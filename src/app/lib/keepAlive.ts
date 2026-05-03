import { API_BASE_URL } from './backendConfig';

const KEEP_ALIVE_KEY = 'nechai_last_keep_alive';
const KEEP_ALIVE_INTERVAL = 5 * 24 * 60 * 60 * 1000; // 5 дней

/**
 * Лёгкий пинг API (свой сервер), чтобы не «засыпал» хостинг при длительном простое.
 */
export async function autoKeepAlive(): Promise<void> {
  try {
    const lastKeepAlive = localStorage.getItem(KEEP_ALIVE_KEY);
    const now = Date.now();

    if (!lastKeepAlive || now - parseInt(lastKeepAlive, 10) > KEEP_ALIVE_INTERVAL) {
      const response = await fetch(`${API_BASE_URL}/keep-alive`, { method: 'GET' });
      if (response.ok) {
        localStorage.setItem(KEEP_ALIVE_KEY, now.toString());
      }
    }
  } catch {
    /* ignore */
  }
}
