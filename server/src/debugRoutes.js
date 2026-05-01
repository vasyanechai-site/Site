/**
 * Диагностические маршруты (/api/debug/*). Тесты с побочными эффектами — по DEBUG_SECRET.
 */

import {
  sendTelegramHtml,
  formatWholesaleOrderMessage,
  serializeFetchError,
} from "./telegram.js";

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
  app.get("/api/debug/telegram/status", (_req, res) => {
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
    res.json({
      hasToken: Boolean(token),
      hasChatId: Boolean(chatId),
      tokenLength: token.length,
      chatIdLength: chatId.length,
      tokenPreview: token ? maskMiddle(token, 6) : null,
      chatIdPreview: chatId ? maskMiddle(chatId, 4) : null,
      nodeEnv: process.env.NODE_ENV || "",
      debugSecretConfigured: Boolean((process.env.DEBUG_SECRET || "").trim()),
      hints: [
        !token || !chatId
          ? "Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID на сервере, затем pm2 restart site-api --update-env."
          : "Переменные заданы. Ошибка fetch failed: часто блок исходящего HTTPS или IPv6 — на API включён приоритет IPv4; проверьте firewall до api.telegram.org:443. Для канала chat_id вида -100…; бот — админ канала.",
      ],
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
