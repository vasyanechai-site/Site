import { API_BASE_URL } from "./backendConfig";

const STORAGE_KEY = "annaAdminToken";
const ANNA_API = `${API_BASE_URL}/anna`;

export function getAnnaToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setAnnaToken(token: string) {
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function clearAnnaToken() {
  sessionStorage.removeItem(STORAGE_KEY);
}

async function annaFetch(path: string, options: RequestInit = {}) {
  const token = getAnnaToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${ANNA_API}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...options, headers });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      "Сервер вернул некорректный ответ. Убедитесь, что API обновлён на VPS."
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function annaLogin(password: string) {
  const data = await annaFetch("/auth", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  if (!data.token) {
    throw new Error("Не удалось получить токен авторизации");
  }
  setAnnaToken(data.token);
  return data;
}

export async function fetchAnnaStats() {
  return annaFetch("/stats");
}

export async function fetchAnnaCalendar(month: string) {
  return annaFetch(`/calendar?month=${encodeURIComponent(month)}`);
}

export async function fetchAnnaSlots(date?: string) {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  const data = await annaFetch(`/slots${q}`);
  return Array.isArray(data) ? data : [];
}

export async function fetchAnnaBookings(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const data = await annaFetch(`/bookings${qs ? `?${qs}` : ""}`);
  return Array.isArray(data) ? data : [];
}

export async function createAnnaSlot(date: string, time: string) {
  return annaFetch("/slots", {
    method: "POST",
    body: JSON.stringify({ date, time }),
  });
}

export async function createAnnaSlotsBulk(text: string) {
  return annaFetch("/slots/bulk", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function deleteAnnaSlot(id: number) {
  return annaFetch(`/slots/${id}`, { method: "DELETE" });
}

export async function updateAnnaBooking(
  id: number,
  payload: { status?: string; adminComment?: string }
) {
  return annaFetch(`/bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAnnaSyncStatus() {
  return annaFetch("/sync-status");
}

export async function fetchAnnaSettings() {
  return annaFetch("/settings");
}

export async function updateAnnaSettings(payload: {
  fullPrice?: number;
  prepayPercent?: number;
}) {
  return annaFetch("/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchChannelStats() {
  return annaFetch("/channel/stats");
}

export async function fetchChannelSubscribers(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const data = await annaFetch(`/channel/subscribers${qs ? `?${qs}` : ""}`);
  return Array.isArray(data) ? data : [];
}

export async function channelSubscriberAction(id: number, action: string) {
  return annaFetch(`/channel/subscribers/${id}/${action}`, { method: "POST" });
}

export async function patchChannelSettings(body: {
  monthlyPrice?: number;
  channelTelegramId?: string;
}) {
  return annaFetch("/channel/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** @deprecated use fetchAnnaSettings */
export async function fetchAnnaConfig() {
  return fetchAnnaSettings();
}
