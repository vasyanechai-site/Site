/** Логин опта: 11 цифр, ведущая 8 (как на форме заявки). */

const PASSWORD_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function normalizeWholesaleLoginPhone(raw) {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) return d;
  if (d.length === 11 && d.startsWith("7")) return `8${d.slice(1)}`;
  if (d.length === 10 && d.startsWith("9")) return `8${d}`;
  return "";
}

/** 6 символов: строчные латинские буквы и цифры. */
export function generateWholesaleAccessPassword6() {
  let s = "";
  for (let i = 0; i < 6; i += 1) {
    s += PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)];
  }
  return s;
}

export function wholesaleLoginPhonesMatch(a, b) {
  const na = normalizeWholesaleLoginPhone(a);
  const nb = normalizeWholesaleLoginPhone(b);
  return Boolean(na && nb && na === nb);
}

/**
 * Публичный @username Telegram: 5–32 символа, a–z, 0–9, _, с буквы (правила Telegram).
 * @returns {{ handle: string, display: string, url: string } | null}
 */
export function parseTelegramPublicUsername(raw) {
  const h = String(raw ?? "")
    .replace(/^@+/g, "")
    .trim()
    .toLowerCase();
  if (!h) return null;
  if (!/^[a-z][a-z0-9_]{4,31}$/.test(h)) return null;
  return {
    handle: h,
    display: `@${h}`,
    url: `https://t.me/${encodeURIComponent(h)}`,
  };
}
