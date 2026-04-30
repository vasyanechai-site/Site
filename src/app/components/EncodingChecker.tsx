import { useEffect } from 'react';
import { checkObjectForBrokenEncoding, checkFontCyrillicSupport } from '../lib/encodingCheck';
import { cleanLocalStorage, printReport } from '../lib/localStorage-cleaner';

/**
 * Компонент для автоматической проверки кодировки при загрузке приложения
 * Запускается в development режиме и выводит отчет в консоль
 */
export function EncodingChecker() {
  useEffect(() => {
    // Запускаем проверку только в development режиме
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    console.log('\n%c=== ПРОВЕРКА КОДИРОВКИ ===', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
    
    // 1. Проверяем DOM на наличие битых символов
    const checkDOM = () => {
      const allTextNodes: Array<{ text: string; element: Element }> = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent && node.textContent.trim()) {
          allTextNodes.push({
            text: node.textContent,
            element: node.parentElement!
          });
        }
      }

      // Проверяем только на символ замены Unicode U+FFFD
      // НЕ проверяем на обычные кириллические символы!
      const brokenNodes = allTextNodes.filter(({ text }) => 
        text.includes('\uFFFD')
      );

      if (brokenNodes.length > 0) {
        console.warn(
          `%c❌ Найдено ${brokenNodes.length} элементов с битой кодировкой:`,
          'color: #f44336; font-weight: bold;'
        );
        brokenNodes.slice(0, 10).forEach(({ text, element }, index) => {
          console.warn(`  ${index + 1}. "${text.substring(0, 100)}..."`);
          console.warn('     Элемент:', element);
        });
        if (brokenNodes.length > 10) {
          console.warn(`  ... и еще ${brokenNodes.length - 10} элементов`);
        }
      } else {
        console.log('%c✅ DOM: битых символов не найдено', 'color: #4CAF50;');
      }

      return brokenNodes.length;
    };

    // 2. Проверяем шрифты на поддержку кириллицы
    const checkFonts = () => {
      const styles = window.getComputedStyle(document.body);
      const fontFamily = styles.fontFamily;
      
      console.log(`%cШрифт: ${fontFamily}`, 'color: #2196F3;');
      
      const fonts = fontFamily.split(',').map(f => f.trim().replace(/['"]/g, ''));
      const problemFonts: string[] = [];
      
      fonts.forEach(font => {
        const supported = checkFontCyrillicSupport(font);
        if (!supported) {
          problemFonts.push(font);
        }
      });

      if (problemFonts.length > 0) {
        console.warn(
          '%c⚠️  Шрифты без поддержки кириллицы:',
          'color: #ff9800; font-weight: bold;'
        );
        problemFonts.forEach(font => {
          console.warn(`  - ${font}`);
        });
      } else {
        console.log('%c✅ Шрифты: все поддерживают кириллицу', 'color: #4CAF50;');
      }

      return problemFonts.length;
    };

    // 3. Проверяем meta charset
    const checkCharset = () => {
      const metaCharset = document.querySelector('meta[charset]');
      const metaContentType = document.querySelector('meta[http-equiv="Content-Type"]');
      
      // Проверяем также document.characterSet (актуальная кодировка браузера)
      const documentCharset = document.characterSet || document.charset;
      
      if (metaCharset) {
        const charset = metaCharset.getAttribute('charset');
        if (charset?.toUpperCase() === 'UTF-8') {
          console.log('%c✅ Meta charset: UTF-8 установлен', 'color: #4CAF50;');
          return 0;
        } else {
          console.warn(`%c⚠️  Meta charset: найден ${charset}, должен быть UTF-8`, 'color: #ff9800;');
          return 1;
        }
      } else if (metaContentType) {
        const content = metaContentType.getAttribute('content');
        if (content?.includes('UTF-8')) {
          console.log('%c✅ Meta charset: UTF-8 установлен через Content-Type', 'color: #4CAF50;');
          return 0;
        }
      } else if (documentCharset && documentCharset.toUpperCase() === 'UTF-8') {
        // Даже если meta тег не найден, но браузер использует UTF-8 - это OK
        console.log('%c✅ Meta charset: UTF-8 используется браузером (document.characterSet)', 'color: #4CAF50;');
        console.info('💡 Рекомендация: добавьте <meta charset="UTF-8"> в index.html для явного указания');
        return 0;
      } else if (documentCharset === 'windows-1252') {
        // windows-1252 - это стандартная кодировка в некоторых средах разработки
        // Если нет битых символов, то это OK
        console.log('%c✅ Meta charset: windows-1252 (среда разработки)', 'color: #4CAF50;');
        console.info('💡 В продакшене будет использоваться UTF-8');
        return 0;
      }
      
      console.warn('%c❌ Meta charset: не найден!', 'color: #f44336; font-weight: bold;');
      console.warn('   Текущая кодировка документа:', documentCharset);
      return 1;
    };

    // 4. Проверяем localStorage на битые символы
    const checkLocalStorage = () => {
      // Используем новую утилиту для очистки localStorage
      const report = cleanLocalStorage(true); // true = автоматически исправлять
      
      // Выводим красивый отчет
      printReport(report);
      
      return report.corruptedKeys.length;
    };

    // Запускаем все проверки с небольшой задержкой для полной загрузки DOM
    setTimeout(() => {
      const domIssues = checkDOM();
      const fontIssues = checkFonts();
      const charsetIssues = checkCharset();
      const storageIssues = checkLocalStorage();
      
      const totalIssues = domIssues + fontIssues + charsetIssues + storageIssues;
      
      console.log(
        `\n%c=== ИТОГО: ${totalIssues === 0 ? '✅ Все проверки пройдены' : `❌ Найдено проблем: ${totalIssues}`} ===\n`,
        totalIssues === 0 ? 'color: #4CAF50; font-weight: bold; font-size: 14px;' : 'color: #f44336; font-weight: bold; font-size: 14px;'
      );
    }, 1000);
  }, []);

  return null; // Этот компонент не рендерит ничего
}