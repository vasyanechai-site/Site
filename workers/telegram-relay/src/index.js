/**
 * Cloudflare Worker: VPS (РФ) → Worker → api.telegram.org
 *
 * Секреты (wrangler secret put):
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_RELAY_SECRET
 *
 * На VPS:
 *   TELEGRAM_RELAY_URL=https://telegram-relay.<ваш>.workers.dev
 *   TELEGRAM_RELAY_SECRET=<тот же>
 */

function timingSafeEqualString(a, b) {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return json({
        ok: true,
        service: "telegram-relay",
        hint: "POST JSON { text, reply_markup? } with Authorization: Bearer <TELEGRAM_RELAY_SECRET>",
      });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }

    const relaySecret = String(env.TELEGRAM_RELAY_SECRET || "").trim();
    const auth = request.headers.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/i.exec(auth);
    const provided = m ? m[1].trim() : "";
    if (!relaySecret || !timingSafeEqualString(provided, relaySecret)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const token = String(env.TELEGRAM_BOT_TOKEN || "").trim();
    const chatId = String(env.TELEGRAM_CHAT_ID || "").trim();
    if (!token || !chatId) {
      return json({ ok: false, error: "worker_missing_telegram_env" }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    const text = String(body.text ?? "").slice(0, 4090);
    if (!text) {
      return json({ ok: false, error: "missing_text" }, 400);
    }

    const tgPayload = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (body.reply_markup != null && typeof body.reply_markup === "object") {
      tgPayload.reply_markup = body.reply_markup;
    }

    let tgRes;
    try {
      tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tgPayload),
      });
    } catch (e) {
      return json(
        { ok: false, error: "telegram_fetch_failed", message: e?.message || String(e) },
        502,
      );
    }

    const tgData = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok || tgData.ok === false) {
      return json({ ok: false, error: "telegram_api_error", telegram: tgData }, 502);
    }

    return json({ ok: true, result: tgData });
  },
};
