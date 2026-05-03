import { API_BASE_URL } from './backendConfig';

const STORAGE_KEY = 'nechai-retail-auth';

export type RetailAuthUser = {
  id: string;
  email: string;
  name?: string;
  role?: string;
};

export type RetailAuthPayload = {
  access_token: string;
  user: RetailAuthUser;
};

function emitChange() {
  window.dispatchEvent(new Event('nechai-retail-auth-changed'));
}

export function getRetailAuth(): RetailAuthPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as RetailAuthPayload;
    if (!p?.access_token || !p?.user?.id) return null;
    return p;
  } catch {
    return null;
  }
}

export function setRetailAuth(payload: RetailAuthPayload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  emitChange();
}

export function clearRetailAuth() {
  localStorage.removeItem(STORAGE_KEY);
  emitChange();
}

export function getRetailAccessToken(): string | null {
  return getRetailAuth()?.access_token ?? null;
}

/** Форма, совместимая с прежним `User` из Supabase (id, email, user_metadata). */
export function getRetailSessionUser(): {
  id: string;
  email?: string;
  user_metadata?: { name?: string };
} | null {
  const p = getRetailAuth();
  if (!p?.user) return null;
  const { id, email, name } = p.user;
  const display = name || (email ? email.split('@')[0] : '') || 'Пользователь';
  return {
    id,
    email,
    user_metadata: { name: display },
  };
}

export function authHeaderRetail(): Record<string, string> {
  const t = getRetailAccessToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function loginRetail(email: string, password: string): Promise<RetailAuthPayload> {
  const res = await fetch(`${API_BASE_URL}/auth/retail/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Ошибка входа (${res.status})`);
  }
  if (!data.access_token || !data.user?.id) {
    throw new Error('Сервер вернул некорректный ответ');
  }
  const user: RetailAuthUser = {
    id: data.user.id,
    email: data.user.email || email.trim(),
    name: data.user.name,
    role: data.user.role,
  };
  const payload: RetailAuthPayload = { access_token: data.access_token, user };
  setRetailAuth(payload);
  return payload;
}
