> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# 🏗️ Архитектура системы Telegram-рассылок

## 📊 Общая схема

```
┌─────────────────────────────────────────────────────────────────┐
│                      TELEGRAM ECOSYSTEM                          │
│                                                                  │
│  ┌──────────────┐          ┌──────────────┐                    │
│  │  Telegram    │          │   Telegram   │                    │
│  │    Bot       │◄────────►│    User      │                    │
│  └──────┬───────┘          └──────────────┘                    │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │ Webhook (HTTPS POST)
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SUPABASE EDGE FUNCTIONS                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  /functions/v1/telegram-webhook                            │ │
│  │                                                            │ │
│  │  • Принимает update от Telegram                           │ │
│  │  • Извлекает chat_id                                      │ │
│  │  • Сохраняет в БД                                         │ │
│  │  • Отправляет подтверждение пользователю                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────┬────────────────────────────────────────────────────────┘
          │ REST API (POST)
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE POSTGRES                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  TABLE: telegram_users                                     │ │
│  │  ┌─────────────┬──────────────┬──────────────────────────┐ │ │
│  │  │ id (BIGINT) │ created_at   │  RLS Policies            │ │ │
│  │  │ (PK)        │ (TIMESTAMPTZ)│  • anon: INSERT          │ │ │
│  │  │             │              │  • service_role: ALL     │ │ │
│  │  └─────────────┴──────────────┴──────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────┬────────────────────────────────────────────────────────┘
          │
          │ Query (SELECT)
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HONO WEB SERVER                               │
│              /supabase/functions/server/                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  telegram_broadcast.tsx                                    │ │
│  │                                                            │ │
│  │  Endpoints:                                                │ │
│  │  • POST /register-telegram  → Ручная регистрация          │ │
│  │  • POST /broadcast          → Отправка рассылки           │ │
│  │  • GET  /broadcast-stats    → Статистика                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────┬────────────────────────────────────────────────────────┘
          │
          │ Telegram Bot API
          │ (sendMessage / sendPhoto)
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TELEGRAM API                                  │
│                                                                  │
│  • api.telegram.org/bot{TOKEN}/sendMessage                      │
│  • api.telegram.org/bot{TOKEN}/sendPhoto                        │
│                                                                  │
└─────────┬────────────────────────────────────────────────────────┘
          │
          │ Push notifications
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  TELEGRAM USERS                                  │
│                                                                  │
│  📱 User 1  📱 User 2  📱 User 3  ... 📱 User N                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Поток данных

### 1. Регистрация пользователя (Подписка)

```
Пользователь отправляет 
сообщение боту
      │
      ▼
Telegram отправляет webhook
на Edge Function
      │
      ▼
Edge Function извлекает chat_id
      │
      ▼
Сохранение в таблицу
telegram_users через REST API
      │
      ▼
Отправка подтверждения
пользователю через Telegram API
      │
      ▼
Пользователь получает:
"✅ Вы подписались на рассылку!"
```

**Технически:**
```javascript
// 1. Telegram → Edge Function
POST /functions/v1/telegram-webhook
Body: { message: { chat: { id: 123456789 } } }

// 2. Edge Function → Supabase DB
POST /rest/v1/telegram_users
Body: { id: 123456789, created_at: "..." }

// 3. Edge Function → Telegram API
POST https://api.telegram.org/bot{TOKEN}/sendMessage
Body: { chat_id: 123456789, text: "✅ Вы подписались..." }
```

---

### 2. Отправка рассылки

```
Админ создает рассылку
в админ-панели
      │
      ▼
Frontend загружает изображение
в Supabase Storage (если есть)
      │
      ▼
Frontend отправляет запрос
на /broadcast endpoint
      │
      ▼
Server запрашивает список
подписчиков из telegram_users
      │
      ▼
Server отправляет сообщения
всем подписчикам через Telegram API
(задержка 30мс между отправками)
      │
      ▼
Server возвращает статистику
(sent, total, errors)
      │
      ▼
Frontend отображает результат
в админ-панели
```

**Технически:**
```javascript
// 1. Frontend → Supabase Storage (если есть изображение)
POST /storage/v1/object/make-aa167a09-broadcasts/broadcasts/img.jpg
Returns: { publicUrl: "https://..." }

// 2. Frontend → Server
POST /make-server-aa167a09/broadcast
Headers: { X-Admin-Auth: "true" }
Body: { text: "...", imageUrl: "https://..." }

// 3. Server → Supabase DB
GET /rest/v1/telegram_users?select=id
Returns: [{ id: 123 }, { id: 456 }, ...]

// 4. Server → Telegram API (для каждого пользователя)
POST https://api.telegram.org/bot{TOKEN}/sendPhoto
Body: { chat_id: 123, photo: "...", caption: "..." }

// 5. Server → Frontend
Returns: { sent: 42, total: 50, errors: [...] }
```

---

## 🗂️ Структура проекта

```
/
├── supabase/
│   └── functions/
│       ├── telegram-webhook/
│       │   └── index.ts              ← Edge Function для webhook
│       └── server/
│           ├── index.tsx              ← Main Hono server
│           └── telegram_broadcast.tsx ← Broadcast API endpoints
│
├── components/
│   ├── AdminPanel.tsx                 ← Интеграция вкладки "Рассылка"
│   └── TelegramBroadcast.tsx         ← UI компонент рассылки
│
├── utils/
│   └── supabase/
│       └── info.tsx                   ← projectId, publicAnonKey
│
└── docs/                              ← Документация
    ├── TELEGRAM_BROADCAST_README.md   ← Краткая инструкция
    ├── TELEGRAM_SETUP_GUIDE.md        ← Полное руководство
    ├── TABLE_CREATION_GUIDE.md        ← Создание таблицы
    ├── WEBHOOK_SETUP.md               ← Настройка webhook
    └── TELEGRAM_SYSTEM_ARCHITECTURE.md ← Этот файл
```

---

## 🔐 Безопасность и доступ

### Row Level Security (RLS)

```sql
-- Таблица: telegram_users

┌─────────────────────────────────────────────────────────┐
│ POLICY: Allow anon insert                               │
│ Role: anon (публичный ключ)                             │
│ Operation: INSERT                                        │
│ CHECK: true                                             │
│ Purpose: Разрешает webhook добавлять новых подписчиков │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ POLICY: Allow service role all                          │
│ Role: service_role (серверный ключ)                     │
│ Operation: ALL (SELECT, INSERT, UPDATE, DELETE)         │
│ USING: true                                             │
│ Purpose: Полный доступ для backend операций             │
└─────────────────────────────────────────────────────────┘
```

### Аутентификация

```
┌────────────────────┬──────────────────────┬─────────────────┐
│ Endpoint           │ Auth Method          │ Role            │
├────────────────────┼──────────────────────┼─────────────────┤
│ telegram-webhook   │ Telegram signature   │ anon            │
│ /broadcast         │ X-Admin-Auth: true   │ service_role    │
│ /broadcast-stats   │ X-Admin-Auth: true   │ service_role    │
│ /register-telegram │ Bearer token         │ service_role    │
└────────────────────┴──────────────────────┴─────────────────┘
```

### Переменные окружения

```
┌────────────────────────────┬─────────────────────────────────┐
│ Variable                   │ Usage                           │
├────────────────────────────┼─────────────────────────────────┤
│ TELEGRAM_BOT_TOKEN         │ • Webhook функция               │
│                            │ • Отправка сообщений            │
├────────────────────────────┼─────────────────────────────────┤
│ SUPABASE_URL               │ • REST API запросы к БД         │
│                            │ • Storage операции              │
├────────────────────────────┼─────────────────────────────────┤
│ SUPABASE_ANON_KEY          │ • Frontend запросы              │
│                            │ • Публичный доступ              │
├────────────────────────────┼─────────────────────────────────┤
│ SUPABASE_SERVICE_ROLE_KEY  │ • Backend операции              │
│                            │ • Bypass RLS                    │
└────────────────────────────┴─────────────────────────────────┘
```

---

## 📊 База данных

### Таблица: telegram_users

```sql
CREATE TABLE telegram_users (
  id BIGINT PRIMARY KEY,              -- chat_id из Telegram
  created_at TIMESTAMPTZ DEFAULT NOW() -- Дата подписки
);

-- Индекс для быстрого поиска последних подписчиков
CREATE INDEX idx_telegram_users_created_at 
ON telegram_users(created_at DESC);
```

**Примеры данных:**

```
┌─────────────┬──────────────────────────┐
│ id          │ created_at               │
├─────────────┼──────────────────────────┤
│ 123456789   │ 2024-12-01 10:30:00+00   │
│ 987654321   │ 2024-12-01 11:45:00+00   │
│ 555777999   │ 2024-12-02 09:15:00+00   │
└─────────────┴──────────────────────────┘
```

**Типичные запросы:**

```sql
-- Получить всех подписчиков
SELECT id FROM telegram_users;

-- Подсчитать подписчиков
SELECT COUNT(*) FROM telegram_users;

-- Новые подписчики за сегодня
SELECT * FROM telegram_users 
WHERE created_at >= CURRENT_DATE;

-- Подписчики за последнюю неделю
SELECT DATE(created_at) as day, COUNT(*) 
FROM telegram_users 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

---

## 🎨 UI Компонент (AdminPanel)

### Структура компонента TelegramBroadcast

```
┌──────────────────────────────────────────────────────────────┐
│                    TELEGRAM РАССЫЛКА                          │
│  Отправьте сообщение всем подписчикам        [👥 42 подписчика]│
├───────────────────────────────┬──────────────────────────────┤
│  СОЗДАТЬ РАССЫЛКУ             │  СТАТУС И ИНСТРУКЦИИ         │
│                               │                              │
│  ┌─────────────────────────┐  │  ┌────────────────────────┐  │
│  │ Текст сообщения         │  │  │ ✅ Отправлено: 40/42  │  │
│  │ [Textarea]              │  │  │                        │  │
│  │                         │  │  │ ❌ Ошибки:            │  │
│  │                         │  │  │ • Chat 123: blocked   │  │
│  └─────────────────────────┘  │  └────────────────────────┘  │
│                               │                              │
│  ┌─────────────────────────┐  │  ┌────────────────────────┐  │
│  │ Изображение             │  │  │ НАСТРОЙКА БОТА         │  │
│  │ [Upload area]           │  │  │                        │  │
│  │ или [Preview image]     │  │  │ Webhook URL:           │  │
│  └─────────────────────────┘  │  │ https://...            │  │
│                               │  │                        │  │
│  [ Отправить рассылку ]       │  │ Project ID: xyz        │  │
│                               │  └────────────────────────┘  │
└───────────────────────────────┴──────────────────────────────┘
```

### Состояния UI

```javascript
// Состояния компонента
const [text, setText] = useState('')                // Текст сообщения
const [imageFile, setImageFile] = useState(null)    // Файл изображения
const [imagePreview, setImagePreview] = useState(null) // Превью
const [imageUrl, setImageUrl] = useState(null)      // URL после загрузки
const [isUploading, setIsUploading] = useState(false) // Загрузка файла
const [isSending, setIsSending] = useState(false)   // Отправка рассылки
const [stats, setStats] = useState(null)            // Статистика подписчиков
const [result, setResult] = useState(null)          // Результат отправки
```

---

## ⚡ Производительность

### Оптимизации

1. **Задержка между отправками: 30мс**
   ```javascript
   await new Promise(resolve => setTimeout(resolve, 30));
   ```
   - Защита от Telegram flood limit
   - 33 сообщения в секунду
   - Для 1000 пользователей: ~30 секунд

2. **Индексация БД**
   ```sql
   CREATE INDEX idx_telegram_users_created_at 
   ON telegram_users(created_at DESC);
   ```
   - Быстрая выборка последних подписчиков
   - Эффективная сортировка

3. **Мемоизация Supabase клиента**
   ```javascript
   const supabase = useMemo(() => createClient(...), []);
   ```
   - Предотвращает создание множественных экземпляров
   - Избегает ошибки "GoTrueClient already exists"

4. **Batch операции**
   ```javascript
   // Одним запросом получаем всех пользователей
   SELECT id FROM telegram_users;
   ```
   - Минимизация запросов к БД

---

## 🔍 Мониторинг и метрики

### Ключевые метрики

```
┌─────────────────────────┬──────────────────────────────┐
│ Метрика                 │ Как получить                 │
├─────────────────────────┼──────────────────────────────┤
│ Всего подписчиков       │ SELECT COUNT(*) FROM ...     │
│ Новые сегодня           │ WHERE created_at >= TODAY    │
│ Успешно отправлено      │ result.sent                  │
│ Ошибки отправки         │ result.errors.length         │
│ Success rate            │ sent / total * 100%          │
└─────────────────────────┴──────────────────────────────┘
```

### Логирование

**Edge Function (telegram-webhook):**
```
✅ User saved to database
✅ Confirmation sent to user
❌ Failed to save user to database
❌ Failed to send Telegram message
```

**Server (telegram_broadcast):**
```
✅ Broadcast started: 42 users
✅ Sent to chat_id: 123456789
❌ Error sending to chat_id 987654321: User blocked bot
✅ Broadcast completed: 40/42 sent
```

---

## 🧪 Тестирование

### Тест 1: Подписка пользователя

```bash
# 1. Установить webhook
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=..."

# 2. Отправить сообщение боту в Telegram
# Ожидаемый результат: "✅ Вы подписались на рассылку!"

# 3. Проверить БД
SELECT * FROM telegram_users ORDER BY created_at DESC LIMIT 1;
# Должна быть запись с вашим chat_id
```

### Тест 2: Отправка текстовой рассылки

```javascript
// В админ-панели
1. Открыть "Опт" → "Рассылка"
2. Ввести текст: "🧪 Тест"
3. Нажать "Отправить рассылку"
4. Проверить результат: sent > 0, errors = []
5. Проверить Telegram: должно прийти сообщение
```

### Тест 3: Отправка с изображением

```javascript
1. Выбрать изображение (до 5MB)
2. Дождаться загрузки (появится галочка)
3. Добавить текст (опционально)
4. Отправить
5. Проверить: изображение и текст пришли в Telegram
```

### Тест 4: Обработка ошибок

```javascript
// Создать пользователя с невалидным chat_id
INSERT INTO telegram_users (id) VALUES (999999999999);

// Отправить рассылку
// Ожидаемый результат: 
// sent: N-1, errors: [{ chat_id: 999999999999, error: "..." }]
```

---

## 🚀 Масштабирование

### Текущие ограничения

```
┌─────────────────────────┬─────────────┬──────────────────┐
│ Параметр                │ Лимит       │ Как увеличить    │
├─────────────────────────┼─────────────┼──────────────────┤
│ Telegram flood limit    │ 30 msg/sec  │ Нельзя изменить  │
│ Supabase Storage        │ 1GB free    │ Upgrade план     │
│ Edge Function timeout   │ 150 sec     │ Разбить на batch │
│ DB connections          │ 60 (free)   │ Upgrade план     │
└─────────────────────────┴─────────────┴──────────────────┘
```

### Для большого количества подписчиков (>5000)

**Вариант 1: Batch отправка**
```javascript
// Разбить пользователей на группы по 1000
const batchSize = 1000;
for (let i = 0; i < users.length; i += batchSize) {
  const batch = users.slice(i, i + batchSize);
  await sendBatch(batch);
  // Пауза между батчами
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

**Вариант 2: Background jobs**
```javascript
// Использовать Supabase Edge Functions + Queue
// 1. Создать задачу в очереди
// 2. Worker обрабатывает задачи по расписанию
// 3. Статус обновляется в реальном времени
```

**Вариант 3: Внешний сервис**
```javascript
// Для >10k подписчиков рассмотреть:
// - Sendinblue
// - OneSignal
// - Firebase Cloud Messaging
```

---

## 📈 Будущие улучшения

### Возможные расширения

1. **Сегментация подписчиков**
   ```sql
   ALTER TABLE telegram_users ADD COLUMN tags TEXT[];
   -- Отправка только определенным сегментам
   ```

2. **История рассылок**
   ```sql
   CREATE TABLE broadcasts (
     id UUID PRIMARY KEY,
     text TEXT,
     image_url TEXT,
     sent_count INT,
     created_at TIMESTAMPTZ
   );
   ```

3. **Отложенные рассылки**
   ```javascript
   // Запланировать отправку на определенное время
   { text: "...", scheduled_at: "2024-12-10 10:00:00" }
   ```

4. **A/B тестирование**
   ```javascript
   // Отправить разные варианты разным группам
   { variantA: "...", variantB: "...", split: 0.5 }
   ```

5. **Rich media**
   ```javascript
   // Поддержка видео, документов, голосовых
   { type: "video", url: "...", caption: "..." }
   ```

6. **Inline кнопки**
   ```javascript
   {
     text: "...",
     buttons: [
       [{ text: "Перейти", url: "https://..." }],
       [{ text: "Подробнее", callback_data: "more" }]
     ]
   }
   ```

7. **Аналитика**
   ```javascript
   // Отслеживание открытий, кликов, конверсий
   { broadcast_id: "...", opens: 42, clicks: 15 }
   ```

---

## 📞 Поддержка

### Диагностика проблем

**Проблема: Webhook не работает**
```bash
# Проверка
curl "https://api.telegram.org/bot{TOKEN}/getWebhookInfo"

# Ожидаемый ответ
{
  "url": "https://{PROJECT}.supabase.co/functions/v1/telegram-webhook",
  "pending_update_count": 0  # ← Должно быть 0
}
```

**Проблема: Ошибка БД**
```sql
-- Проверка таблицы
SELECT * FROM information_schema.tables 
WHERE table_name = 'telegram_users';

-- Проверка политик
SELECT * FROM pg_policies 
WHERE tablename = 'telegram_users';
```

**Проблема: Рассылка не отправляется**
```javascript
// Проверка в console браузера
// 1. Network tab → проверить запрос к /broadcast
// 2. Console tab → проверить ошибки
// 3. Supabase Dashboard → Edge Functions → Logs
```

---

## ✅ Итоговый чеклист

- [x] Таблица `telegram_users` создана
- [x] RLS политики настроены
- [x] Edge Function `telegram-webhook` создана
- [x] API endpoints в `telegram_broadcast.tsx` реализованы
- [x] UI компонент `TelegramBroadcast.tsx` создан
- [x] Интеграция в `AdminPanel.tsx` добавлена
- [x] Webhook настроен и активен
- [x] Документация написана
- [x] Система протестирована

---

**Система готова к продакшн использованию! 🎉**

*Архитектурная документация v1.0*  
*Последнее обновление: Декабрь 2024*
