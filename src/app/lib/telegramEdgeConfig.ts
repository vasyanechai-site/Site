/**
 * Опциональная база для админских вызовов Telegram (рассылка, webhook setup),
 * если они ещё на отдельном Edge (например Supabase). Основной сайт — `VITE_API_BASE_URL`.
 */
export const TELEGRAM_EDGE_BASE_URL = String(
  import.meta.env.VITE_TELEGRAM_EDGE_BASE_URL || '',
).replace(/\/+$/, '');

/** Если Edge требует `Authorization: Bearer …` (anon key проекта). */
export const TELEGRAM_EDGE_ANON_KEY = String(
  import.meta.env.VITE_TELEGRAM_EDGE_ANON_KEY || '',
).trim();

export function telegramEdgeHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (TELEGRAM_EDGE_ANON_KEY) h.Authorization = `Bearer ${TELEGRAM_EDGE_ANON_KEY}`;
  return h;
}
