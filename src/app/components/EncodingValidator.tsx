import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Компонент для мониторинга и автоматического исправления битых текстов (проблемы с кодировкой UTF-8)
 * 
 * Работает на всех страницах и в модальных окнах
 */

interface BrokenTextEntry {
  element: HTMLElement;
  originalText: string;
  fixedText: string;
  timestamp: Date;
}

// Карта распространенных битых символов
const ENCODING_FIXES: Record<string, string> = {
  'аша': 'Ваша',
  'аказы': 'Заказы',
  'ромокод': 'Промокод',
  'обавьте': 'Добавьте',
  'зображение': 'изображение',
  'бязательство': 'Обязательство',
  'ильтр': 'Фильтр',
  'анные': 'данные',
  'споль': 'исполь',
  'роверяем': 'проверяем',
  'публик': 'опублик',
  'ля': 'для',
  'егистр': 'Регистр',
  'игр': 'Мигр',
  'орядок': 'порядок',
  'овар': 'товар',
  'дномление': 'едомление',
  'олько': 'только',
};

export function EncodingValidator() {
  const [brokenTexts, setBrokenTexts] = useState<BrokenTextEntry[]>([]);
  const lastScanRef = useRef<number>(0);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Функция для проверки и исправления текста
  const checkAndFixText = (text: string): string | null => {
    // Проверяем наличие replacement character
    if (!text.includes('�') && !text.includes('\uFFFD')) {
      return null;
    }

    let fixed = text;
    
    // Применяем известные замены
    for (const [broken, correct] of Object.entries(ENCODING_FIXES)) {
      if (fixed.includes(broken)) {
        fixed = fixed.replace(new RegExp(broken, 'g'), correct);
      }
    }

    return fixed !== text ? fixed : null;
  };

  // Функция для сканирования всех текстовых узлов
  const scanAndFix = () => {
    // Предотвращаем слишком частые сканирования (минимум 500мс между сканированиями)
    const now = Date.now();
    if (now - lastScanRef.current < 500) {
      return;
    }
    lastScanRef.current = now;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Пропускаем пустые узлы и скрипты
          if (!node.textContent?.trim() || 
              node.parentElement?.tagName === 'SCRIPT' ||
              node.parentElement?.tagName === 'STYLE') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const foundBroken: BrokenTextEntry[] = [];
    const nodesToFix: Array<{ node: Text; fixedText: string; originalText: string }> = [];

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      const textNode = currentNode as Text;
      const originalText = textNode.textContent || '';
      const fixedText = checkAndFixText(originalText);

      if (fixedText) {
        nodesToFix.push({
          node: textNode,
          fixedText,
          originalText
        });

        if (textNode.parentElement) {
          foundBroken.push({
            element: textNode.parentElement,
            originalText,
            fixedText,
            timestamp: new Date()
          });
        }
      }
    }

    // Применяем исправления
    nodesToFix.forEach(({ node, fixedText }) => {
      node.textContent = fixedText;
    });

    // Логируем если нашли битые тексты
    if (foundBroken.length > 0) {
      console.warn(`🔧 Исправлено битых текстов: ${foundBroken.length}`);
      foundBroken.forEach(entry => {
        console.log(`  ❌ "${entry.originalText}" → ✅ "${entry.fixedText}"`);
      });
      
      setBrokenTexts(prev => [...prev, ...foundBroken].slice(-100)); // Храним последние 100
      
      // Сохраняем в localStorage для админки
      try {
        const existingLogs = JSON.parse(localStorage.getItem('encoding_fixes_log') || '[]');
        const newLogs = [...existingLogs, ...foundBroken.map(entry => ({
          timestamp: entry.timestamp.toISOString(),
          originalText: entry.originalText,
          fixedText: entry.fixedText,
          element: entry.element.tagName
        }))].slice(-100); // Храним последние 100
        localStorage.setItem('encoding_fixes_log', JSON.stringify(newLogs));
      } catch (e) {
        console.error('Failed to save encoding logs:', e);
      }
      
      // Показываем toast только в dev режиме и только один раз
      if (process.env.NODE_ENV === 'development' && foundBroken.length > 0) {
        toast.info(`Исправлено ${foundBroken.length} битых текстов`, {
          description: 'Проверьте консоль для деталей',
          duration: 3000
        });
      }
    }
  };

  // Первоначальное сканирование и мониторинг
  useEffect(() => {
    // Даем время на полную загрузку страницы
    const initialTimeout = setTimeout(scanAndFix, 500);

    // MutationObserver для отслеживания изменений DOM (только для модалок и динамического контента)
    const observer = new MutationObserver((mutations) => {
      // Проверяем только если добавлены новые узлы с атрибутом data-radix (модалки)
      const hasModalNodes = mutations.some(mutation => 
        mutation.type === 'childList' && 
        Array.from(mutation.addedNodes).some(node => {
          if (node instanceof HTMLElement) {
            return node.hasAttribute('data-radix-portal') || 
                   node.hasAttribute('data-state') ||
                   node.querySelector('[data-radix-portal]') !== null;
          }
          return false;
        })
      );

      if (hasModalNodes) {
        // Debounce - сканируем через 300ms после последнего изменения
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
        scanTimeoutRef.current = setTimeout(scanAndFix, 300);
      }
    });

    // Наблюдаем за изменениями в body
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false, // Не отслеживаем изменения текста (чтобы не было зацикливания)
    });

    return () => {
      clearTimeout(initialTimeout);
      observer.disconnect();
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // Компонент невидимый, только для мониторинга
  return null;
}

// Export для использования в других компонентах
export function getBrokenTextsLog() {
  return JSON.parse(localStorage.getItem('encoding_fixes_log') || '[]');
}

export function clearBrokenTextsLog() {
  localStorage.removeItem('encoding_fixes_log');
}
