/**
 * Cloudflare Worker: VPS (РФ) → Worker → api.telegram.org
 *
 * Проксирует все методы Bot API (getUpdates, sendMessage, …) для aiogram polling.
 * Секрет в URL-пути (aiogram TelegramAPIServer.from_base):
 *   https://telegram-bot-proxy.<account>.workers.dev/<SECRET>/bot<token>/getUpdates
 *
 * Секрет worker (wrangler secret put):
 *   TELEGRAM_BOT_PROXY_SECRET  (или TELEGRAM_RELAY_SECRET — тот же, что для relay)
 *
 * На VPS (photo-booking-bot/.env):
 *   TELEGRAM_BOT_PROXY_URL=https://telegram-bot-proxy.<account>.workers.dev
 *   TELEGRAM_BOT_PROXY_SECRET=<тот же секрет>
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
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
      return json({
        ok: true,
        service: "telegram-bot-proxy",
        hint: "Proxy Bot API: /<SECRET>/bot<token>/<method>",
      });
    }

    const expectedSecret = String(
      env.TELEGRAM_BOT_PROXY_SECRET || env.TELEGRAM_RELAY_SECRET || "",
    ).trim();
    if (!expectedSecret) {
      return json({ ok: false, error: "worker_missing_secret" }, 500);
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return json({ ok: false, error: "bad_path" }, 404);
    }

    const providedSecret = parts[0];
    if (!timingSafeEqualString(providedSecret, expectedSecret)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const tgPath = `/${parts.slice(1).join("/")}`;
    if (!tgPath.startsWith("/bot")) {
      return json({ ok: false, error: "forbidden_path" }, 403);
    }

    const tgUrl = `https://api.telegram.org${tgPath}${url.search}`;
    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);

    const init = {
      method: request.method,
      headers,
    };
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
  },
};
