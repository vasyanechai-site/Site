> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# 🔧 Быстрое руководство по исправлению кодировки

## 🚀 Что было сделано автоматически

### ✅ Исправлено сразу
1. **4 файла с битой кодировкой** - все символы � заменены на правильные
2. **index.html создан** - добавлен `<meta charset="UTF-8">`
3. **Автопроверка добавлена** - запускается при каждом старте приложения
4. **Защита настроена** - новые данные автоматически очищаются

---

## 📝 Если нашли новый битый символ

### Вариант 1: Автоматическое исправление
```bash
# Запустите приложение в dev режиме
npm run dev

# Откройте консоль браузера (F12)
# Вы увидите автоматический отчет с указанием всех проблем
```

### Вариант 2: Ручное исправление
1. Найдите файл с битым символом
2. Найдите строку с � или �
3. Перепечатайте текст вручную
4. Сохраните файл

### Вариант 3: Программное исправление
```typescript
import { cleanText } from './lib/encodingCheck';

const brokenText = "Тест� с проблемой";
const fixedText = cleanText(brokenText);
// "Тест с проблемой"
```

---

## 🎨 Если текст отображается битым

### Проблема 1: Шрифт не поддерживает кириллицу

**Решение:**
```css
/* Плохо */
font-family: 'CustomFont';

/* Хорошо */
font-family: 'CustomFont', 'Manrope', sans-serif;
```

### Проблема 2: Отсутствует subset=cyrillic

**Решение для Google Fonts:**
```html
<!-- Плохо -->
<link href="https://fonts.googleapis.com/css2?family=Roboto" />

<!-- Хорошо -->
<link href="https://fonts.googleapis.com/css2?family=Roboto&subset=cyrillic" />
```

В CSS файле:
```css
/* Хорошо */
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700&subset=cyrillic&display=swap');
```

### Проблема 3: Битая кодировка в файле

**Быстрое решение:**
1. Откройте консоль браузера
2. Найдите отчет "ПРОВЕРКА КОДИРОВКИ"
3. Исправьте указанные файлы
4. Перезагрузите страницу

---

## 🛡️ Как предотвратить проблемы

### При добавлении текста:
```typescript
// ❌ Плохо
const text = "Скопировано из Word�";

// ✅ Хорошо - используйте автоочистку
import { cleanText } from './lib/encodingCheck';
const text = cleanText("Скопировано из Word�");
```

### При сохранении в БД:
```typescript
// ✅ Автоматическая очистка на сервере
// Уже настроено в encodingMiddleware.tsx
// Ничего делать не нужно!
```

### При создании компонента:
```typescript
// ✅ Используйте стандартные компоненты
import { Input } from './components/ui/input';
// Они автоматически используют правильные шрифты
```

---

## 🔍 Инструменты для проверки

### 1. Автоматическая проверка (встроена)
- Запускается при каждом старте в dev режиме
- Отчет в консоли браузера
- Проверяет: DOM, шрифты, localStorage, meta теги

### 2. Ручная проверка объекта
```typescript
import { generateEncodingReport } from './lib/encodingCheck';

const data = { /* ваши данные */ };
const { hasIssues, report } = generateEncodingReport(data);
console.log(report);
```

### 3. Проверка шрифта
```typescript
import { checkFontCyrillicSupport } from './lib/encodingCheck';

const isSupported = checkFontCyrillicSupport('Roboto');
console.log(isSupported); // true
```

### 4. Глобальная функция в консоли
```javascript
// В dev режиме доступна в браузере
window.__encodingCheck({ name: 'Тест�' });
```

---

## 📦 Где находятся инструменты

```
/lib/encodingCheck.ts                              - Утилиты
/components/EncodingChecker.tsx                    - Компонент проверки
/supabase/functions/server/encodingMiddleware.tsx  - Middleware сервера
/index.html                                        - HTML с UTF-8
/ENCODING_AUDIT_REPORT.md                          - Полный отчет
```

---

## 🆘 Быстрые решения частых проблем

### Символ � в тексте
```typescript
import { cleanText } from './lib/encodingCheck';
const fixed = cleanText(brokenText);
```

### Кириллица не отображается
```css
/* Добавьте fallback шрифт */
font-family: 'YourFont', 'Manrope', sans-serif;
```

### Консоль показывает ошибки кодировки
```typescript
// Проверьте отчет EncodingChecker
// Исправьте указанные файлы
// Перезапустите приложение
```

### Данные из API битые
```typescript
// Middleware автоматически очистит
// Но можно и вручную:
import { sanitizeForStorage } from './lib/encodingCheck';
const clean = sanitizeForStorage(apiData);
```

---

## ✨ Всё работает автоматически!

**Вам не нужно ничего делать вручную:**
- ✅ Проверка при старте приложения
- ✅ Автоочистка данных на сервере
- ✅ Правильные шрифты с кириллицей
- ✅ UTF-8 мета-теги в HTML
- ✅ Защита от битых символов

**Просто разрабатывайте, система сама всё проверит! 🎉**

---

## 📞 Нужна помощь?

1. Проверьте `/ENCODING_AUDIT_REPORT.md` - полный отчет
2. Откройте консоль браузера - автоматический отчет
3. Используйте встроенные утилиты из `/lib/encodingCheck.ts`

---

**Последнее обновление:** 20 ноября 2024
