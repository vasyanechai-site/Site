import { projectId, publicAnonKey } from "../utils/supabase/info";

/**
 * Единая база API для фронта (розница, СДЭК, оплата, админ).
 * Должна совпадать с дефолтом в RetailStorefront: иначе заказы уходят на Supabase/VPS,
 * а `/cdek/*` оказываются на другом origin (`/api` без прокси).
 */
export const API_BASE_URL = String(
  import.meta.env.VITE_API_BASE_URL ||
    `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09`,
).replace(/\/+$/, "");

export const API_AUTH_HEADER = API_BASE_URL.includes("supabase.co")
  ? { Authorization: `Bearer ${publicAnonKey}` }
  : {};
