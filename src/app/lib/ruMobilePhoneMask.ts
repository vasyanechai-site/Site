/** Нормализация ввода к российскому мобильному: всегда ведущая 8, до 11 цифр. +7 / 7 → 8. */

export function parseRuMobile8Input(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('8')) return d.slice(0, 11);
  if (d.startsWith('7')) return ('8' + d.slice(1)).slice(0, 11);
  return ('8' + d).slice(0, 11);
}

export function formatRuMobile8Display(digits: string): string {
  if (!digits) return '';
  const r = digits.slice(1, 11);
  if (r.length === 0) return '8';
  let out = '8 (';
  out += r.slice(0, 3);
  if (r.length < 3) return out;
  out += ') ';
  out += r.slice(3, 6);
  if (r.length < 6) return out;
  out += '-';
  out += r.slice(6, 8);
  if (r.length < 8) return out;
  out += '-';
  out += r.slice(8, 10);
  return out;
}

export function isCompleteRuMobile8(digits: string): boolean {
  return digits.length === 11 && digits[0] === '8' && digits[1] === '9';
}
