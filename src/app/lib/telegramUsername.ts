/** Публичный @username Telegram (как на сервере). */

export function normalizeTelegramUsernameInput(raw: string): string {
  return raw.replace(/^@+/g, "").trim().toLowerCase();
}

export function isValidTelegramUsername(raw: string): boolean {
  const h = normalizeTelegramUsernameInput(raw);
  return /^[a-z][a-z0-9_]{4,31}$/.test(h);
}
