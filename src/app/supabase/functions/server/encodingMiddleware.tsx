/**
 * Middleware для автоматической проверки и очистки данных от битой кодировки
 */

// Паттерн для обнаружения битых символов кодировки
const BROKEN_ENCODING_PATTERN = /\uFFFD|�/g;

/**
 * Проверяет строку на наличие битых символов кодировки
 */
export function hasBrokenEncoding(text: string): boolean {
  return BROKEN_ENCODING_PATTERN.test(text);
}

/**
 * Нормализует Unicode строку в NFC форму
 */
export function normalizeText(text: string): string {
  return text.normalize('NFC');
}

/**
 * Очищает текст от битых символов
 */
export function cleanText(text: string): string {
  let cleaned = text;
  
  // Удаляем битые символы замены
  cleaned = cleaned.replace(/\uFFFD/g, '');
  cleaned = cleaned.replace(/�/g, '');
  
  // Нормализуем Unicode
  cleaned = normalizeText(cleaned);
  
  // Удаляем невидимые символы (кроме обычных пробелов)
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  return cleaned.trim();
}

/**
 * Рекурсивная очистка объекта от битых символов
 */
export function sanitizeData<T>(data: T): T {
  if (typeof data === 'string') {
    return cleanText(data) as T;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item)) as T;
  }
  
  if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeData(value);
    }
    return sanitized as T;
  }
  
  return data;
}

/**
 * Проверяет объект на наличие битых символов и выводит отчет
 */
export function checkAndReport(data: unknown, context: string): {
  hasIssues: boolean;
  cleanedData: unknown;
} {
  const issues: string[] = [];
  
  const check = (obj: unknown, path: string = ''): void => {
    if (typeof obj === 'string') {
      if (hasBrokenEncoding(obj)) {
        issues.push(`${path}: "${obj}"`);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => check(item, `${path}[${index}]`));
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        check(value, path ? `${path}.${key}` : key);
      }
    }
  };
  
  check(data);
  
  if (issues.length > 0) {
    console.warn(`[Encoding Check] ${context}: Found ${issues.length} encoding issues:`);
    issues.forEach(issue => console.warn(`  - ${issue}`));
  }
  
  return {
    hasIssues: issues.length > 0,
    cleanedData: sanitizeData(data)
  };
}

/**
 * Middleware для Hono - автоматическая очистка входящих данных
 */
export async function encodingMiddleware(c: any, next: () => Promise<void>) {
  // Проверяем и очищаем тело запроса если это POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
    try {
      const body = await c.req.json();
      const { hasIssues, cleanedData } = checkAndReport(body, `${c.req.method} ${c.req.url}`);
      
      if (hasIssues) {
        console.log('[Encoding Middleware] Data was automatically cleaned');
        // Заменяем body на очищенные данные
        c.req.bodyCache = { bodyCache: JSON.stringify(cleanedData), parsedBody: cleanedData };
      }
    } catch (e) {
      // Если не JSON, пропускаем
    }
  }
  
  await next();
}
