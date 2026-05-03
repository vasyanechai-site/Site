/**
 * База HTTP API (пути вида `${API_BASE_URL}/retail/orders`).
 * В проде задайте VITE_API_BASE_URL (например https://api.example.com/api).
 * Локально: см. .env.example + прокси Vite на `/api`.
 */
export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

/** Раньше: Bearer anon для Supabase. На своём API не используется. */
export const API_AUTH_HEADER: Record<string, string> = {};
