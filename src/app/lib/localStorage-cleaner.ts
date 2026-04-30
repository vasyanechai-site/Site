/**
 * 🧹 Утилита для очистки битых данных из localStorage
 * 
 * Автоматически обнаруживает и очищает данные с символами замены (�)
 * и другими проблемами кодировки.
 * 
 * @example
 * // Автоматическая очистка при запуске приложения
 * import { cleanLocalStorage, printReport } from './localStorage-cleaner';
 * const report = cleanLocalStorage(true);
 * printReport(report);
 * 
 * @example
 * // Ручная очистка из консоли браузера
 * // 1. Откройте DevTools (F12)
 * // 2. В консоли введите:
 * window.cleanLocalStorage();
 */

export interface CleanupReport {
  totalKeys: number;
  corruptedKeys: string[];
  cleanedKeys: string[];
  errors: { key: string; error: string }[];
}

/**
 * Проверяет строку на наличие битых символов
 */
export function hasCorruptedChars(str: string): boolean {
  return str.includes('\uFFFD'); // Unicode replacement character
}

/**
 * Проверяет JSON валидность
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Сканирует localStorage на битые данные
 */
export function scanLocalStorage(): CleanupReport {
  const report: CleanupReport = {
    totalKeys: 0,
    corruptedKeys: [],
    cleanedKeys: [],
    errors: []
  };

  try {
    const keys = Object.keys(localStorage);
    report.totalKeys = keys.length;

    for (const key of keys) {
      try {
        const value = localStorage.getItem(key);
        
        if (value === null) continue;

        // Проверяем на битые символы
        if (hasCorruptedChars(value)) {
          report.corruptedKeys.push(key);
        }
        
        // Проверяем валидность JSON (если похоже на JSON)
        if (value.startsWith('{') || value.startsWith('[')) {
          if (!isValidJSON(value)) {
            if (!report.corruptedKeys.includes(key)) {
              report.corruptedKeys.push(key);
            }
          }
        }
      } catch (error) {
        report.errors.push({
          key,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  } catch (error) {
    console.error('Ошибка сканирования localStorage:', error);
  }

  return report;
}

/**
 * Очищает битые данные из localStorage
 */
export function cleanLocalStorage(autoFix: boolean = true): CleanupReport {
  const report = scanLocalStorage();

  if (autoFix && report.corruptedKeys.length > 0) {
    console.log('%c🧹 Автоматическая очистка битых данных...', 'color: #2196F3; font-weight: bold;');

    for (const key of report.corruptedKeys) {
      try {
        // Удаляем битые данные
        localStorage.removeItem(key);
        report.cleanedKeys.push(key);
        console.log(`%c  ✅ Очищен: ${key}`, 'color: #4CAF50;');

        // Для некоторых ключей устанавливаем значения по умолчанию
        if (key === 'nechai_coffee_items') {
          localStorage.setItem(key, '[]');
          console.log(`%c  📦 Установлен пустой массив для ${key}`, 'color: #2196F3;');
        } else if (key === 'nechai_orders' || key === 'nechai_retail_orders') {
          localStorage.setItem(key, '[]');
          console.log(`%c  📦 Установлен пустой массив для ${key}`, 'color: #2196F3;');
        }
      } catch (error) {
        report.errors.push({
          key,
          error: error instanceof Error ? error.message : String(error)
        });
        console.error(`  ❌ Ошибка очистки ${key}:`, error);
      }
    }

    if (report.cleanedKeys.length > 0) {
      console.log(
        `%c✅ Очищено ключей: ${report.cleanedKeys.length}`,
        'color: #4CAF50; font-weight: bold;'
      );
      console.log('%c🔄 Рекомендуется обновить страницу', 'color: #FF9800; font-weight: bold;');
    }
  }

  return report;
}

/**
 * Валидирует и очищает конкретный ключ
 */
export function cleanKey(key: string, defaultValue?: any): boolean {
  try {
    const value = localStorage.getItem(key);
    
    if (value === null) return true;

    // Проверяем на битые символы
    if (hasCorruptedChars(value)) {
      console.warn(`⚠️ Найдены битые символы в ${key}, очистка...`);
      localStorage.removeItem(key);
      
      if (defaultValue !== undefined) {
        localStorage.setItem(key, JSON.stringify(defaultValue));
      }
      
      return true;
    }

    // Проверяем валидность JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      if (!isValidJSON(value)) {
        console.warn(`⚠️ Невалидный JSON в ${key}, очистка...`);
        localStorage.removeItem(key);
        
        if (defaultValue !== undefined) {
          localStorage.setItem(key, JSON.stringify(defaultValue));
        }
        
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`❌ Ошибка валидации ${key}:`, error);
    return false;
  }
}

/**
 * Выводит отчет о состоянии localStorage в консоль
 */
export function printReport(report: CleanupReport): void {
  console.log('\n%c=== 📊 ОТЧЕТ О СОСТОЯНИИ LOCALSTORAGE ===', 'color: #2196F3; font-weight: bold; font-size: 14px;');
  console.log(`Всего ключей: ${report.totalKeys}`);
  
  if (report.corruptedKeys.length > 0) {
    console.log(`%c❌ Найдено битых ключей: ${report.corruptedKeys.length}`, 'color: #f44336; font-weight: bold;');
    report.corruptedKeys.forEach(key => console.log(`  - ${key}`));
  } else {
    console.log('%c✅ Битых данных не найдено', 'color: #4CAF50; font-weight: bold;');
  }

  if (report.cleanedKeys.length > 0) {
    console.log(`%c✅ Очищено ключей: ${report.cleanedKeys.length}`, 'color: #4CAF50; font-weight: bold;');
    report.cleanedKeys.forEach(key => console.log(`  - ${key}`));
  }

  if (report.errors.length > 0) {
    console.log(`%c⚠️ Ошибок при обработке: ${report.errors.length}`, 'color: #ff9800; font-weight: bold;');
    report.errors.forEach(({ key, error }) => console.log(`  - ${key}: ${error}`));
  }

  console.log('%c=====================================\n', 'color: #2196F3; font-weight: bold;');
}
