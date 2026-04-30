# 🔗 Автоматическая настройка Telegram Webhook

## Быстрая настройка через браузер

Откройте эту ссылку в браузере, заменив параметры на свои:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<PROJECT_ID>.supabase.co/functions/v1/telegram-webhook
```

### Как получить значения:

#### 1. YOUR_BOT_TOKEN
Это токен из переменной окружения `TELEGRAM_BOT_TOKEN`.  
Вы получили его при создании бота через @BotFather.

**Формат:** `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

#### 2. PROJECT_ID
Это ID вашего Supabase проекта.  
Найдите его в коде проекта в файле `/utils/supabase/info.tsx` или в Supabase Dashboard.

**Формат:** `abcdefghijklmno`

---

## Пример заполненной ссылки

```
https://api.telegram.org/bot7936420195:AAGfwc7RMbtaVFqfIL2kOpz2IzVb45G0kTc/setWebhook?url=https://wjdofxzkbxmcjkgzmbqt.supabase.co/functions/v1/telegram-webhook
```

---

## Ожидаемый ответ

После перехода по ссылке вы должны увидеть:

```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

Если видите это - **всё настроено правильно! ✅**

---

## Проверка установленного webhook

Чтобы проверить, какой webhook установлен:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

**Ожидаемый ответ:**

```json
{
  "ok": true,
  "result": {
    "url": "https://<PROJECT_ID>.supabase.co/functions/v1/telegram-webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "max_connections": 40
  }
}
```

---

## Удаление webhook (если нужно)

Если хотите отключить webhook:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook
```

---

## Настройка через curl (для продвинутых)

### Установка webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<PROJECT_ID>.supabase.co/functions/v1/telegram-webhook",
    "max_connections": 40,
    "allowed_updates": ["message"]
  }'
```

### Проверка webhook:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### Удаление webhook:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

---

## Тестирование

После установки webhook:

1. Откройте вашего бота в Telegram
2. Отправьте любое сообщение
3. Бот должен ответить: **"✅ Вы подписались на рассылку!"**

Если ответа нет - проверьте логи Edge Function в Supabase Dashboard.

---

## Важные замечания

⚠️ **Webhook можно установить только ОДИН раз**  
Если webhook уже установлен, новый вызов перезапишет старый.

⚠️ **HTTPS обязателен**  
Telegram требует HTTPS для webhook. Supabase автоматически предоставляет HTTPS.

⚠️ **Публичный доступ**  
Edge Function должна быть доступна без аутентификации для webhook.

✅ **Безопасность**  
Supabase автоматически защищает функцию через HTTPS и проверку IP Telegram.

---

## Готово! 🎉

Теперь ваш бот будет автоматически регистрировать всех пользователей в таблице `telegram_users`.
