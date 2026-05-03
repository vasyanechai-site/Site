/**
 * Supabase Edge Function: VPS шлёт сюда HTML, функция вызывает Telegram Bot API.
 * Secrets (Dashboard → Edge Functions → Secrets или `supabase secrets set`):
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_RELAY_SECRET
 * VPS: TELEGRAM_RELAY_URL=https://<ref>.supabase.co/functions/v1/telegram-relay
 *      TELEGRAM_RELAY_SECRET=<тот же>
 */

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i]! ^ bb[i]!;
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST" },
    });
  }

  const relaySecret = (Deno.env.get("TELEGRAM_RELAY_SECRET") ?? "").trim();
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  const provided = m ? m[1].trim() : "";
  if (!relaySecret || !timingSafeEqualString(provided, relaySecret)) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = (Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "").trim();
  const chatId = (Deno.env.get("TELEGRAM_CHAT_ID") ?? "").trim();
  if (!token || !chatId) {
    return new Response(JSON.stringify({ ok: false, error: "server_missing_telegram_env" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const text = String(body.text ?? "").slice(0, 4090);
  if (!text) {
    return new Response(JSON.stringify({ ok: false, error: "missing_text" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  let tgRes: Response;
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
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: "telegram_fetch_failed", message: msg }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tgData = await tgRes.json().catch(() => ({}));
  if (!tgRes.ok || tgData.ok === false) {
    return new Response(JSON.stringify({ ok: false, error: "telegram_api_error", telegram: tgData }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, result: tgData }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
