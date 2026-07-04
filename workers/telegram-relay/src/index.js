/**
 * Cloudflare Worker: VPS (РФ) → Worker → api.telegram.org
 *
 * Два режима:
 * 1) POST / + Bearer — уведомления о заказах (sendMessage)
 * 2) /{TELEGRAM_RELAY_SECRET}/bot<token>/<method> — полный Bot API для aiogram
 * 3) /{TELEGRAM_RELAY_SECRET}/file/bot<token>/<path> — скачивание файлов (voice, photo)
 *
 * Секреты (wrangler secret put):
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_RELAY_SECRET
 *
 * На VPS (site-api):
 *   TELEGRAM_RELAY_URL=https://telegram-relay.<ваш>.workers.dev
 *   TELEGRAM_RELAY_SECRET=<тот же>
 *
 * На VPS (photo-booking-bot):
 *   TELEGRAM_BOT_PROXY_URL=https://telegram-relay.<ваш>.workers.dev
 *   TELEGRAM_BOT_PROXY_SECRET=<тот же TELEGRAM_RELAY_SECRET>
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

async function proxyBotApi(request, tgPath, search) {
  const tgUrl = `https://api.telegram.org${tgPath}${search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const init = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  try {
    return await fetch(tgUrl, init);
  } catch (e) {
    return json(
      { ok: false, error: "telegram_fetch_failed", message: e?.message || String(e) },
      502,
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const relaySecret = String(env.TELEGRAM_RELAY_SECRET || "").trim();
    const parts = url.pathname.split("/").filter(Boolean);

    const relayAuthorized =
      parts.length >= 2 && relaySecret && timingSafeEqualString(parts[0], relaySecret);

    // Bot API proxy: /{secret}/bot<token>/<method>
    if (relayAuthorized && parts[1]?.startsWith("bot")) {
      const tgPath = `/${parts.slice(1).join("/")}`;
      return proxyBotApi(request, tgPath, url.search);
    }

    // File download: /{secret}/file/bot<token>/<path> (aiogram download_file)
    if (relayAuthorized && parts[1] === "file" && parts[2]?.startsWith("bot")) {
      const tgPath = `/${parts.slice(1).join("/")}`;
      return proxyBotApi(request, tgPath, url.search);
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
      return json({
        ok: true,
        service: "telegram-relay",
        features: ["order-relay", "bot-api-proxy", "file-download-proxy"],
        hint: "POST / with Bearer for orders; /{SECRET}/bot<token>/<method> for Bot API; /{SECRET}/file/bot<token>/<path> for files",
      });
    }

    if (request.method !== "POST" || url.pathname !== "/") {
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }

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
