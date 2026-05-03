/**
 * Лёгкий ping для активности проекта Supabase (бесплатный тариф — пауза после ~7 дней без запросов).
 * Вызывайте по расписанию из GitHub Actions: GET …/functions/v1/keepalive
 */

Deno.serve(() =>
  new Response(JSON.stringify({ ok: true, service: "keepalive" }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  }),
);
