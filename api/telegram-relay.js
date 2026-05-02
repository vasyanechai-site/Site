/**
 * Vercel Serverless: принимает HTML-текст от вашего VPS и вызывает Telegram Bot API.
 * Env на Vercel: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_RELAY_SECRET (длинная случайная строка).
 * VPS: TELEGRAM_RELAY_URL=https://<project>.vercel.app/api/telegram-relay, TELEGRAM_RELAY_SECRET=<тот же секрет>.
 */

import crypto from "crypto";

function timingSafeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const secret = String(process.env.TELEGRAM_RELAY_SECRET || "").trim();
  const auth = String(req.headers.authorization || "");
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  const provided = m ? m[1].trim() : "";
  if (!secret || !timingSafeEqualString(provided, secret)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId) {
    return res.status(500).json({ ok: false, error: "server_missing_telegram_env" });
  }

  const body = await readJsonBody(req);
  if (body === null) {
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }
  const text = String(body.text ?? "").slice(0, 4090);
  if (!text) {
    return res.status(400).json({ ok: false, error: "missing_text" });
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  let tgRes;
  try {
    tgRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
    return res.status(502).json({ ok: false, error: "telegram_fetch_failed", message: msg });
  }

  const tgData = await tgRes.json().catch(() => ({}));
  if (!tgRes.ok || tgData.ok === false) {
    return res.status(502).json({ ok: false, error: "telegram_api_error", telegram: tgData });
  }
  return res.status(200).json({ ok: true, result: tgData });
}
