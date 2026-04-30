# 📱 Telegram Broadcast System - Краткая инструкция

> **Полная система рассылок в Telegram для интернет-магазина кофе**  
> Использует существующий `TELEGRAM_BOT_TOKEN` без необходимости создания нового бота.

---

## 🚀 Быстрый старт (3 шага)

### 1️⃣ Создайте таблицу в Supabase

Откройте **SQL Editor** в Supabase Dashboard и выполните:

```sql
CREATE TABLE IF NOT EXISTS telegram_users (
  id BIGINT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_users_created_at 
ON telegram_users(created_at DESC);

ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert telegram_users" 
ON telegram_users FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow service role all telegram_users" 
ON telegram_users FOR ALL TO service_role USING (true);
```

📖 [Подробная инструкция →](TABLE_CREATION_GUIDE.md)

---

### 2️⃣ Настройте Telegram Webhook

Откройте эту ссылку в браузере (замените параметры):

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<PROJECT_ID>.supabase.co/functions/v1/telegram-webhook
```

**Где взять параметры:**
- `YOUR_BOT_TOKEN` - из переменной окружения `TELEGRAM_BOT_TOKEN`
- `PROJECT_ID` - из файла `/utils/supabase/info.tsx`

**Ожидаемый ответ:**
```json
{"ok": true, "result": true, "description": "Webhook was set"}
```

📖 [Подробная инструкция →](WEBHOOK_SETUP.md)

---

### 3️⃣ Протестируйте систему

1. **Подпишитесь на бота:**
   - Откройте вашего бота в Telegram
   - Отправьте любое сообщение
   - Должен прийти ответ: "✅ Вы подписались на рассылку!"

2. **Отправьте рассылку:**
   - Войдите в админ-панель
   - Выберите **Опт** → **Рассылка**
   - Создайте и отправьте тестовое сообщение

📖 [Полное руководство →](TELEGRAM_SETUP_GUIDE.md)

---

## 📂 Что уже готово в проекте

### ✅ Файлы системы

| Файл | Описание |
|------|----------|
| `/supabase/functions/telegram-webhook/index.ts` | Edge Function для webhook бота |
| `/supabase/functions/server/telegram_broadcast.tsx` | API endpoints для рассылок |
| `/components/TelegramBroadcast.tsx` | UI компонент админ-панели |
| `/components/AdminPanel.tsx` | Интеграция в админку (вкладка "Рассылка") |

### ✅ API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/functions/v1/telegram-webhook` | POST | Webhook для регистрации пользователей |
| `/make-server-aa167a09/register-telegram` | POST | Ручная регистрация пользователя |
| `/make-server-aa167a09/broadcast` | POST | Отправка рассылки |
| `/make-server-aa167a09/broadcast-stats` | GET | Статистика подписчиков |

### ✅ Возможности

- 📝 Отправка текста с HTML форматированием
- 🖼️ Загрузка и отправка изображений (до 5MB)
- 📊 Статистика подписчиков в реальном времени
- ⚡ Защита от flood limit (задержка 30мс между отправками)
- 🎯 Автоматическая регистрация при первом сообщении боту
- ✅ Детальная информация об ошибках отправки
- 🔒 Защита через RLS политики Supabase

---

## 🎯 Использование

### В админ-панели

1. Войдите в админку
2. Выберите **Опт**
3. Откройте вкладку **Рассылка**
4. Заполните форму:
   - **Текст**: можно использовать HTML (`<b>`, `<i>`, `<a>`)
   - **Изображение**: JPG, PNG или WebP до 5MB (опционально)
5. Нажмите **"Отправить рассылку"**

### Статистика

В правом верхнем углу отображается количество подписчиков.  
После отправки показывается:
- ✅ Количество успешных отправок
- ❌ Список ошибок (если есть)

---

## 🔧 Технические детали

### Архитектура

```
Telegram Bot
    ↓ (webhook)
telegram-webhook Edge Function
    ↓ (REST API)
Supabase postgres: telegram_users
    ↓ (query)
telegram_broadcast.tsx
    ↓ (Telegram API)
Пользователи в Telegram
```

### База данных

**Таблица:** `telegram_users`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | BIGINT | chat_id из Telegram (Primary Key) |
| `created_at` | TIMESTAMPTZ | Дата подписки |

**RLS Политики:**
- `anon` - может вставлять записи (для webhook)
- `service_role` - полный доступ (для админки)

### Переменные окружения

Система использует уже настроенные переменные:
- ✅ `TELEGRAM_BOT_TOKEN` - токен бота
- ✅ `SUPABASE_URL` - URL проекта
- ✅ `SUPABASE_ANON_KEY` - публичный ключ
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - сервисный ключ

---

## 📊 Мониторинг и отладка

### Проверка таблицы

```sql
-- Все подписчики
SELECT * FROM telegram_users ORDER BY created_at DESC;

-- Количество подписчиков
SELECT COUNT(*) FROM telegram_users;

-- Новые подписчики за сегодня
SELECT COUNT(*) FROM telegram_users 
WHERE created_at >= CURRENT_DATE;
```

### Проверка webhook

```bash
# Статус webhook
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"

# Удалить webhook (если нужно переустановить)
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

### Логи Edge Function

1. **Supabase Dashboard** → **Edge Functions**
2. Выберите `telegram-webhook`
3. Вкладка **Logs**

Полезные логи:
- ✅ "User saved to database" - успешная регистрация
- ✅ "Confirmation sent to user" - сообщение отправлено
- ❌ "Failed to save user" - ошибка БД
- ❌ "Failed to send Telegram message" - ошибка API

---

## 🐛 Устранение проблем

### Бот не отвечает на сообщения

**Причины:**
1. Webhook не установлен → проверьте через `getWebhookInfo`
2. Edge Function не опубликована → проверьте в Dashboard
3. Неверный токен → проверьте `TELEGRAM_BOT_TOKEN`

**Решение:**
```bash
# Переустановите webhook
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PROJECT>.supabase.co/functions/v1/telegram-webhook"
```

### Ошибка "relation telegram_users does not exist"

**Причина:** Таблица не создана

**Решение:** Выполните SQL из [Шага 1](#1%EF%B8%8F%E2%83%A3-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%B9%D1%82%D0%B5-%D1%82%D0%B0%D0%B1%D0%BB%D0%B8%D1%86%D1%83-%D0%B2-supabase)

### Рассылка не отправляется

**Причины:**
1. Нет подписчиков → добавьте тестового подписчика
2. Неверный токен бота → проверьте переменную окружения
3. Blocked by user → пользователь заблокировал бота

**Решение:** Проверьте логи в админ-панели после отправки

### Изображение не загружается

**Причины:**
1. Bucket не создан → он создастся автоматически при первой загрузке
2. Файл слишком большой → макс 5MB
3. Неверный формат → только JPG, PNG, WebP

**Решение:** Проверьте console в браузере для деталей

---

## 💡 Советы и best practices

### Содержание рассылок

- ✅ Делайте сообщения короткими и ценными
- ✅ Используйте эмодзи для привлечения внимания
- ✅ Добавляйте призыв к действию (CTA)
- ❌ Не спамьте - макс 1-2 рассылки в неделю

### Время отправки

- ✅ 10:00-12:00 - пик активности
- ✅ 18:00-20:00 - вечернее время
- ❌ Ночные часы (00:00-08:00)

### Изображения

- ✅ Используйте качественные фото продуктов
- ✅ Оптимизируйте размер (рекомендуется до 500KB)
- ✅ Соотношение сторон 16:9 или 4:3

### HTML Форматирование

```html
<b>Жирный текст</b>
<i>Курсив</i>
<a href="https://example.com">Ссылка</a>
<code>Код</code>

✅ Можно комбинировать:
<b>Скидка 20%</b> на все позиции!
Переходите на <a href="https://coffeenechai.ru">сайт</a>
```

---

## 📚 Дополнительные ресурсы

- 📖 [Полное руководство по настройке](TELEGRAM_SETUP_GUIDE.md)
- 🔧 [Создание таблицы в Supabase](TABLE_CREATION_GUIDE.md)
- 🔗 [Настройка Webhook](WEBHOOK_SETUP.md)
- 🤖 [Telegram Bot API](https://core.telegram.org/bots/api)
- 📊 [Supabase Documentation](https://supabase.com/docs)

---

## ✅ Чек-лист готовности

Перед запуском в продакшн убедитесь:

- [ ] Таблица `telegram_users` создана
- [ ] RLS политики настроены
- [ ] Edge Function опубликована
- [ ] Webhook установлен и активен
- [ ] Протестирована подписка на бота
- [ ] Протестирована отправка текста
- [ ] Протестирована отправка изображения
- [ ] Проверены логи на ошибки
- [ ] Bucket `make-aa167a09-broadcasts` создан (или создастся автоматически)
- [ ] Переменные окружения корректны

---

## 🎉 Готово!

Система полностью настроена и готова к использованию.  
Начните с тестовой рассылки и постепенно наращивайте базу подписчиков.

**Успешных рассылок! 🚀☕**

---

*Последнее обновление: 2024*  
*Версия системы: 1.0*
