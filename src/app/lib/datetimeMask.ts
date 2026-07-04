/** Маски даты ДД.ММ.ГГГГ и времени ЧЧ:ММ — ввод только цифрами. */

export function parseDateDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

export function formatDateDisplay(digits: string): string {
  if (!digits) return "";
  let out = digits.slice(0, 2);
  if (digits.length <= 2) return out;
  out += `.${digits.slice(2, 4)}`;
  if (digits.length <= 4) return out;
  out += `.${digits.slice(4, 8)}`;
  return out;
}

export function parseTimeDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

export function formatTimeDisplay(digits: string): string {
  if (!digits) return "";
  let out = digits.slice(0, 2);
  if (digits.length <= 2) return out;
  out += `:${digits.slice(2, 4)}`;
  return out;
}

export function isCompleteDateDigits(digits: string): boolean {
  return digits.length === 8;
}

export function isCompleteTimeDigits(digits: string): boolean {
  return digits.length === 4;
}

export function validateDateDigits(digits: string): string | null {
  if (!isCompleteDateDigits(digits)) {
    return "Введите дату полностью — 8 цифр (например 23072026)";
  }
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (month < 1 || month > 12) return "Месяц должен быть от 01 до 12";
  if (day < 1 || day > 31) return "День должен быть от 01 до 31";
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return "Такой даты не существует";
  }
  if (year < 2024 || year > 2100) return "Проверьте год";
  return null;
}

export function validateTimeDigits(digits: string): string | null {
  if (!isCompleteTimeDigits(digits)) {
    return "Введите время полностью — 4 цифры (например 1700)";
  }
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2, 4));
  if (hour > 23) return "Часы от 00 до 23";
  if (minute > 59) return "Минуты от 00 до 59";
  return null;
}

export function validateFutureSlot(dateDigits: string, timeDigits: string): string | null {
  const day = Number(dateDigits.slice(0, 2));
  const month = Number(dateDigits.slice(2, 4));
  const year = Number(dateDigits.slice(4, 8));
  const hour = Number(timeDigits.slice(0, 2));
  const minute = Number(timeDigits.slice(2, 4));
  const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (dt.getTime() <= Date.now()) return "Слот должен быть в будущем";
  return null;
}

export function dateDigitsToApi(digits: string): string {
  return formatDateDisplay(digits);
}

export function timeDigitsToApi(digits: string): string {
  return formatTimeDisplay(digits);
}

const FORMATTED_SLOT_LINE = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/;

export function normalizeBulkSlotLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return "";

  if (FORMATTED_SLOT_LINE.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 12) {
    const d = digits.slice(0, 12);
    return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 8)} ${d.slice(8, 10)}:${d.slice(10, 12)}`;
  }

  return trimmed;
}

export function normalizeBulkSlotText(text: string): string {
  return text
    .split("\n")
    .map((line) => normalizeBulkSlotLine(line))
    .join("\n");
}

export function validateBulkSlotText(text: string): string | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return "Добавьте хотя бы одну строку";

  for (const line of lines) {
    if (!FORMATTED_SLOT_LINE.test(line)) {
      return `Неверный формат: «${line}». Нужно 12 цифр подряд или ДД.ММ.ГГГГ ЧЧ:ММ`;
    }
    const [, dd, mm, yyyy, hh, min] = line.match(FORMATTED_SLOT_LINE)!;
    const dateErr = validateDateDigits(`${dd}${mm}${yyyy}`);
    if (dateErr) return `${line}: ${dateErr}`;
    const timeErr = validateTimeDigits(`${hh}${min}`);
    if (timeErr) return `${line}: ${timeErr}`;
  }

  return null;
}
