/**
 * Диагностические маршруты (/api/debug/*). POST-тесты Telegram без секрета — ограничьте доступ к API (сеть / файрвол), если нужно.
 */

import {
  sendTelegramHtml,
  formatWholesaleOrderMessage,
  serializeFetchError,
} from "./telegram.js";
import { ipv4HttpsRequest } from "./ipv4Https.js";

function chatIdHint(chatId) {
  const s = String(chatId || "").trim();
  if (!s) return "chat_id пустой";
  if (s.startsWith("-100")) return "похоже на канал / супергруппу (часто то, что нужно для общей ленты заявок)";
  if (s.startsWith("-")) return "отрицательный id (группа или старый формат)";
  if (/^\d+$/.test(s) && s.length < 12) return "похоже на личный user id — в канал так не доставится; нужен id канала вида -100…";
  return "проверьте, что бот админ канала с правом публиковать";
}

function maskMiddle(s, keep = 4) {
  if (!s || typeof s !== "string") return "";
  const t = s.trim();
  if (t.length <= keep * 2) return "•".repeat(Math.min(t.length, 8));
  return `${t.slice(0, keep)}…${t.slice(-keep)}`;
}

function sampleWholesaleOrder() {
  return {
    orderId: `DEBUG-ORD-${Date.now()}`,
    date: new Date().toISOString(),
    orderType: "wholesale",
    company: "ООО «Отладка Telegram»",
    inn: "7707083893",
    account: "40702810900000000001",
    bik: "044525225",
    contact: "Тестовый контакт",
    phone: "+79991234567",
    address: "г. Москва, ул. Примерная, д. 1",
    delivery_address: "г. Москва, ул. Доставки, д. 2",
    delivery_company: "СДЭК",
    delivery_method: "ПВЗ",
    items: [
      {
        name: "Тестовая позиция",
        type: "grain",
        kg: 2,
        packs200: 1,
        subtotal: 5000,
        category: "Фильтр",
      },
    ],
    total: 5000,
  };
}

/** @param {import("express").Express} app */
export function registerDebugRoutes(app) {
  app.get("/api/debug/telegram/status", async (_req, res) => {
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();

    let getMe = null;
    if (token) {
      try {
        const url = `https://api.telegram.org/bot${token}/getMe`;
        const gr = await ipv4HttpsRequest(url, { method: "GET" });
        const gj = await gr.json();
        getMe = {
          http: gr.status,
          ok: gj.ok === true,
          username: gj.result?.username,
          botId: gj.result?.id,
          error: gj.ok ? undefined : gj.description || gj,
        };
      } catch (e) {
        getMe = { ok: false, ...serializeFetchError(e) };
      }
    }

    const hints = [];
    const proxyOn = Boolean((process.env.TELEGRAM_HTTPS_PROXY || process.env.HTTPS_PROXY || "").trim());
    const getMeTimeout =
      getMe &&
      !getMe.ok &&
      (getMe.codes?.includes("ETIMEDOUT") ||
        String(getMe.errorSummary || "").includes("ETIMEDOUT"));

    if (!token || !chatId) {
      hints.push(
        "Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID на сервере (файл .env в корне проекта рядом с package.json), затем pm2 restart site-api --update-env.",
      );
    } else {
      hints.push(`TELEGRAM_CHAT_ID: ${chatIdHint(chatId)}`);
      if (getMeTimeout) {
        hints.push(
          "Сеть: ETIMEDOUT до api.telegram.org — с этого VPS, скорее всего, блокируют исходящий доступ к Telegram (это не «неверный токен»). Варианты: открыть у хостинга api.telegram.org:443; задать TELEGRAM_HTTPS_PROXY; вынести отправку на другой сервер.",
        );
      } else if (getMe && !getMe.ok) {
        hints.push("getMe не прошёл — проверьте TELEGRAM_BOT_TOKEN или текст ошибки в поле error.");
      } else if (getMe?.ok) {
        hints.push(`Бот @${getMe.username || "?"} — добавьте его в канал админом с правом «Публиковать сообщения».`);
      }
      if (getMeTimeout && !proxyOn) {
        hints.push(
          "Прокси: в .env задайте TELEGRAM_HTTPS_PROXY (или HTTPS_PROXY), например http://user:pass@proxy.example:8080 — npm-пакет https-proxy-agent уже в зависимостях.",
        );
      }
    }

    res.json({
      hasToken: Boolean(token),
      hasChatId: Boolean(chatId),
      tokenLength: token.length,
      chatIdLength: chatId.length,
      tokenPreview: token ? maskMiddle(token, 6) : null,
      chatIdPreview: chatId ? maskMiddle(chatId, 4) : null,
      nodeEnv: process.env.NODE_ENV || "",
      outboundProxyConfigured: proxyOn,
      getMe,
      hints,
    });
  });

  /** Проверка TCP/TLS до api.telegram.org (без токена в URL). */
  app.post("/api/debug/telegram/network-probe", async (_req, res) => {
    const url = "https://api.telegram.org/";
    try {
      const r = await ipv4HttpsRequest(url, { method: "GET" });
      res.json({
        ok: true,
        telegramHttpStatus: r.status,
        note: "Соединение с api.telegram.org установлено (IPv4). Если раньше был ETIMEDOUT через fetch — проверьте ping снова.",
      });
    } catch (e) {
      res.json({
        ok: false,
        url,
        ...serializeFetchError(e),
        hint: "Если снова ETIMEDOUT — у провайдера/VPS закрыт исходящий HTTPS к api.telegram.org; нужен другой хостинг или HTTP(S)-прокси.",
      });
    }
  });

  app.post("/api/debug/telegram/ping", async (req, res) => {
    const message =
      (req.body && typeof req.body.message === "string" && req.body.message.trim()) ||
      "🔧 <b>Тест Telegram</b>\nСообщение со страницы /debug API.";
    const result = await sendTelegramHtml(message.slice(0, 4000));
    res.json({ ok: result.ok, result });
  });

  app.post("/api/debug/telegram/wholesale-sample", async (req, res) => {
    const html = formatWholesaleOrderMessage(sampleWholesaleOrder());
    const result = await sendTelegramHtml(html);
    res.json({ ok: result.ok, result, htmlChars: html.length });
  });
}
