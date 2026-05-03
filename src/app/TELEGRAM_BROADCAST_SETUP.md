> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# Настройка Telegram-бота для рассылки

## Обзор
Система позволяет отправлять массовые рассылки всем подписчикам вашего Telegram-бота. Пользователи автоматически регистрируются при первом сообщении боту.

## Архитектура

```
Telegram Bot → API /register-telegram → KV Store
Admin Panel → API /broadcast → Telegram API → Users
```

## 1. Регистрация пользователей

Ваш Telegram-бот должен автоматически регистрировать пользователей при любом входящем сообщении.

### Node.js (Telegraf)

```javascript
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.on('message', async (ctx) => {
  try {
    // Регистрируем пользователя в системе
    await fetch(
      'https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/register-telegram',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_ANON_KEY'
        },
        body: JSON.stringify({
          chat_id: ctx.chat.id
        })
      }
    );
    
    // Отправляем подтверждение пользователю
    await ctx.reply('Спасибо! Вы подписались на рассылку ✅');
  } catch (error) {
    console.error('Error registering user:', error);
  }
});

bot.launch();
```

### Python (python-telegram-bot)

```python
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters
import requests
import os

SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co"
ANON_KEY = "YOUR_ANON_KEY"

async def handle_message(update: Update, context):
    chat_id = update.effective_chat.id
    
    # Регистрируем пользователя
    try:
        response = requests.post(
            f"{SUPABASE_URL}/functions/v1/make-server-aa167a09/register-telegram",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {ANON_KEY}"
            },
            json={"chat_id": chat_id}
        )
        
        if response.ok:
            await update.message.reply_text("Спасибо! Вы подписались на рассылку ✅")
    except Exception as e:
        print(f"Error registering user: {e}")

app = ApplicationBuilder().token(os.getenv("TELEGRAM_BOT_TOKEN")).build()
app.add_handler(MessageHandler(filters.ALL, handle_message))
app.run_polling()
```

## 2. Использование админ-панели

1. Войдите в админ-панель
2. Перейдите в раздел "Опт" → "Рассылка"
3. Заполните текст сообщения (поддерживается HTML)
4. При необходимости загрузите изображение (JPG, PNG, WebP, макс 5MB)
5. Нажмите "Отправить рассылку"

### Поддерживаемые HTML теги

- `<b>Жирный текст</b>`
- `<i>Курсив</i>`
- `<u>Подчеркнутый</u>`
- `<s>Зачеркнутый</s>`
- `<code>Код</code>`
- `<pre>Блок кода</pre>`
- `<a href="https://example.com">Ссылка</a>`

### Пример сообщения

```html
<b>🎉 Новое поступление!</b>

Встречайте свежую партию кофе из Эфиопии:
• Эфиопия Иргачиф
• Обработка: мытая
• Q Score: 86

<i>Скидка 10% до конца недели!</i>

<a href="https://yoursite.com/catalog">Перейти в каталог</a>
```

## 3. API Endpoints

### POST /api/register-telegram
Регистрирует нового пользователя для рассылки.

**Request:**
```json
{
  "chat_id": 123456789
}
```

**Response:**
```json
{
  "success": true,
  "chat_id": 123456789
}
```

### POST /api/broadcast
Отправляет рассылку всем зарегистрированным пользователям.

**Headers:**
- `X-Admin-Auth: true` (требуется)

**Request:**
```json
{
  "text": "Текст сообщения",
  "imageUrl": "https://example.com/image.jpg" // необязательно
}
```

**Response:**
```json
{
  "sent": 45,
  "total": 50,
  "errors": [
    {
      "chat_id": 123,
      "error": "Forbidden: bot was blocked by the user"
    }
  ]
}
```

### GET /api/broadcast-stats
Получает статистику подписчиков.

**Headers:**
- `X-Admin-Auth: true` (требуется)

**Response:**
```json
{
  "total_users": 150,
  "users": [
    {
      "chat_id": 123456789,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## 4. Хранение данных

Данные пользователей хранятся в KV Store с префиксом `telegram_user_`:

```
telegram_user_123456789 → {
  "chat_id": 123456789,
  "created_at": "2024-01-15T10:30:00Z"
}
```

## 5. Ограничения Telegram API

- **Задержка между сообщениями:** 30 мс (автоматически)
- **Лимит сообщений:** ~30 сообщений/секунду
- **Размер изображения:** до 5MB
- **Форматы изображений:** JPG, PNG, WebP
- **Длина текста:** до 4096 символов для текста, до 1024 для caption

## 6. Обработка ошибок

Система автоматически обрабатывает следующие ошибки:
- Пользователь заблокировал бота
- Неверный chat_id
- Превышен лимит запросов
- Проблемы с сетью

Все ошибки логируются и отображаются в результатах рассылки.

## 7. Безопасность

- ✅ Используется существующий `TELEGRAM_BOT_TOKEN` из переменных окружения
- ✅ Требуется админская авторизация для отправки рассылки
- ✅ Изображения хранятся в Supabase Storage с публичным доступом
- ✅ Rate limiting на стороне Telegram API

## 8. Тестирование

1. Запустите бота локально
2. Отправьте любое сообщение боту
3. Проверьте регистрацию в админ-панели (должно показать "1 подписчик")
4. Создайте тестовую рассылку
5. Проверьте получение сообщения

## Поддержка

Если возникли проблемы:
1. Проверьте логи сервера в Supabase Edge Functions
2. Убедитесь что `TELEGRAM_BOT_TOKEN` установлен
3. Проверьте что бот не заблокирован пользователями
4. Проверьте формат изображений (должны быть доступны по URL)
