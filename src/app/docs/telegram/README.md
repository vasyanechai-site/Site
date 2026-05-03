> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# 📱 Документация Telegram-рассылки

Полная документация по системе Telegram-рассылки для интернет-магазина кофе.

---

## 📚 Содержание

### 🚀 [Быстрый старт](./QUICK_START.md)
Пошаговая инструкция для быстрой настройки системы (2 минуты).

**Включает:**
- ✅ Создание таблицы в БД
- ✅ Автоматическая настройка webhook через админ-панель
- ✅ Проверка работы системы

**Для кого:** Начинающие пользователи, быстрая настройка с нуля.

---

### 🔧 [Подробная настройка Webhook](./WEBHOOK_SETUP_SCRIPT.md)
Детальное руководство по настройке и отладке webhook.

**Включает:**
- 📋 Настройка через админ-панель (рекомендуется)
- 💻 Ручная настройка через cURL
- 🧪 Тестирование работы бота
- 🔍 Решение типичных проблем
- 📊 Проверка статуса и логов

**Для кого:** Продвинутые пользователи, отладка проблем.

---

### 📜 Скрипты для автоматизации

#### 1. [Node.js скрипт](./setup-webhook.js)
```bash
node setup-webhook.js <BOT_TOKEN>
```

**Возможности:**
- Проверка текущего webhook
- Автоматическая установка
- Валидация результата
- Детальный вывод статуса

**Требования:** Node.js

---

#### 2. [Bash скрипт](./setup-webhook.sh)
```bash
chmod +x setup-webhook.sh
./setup-webhook.sh <BOT_TOKEN>
```

**Возможности:**
- Цветной вывод в терминал
- Проверка и установка webhook
- Обработка ошибок
- Вывод детальной информации

**Требования:** bash, curl

---

## 🎯 Что выбрать?

| Сценарий | Рекомендация |
|----------|--------------|
| Первая настройка | [Быстрый старт](./QUICK_START.md) → Админ-панель |
| Проблемы с webhook | [Подробная настройка](./WEBHOOK_SETUP_SCRIPT.md) |
| Автоматизация развертывания | [Node.js скрипт](./setup-webhook.js) |
| CI/CD или серверная настройка | [Bash скрипт](./setup-webhook.sh) |

---

## 🏗️ Архитектура системы

```
┌──────────────────┐
│  Пользователь    │
│   в Telegram     │
└────────┬─────────┘
         │
         │ Отправляет сообщение боту
         ↓
┌──────────────────────────────────────┐
│       Telegram Bot API               │
│       (Webhook активен)              │
└────────┬─────────────────────────────┘
         │
         │ POST запрос на webhook URL
         ↓
┌──────────────────────────────────────┐
│   Supabase Edge Function             │
│   /telegram-webhook                  │
│                                      │
│   1. Извлекает chat_id из update     │
│   2. Сохраняет в таблицу             │
│   3. Отправляет подтверждение        │
└────────┬─────────────────────────────┘
         │
         │ REST API запрос
         ↓
┌──────────────────────────────────────┐
│   PostgreSQL Database                │
│                                      │
│   Таблица: telegram_users            │
│   - id (BIGINT, PRIMARY KEY)         │
│   - created_at (TIMESTAMP)           │
└──────────────────────────────────────┘


   ┌────────────────────────────────┐
   │   Админ-панель                 │
   │   /components/AdminPanel.tsx   │
   │                                │
   │   Вкладка "Рассылка":          │
   │   ├─ TelegramWebhookManager    │
   │   └─ TelegramBroadcast         │
   └────────────────────────────────┘
            │
            │ REST API запросы
            ↓
   ┌────────────────────────────────┐
   │   Hono Server                  │
   │   /make-server-aa167a09        │
   │                                │
   │   Endpoints:                   │
   │   ├─ /telegram/webhook/*       │
   │   ├─ /telegram/broadcast       │
   │   └─ /telegram/subscribers/*   │
   └────────────────────────────────┘
```

---

## 📂 Структура файлов проекта

```
/
├── supabase/
│   └── functions/
│       ├── telegram-webhook/
│       │   └── index.ts              # Edge Function для webhook
│       └── server/
│           ├── telegram_broadcast.tsx # Роуты рассылки
│           └── telegram_webhook_setup.tsx # Утилиты настройки webhook
│
├── components/
│   ├── TelegramBroadcast.tsx         # UI рассылки
│   ├── TelegramWebhookManager.tsx    # UI управления webhook
│   └── AdminPanel.tsx                # Интеграция в админ-панель
│
└── docs/
    └── telegram/
        ├── README.md                 # Этот файл
        ├── QUICK_START.md            # Быстрый старт
        ├── WEBHOOK_SETUP_SCRIPT.md   # Подробная настройка
        ├── setup-webhook.js          # Node.js скрипт
        └── setup-webhook.sh          # Bash скрипт
```

---

## 🔑 Переменные окружения

Все переменные уже настроены в Supabase Dashboard:

| Переменная | Описание | Где используется |
|------------|----------|------------------|
| `TELEGRAM_BOT_TOKEN` | Токен бота из BotFather | Webhook, Рассылка |
| `SUPABASE_URL` | URL проекта Supabase | Все серверные функции |
| `SUPABASE_ANON_KEY` | Публичный ключ Supabase | Webhook, REST API |
| `SUPABASE_SERVICE_ROLE_KEY` | Сервисный ключ (admin) | Не используется в рассылке |

---

## 🛠️ API Endpoints

### Управление webhook

#### Установить webhook
```http
POST /make-server-aa167a09/telegram/webhook/setup
Authorization: Bearer <SUPABASE_ANON_KEY>
```

**Ответ:**
```json
{
  "success": true,
  "message": "Webhook успешно настроен",
  "info": {
    "url": "https://...supabase.co/functions/v1/telegram-webhook",
    "response": { ... }
  }
}
```

#### Получить информацию
```http
GET /make-server-aa167a09/telegram/webhook/info
Authorization: Bearer <SUPABASE_ANON_KEY>
```

**Ответ:**
```json
{
  "success": true,
  "info": {
    "url": "https://...supabase.co/functions/v1/telegram-webhook",
    "pending_update_count": 0,
    "last_error_message": null
  }
}
```

#### Удалить webhook
```http
DELETE /make-server-aa167a09/telegram/webhook/delete
Authorization: Bearer <SUPABASE_ANON_KEY>
```

#### Тестировать бота
```http
POST /make-server-aa167a09/telegram/webhook/test
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json

{
  "chatId": "123456789"
}
```

### Рассылка

#### Отправить рассылку
```http
POST /make-server-aa167a09/telegram/broadcast
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json

{
  "text": "Текст сообщения",
  "imageUrl": "https://..." // опционально
}
```

#### Получить количество подписчиков
```http
GET /make-server-aa167a09/telegram/subscribers/count
Authorization: Bearer <SUPABASE_ANON_KEY>
```

---

## 🧪 Тестирование

### 1. Проверка webhook

**Через админ-панель:**
1. Откройте раздел "Рассылка"
2. Нажмите кнопку обновления (🔄)
3. Проверьте статус

**Через curl:**
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

### 2. Тестовое сообщение

**Через админ-панель:**
1. Введите ваш Chat ID
2. Нажмите "Отправить тестовое сообщение"

**Через curl:**
```bash
curl -X POST "https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/telegram/webhook/test" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"chatId": "123456789"}'
```

### 3. Проверка подписчиков

**Через Supabase Dashboard:**
1. Перейдите в Table Editor
2. Откройте таблицу `telegram_users`
3. Проверьте список Chat ID

---

## 🐛 Отладка

### Просмотр логов

#### Edge Function (webhook)
1. Supabase Dashboard → Functions
2. Выберите `telegram-webhook`
3. Перейдите на вкладку "Logs"

#### Hono Server (рассылка)
1. Supabase Dashboard → Functions
2. Выберите `make-server-aa167a09`
3. Перейдите на вкладку "Logs"

### Типичные ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| "Table doesn't exist" | Таблица не создана | Создайте таблицу (см. Quick Start) |
| "Wrong response: 500" | Оши��ка на сервере | Проверьте логи Edge Function |
| "Webhook deleted" | Webhook не установлен | Установите webhook через админ-панель |
| "No subscribers" | Нет подписчиков | Напишите боту сообщение |

---

## 🎓 Дополнительные ресурсы

### Официальная документация

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Webhooks](https://core.telegram.org/bots/api#setwebhook)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Hono Web Framework](https://hono.dev/)

### Внутренние ресурсы

- [Основной README проекта](/README.md)
- [Документация по API](/docs/api/)
- [Changelog](/CHANGELOG.md)

---

## 💡 Советы

1. **Всегда используйте админ-панель** для управления webhook - это самый простой способ
2. **Проверяйте логи** при возникновении проблем
3. **Тестируйте на своем Chat ID** перед массовой рассылкой
4. **Сохраняйте токен бота в секрете** - не публикуйте его
5. **Мониторьте количество ошибок** в информации о webhook

---

## 📞 Поддержка

Если у вас возникли вопросы или проблемы:

1. Проверьте [Быстрый старт](./QUICK_START.md)
2. Изучите [Подробную настройку](./WEBHOOK_SETUP_SCRIPT.md)
3. Проверьте логи в Supabase Dashboard
4. Убедитесь, что все переменные окружения настроены

---

**Последнее обновление:** Декабрь 2024
