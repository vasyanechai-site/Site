/**
 * Утилита для автоматической проверки и исправления проблем с кодировкой
 * 
 * Эта утилита помогает обнаруживать и исправлять битые символы кодировки
 * в текстовых значениях приложения.
 */

/**
 * Проверяет строку на наличие битых символов кодировки
 * Проверяет только символ замены Unicode U+FFFD, не обычную кириллицу
 */
export function hasBrokenEncoding(text: string): boolean {
  // Проверяем только на символ замены Unicode U+FFFD
  // НЕ на обычные кириллические символы!
  return text.includes('\uFFFD');
}

/**
 * Нормализует Unicode строку в NFC форму
 * Это помогает устранить проблемы с составными символами
 */
export function normalizeText(text: string): string {
  return text.normalize('NFC');
}

/**
 * Очищает текст от битых символов и невидимых символов
 */
export function cleanText(text: string): string {
  let cleaned = text;
  
  // Удаляем битые символы замены
  cleaned = cleaned.replace(/\uFFFD/g, '');
  
  // Нормализуем Unicode
  cleaned = normalizeText(cleaned);
  
  // Удаляем невидимые символы (кроме обычных пробелов)
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  return cleaned.trim();
}

/**
 * Проверяет объект на наличие битых символов в строковых значениях
 */
export function checkObjectForBrokenEncoding(
  obj: Record<string, unknown>,
  path: string = ''
): Array<{ path: string; value: string }> {
  const issues: Array<{ path: string; value: string }> = [];

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof value === 'string') {
      if (hasBrokenEncoding(value)) {
        issues.push({ path: currentPath, value });
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      issues.push(...checkObjectForBrokenEncoding(value as Record<string, unknown>, currentPath));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string' && hasBrokenEncoding(item)) {
          issues.push({ path: `${currentPath}[${index}]`, value: item });
        } else if (item && typeof item === 'object') {
          issues.push(...checkObjectForBrokenEncoding(item as Record<string, unknown>, `${currentPath}[${index}]`));
        }
      });
    }
  }

  return issues;
}

/**
 * Проверяет шрифт на поддержку кириллицы
 */
export function checkFontCyrillicSupport(fontFamily: string): boolean {
  // Список шрифтов, которые гарантированно поддерживают кириллицу
  const cyrillicSupportedFonts = [
    'manrope',
    'roboto',
    'open sans',
    'pt sans',
    'pt serif',
    'noto sans',
    'arial',
    'times new roman',
    'georgia',
    'verdana',
    'courier new',
    'system-ui',
    'oxygen',
    '-apple-system',
    'blinkmacsystemfont',
    'segoe ui',
    'ubuntu',
    'cantarell',
    'sans-serif',
    'serif',
    'monospace'
  ];

  const normalizedFont = fontFamily.toLowerCase().trim();
  
  // Mabry Pro специально использует только латиницу по дизайну,
  // но у нас есть fallback на Manrope для кириллицы - это ОК
  if (normalizedFont.includes('mabry')) {
    return true; // Считаем OK, так как есть fallback
  }
  
  return cyrillicSupportedFonts.some(font => normalizedFont.includes(font));
}

/**
 * Автоматический отчет о проблемах с кодировкой
 */
export function generateEncodingReport(data: Record<string, unknown>): {
  hasIssues: boolean;
  issues: Array<{ path: string; value: string }>;
  report: string;
} {
  const issues = checkObjectForBrokenEncoding(data);
  const hasIssues = issues.length > 0;

  let report = '=== Отчет о проверке кодировки ===\n\n';
  
  if (hasIssues) {
    report += `❌ Найдено проблем: ${issues.length}\n\n`;
    issues.forEach(({ path, value }, index) => {
      report += `${index + 1}. Путь: ${path}\n`;
      report += `   Значение: "${value}"\n`;
      report += `   Битые символы: ${value.match(/\uFFFD/g)?.join(', ')}\n\n`;
    });
  } else {
    report += '✅ Проблем с кодировкой не обнаружено\n';
  }

  return { hasIssues, issues, report };
}

/**
 * Middleware для автоматической очистки данных перед сохранением
 */
export function sanitizeForStorage<T extends Record<string, unknown>>(data: T): T {
  const sanitized = { ...data };

  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      sanitized[key] = cleanText(value) as T[Extract<keyof T, string>];
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeForStorage(value as Record<string, unknown>) as T[Extract<keyof T, string>];
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? cleanText(item) : 
        (item && typeof item === 'object' ? sanitizeForStorage(item as Record<string, unknown>) : item)
      ) as T[Extract<keyof T, string>];
    }
  }

  return sanitized;
}

// Экспорт функции для использования в development mode
if (typeof window !== 'undefined') {
  (window as Window & { __encodingCheck?: typeof checkObjectForBrokenEncoding }).__encodingCheck = checkObjectForBrokenEncoding;
}