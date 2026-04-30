# Скрипт быстрой настройки Telegram Webhook

## Автоматическая настройка через админ-панель (рекомендуется)

1. Откройте админ-панель магазина
2. Перейдите в раздел **"Рассылка"** (вкладка "Broadcast")
3. В блоке **"Настройка Webhook"** нажмите кнопку **"Установить webhook"**
4. Система автоматически настроит webhook и покажет результат

✅ Готово! Теперь бот будет получать сообщения от пользователей.

---

## Ручная настройка через cURL (альтернативный способ)

Если по какой-то причине настройка через админ-панель не работает, можно настроить webhook вручную:

### 1. Получите ваши данные

- **Project ID**: `pkhinqiplfezrzvsqgwo` (из `/utils/supabase/info.tsx`)
- **Bot Token**: значение переменной `TELEGRAM_BOT_TOKEN` из Supabase Dashboard

### 2. Выполните команду

```bash
curl -X POST "https://api.telegram.org/bot<ВАШ_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/telegram-webhook",
    "allowed_updates": ["message"]
  }'
```

**Замените `<ВАШ_BOT_TOKEN>` на реальный токен!**

### 3. Проверьте результат

Ответ должен быть:
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

---

## Проверка работы webhook

### Через админ-панель:

1. В разделе "Рассылка" нажмите кнопку обновления (иконка 🔄)
2. Проверьте, что поле "URL" заполнено
3. Убедитесь, что "Необработанных обновлений" равно 0

### Через cURL:

```bash
curl "https://api.telegram.org/bot<ВАШ_BOT_TOKEN>/getWebhookInfo"
```

Ответ должен содержать:
```json
{
  "ok": true,
  "result": {
    "url": "https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/telegram-webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## Тестирование бота

### 1. Получите Chat ID

Напишите боту любое сообщение в Telegram. Бот автоматически:
- Сохранит ваш Chat ID в базу данных
- Ответит: "✅ Вы подписались на рассылку!"

### 2. Проверьте через админ-панель

1. В разделе "Рассылка" введите ваш Chat ID в поле "Chat ID для тестирования"
2. Нажмите "Отправить тестовое сообщение"
3. Проверьте, что сообщение пришло в Telegram

### 3. Отправьте рассылку

1. В разделе "Рассылка" создайте текст сообщения
2. (Опционально) Добавьте изображение
3. Нажмите "Отправить рассылку"
4. Все подписанные пользователи получат сообщение

---

## Возможные проблемы и решения

### ❌ "Webhook was deleted"

**Причина**: Webhook был удален или не настроен.

**Решение**: Повторите настройку webhook через админ-панель или cURL.

---

### ❌ "Wrong response from the webhook: 500 Internal Server Error"

**Причина**: Таблица `telegram_users` не создана в базе данных.

**Решение**: Создайте таблицу в Supabase Dashboard → SQL Editor:

```sql
CREATE TABLE telegram_users (
  id BIGINT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### ❌ "Conflict: can't use getUpdates method while webhook is active"

**Причина**: Вы пытаетесь использовать метод `getUpdates` при активном webhook.

**Решение**: Используйте только один способ получения обновлений (webhook ИЛИ long polling). Для этого проекта используется webhook.

---

### ❌ Бот не отвечает на сообщения

**Шаги отладки**:

1. Проверьте webhook через админ-панель (кнопка обновления 🔄)
2. Убедитесь, что поле "URL" заполнено
3. Проверьте логи Edge Function в Supabase Dashboard:
   - Functions → `telegram-webhook` → Logs
4. Убедитесь, что переменные окружения настроены:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

---

## Дополнительная информация

### Архитектура системы

```
Пользователь → Telegram API → Supabase Edge Function (telegram-webhook)
                                        ↓
                                 Сохранение в БД
                                        ↓
                                 Ответ пользователю
```

### Полезные ссылки

- [Telegram Bot API - Webhooks](https://core.telegram.org/bots/api#setwebhook)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Документация проекта](/docs/telegram/QUICK_START.md)

---

## Быстрая команда для сброса и повторной настройки

Если нужно полностью сбросить webhook и настроить заново:

```bash
# 1. Удалить webhook
curl -X POST "https://api.telegram.org/bot<ВАШ_BOT_TOKEN>/deleteWebhook"

# 2. Установить webhook заново
curl -X POST "https://api.telegram.org/bot<ВАШ_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/telegram-webhook",
    "allowed_updates": ["message"]
  }'

# 3. Проверить статус
curl "https://api.telegram.org/bot<ВАШ_BOT_TOKEN>/getWebhookInfo"
```

---

**Готово!** Теперь ваш Telegram бот полностью настроен и готов к приему сообщений от пользователей.
