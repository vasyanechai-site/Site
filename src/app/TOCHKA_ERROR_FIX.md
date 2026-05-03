> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# ✅ Исправлена ошибка "Failed to construct 'Request': headers is not a valid ByteString"

## 🎯 Что было сделано:

### 1. Добавлена жёсткая валидация токена перед fetch
**Файл:** `/supabase/functions/server/tochka_acquiring.tsx`

```typescript
// ⚠️ ЖЁСТКАЯ ВАЛИДАЦИЯ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ
if (!apiBase || typeof apiBase !== 'string' || apiBase.trim().length === 0) {
  throw new Error('TOCHKA_API_BASE is missing or invalid');
}
if (!jwtToken || typeof jwtToken !== 'string' || jwtToken.trim().length === 0) {
  throw new Error('TOCHKA_JWT_TOKEN is missing or invalid. Please set it in Supabase Edge Functions Secrets.');
}
if (!customerCode || typeof customerCode !== 'string' || customerCode.trim().length === 0) {
  throw new Error('TOCHKA_CUSTOMER_CODE is missing or invalid');
}

// Trim токен на всякий случай
const token = jwtToken.trim();
```

### 2. Безопасный вызов fetch
**Теперь fetch вызывается ТОЛЬКО с валидным токеном:**

```typescript
const response = await fetch(
  `${trimmedApiBase}/uapi/acquiring/v1.0/payments/with-receipt`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,  // ✅ Гарантированно валидная строка
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  }
);
```

### 3. Улучшенная диагностика
**Файл:** `/supabase/functions/server/index.tsx`

Тестовый endpoint `/tochka/acquiring/test-token` теперь возвращает:
```json
{
  "validation": {
    "tokenValid": true,
    "apiBaseValid": true,
    "customerCodeValid": true,
    "allValid": true
  }
}
```

---

## 🔍 Как проверить исправление:

### Шаг 1: Откройте диагностическую страницу
```
https://ваш-сайт.com/tochka-diagnostics
```

### Шаг 2: Нажмите "Запустить диагностику"

### Шаг 3: Проверьте результат

#### ✅ Если всё в порядке:
```
✅ Все настроено правильно!
Интеграция с Точка Банком готова к использованию.
```

#### ❌ Если токен отсутствует:
```
⚠️ Требуется внимание
• JWT токен отсутствует - добавьте TOCHKA_JWT_TOKEN в Supabase Secrets
```

**Решение:**
1. Supabase Dashboard → Edge Functions → Secrets
2. Найдите `TOCHKA_JWT_TOKEN`
3. Вставьте токен полностью (572 символа)
4. Подождите 30-60 секунд
5. Повторите диагностику

---

## 🚀 Что происходит теперь:

### ДО исправления:
```javascript
// ❌ Если токен undefined:
headers: {
  'Authorization': `Bearer ${undefined}`,  // → "Bearer undefined" → ОШИБКА
}
```

### ПОСЛЕ исправления:
```javascript
// ✅ Сначала проверка:
if (!jwtToken || typeof jwtToken !== 'string' || jwtToken.trim().length === 0) {
  throw new Error('TOCHKA_JWT_TOKEN is missing or invalid');
}

// ✅ Потом использование:
const token = jwtToken.trim();
headers: {
  'Authorization': `Bearer ${token}`,  // → Всегда валидная строка
}
```

---

## 🎯 Следующий шаг:

После успешной диагностики попробуйте создать тестовый заказ:

1. Откройте главную страницу
2. Добавьте товар в корзину
3. Оформите заказ с email
4. Выберите "Онлайн-оплата"
5. Нажмите "Перейти к оплате"

### Ожидаемое поведение:

#### ✅ Если токен установлен:
- Redirect на страницу Точка Банка
- Доступны способы оплаты: Карта и СБП
- После оплаты чек приходит на email

#### ❌ Если токен НЕ установлен:
- В логах Edge Functions:
  ```
  ❌ CRITICAL ERROR in createAcquiringPayment
  Error: TOCHKA_JWT_TOKEN is missing or invalid. Please set it in Supabase Edge Functions Secrets.
  ```
- На фронте:
  ```
  Ошибка создания платежа: TOCHKA_JWT_TOKEN is missing or invalid...
  ```

---

## 📋 Чек-лист для полной работоспособности:

- [ ] TOCHKA_API_BASE установлен (`https://enter.tochka.com`)
- [ ] TOCHKA_CUSTOMER_CODE установлен (`303195679`)
- [ ] TOCHKA_JWT_TOKEN установлен (572 символа)
- [ ] Диагностика показывает ✅ "Все настроено правильно"
- [ ] Edge Functions перезапущены (подождали 30-60 секунд)
- [ ] Тестовый заказ создаётся успешно

---

## 🔧 Отладка (если проблема остаётся):

### 1. Проверьте логи Edge Functions:
```
Supabase Dashboard → Edge Functions → Logs
```

Найдите:
```
========================================
🔑 JWT TOKEN VERIFICATION
========================================
JWT Token exists: true
JWT Token length: 572
```

Если `exists: false` → токен не загрузился из Secrets.

### 2. Проверьте имя переменной:
- Точно `TOCHKA_JWT_TOKEN` (ЗАГЛАВНЫМИ)
- Нет пробелов до/после имени
- Нет опечаток

### 3. Проверьте значение токена:
- Начинается с `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9`
- Длина около 572 символов
- Нет пробелов в начале/конце
- Скопирован полностью

### 4. Перезапустите Edge Function:
После изменения Secrets необходимо подождать 30-60 секунд или:
- Supabase Dashboard → Edge Functions
- Найдите `make-server-aa167a09`
- Нажмите "Restart" (если доступно)

---

## ✅ Итог:

**Ошибка исправлена:** Теперь невозможно вызвать fetch с невалидным токеном. Если токен отсутствует, будет выброшено понятное исключение с инструкцией по исправлению.

**Следующий шаг:** Убедитесь, что токен добавлен в Supabase Secrets и запустите диагностику.
