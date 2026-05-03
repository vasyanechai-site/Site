> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# 📱 Полное руководство по настройке Telegram-рассылок

Это руководство содержит пошаговые инструкции по настройке системы Telegram-рассылок для вашего проекта.

---

## 🎯 Что входит в систему

1. ✅ **Telegram Webhook** - автоматическая регистрация пользователей через бота
2. ✅ **База данных** - таблица `telegram_users` для хранения подписчиков
3. ✅ **API рассылок** - отправка текста и изображений всем подписчикам
4. ✅ **Админ-панель** - удобный UI для создания и отправки рассылок
5. ✅ **Статистика** - отслеживание подписчиков и результатов рассылок

---

## 📋 Шаг 1: Создание таблицы в Supabase

### Вариант A: Через SQL Editor (рекомендуется)

1. Откройте **Supabase Dashboard**
2. Перейдите в раздел **SQL Editor**
3. Создайте новый запрос и выполните:

```sql
-- Создание таблицы для Telegram пользователей
CREATE TABLE IF NOT EXISTS telegram_users (
  id BIGINT PRIMARY KEY,           -- chat_id пользователя из Telegram
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Создание индекса для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_telegram_users_created_at 
ON telegram_users(created_at DESC);

-- Включение Row Level Security (RLS)
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

-- Политика: анонимные пользователи могут вставлять записи
CREATE POLICY "Allow anon insert" 
ON telegram_users 
FOR INSERT 
TO anon 
WITH CHECK (true);

-- Политика: сервисная роль имеет полный доступ
CREATE POLICY "Allow service role all" 
ON telegram_users 
FOR ALL 
TO service_role 
USING (true);
```

4. Нажмите **Run** для выполнения

### Вариант B: Через Table Editor

1. Откройте **Supabase Dashboard**
2. Перейдите в раздел **Table Editor**
3. Нажмите **New Table**
4. Настройте таблицу:
   - **Name**: `telegram_users`
   - **Description**: Telegram subscribers for broadcast
5. Добавьте колонки:
   - **id**: `int8` (BIGINT), Primary Key, без автоинкремента
   - **created_at**: `timestamptz`, Default value: `now()`
6. Сохраните таблицу

---

## 🔧 Шаг 2: Настройка Telegram Webhook

После публикации функции `telegram-webhook` нужно подключить её к вашему боту.

### Автоматическая настройка (рекомендуется)

Выполните этот запрос в браузере или через curl:

```bash
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<PROJECT_ID>.supabase.co/functions/v1/telegram-webhook
```

**Замените:**
- `<YOUR_BOT_TOKEN>` на ваш токен бота
- `<PROJECT_ID>` на ID вашего Supabase проекта

### Пример с curl:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<PROJECT_ID>.supabase.co/functions/v1/telegram-webhook"}'
```

### Проверка статуса webhook:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "result": {
    "url": "https://<PROJECT_ID>.supabase.co/functions/v1/telegram-webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## 🚀 Шаг 3: Публикация Edge Function

Edge Function `telegram-webhook` уже создана в файле `/supabase/functions/telegram-webhook/index.ts`.

### Как опубликовать (в Supabase Dashboard):

1. Откройте **Supabase Dashboard**
2. Перейдите в **Edge Functions**
3. Код автоматически синхронизирован из проекта
4. Убедитесь, что функция активна

**URL функции:**
```
https://<PROJECT_ID>.supabase.co/functions/v1/telegram-webhook
```

---

## 📊 Шаг 4: Использование системы

### Админ-панель

1. Войдите в админ-панель вашего сайта
2. Выберите раздел **"Опт"**
3. Перейдите на вкладку **"Рассылка"**
4. Вы увидите:
   - 📝 Форму для создания рассылки
   - 📊 Статистику подписчиков
   - 📈 Результаты отправленных рассылок

### Создание рассылки

1. **Текст сообщения** (необязательно):
   - Введите текст рассылки
   - Поддерживается HTML: `<b>жирный</b>`, `<i>курсив</i>`, `<a href="...">ссылка</a>`

2. **Изображение** (необязательно):
   - Нажмите на область загрузки
   - Выберите изображение (JPG, PNG, WebP)
   - Максимальный размер: 5MB
   - Изображение автоматически загрузится в Supabase Storage

3. **Отправка**:
   - Нажмите "Отправить рассылку"
   - Система отправит сообщение всем подписчикам
   - Задержка между отправками: 30мс (защита от flood limit)

### Статистика

В правой части экрана вы увидите:
- 👥 Общее количество подписчиков
- ✅ Количество успешно отправленных сообщений
- ❌ Список ошибок (если есть)

---

## 🤖 Шаг 5: Тестирование

### 1. Проверка подписки

1. Откройте вашего бота в Telegram
2. Отправьте любое сообщение боту
3. Бот должен ответить: "✅ Вы подписались на рассылку!"
4. В админ-панели должен появиться новый подписчик

### 2. Проверка рассылки

1. В админ-панели создайте тестовую рассылку:
   - Текст: "🧪 Тестовая рассылка"
   - Изображение: (опционально)
2. Нажмите "Отправить рассылку"
3. Проверьте Telegram - должно прийти сообщение

---

## 🔍 Проверка и отладка

### Проверка таблицы

```sql
-- Посмотреть всех подписчиков
SELECT * FROM telegram_users ORDER BY created_at DESC;

-- Количество подписчиков
SELECT COUNT(*) FROM telegram_users;
```

### Логи Edge Function

1. Откройте **Supabase Dashboard**
2. Перейдите в **Edge Functions**
3. Выберите `telegram-webhook`
4. Откройте вкладку **Logs**
5. Проверьте сообщения об ошибках

### Распространенные проблемы

**Проблема**: Webhook не отвечает
- ✅ Проверьте, что функция опубликована
- ✅ Проверьте URL webhook через `getWebhookInfo`
- ✅ Проверьте переменные окружения

**Проблема**: Ошибка при сохранении пользователя
- ✅ Убедитесь, что таблица `telegram_users` создана
- ✅ Проверьте RLS политики
- ✅ Проверьте логи функции

**Проблема**: Бот не отвечает на сообщения
- ✅ Проверьте `TELEGRAM_BOT_TOKEN` в переменных окружения
- ✅ Убедитесь, что webhook установлен правильно
- ✅ Проверьте, что бот не заблокирован

---

## 📝 API Endpoints

Система предоставляет следующие API endpoints:

### 1. Регистрация пользователя
```
POST /functions/v1/make-server-aa167a09/register-telegram
```
**Body:**
```json
{
  "chat_id": 123456789
}
```

### 2. Отправка рассылки
```
POST /functions/v1/make-server-aa167a09/broadcast
```
**Headers:**
```
Authorization: Bearer <SUPABASE_ANON_KEY>
X-Admin-Auth: true
```
**Body:**
```json
{
  "text": "Ваше сообщение",
  "imageUrl": "https://example.com/image.jpg"
}
```

### 3. Статистика
```
GET /functions/v1/make-server-aa167a09/broadcast-stats
```
**Headers:**
```
Authorization: Bearer <SUPABASE_ANON_KEY>
X-Admin-Auth: true
```

---

## 🔐 Безопасность

### Переменные окружения

Убедитесь, что настроены следующие переменные:
- ✅ `TELEGRAM_BOT_TOKEN` - токен вашего бота
- ✅ `SUPABASE_URL` - URL проекта
- ✅ `SUPABASE_ANON_KEY` - публичный ключ
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - сервисный ключ (только на сервере!)

### Row Level Security (RLS)

Таблица `telegram_users` защищена политиками RLS:
- Анонимные пользователи могут только добавлять записи
- Сервисная роль имеет полный доступ
- Обычные пользователи не имеют доступа

---

## 📚 Дополнительные возможности

### Кастомизация сообщений

Вы можете изменить текст приветствия в файле:
`/supabase/functions/telegram-webhook/index.ts`

```typescript
text: '✅ Вы подписались на рассылку!\n\nТеперь вы будете получать уведомления о новинках и специальных предложениях.',
```

### Добавление кнопок

Telegram поддерживает inline кнопки. Пример:

```typescript
body: JSON.stringify({
  chat_id: chatId,
  text: 'Текст сообщения',
  reply_markup: {
    inline_keyboard: [[
      { text: 'Перейти на сайт', url: 'https://coffeenechai.ru' }
    ]]
  }
})
```

### Отправка документов

Для отправки PDF, документов и других файлов используйте метод `sendDocument`:

```typescript
fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: chatId,
    document: 'https://example.com/file.pdf',
    caption: 'Описание файла'
  })
})
```

---

## 💡 Советы по использованию

1. **Тестируйте на себе**: Подпишитесь на бота первым и проверяйте все рассылки
2. **Используйте превью**: Всегда проверяйте превью изображения перед отправкой
3. **HTML форматирование**: Используйте `<b>`, `<i>`, `<a>` для красивого текста
4. **Время отправки**: Отправляйте рассылки в рабочее время для лучшего engagement
5. **Частота**: Не спамьте - 1-2 рассылки в неделю достаточно
6. **Персонализация**: Делайте сообщения полезными и релевантными

---

## ✅ Чек-лист запуска

- [ ] Таблица `telegram_users` создана в Supabase
- [ ] Политики RLS настроены
- [ ] Edge Function `telegram-webhook` опубликована
- [ ] Webhook установлен через `setWebhook`
- [ ] Переменные окружения настроены
- [ ] Протестирована подписка на бота
- [ ] Протестирована отправка рассылки
- [ ] Проверены логи на наличие ошибок

---

## 🆘 Поддержка

Если у вас возникли проблемы:

1. Проверьте логи в Supabase Dashboard → Edge Functions → Logs
2. Проверьте статус webhook через `getWebhookInfo`
3. Проверьте наличие записей в таблице `telegram_users`
4. Убедитесь, что все переменные окружения настроены

---

**Система готова к работе! 🚀**

Теперь вы можете отправлять красивые рассылки своим подписчикам прямо из админ-панели.
