> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# 🔤 Система автоматической проверки кодировки

## 🎯 Что это?

Полностью автоматическая система защиты от проблем с кодировкой текста в веб-приложении.

**Работает автоматически — никаких ручных действий не требуется! ✨**

---

## ⚡ Быстрый старт

### Разработчику нужно знать только это:

```bash
# 1. Запустите приложение
npm run dev

# 2. Откройте консоль браузера (F12)
# 3. Увидите автоматический отчет
```

**Всё! Система сама проверит и сообщит о проблемах.**

---

## 🛡️ Что система делает автоматически

### 1. При запуске приложения:
- ✅ Проверяет весь DOM на битые символы (�, �)
- ✅ Проверяет шрифты на поддержку кириллицы
- ✅ Проверяет наличие UTF-8 meta тегов
- ✅ Проверяет LocalStorage на битые данные
- ✅ Выводит подробный отчет в консоль

### 2. При работе с API:
- ✅ Автоматически очищает входящие данные на сервере
- ✅ Удаляет битые символы из POST/PUT/PATCH запросов
- ✅ Нормализует Unicode в NFC форму
- ✅ Логирует все найденные проблемы

### 3. Защита от проблем:
- ✅ HTML с правильным `<meta charset="UTF-8">`
- ✅ Все шрифты имеют fallback с кириллицей
- ✅ Автоматическая нормализация текста
- ✅ Удаление невидимых символов

---

## 📊 Как читать отчет в консоли

### ✅ Всё хорошо:
```
=== ПРОВЕРКА КОДИРОВКИ ===
✅ DOM: битых символов не найдено
✅ Шрифты: все поддерживают кириллицу
✅ Meta charset: UTF-8 установлен
✅ LocalStorage: битых символов не найдено

=== ИТОГО: ✅ Все проверки пройдены ===
```

### ⚠️ Найдены проблемы:
```
=== ПРОВЕРКА КОДИРОВКИ ===
❌ Найдено 2 элементов с битой кодировкой:
  1. "Тест� текст"
     Элемент: <div class="title">
  2. "Описание�"
     Элемент: <p>

⚠️ Шрифты без поддержки кириллицы:
  - CustomFont

=== ИТОГО: ❌ Найдено проблем: 3 ===
```

**Что делать:** Исправьте указанные элементы согласно `/ENCODING_FIX_GUIDE.md`

---

## 🔧 Инструменты для разработчика

### В JavaScript коде:

```typescript
// 1. Проверка текста на битые символы
import { hasBrokenEncoding } from './lib/encodingCheck';
hasBrokenEncoding('Тест�'); // true

// 2. Очистка текста
import { cleanText } from './lib/encodingCheck';
cleanText('Тест� текст'); // "Тест текст"

// 3. Очистка объекта перед сохранением
import { sanitizeForStorage } from './lib/encodingCheck';
const clean = sanitizeForStorage({ name: 'Тест�' });

// 4. Полный отчет по объекту
import { generateEncodingReport } from './lib/encodingCheck';
const { hasIssues, report } = generateEncodingReport(data);
console.log(report);

// 5. Проверка шрифта
import { checkFontCyrillicSupport } from './lib/encodingCheck';
checkFontCyrillicSupport('Roboto'); // true
```

### В консоли браузера:

```javascript
// Доступна глобальная функция (только в dev режиме)
window.__encodingCheck({ text: 'Проверяемый текст�' });
```

---

## 📁 Структура файлов

```
├── /index.html                              # HTML с UTF-8 meta тегами
├── /App.tsx                                 # Интеграция EncodingChecker
│
├── /lib/
│   └── encodingCheck.ts                     # Утилиты для проверки
│
├── /components/
│   └── EncodingChecker.tsx                  # Автопроверка при загрузке
│
├── /supabase/functions/server/
│   └── encodingMiddleware.tsx               # Middleware для API
│
└── /Документация/
    ├── ENCODING_AUDIT_REPORT.md             # Полный отчет об аудите
    ├── ENCODING_FIX_GUIDE.md                # Быстрое руководство
    └── ENCODING_README.md                   # Этот файл
```

---

## 🚨 Частые проблемы и решения

### Проблема: Символ � в тексте

**Быстрое решение:**
```typescript
import { cleanText } from './lib/encodingCheck';
const fixed = cleanText(brokenText);
```

**Причина:** Битая кодировка при копировании из внешних источников

---

### Проблема: Кириллица отображается как квадратики

**Быстрое решение:**
```css
/* Добавьте fallback шрифт с кириллицей */
font-family: 'CustomFont', 'Manrope', sans-serif;
```

**Причина:** Шрифт не поддерживает кириллицу

---

### Проблема: Google Font не показывает кириллицу

**Быстрое решение:**
```css
/* Добавьте subset=cyrillic */
@import url('https://fonts.googleapis.com/css2?family=Roboto&subset=cyrillic');
```

**Причина:** Не указан subset с кириллицей

---

### Проблема: Консоль показывает ошибки кодировки

**Быстрое решение:**
1. Посмотрите отчет в консоли
2. Найдите указанные файлы/элементы
3. Исправьте текст
4. Перезагрузите страницу

**Причина:** Найдены битые символы в коде

---

## 📖 Дополнительная документация

### Для детального изучения:

1. **`/ENCODING_AUDIT_REPORT.md`** - Полный отчет о проведенном аудите
   - Что было найдено
   - Что было исправлено
   - Как работает система

2. **`/ENCODING_FIX_GUIDE.md`** - Практическое руководство
   - Как исправить битые символы
   - Как настроить шрифты
   - Быстрые решения

3. **`/lib/encodingCheck.ts`** - API документация
   - Все доступные функции
   - Примеры использования
   - TypeScript типы

---

## ✅ Checklist для новых разработчиков

При работе с проектом:

- [ ] Запустил `npm run dev` и проверил консоль
- [ ] Прочитал отчет о кодировке
- [ ] Знаю где находится `/ENCODING_FIX_GUIDE.md`
- [ ] Понимаю как использовать `cleanText()`
- [ ] Проверяю консоль при добавлении нового текста

При добавлении нового шрифта:

- [ ] Убедился что шрифт поддерживает кириллицу
- [ ] Добавил `subset=cyrillic` для Google Fonts
- [ ] Указал fallback шрифт: `'Manrope', sans-serif`
- [ ] Проверил в EncodingChecker отчете

При копировании текста:

- [ ] Проверил нет ли символа � в скопированном тексте
- [ ] Использовал `cleanText()` если есть сомнения
- [ ] Проверил результат в браузере
- [ ] Посмотрел консоль на предупреждения

---

## 🎓 Обучающие примеры

### Пример 1: Очистка пользовательского ввода

```typescript
import { useState } from 'react';
import { cleanText } from './lib/encodingCheck';

function MyComponent() {
  const [text, setText] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Автоматическая очистка при вводе
    const cleaned = cleanText(e.target.value);
    setText(cleaned);
  };

  return <input value={text} onChange={handleChange} />;
}
```

### Пример 2: Проверка данных перед отправкой

```typescript
import { sanitizeForStorage, checkObjectForBrokenEncoding } from './lib/encodingCheck';

async function saveData(data: MyData) {
  // Проверяем на проблемы
  const issues = checkObjectForBrokenEncoding(data);
  
  if (issues.length > 0) {
    console.warn('Найдены проблемы с кодировкой:', issues);
  }
  
  // Очищаем и сохраняем
  const cleanData = sanitizeForStorage(data);
  await api.save(cleanData);
}
```

### Пример 3: Создание компонента с правильным шрифтом

```typescript
function MyTitle({ children }: { children: string }) {
  return (
    <h1 
      style={{ 
        fontFamily: "'CustomFont', 'Manrope', sans-serif" 
      }}
    >
      {children}
    </h1>
  );
}
```

---

## 🔬 Режим разработки vs Production

### Development:
- ✅ EncodingChecker активен
- ✅ Полный отчет в консоли
- ✅ Глобальная функция `__encodingCheck`
- ✅ Предупреждения о проблемах

### Production:
- ❌ EncodingChecker отключен (не влияет на производительность)
- ✅ Middleware на сервере активен
- ✅ Автоочистка данных работает
- ✅ Защита от битых символов активна

**Безопасность:** Вся логика проверки отключается в продакшене, но защита остается!

---

## 🌟 Лучшие практики

### DO ✅

```typescript
// Используйте встроенные утилиты
import { cleanText } from './lib/encodingCheck';

// Проверяйте консоль регулярно
// Используйте стандартные UI компоненты
import { Input } from './components/ui/input';

// Указывайте fallback шрифты
font-family: 'CustomFont', 'Manrope', sans-serif;
```

### DON'T ❌

```typescript
// Не игнорируйте предупреждения в консоли
// Не используйте шрифты без кириллицы без fallback
// Не копируйте текст из Word/PDF напрямую в код
// Не отключайте EncodingChecker в dev режиме
```

---

## 💡 Полезные ссылки

- **Полный отчет:** `/ENCODING_AUDIT_REPORT.md`
- **Быстрое руководство:** `/ENCODING_FIX_GUIDE.md`
- **Утилиты:** `/lib/encodingCheck.ts`
- **Middleware:** `/supabase/functions/server/encodingMiddleware.tsx`

---

## 📞 Поддержка

**Вопрос:** Я нашел битый символ, что делать?  
**Ответ:** Смотрите `/ENCODING_FIX_GUIDE.md` → раздел "Если нашли новый битый символ"

**Вопрос:** Кириллица не отображается  
**Ответ:** Смотрите `/ENCODING_FIX_GUIDE.md` → раздел "Если текст отображается битым"

**Вопрос:** Как добавить новый шрифт?  
**Ответ:** Смотрите раздел "Checklist для новых разработчиков" → "При добавлении нового шрифта"

**Вопрос:** Система не работает  
**Ответ:** Проверьте что вы в dev режиме (`npm run dev`) и откройте консоль (F12)

---

**Система работает автоматически! Просто разрабатывайте спокойно 🚀**

---

**Версия:** 1.0.0  
**Последнее обновление:** 20 ноября 2024  
**Статус:** ✅ Полностью функциональна
