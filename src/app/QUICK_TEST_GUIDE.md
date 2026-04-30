# ⚡ Быстрая проверка токена Точка Банк

## 🎯 Откройте диагностическую страницу

Перейдите по ссылке:
```
https://ваш-домен.com/tochka-diagnostics
```

Или если используете localhost:
```
http://localhost:5173/tochka-diagnostics
```

## 📋 Что вы увидите

1. **Нажмите кнопку "Запустить диагностику"**

2. **Проверьте результаты:**

### ✅ Если всё настроено правильно:

```
✓ TOCHKA_API_BASE
  https://enter.tochka.com

✓ TOCHKA_CUSTOMER_CODE
  303195679

✓ TOCHKA_JWT_TOKEN
  Существует: Да ✓
  Длина: 572 символов ✓
  Начало: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mio...

✓ Authorization Header
  Bearer eyJhbGciOiJSUzI1NiIsInR5c...

✅ Все настроено правильно!
Интеграция с Точка Банком готова к использованию.
```

### ❌ Если токен НЕ найден:

```
✗ TOCHKA_JWT_TOKEN
  Существует: Нет ✗
  Длина: 0 символов

⚠️ Требуется внимание
• JWT токен отсутствует - добавьте TOCHKA_JWT_TOKEN в Supabase Secrets
```

**Решение:**
1. Откройте Supabase Dashboard
2. Edge Functions → Secrets
3. Найдите `TOCHKA_JWT_TOKEN`
4. Убедитесь, что вставлен полный токен (572 символа)
5. Подождите 30-60 секунд
6. Повторите диагностику

### ⚠️ Если токен слишком короткий:

```
⚠ TOCHKA_JWT_TOKEN
  Существует: Да ✓
  Длина: 150 символов (ожидается ~572)

⚠️ Требуется внимание
• JWT токен слишком короткий - убедитесь, что скопировали его полностью
```

**Решение:**
Токен был скопирован не полностью. Вставьте весь токен:
```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3ODkzNjAyNjMwMTcyMDYzNzdmYjUxMjY1ZDFjNmY5MiIsInN1YiI6ImU4MmM2MmYzLTczYTItNDZhMy1hZjViLTgxNjg0N2Y1OTQzMyIsImN1c3RvbWVyX2NvZGUiOiIzMDMxOTU2NzkifQ.WmS0VhMkaa1qCYNhuE1nlZT77cpU1W7ln0OkG7XRBg9YaK_MksQs21y41FZw5nhZCgNFoQll8bggqXW_cZhqUQSxgJ1j7wsVgu0Wxnb4IB_3jWFRK2-E7_ASYlaCpGidkKs29spvIGQwNAx2No2vdgDnOOP0xPLNHe2J-xoUBmSR8OfAgZw635EGn-OM-uutqLfm0LaJ9aDC2EGLRZcL8dJPJRw8cPQdYV1zjrzBJOB9b3vnlkGwAkr5lzglsII7elYNBY46-PCybE6uy6iFjpLfrsvrtEhOpg6Pdyh3sIMz6VZBpMq5GCHrt_rrsFTFHPs6pq7hyzpg-MrNix0vEb5lh7W0OHmAL-IDJRdbI_Jqp503TWBa-tFleDwM9D_CKcR_qv7W66pbOh37kJrchLIw59abkrYGLXxACtLUVnwnfNUF4TXWg_dbgq20kOphhovd-EqGLb5LE0vMee7nA4GWYvyY6MLY_P5J-6IY7fSULUrdp85i2z0LLC3DEXXi
```

---

## 🚀 Следующий шаг после успешной диагностики

Если диагностика показала ✅ - попробуйте создать тестовый заказ:

1. Откройте главную страницу сайта
2. Добавьте товар в корзину
3. Оформите заказ:
   - Введите ФИО
   - Введите телефон
   - **Введите email** (обязательно!)
   - Укажите адрес доставки
4. Выберите "Онлайн-оплата"
5. Нажмите "Перейти к оплате"

### Ожидаемый результат:
- ✅ Redirect на страницу Точка Банка
- ✅ Доступны способы оплаты: Карта и СБП
- ✅ После оплаты чек приходит на email

---

## 🔍 Проверка логов (для разработчиков)

Если нужно увидеть подробные логи:

1. Откройте Supabase Dashboard
2. Edge Functions → Logs
3. Найдите секцию:

```
========================================
🔑 JWT TOKEN VERIFICATION
========================================
JWT Token exists: true
JWT Token length: 572
JWT Token first 50 chars: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mio...
Authorization header will be: Bearer eyJhbGciOiJSUzI1NiIsInR5c...
========================================
```

Если `exists: false` или `length: 0` - токен не загрузился из environment variables.

---

## 📞 Если ничего не помогает

1. Проверьте имя переменной: точно `TOCHKA_JWT_TOKEN` (без пробелов, заглавными)
2. Убедитесь, что токен вставлен БЕЗ пробелов в начале/конце
3. Подождите минуту после сохранения (Edge Function перезапускается)
4. Проверьте консоль браузера на ошибки JavaScript
5. Проверьте Network tab - должен быть запрос к `/tochka/acquiring/test-token`

---

**Полная документация:** `/TOCHKA_ACQUIRING_SETUP.md`
