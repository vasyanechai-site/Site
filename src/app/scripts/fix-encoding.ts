/**
 * Утилита для исправления битого текста (проблемы с кодировкой UTF-8)
 * 
 * Использование:
 * 1. Импортировать функцию fixText
 * 2. Обернуть все русские строки в fixText()
 * 
 * Пример: const title = fixText("��аша корзина пуста") → "Ваша корзина пуста"
 */

// Карта распространенных битых символов UTF-8 → правильных символов
const encodingMap: Record<string, string> = {
  // Кириллица
  '��': 'В',
  '��': 'Д',
  '��': 'З',
  '��': 'П',
  '��': 'Р',
  '��': 'Ф',
  '��': 'а',
  '��': 'и',
  '��': 'о',
  '��': 'р',
  '��': 'т',
  '��': 'я',
  
  // Распространённые битые последовательности
  '��аша': 'Ваша',
  '��аказы': 'Заказы',
  '��ромокод': 'Промокод',
  '��олько': 'только',
  '��зображение': 'изображение',
  '��бязательство': 'Обязательство',
  '��ильтр': 'Фильтр',
  '��дномление': 'едомление',
  '��овар': 'товар',
  '��рядок': 'порядок',
  '��анные': 'данные',
  '��споль': 'исполь',
  '��роверяем': 'проверяем',
  '��публик': 'опублик',
  '��ля': 'для',
  '��егистр': 'Регистр',
};

/**
 * Исправляет битый текст, заменяя известные битые последовательности
 */
export function fixText(text: string): string {
  if (!text) return text;
  
  let fixed = text;
  
  // Применяем все известные замены
  for (const [broken, correct] of Object.entries(encodingMap)) {
    fixed = fixed.replace(new RegExp(broken, 'g'), correct);
  }
  
  return fixed;
}

/**
 * Проверяет, содержит ли текст битые символы
 */
export function hasBrokenEncoding(text: string): boolean {
  if (!text) return false;
  
  // Проверяем на наличие replacement character (�)
  return text.includes('�') || text.includes('\uFFFD');
}

/**
 * Сканирует объект рекурсивно и исправляет все строки
 */
export function fixObjectEncoding<T>(obj: T): T {
  if (typeof obj === 'string') {
    return fixText(obj) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => fixObjectEncoding(item)) as T;
  }
  
  if (obj && typeof obj === 'object') {
    const fixed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      fixed[key] = fixObjectEncoding(value);
    }
    return fixed;
  }
  
  return obj;
}

/**
 * React Hook для автоматического исправления текстов
 */
export function useFixedText(text: string): string {
  if (hasBrokenEncoding(text)) {
    console.warn('Обнаружен битый текст:', text);
    const fixed = fixText(text);
    console.log('Исправлено на:', fixed);
    return fixed;
  }
  return text;
}

// Мониторинг и логирование битых текстов
let brokenTextsLog: Array<{ original: string; fixed: string; timestamp: Date }> = [];

export function logBrokenText(original: string, fixed: string) {
  brokenTextsLog.push({
    original,
    fixed,
    timestamp: new Date()
  });
  
  // Ограничиваем размер лога
  if (brokenTextsLog.length > 100) {
    brokenTextsLog = brokenTextsLog.slice(-100);
  }
}

export function getBrokenTextsLog() {
  return brokenTextsLog;
}

export function clearBrokenTextsLog() {
  brokenTextsLog = [];
}
