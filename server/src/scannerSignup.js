/**
 * Пробные регистрации сканера Tenable Nessus.
 * Такие запросы не должны создавать пользователя и не должны уходить в Telegram.
 */

const SCANNER_EMAIL_DOMAINS = ["tenable.com"];

function emailDomain(value) {
  const raw = String(value || "").trim().toLowerCase();
  const at = raw.lastIndexOf("@");
  if (at < 0 || at === raw.length - 1) return "";
  return raw.slice(at + 1).replace(/\.+$/, "");
}

function isScannerEmailDomain(domain) {
  if (!domain) return false;
  return SCANNER_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

const NESSUS_MARK = /nessus/i;

/**
 * @param {unknown} body
 * @returns {"tenable-email" | "nessus-mark" | null}
 */
export function scannerSignupReason(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const emails = [body.email, body.username, body.login];
  if (emails.some((value) => isScannerEmailDomain(emailDomain(value)))) return "tenable-email";
  const marked = [
    body.name,
    body.realname,
    body.username,
    body.comment,
    body.role_name,
    body.company_name,
    body.companyName,
    body.company,
  ];
  if (marked.some((value) => NESSUS_MARK.test(String(value ?? "")))) return "nessus-mark";
  return null;
}

export function isScannerSignupProbe(body) {
  return scannerSignupReason(body) != null;
}
