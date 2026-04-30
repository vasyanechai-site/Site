# ☕ Nechai Coffee - Система бэкапов

## 📋 Что реализовано

### ✅ Автоматические бэкапы
- **Частота**: каждые 3 дня в 00:00 МСК
- **Отправка**: на email **dakolosovs@mail.ru**
- **Хранение**: 30 последних бэкапов в базе данных
- **Автоочистка**: старые бэкапы удаляются автоматически

### ✅ Ручные бэкапы
- **Отправка на email**: кнопка "Отправить на почту" в админ-панели
- **Скачивание**: кнопка "Скачать JSON" для локального сохранения

### ✅ Что включается в бэкап
- Товары кофе с ценами (USD и RUB)
- Все заказы с деталями
- Пользователи (без паролей)
- Промокоды
- Курс доллара
- Настройки пользователей (ИНН, БИК, счет и т.д.)

## 🚀 Быстрый старт

### 1. Настройте Resend API Key

Вы уже добавили ключ через интерфейс приложения ✅

Если нужно обновить:
1. Зайдите на [Resend.com](https://resend.com)
2. Скопируйте API ключ
3. В приложении он уже добавлен в environment variable `RESEND_API_KEY`

### 2. Настройте автоматические бэкапы

**Вариант A: Используйте cron-job.org (рекомендуется)**

1. Зарегистрируйтесь на https://cron-job.org
2. Создайте новый Cron Job:
   - URL: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/backup/check-schedule`
   - Method: POST
   - Header: `Authorization: Bearer YOUR_ANON_KEY`
   - Schedule: каждые 3 дня в 00:00

**Вариант B: Используйте GitHub Actions**

См. подробную инструкцию в файле `/BACKUP_AUTOMATION_SETUP.md`

### 3. Протестируйте отправку

1. Откройте админ-панель → вкладка "Экспорт"
2. Нажмите "Отправить на почту"
3. Проверьте email dakolosovs@mail.ru (включая папку Спам)

## 📧 Что приходит на email

Каждое письмо содержит:

**Тема**: 
- Автоматический: "Автоматический бэкап Nechai Coffee - 24.11.2024"
- Ручной: "Ручной бэкап Nechai Coffee - 24.11.2024"

**Содержимое**:
- Тип бэкапа (Автоматический/Ручной)
- Дата и время
- Статистика:
  - Товары кофе: X шт.
  - Заказы: X шт.
  - Пользователи: X чел.
  - Промокоды: X шт.
  - Курс USD/RUB: X ₽

**Вложение**:
- JSON файл (например: `nechai-backup-2024-11-24.json`)
- Размер: обычно < 1 MB

## 🔄 Восстановление из бэкапа

### Способ 1: Через админ-панель (рекомендуется)

1. Скачайте JSON файл из email
2. Откройте админ-панель → вкладка "Импорт"
3. Нажмите "Выбрать файл" и загрузите JSON
4. Нажмите "Импортировать данные"
5. Подтвердите импорт

### Способ 2: Через API

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d @backup.json \
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/backups/BACKUP_ID/restore
```

## 📊 Управление бэкапами

### Просмотр списка бэкапов

```bash
curl -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/backups
```

### Удаление старого бэкапа

```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/backups/BACKUP_ID
```

## 🛡️ Безопасность

### Что НЕ включается в бэкап:
- ❌ Пароли пользователей
- ❌ API ключи
- ❌ Токены доступа

### Рекомендации:
- 📧 Храните бэкапы в безопасном месте
- 🔐 Не делитесь JSON файлами публично
- 💾 Делайте дополнительные локальные копии важных данных

## ⚙️ Настройка частоты бэкапов

По умолчанию бэкапы создаются каждые **3 дня**.

Чтобы изменить интервал:

1. Откройте `/supabase/functions/server/index.tsx`
2. Найдите: `await backup.updateBackupSchedule(3);`
3. Измените `3` на нужное количество дней (например, `7` для недельных бэкапов)
4. Обновите расписание в cron service соответствующим образом

## 🔍 Проверка логов

### Supabase Dashboard:
1. Откройте Supabase Dashboard
2. Перейдите в Edge Functions → Logs
3. Ищите сообщения:
   - "Creating full backup..."
   - "Backup saved with ID: backup:..."
   - "Backup sent to email successfully"

### Логи cron service:
Проверьте логи выполнения в вашем cron сервисе (cron-job.org или GitHub Actions)

## ❓ Решение проблем

### Письма не приходят

**Проверьте:**
1. Папку "Спам" в dakolosovs@mail.ru
2. Правильность RESEND_API_KEY в Supabase Secrets
3. Логи Edge Functions в Supabase
4. Статус в cron service (если настроен)

**Решение:**
```bash
# Тестовая отправка email
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/test-email
```

### Ошибка "RESEND_API_KEY not configured"

**Решение:**
1. Откройте Supabase Dashboard
2. Project Settings → Edge Functions → Secrets
3. Добавьте `RESEND_API_KEY` с вашим API ключом
4. Пересоздайте Edge Functions (re-deploy)

### Cron не запускается автоматически

**Проверьте:**
1. Правильность URL endpoint
2. Правильность Authorization header
3. Формат расписания cron
4. Статус задачи в cron service

**Тест вручную:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/backup/check-schedule
```

### База данных переполнена бэкапами

Система автоматически удаляет бэкапы старше 30 дней, но вы можете очистить вручную:

1. Откройте Supabase SQL Editor
2. Выполните:
```sql
-- Посмотреть все бэкапы
SELECT key, (value->>'timestamp')::text as timestamp 
FROM kv_store_22d84083 
WHERE key LIKE 'backup:%';

-- Удалить конкретный бэкап
DELETE FROM kv_store_22d84083 WHERE key = 'backup:1234567890';

-- Удалить все бэкапы (осторожно!)
DELETE FROM kv_store_22d84083 WHERE key LIKE 'backup:%';
```

## 📈 Мониторинг

### Проверка следующего планового бэкапа

```bash
curl -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/backup/check-schedule
```

Ответ покажет:
- `shouldRun`: нужно ли создавать бэкап сейчас
- `schedule.lastBackup`: когда был последний бэкап
- `schedule.nextBackup`: когда запланирован следующий

## 📞 Поддержка

**Документация:**
- `/BACKUP_AUTOMATION_SETUP.md` - подробная настройка автоматизации
- `/DATABASE_RECOVERY_GUIDE.md` - восстановление базы данных
- `/DATABASE_QUICK_RECOVERY.md` - быстрая справка

**Проверка здоровья системы:**
Админ-панель → вкладка "Здоровье БД"

## 🎯 Чек-лист настройки

- [ ] ✅ RESEND_API_KEY настроен
- [ ] Cron service настроен и активен
- [ ] Тестовое письмо отправлено и получено
- [ ] Проверены логи Edge Functions
- [ ] Сделан тестовый бэкап и восстановление
- [ ] Добавлен календарь для напоминаний (опционально)

---

**Автор**: Nechai Coffee Team  
**Версия**: 1.0  
**Дата**: 24.11.2024
