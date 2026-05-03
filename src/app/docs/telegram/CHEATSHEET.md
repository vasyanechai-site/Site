> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# 📝 Шпаргалка: Telegram-рассылка

## 🚀 Быстрые команды

### Создать таблицу в БД
```sql
CREATE TABLE telegram_users (
  id BIGINT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Настроить webhook (Node.js)
```bash
node docs/telegram/setup-webhook.js <BOT_TOKEN>
```

### Настроить webhook (Bash)
```bash
chmod +x docs/telegram/setup-webhook.sh
./docs/telegram/setup-webhook.sh <BOT_TOKEN>
```

### Настроить webhook (curl)
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/telegram-webhook",
    "allowed_updates": ["message"]
  }'
```

### Проверить webhook
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

### Удалить webhook
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"
```

### Тестировать систему
```bash
chmod +x docs/telegram/test-system.sh
./docs/telegram/test-system.sh <BOT_TOKEN> <CHAT_ID>
```

---

## 🔗 Важные URL

| Ресурс | URL |
|--------|-----|
| Webhook URL | `https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/telegram-webhook` |
| Server Base | `https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09` |
| Supabase Dashboard | `https://supabase.com/dashboard/project/pkhinqiplfezrzvsqgwo` |
| Telegram API | `https://api.telegram.org/bot<TOKEN>` |

---

## 📡 API Endpoints

### Webhook Management

```bash
# Установить webhook
curl -X POST "${SERVER_BASE}/telegram/webhook/setup" \
  -H "Authorization: Bearer ${ANON_KEY}"

# Информация о webhook
curl "${SERVER_BASE}/telegram/webhook/info" \
  -H "Authorization: Bearer ${ANON_KEY}"

# Удалить webhook
curl -X DELETE "${SERVER_BASE}/telegram/webhook/delete" \
  -H "Authorization: Bearer ${ANON_KEY}"

# Тестировать бота
curl -X POST "${SERVER_BASE}/telegram/webhook/test" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"chatId": "123456789"}'
```

### Broadcasting

```bash
# Отправить рассылку
curl -X POST "${SERVER_BASE}/telegram/broadcast" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Текст сообщения",
    "imageUrl": "https://..."
  }'

# Количество подписчиков
curl "${SERVER_BASE}/telegram/subscribers/count" \
  -H "Authorization: Bearer ${ANON_KEY}"
```

---

## 🐛 Отладка

### Проверка компонентов

```bash
# 1. Проверка бота
curl "https://api.telegram.org/bot<TOKEN>/getMe"

# 2. Проверка webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# 3. Проверка Edge Function (должен вернуть 405)
curl -I "https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/telegram-webhook"

# 4. Отправка тестового сообщения
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": 123456789, "text": "Test"}'
```

### Логи в Supabase

1. **Edge Function logs:**
   - Dashboard → Functions → `telegram-webhook` → Logs

2. **Server logs:**
   - Dashboard → Functions → `make-server-aa167a09` → Logs

3. **Database logs:**
   - Dashboard → Table Editor → `telegram_users`

---

## ❌ Типичные ошибки

| Ошибка | Команда для исправления |
|--------|-------------------------|
| Table doesn't exist | См. SQL выше для создания таблицы |
| Webhook deleted | `./setup-webhook.sh <TOKEN>` |
| Wrong response: 500 | Проверьте логи Edge Function |
| Unauthorized (401) | Проверьте `SUPABASE_ANON_KEY` |

---

## 📋 Переменные окружения

```bash
# Для локальной разработки
export PROJECT_ID="pkhinqiplfezrzvsqgwo"
export SUPABASE_URL="https://${PROJECT_ID}.supabase.co"
export SUPABASE_ANON_KEY="eyJhbGc..."
export TELEGRAM_BOT_TOKEN="123456:ABC..."
```

---

## 🧪 Быстрый тест

```bash
# 1. Получить токен (из Supabase Dashboard)
TOKEN="ваш_токен"

# 2. Настроить webhook
curl -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/telegram-webhook"}'

# 3. Проверить
curl "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"

# 4. Написать боту в Telegram
# Должен ответить: "✅ Вы подписались на рассылку!"
```

---

## 📱 Telegram Bot Commands

```
/start - Начать использование бота
(любое сообщение) - Подписаться на рассылку
```

*Примечание: Команды обрабатываются автоматически Edge Function*

---

## 🔐 Безопасность

✅ **Токен бота** хранится в переменных окружения Supabase  
✅ **Webhook** защищен Telegram (только от Telegram API)  
✅ **Server endpoints** защищены Bearer токеном  
✅ **База данных** защищена RLS (если настроено)

---

## 📊 Мониторинг

### Проверка здоровья системы

```bash
# Статус webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | jq '.result'

# Количество подписчиков
curl "https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/telegram/subscribers/count" \
  -H "Authorization: Bearer <ANON_KEY>"

# Последняя ошибка webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | jq '.result.last_error_message'
```

---

## 🎯 Быстрый старт за 60 секунд

```bash
# 1. Создать таблицу (в Supabase SQL Editor)
CREATE TABLE telegram_users (id BIGINT PRIMARY KEY, created_at TIMESTAMP DEFAULT NOW());

# 2. Настроить webhook
node docs/telegram/setup-webhook.js <TOKEN>

# 3. Написать боту в Telegram
# Готово!
```

---

## 📚 Полная документация

- [Настройка прямо сейчас](./SETUP_NOW.md) ⚡
- [Быстрый старт](./QUICK_START.md) 🚀
- [Подробная настройка](./WEBHOOK_SETUP_SCRIPT.md) 🔧
- [README](./README.md) 📖

---

**Совет:** Сохраните эту шпаргалку в закладки для быстрого доступа!
