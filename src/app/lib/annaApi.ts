const STORAGE_KEY = "annaAdminToken";

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

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function annaLogin(password: string) {
  const data = await annaFetch("/api/anna/auth", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  setAnnaToken(data.token);
  return data;
}

export async function fetchAnnaStats() {
  return annaFetch("/api/anna/stats");
}

export async function fetchAnnaCalendar(month: string) {
  return annaFetch(`/api/anna/calendar?month=${month}`);
}

export async function fetchAnnaSlots(date?: string) {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  return annaFetch(`/api/anna/slots${q}`);
}

export async function fetchAnnaBookings(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return annaFetch(`/api/anna/bookings${qs ? `?${qs}` : ""}`);
}

export async function createAnnaSlot(date: string, time: string) {
  return annaFetch("/api/anna/slots", {
    method: "POST",
    body: JSON.stringify({ date, time }),
  });
}

export async function createAnnaSlotsBulk(text: string) {
  return annaFetch("/api/anna/slots/bulk", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function deleteAnnaSlot(id: number) {
  return annaFetch(`/api/anna/slots/${id}`, { method: "DELETE" });
}

export async function updateAnnaBooking(
  id: number,
  payload: { status?: string; adminComment?: string }
) {
  return annaFetch(`/api/anna/bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAnnaConfig() {
  return annaFetch("/api/anna/config");
}
