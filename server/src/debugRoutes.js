/**
 * Диагностические маршруты (/api/debug/*). Тесты с побочными эффектами — по DEBUG_SECRET.
 */

import {
  sendTelegramHtml,
  formatWholesaleOrderMessage,
  serializeFetchError,
} from "./telegram.js";

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

function requireDebugSecret(req, res, next) {
  const expected = (process.env.DEBUG_SECRET || "").trim();
  if (!expected) {
    return res.status(503).json({
      error:
        "На сервере не задан DEBUG_SECRET. Добавьте в .env (и при деплое через GitHub Secrets), затем заголовок X-Debug-Secret в запросах с этой страницы.",
    });
  }
  const got = String(req.get("x-debug-secret") || "").trim();
  if (got !== expected) {
    return res.status(401).json({ error: "Неверный или отсутствующий заголовок X-Debug-Secret" });
  }
  next();
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
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 12000);
        const gr = await fetch(url, { signal: ac.signal });
        clearTimeout(timer);
        const gj = await gr.json().catch(() => ({}));
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
    if (!token || !chatId) {
      hints.push(
        "Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID на сервере (файл .env в корне проекта рядом с package.json), затем pm2 restart site-api --update-env.",
      );
    } else {
      hints.push(`TELEGRAM_CHAT_ID: ${chatIdHint(chatId)}`);
      if (getMe && !getMe.ok) {
        hints.push("getMe не прошёл — токен неверный или сеть до api.telegram.org недоступна.");
      } else if (getMe?.ok) {
        hints.push(`Бот @${getMe.username || "?"} — добавьте его в канал админом с правом «Публиковать сообщения».`);
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
      debugSecretConfigured: Boolean((process.env.DEBUG_SECRET || "").trim()),
      getMe,
      hints,
    });
  });

  /** Проверка TCP/TLS до api.telegram.org (без токена в URL). */
  app.post("/api/debug/telegram/network-probe", requireDebugSecret, async (_req, res) => {
    const url = "https://api.telegram.org/";
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 12000);
    try {
      const r = await fetch(url, { method: "GET", signal: ac.signal, redirect: "manual" });
      clearTimeout(timer);
      res.json({
        ok: true,
        telegramHttpStatus: r.status,
        note: "Соединение с api.telegram.org установлено. Если ping всё ещё падает — смотрите errorSummary в ответе ping.",
      });
    } catch (e) {
      clearTimeout(timer);
      res.json({ ok: false, url, ...serializeFetchError(e) });
    }
  });

  app.post("/api/debug/telegram/ping", requireDebugSecret, async (req, res) => {
    const message =
      (req.body && typeof req.body.message === "string" && req.body.message.trim()) ||
      "🔧 <b>Тест Telegram</b>\nСообщение со страницы /debug API.";
    const result = await sendTelegramHtml(message.slice(0, 4000));
    res.json({ ok: result.ok, result });
  });

  app.post("/api/debug/telegram/wholesale-sample", requireDebugSecret, async (req, res) => {
    const html = formatWholesaleOrderMessage(sampleWholesaleOrder());
    const result = await sendTelegramHtml(html);
    res.json({ ok: result.ok, result, htmlChars: html.length });
  });
}
