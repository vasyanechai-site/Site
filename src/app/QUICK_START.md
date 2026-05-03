> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# ⚡ Быстрый старт интеграции Точка Банк

## 🎯 3 шага до запуска:

### Шаг 1: Установите переменные в Supabase (2 минуты)

1. Откройте **Supabase Dashboard** → ваш проект
2. Перейдите в **Edge Functions** → **Secrets**
3. Найдите и обновите эти 3 переменные:

| Имя переменной | Значение |
|----------------|----------|
| `TOCHKA_API_BASE` | `https://enter.tochka.com` |
| `TOCHKA_CUSTOMER_CODE` | `303195679` |
| `TOCHKA_JWT_TOKEN` | `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3ODkzNjAyNjMwMTcyMDYzNzdmYjUxMjY1ZDFjNmY5MiIsInN1YiI6ImU4MmM2MmYzLTczYTItNDZhMy1hZjViLTgxNjg0N2Y1OTQzMyIsImN1c3RvbWVyX2NvZGUiOiIzMDMxOTU2NzkifQ.WmS0VhMkaa1qCYNhuE1nlZT77cpU1W7ln0OkG7XRBg9YaK_MksQs21y41FZw5nhZCgNFoQll8bggqXW_cZhqUQSxgJ1j7wsVgu0Wxnb4IB_3jWFRK2-E7_ASYlaCpGidkKs29spvIGQwNAx2No2vdgDnOOP0xPLNHe2J-xoUBmSR8OfAgZw635EGn-OM-uutqLfm0LaJ9aDC2EGLRZcL8dJPJRw8cPQdYV1zjrzBJOB9b3vnlkGwAkr5lzglsII7elYNBY46-PCybE6uy6iFjpLfrsvrtEhOpg6Pdyh3sIMz6VZBpMq5GCHrt_rrsFTFHPs6pq7hyzpg-MrNix0vEb5lh7W0OHmAL-IDJRdbI_Jqp503TWBa-tFleDwM9D_CKcR_qv7W66pbOh37kJrchLIw59abkrYGLXxACtLUVnwnfNUF4TXWg_dbgq20kOphhovd-EqGLb5LE0vMee7nA4GWYvyY6MLY_P5J-6IY7fSULUrdp85i2z0LLC3DEXXi` |

⚠️ **ВАЖНО:** Копируйте JWT токен **полностью** (572 символа), без пробелов!

4. Нажмите **Save** / **Update**
5. Подождите **30-60 секунд** (Edge Function перезапустится)

---

### Шаг 2: Запустите диагностику (30 секунд)

1. Откройте в браузере:
   ```
   https://ваш-сайт.com/tochka-diagnostics
   ```

2. Нажмите **"Запустить диагностику"**

3. Убедитесь, что видите:
   ```
   ✅ Все настроено правильно!
   Интеграция с Точка Банком готова к использованию.
   ```

#### ⚠️ Если видите ошибку:
```
❌ JWT токен отсутствует
```

**Решение:**
- Вернитесь к Шагу 1
- Проверьте, что имя ТОЧНО: `TOCHKA_JWT_TOKEN` (заглавными)
- Проверьте, что токен скопирован полностью
- Подождите ещё 30 секунд

---

### Шаг 3: Тестовый заказ (2 минуты)

1. Откройте главную страницу сайта
2. Добавьте любой товар в корзину
3. Оформите заказ:
   - Введите ФИО
   - Введите телефон
   - **Обязательно** введите email (для чека!)
   - Укажите адрес доставки
4. Выберите **"Онлайн-оплата"**
5. Нажмите **"Перейти к оплате"**

#### ✅ Ожидаемый результат:
- Вас перенаправит на страницу Точка Банка
- Будут доступны способы оплаты:
  - 💳 **Банковская карта**
  - 📱 **СБП** (Система Быстрых Платежей)
- После оплаты чек придёт на email

#### ❌ Если redirect не произошёл:
1. Откройте **консоль браузера** (F12)
2. Найдите ошибку в красном цвете
3. Скопируйте текст ошибки
4. Проверьте логи:
   - Supabase Dashboard → Edge Functions → Logs
   - Найдите секцию с ❌

---

## 🔍 Типичные проблемы и решения:

### Проблема 1: "TOCHKA_JWT_TOKEN is missing or invalid"
**Причина:** Токен не установлен или пустой  
**Решение:** Вернитесь к Шагу 1, добавьте токен в Secrets

### Проблема 2: "JWT Token length: 0"
**Причина:** Токен не загрузился после добавления  
**Решение:** Подождите 60 секунд, повторите диагностику

### Проблема 3: "JWT Token length: 150" (слишком короткий)
**Причина:** Токен скопирован не полностью  
**Решение:** Скопируйте весь токен (должно быть 572 символа)

### Проблема 4: Диагностика ✅, но оплата не работает
**Причина:** Возможно, проблема с чеком или суммой  
**Решение:** 
1. Проверьте Edge Functions → Logs
2. Найдите секцию "📤 REQUEST TO TOCHKA API"
3. Проверьте "📥 RESPONSE FROM TOCHKA API"
4. Посмотрите код ответа и body

---

## 📊 Что должно быть в логах:

### При создании платежа:
```
========================================
🏦 СОЗДАНИЕ ПЛАТЕЖА ТОЧКА ACQUIRING
========================================
Order ID: retail_xxxxx
Amount (RUB): 1234
Customer Email: user@example.com
Items: 2
========================================

✅ Environment variables loaded:
API Base: https://enter.tochka.com
Customer Code: 303195679 (length: 9)
JWT Token length: 572
JWT Token starts with: eyJhbGciOiJSUzI1NiIsInR5
========================================

📤 REQUEST TO TOCHKA API
========================================
Endpoint: https://enter.tochka.com/uapi/acquiring/v1.0/payments/with-receipt
Customer Code: 303195679
Amount: 123400 kopeks
Payment Modes: card,sbp
Receipt Items: 2
========================================

📥 RESPONSE FROM TOCHKA API
========================================
Status: 200
Body: {"operationId":"xxx","paymentUrl":"https://..."}
========================================

✅ PAYMENT CREATED SUCCESSFULLY
========================================
Payment URL: https://enter.tochka.com/payment/xxx
========================================
```

### Если всё хорошо, вы увидите:
- ✅ "Environment variables loaded"
- ✅ "JWT Token length: 572"
- ✅ "Status: 200"
- ✅ "PAYMENT CREATED SUCCESSFULLY"

---

## 🎉 Готово!

После успешного прохождения всех 3 шагов:

✅ Интеграция настроена  
✅ Диагностика проходит  
✅ Тестовый заказ работает  

**Теперь розничные клиенты могут оплачивать заказы онлайн!**

---

## 📚 Дополнительная документация:

- **Полная инструкция:** `/TOCHKA_ACQUIRING_SETUP.md`
- **Исправление ошибок:** `/TOCHKA_ERROR_FIX.md`
- **Быстрая проверка:** `/QUICK_TEST_GUIDE.md`

---

## 🆘 Нужна помощь?

1. Запустите диагностику: `/tochka-diagnostics`
2. Проверьте логи: Supabase → Edge Functions → Logs
3. Проверьте консоль браузера: F12 → Console

**Два типа интеграции:**
- 🛒 **Розничная** (acquiring) - через `/tochka_acquiring.tsx` ← **это она**
- 🏢 **Оптовая** (B2B) - через `/tochka_payments.tsx` ← **остаётся нетронутой**
