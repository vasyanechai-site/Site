# 📚 Telegram Broadcast System - Документация

> **Полная система Telegram-рассылок для интернет-магазина**  
> Все файлы, инструкции и руководства в одном месте

---

## 🎯 Быстрая навигация

### 🚀 Новичкам - начните здесь!

| Документ | Описание | Время чтения |
|----------|----------|--------------|
| **[⚡ Quick Start](QUICK_START.md)** | Запуск за 5 минут | ⏱️ 5 мин |
| **[📱 README](TELEGRAM_BROADCAST_README.md)** | Краткая инструкция с чек-листами | ⏱️ 10 мин |

### 📖 Подробные руководства

| Документ | Описание | Для кого |
|----------|----------|----------|
| **[📋 Полное руководство](TELEGRAM_SETUP_GUIDE.md)** | Пошаговая настройка всей системы | Все |
| **[📊 Создание таблицы](TABLE_CREATION_GUIDE.md)** | Детальная инструкция по БД | Новички в Supabase |
| **[🔗 Настройка Webhook](WEBHOOK_SETUP.md)** | Подключение бота к системе | Новички в Telegram Bot API |

### 🏗️ Техническая документация

| Документ | Описание | Для кого |
|----------|----------|----------|
| **[🏛️ Архитектура](TELEGRAM_SYSTEM_ARCHITECTURE.md)** | Полная схема системы | Разработчики |

---

## 📂 Структура системы

### Backend

```
/supabase/functions/
├── telegram-webhook/
│   └── index.ts                    ← Edge Function для webhook
└── server/
    ├── index.tsx                   ← Main Hono server
    └── telegram_broadcast.tsx      ← Broadcast API
```

### Frontend

```
/components/
├── AdminPanel.tsx                  ← Интеграция вкладки "Рассылка"
└── TelegramBroadcast.tsx          ← UI компонент админки
```

### База данных

```sql
telegram_users
├── id (BIGINT, PK)                ← chat_id из Telegram
└── created_at (TIMESTAMPTZ)       ← Дата подписки
```

---

## 🔄 Жизненный цикл

```
1. Пользователь → пишет боту
2. Webhook → регистрирует chat_id в БД
3. Бот → отвечает подтверждением
4. Админ → создает рассылку в админке
5. API → отправляет всем подписчикам
6. Админ → видит статистику отправки
```

---

## 🎓 Учебный план

### Для новичков

1. ✅ Прочитайте [Quick Start](QUICK_START.md)
2. ✅ Создайте таблицу по [TABLE_CREATION_GUIDE.md](TABLE_CREATION_GUIDE.md)
3. ✅ Настройте webhook по [WEBHOOK_SETUP.md](WEBHOOK_SETUP.md)
4. ✅ Протестируйте систему
5. ✅ Прочитайте [TELEGRAM_BROADCAST_README.md](TELEGRAM_BROADCAST_README.md) для деталей

### Для опытных разработчиков

1. ✅ Изучите [TELEGRAM_SYSTEM_ARCHITECTURE.md](TELEGRAM_SYSTEM_ARCHITECTURE.md)
2. ✅ Просмотрите код в `/supabase/functions/`
3. ✅ Кастомизируйте под свои нужды
4. ✅ Разверните в продакшн

---

## 🛠️ API Reference

### Endpoints

| URL | Method | Auth | Description |
|-----|--------|------|-------------|
| `/functions/v1/telegram-webhook` | POST | Telegram | Webhook для регистрации |
| `/make-server-aa167a09/register-telegram` | POST | Bearer | Ручная регистрация |
| `/make-server-aa167a09/broadcast` | POST | X-Admin-Auth | Отправка рассылки |
| `/make-server-aa167a09/broadcast-stats` | GET | X-Admin-Auth | Статистика |

### Request/Response Examples

#### Broadcast Request
```json
POST /make-server-aa167a09/broadcast
Headers: {
  "Authorization": "Bearer <ANON_KEY>",
  "X-Admin-Auth": "true"
}
Body: {
  "text": "Текст рассылки",
  "imageUrl": "https://example.com/image.jpg"
}
```

#### Broadcast Response
```json
{
  "sent": 42,
  "total": 50,
  "errors": [
    {
      "chat_id": 123456,
      "error": "Forbidden: bot was blocked by the user"
    }
  ]
}
```

---

## 📊 База данных

### Схема

```sql
-- Создание
CREATE TABLE telegram_users (
  id BIGINT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индекс
CREATE INDEX idx_telegram_users_created_at 
ON telegram_users(created_at DESC);

-- RLS
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert telegram_users" 
ON telegram_users FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow service role all telegram_users" 
ON telegram_users FOR ALL TO service_role USING (true);
```

### Полезные запросы

```sql
-- Все подписчики
SELECT * FROM telegram_users ORDER BY created_at DESC;

-- Статистика
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - 7) as week
FROM telegram_users;

-- Динамика по дням
SELECT 
  DATE(created_at) as day,
  COUNT(*) as subscribers
FROM telegram_users
WHERE created_at >= CURRENT_DATE - 30
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

---

## 🔐 Безопасность

### Переменные окружения

```bash
TELEGRAM_BOT_TOKEN=<your_bot_token>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_key>  # Только на сервере!
```

### RLS Политики

- ✅ **anon** - может только добавлять записи (webhook)
- ✅ **service_role** - полный доступ (backend)
- ❌ **authenticated** - нет доступа

### Аутентификация

- Webhook: проверка Telegram signature (автоматически)
- Broadcast API: `X-Admin-Auth: true` header
- Frontend: Bearer token с anon key

---

## 🧪 Тестирование

### Checklist

- [ ] Таблица создана
- [ ] Webhook установлен
- [ ] Бот отвечает на сообщения
- [ ] Пользователь сохраняется в БД
- [ ] Рассылка отправляется
- [ ] Изображения загружаются
- [ ] Статистика отображается
- [ ] Ошибки логируются

### Тестовые сценарии

#### Сценарий 1: Регистрация
```
1. Открыть бота в Telegram
2. Отправить: "Hello"
3. Получить: "✅ Вы подписались на рассылку!"
4. Проверить: SELECT * FROM telegram_users WHERE id = <your_chat_id>
```

#### Сценарий 2: Текстовая рассылка
```
1. Админка → Опт → Рассылка
2. Текст: "🧪 Тест"
3. Отправить
4. Проверить Telegram
5. Проверить статистику (sent/total)
```

#### Сценарий 3: Рассылка с изображением
```
1. Админка → Рассылка
2. Загрузить изображение (jpg, png, webp)
3. Добавить текст
4. Отправить
5. Проверить в Telegram (изображение + текст)
```

---

## 🚀 Deployment

### Production Checklist

- [ ] Таблица создана в production БД
- [ ] RLS политики активированы
- [ ] Edge Function опубликована
- [ ] Webhook установлен на production URL
- [ ] Переменные окружения настроены
- [ ] SSL сертификат валиден (автоматически через Supabase)
- [ ] Логирование настроено
- [ ] Мониторинг подключен

### Мониторинг

```javascript
// Метрики для отслеживания
- Количество подписчиков (ежедневно)
- Success rate рассылок (%)
- Средняя скорость отправки (msg/sec)
- Количество ошибок
- Размер bucket для изображений
```

---

## 📈 Масштабирование

### Текущие лимиты

- Telegram: 30 сообщений/сек
- Edge Function: 150 сек timeout
- Supabase Free: 500MB DB, 1GB Storage

### Для роста

| Подписчиков | Рекомендация |
|-------------|--------------|
| < 1,000 | Текущая архитектура OK |
| 1,000 - 5,000 | Добавить batch отправку |
| 5,000 - 10,000 | Background jobs + Queue |
| > 10,000 | Рассмотреть внешний сервис |

---

## 💡 Советы по использованию

### Content Best Practices

✅ **Делайте:**
- Короткие, ценные сообщения
- Используйте эмодзи умеренно
- Добавляйте CTA (призыв к действию)
- Персонализируйте контент
- Тестируйте на себе перед отправкой

❌ **Не делайте:**
- Спам (чаще 2 раз в неделю)
- Длинные тексты без форматирования
- Отправка в ночное время
- Реклама без ценности

### Timing

| Время | Engagement |
|-------|------------|
| 09:00-11:00 | 🟢 Высокий |
| 13:00-14:00 | 🟡 Средний |
| 18:00-20:00 | 🟢 Высокий |
| 22:00-08:00 | 🔴 Низкий |

---

## 🐛 Troubleshooting

### Частые проблемы

| Проблема | Решение |
|----------|---------|
| Бот не отвечает | Проверьте webhook через getWebhookInfo |
| Ошибка БД | Проверьте RLS политики |
| Не отправляется рассылка | Проверьте TELEGRAM_BOT_TOKEN |
| Изображение не грузится | Проверьте размер (макс 5MB) и формат |
| GoTrueClient error | Используйте useMemo для Supabase клиента |

### Debug Commands

```bash
# Webhook status
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Test message
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=<YOUR_CHAT_ID>&text=Test"

# DB check
psql $DATABASE_URL -c "SELECT COUNT(*) FROM telegram_users;"
```

---

## 📞 Поддержка

### Ресурсы

- 📖 [Telegram Bot API](https://core.telegram.org/bots/api)
- 📊 [Supabase Docs](https://supabase.com/docs)
- 🔧 [Deno Docs](https://deno.land/manual)
- 🎨 [React Docs](https://react.dev)

### Логи

- **Supabase Dashboard** → Edge Functions → Logs
- **Browser Console** → Network tab
- **Telegram** → @BotFather → Bot logs

---

## 📝 Changelog

### v1.0 (Текущая версия)

✅ Создана Edge Function для webhook  
✅ Реализован API для рассылок  
✅ Добавлен UI компонент админки  
✅ Интеграция с Supabase Storage  
✅ RLS политики для безопасности  
✅ Полная документация  

### Планы на будущее

- 🔄 Сегментация подписчиков
- 📅 Отложенные рассылки
- 📊 Расширенная аналитика
- 🎯 A/B тестирование
- 📹 Поддержка видео
- 🔘 Inline кнопки

---

## 🎓 FAQ

**Q: Нужно ли создавать нового бота?**  
A: Нет, используется существующий TELEGRAM_BOT_TOKEN.

**Q: Можно ли использовать на Free плане Supabase?**  
A: Да, полностью поддерживается.

**Q: Сколько времени занимает отправка 1000 сообщений?**  
A: ~33 секунды (30 сообщений/сек + задержки).

**Q: Что если пользователь заблокировал бота?**  
A: Ошибка логируется, отправка продолжается остальным.

**Q: Можно ли отправлять видео?**  
A: Пока только текст и изображения. Видео в планах.

**Q: Как удалить подписчика?**  
A: `DELETE FROM telegram_users WHERE id = <chat_id>;`

---

## ✅ Итоговый чеклист

### Установка
- [ ] Таблица telegram_users создана
- [ ] RLS политики настроены
- [ ] Edge Function опубликована
- [ ] Webhook установлен

### Тестирование
- [ ] Подписка работает
- [ ] Рассылка отправляется
- [ ] Изображения загружаются
- [ ] Статистика отображается

### Production
- [ ] Все переменные окружения настроены
- [ ] Логирование работает
- [ ] Мониторинг настроен
- [ ] Документация изучена

---

## 🎉 Заключение

Система Telegram-рассылок полностью готова к использованию!

**Следующие шаги:**
1. 📖 Прочитайте [Quick Start](QUICK_START.md)
2. 🚀 Настройте систему
3. 🧪 Протестируйте
4. 📊 Запускайте рассылки!

**Успехов! ☕📱**

---

*Документация актуальна на Декабрь 2024*  
*Система версии 1.0*  
*Figma Make + Supabase + Telegram Bot API*
