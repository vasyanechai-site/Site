> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# 🤖 Настройка автоматических бэкапов

## Обзор

Система поддерживает автоматические бэкапы каждые 3 дня с отправкой на email `dakolosovs@mail.ru`.

## ⚙️ Настройка Email (Resend API)

1. Зарегистрируйтесь на [Resend.com](https://resend.com)
2. Создайте API ключ
3. Добавьте ключ в Supabase Secrets:
   - Откройте Supabase Dashboard → Project Settings → Edge Functions → Secrets
   - Имя: `RESEND_API_KEY`
   - Значение: ваш API ключ

**Примечание**: Вы уже добавили ключ через интерфейс приложения ✅

## 📅 Вариант 1: Использование внешнего Cron сервиса (Рекомендуется)

### Использование cron-job.org:

1. Зарегистрируйтесь на https://cron-job.org (бесплатно)

2. Создайте новый Cron Job со следующими параметрами:
   - **Title**: "Nechai Coffee Auto Backup"
   - **URL**: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/backup/check-schedule`
   - **Method**: POST
   - **Headers**: `Authorization: Bearer YOUR_ANON_KEY`
   - **Schedule**: 
     - Every: **3** days
     - At: **00:00** (полночь по МСК)

3. Сохраните и активируйте задачу

### Другие варианты:
- https://easycron.com (бесплатно до 100 заданий)
- https://console.cron-job.org (бесплатно)
- GitHub Actions (см. ниже)

## 📅 Вариант 2: GitHub Actions (Бесплатно для публичных репо)

Создайте файл `.github/workflows/backup.yml` в вашем репозитории:

\`\`\`yaml
name: Auto Backup

on:
  schedule:
    # Каждые 3 дня в 00:00 UTC (03:00 МСК)
    - cron: '0 0 */3 * *'
  workflow_dispatch: # Позволяет запускать вручную

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Backup
        run: |
          curl -X POST \
            -H "Authorization: Bearer \${{ secrets.SUPABASE_ANON_KEY }}" \
            https://\${{ secrets.PROJECT_ID }}.supabase.co/functions/v1/make-server-aa167a09/backup/check-schedule

      - name: Check Status
        run: echo "Backup triggered successfully"
\`\`\`

Добавьте Secrets в GitHub:
- `PROJECT_ID`: ваш Supabase Project ID
- `SUPABASE_ANON_KEY`: ваш Supabase Anon Key

## 📅 Вариант 3: Supabase Cron (Если доступно)

**Примечание**: Supabase Cron доступен только на платных планах.

Если у вас платный план, создайте файл SQL в Supabase SQL Editor:

\`\`\`sql
-- Создаем функцию для триггера бэкапа
create or replace function trigger_backup()
returns void
language plpgsql
security definer
as $$
declare
  response text;
begin
  -- Вызываем Edge Function
  select content into response
  from http_post(
    'https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/backup/check-schedule',
    json_build_object(),
    json_build_object('Authorization', 'Bearer YOUR_ANON_KEY')::jsonb
  );
  
  raise notice 'Backup triggered: %', response;
end;
$$;

-- Создаем расписание (каждые 3 дня в полночь)
select cron.schedule(
  'nechai-auto-backup',
  '0 0 */3 * *',
  'SELECT trigger_backup();'
);
\`\`\`

## ✅ Проверка работы автоматических бэкапов

### 1. Ручной запуск (тестирование):

Выполните в терминале или через Postman:

\`\`\`bash
curl -X POST \\
  -H "Authorization: Bearer YOUR_ANON_KEY" \\
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/backup/check-schedule
\`\`\`

### 2. Проверка через админ-панель:

1. Откройте админ-панель
2. Перейдите на вкладку "Экспорт"
3. Нажмите "Отправить на почту"
4. Проверьте email `dakolosovs@mail.ru`

### 3. Просмотр логов:

Откройте Supabase Dashboard → Edge Functions → Logs

Найдите логи с сообщением:
- `"Running scheduled backup..."`
- `"Backup sent to email successfully"`

## 📧 Что приходит на email

При каждом автоматическом бэкапе на email отправляется письмо содержащее:

- **Тип бэкапа**: Автоматический
- **Дата и время**: в формате МСК
- **Статистика**:
  - Количество товаров кофе
  - Количество заказов
  - Количество пользователей
  - Количество промокодов
  - Текущий курс USD/RUB
- **Вложение**: JSON файл с полным бэкапом

## 🔄 Восстановление из бэкапа

1. Скачайте JSON файл из email
2. Откройте админ-панель → вкладка "Импорт"
3. Загрузите JSON файл
4. Данные будут восстановлены

## 📊 Хранение бэкапов

- **В базе данных**: 30 последних бэкапов (автоматическая очистка старых)
- **На email**: бессрочно (зависит от вашего почтового ящика)
- **Локально**: если скачиваете вручную через "Скачать JSON"

## 🔧 Настройка частоты бэкапов

Если нужно изменить интервал с 3 дней на другой:

1. Откройте `/supabase/functions/server/index.tsx`
2. Найдите строку: `await backup.updateBackupSchedule(3);`
3. Измените `3` на нужное количество дней
4. Обновите настройки cron job соответствующим образом

## ⚠️ Важные примечания

1. **Email сервис (Resend)**:
   - Бесплатный план: 100 emails/день, 3000/месяц
   - Это достаточно для автоматических бэкапов

2. **Размер бэкапа**:
   - JSON файлы обычно небольшие (< 1 MB)
   - Email провайдеры поддерживают вложения до 25 MB

3. **Безопасность**:
   - Пароли пользователей НЕ включаются в бэкап
   - Храните бэкапы в безопасном месте

4. **Тестирование**:
   - Перед настройкой cron обязательно проверьте ручную отправку
   - Убедитесь что письмо приходит корректно

## 🆘 Решение проблем

### Письма не приходят:

1. Проверьте папку "Спам" в почте
2. Убедитесь что `RESEND_API_KEY` правильно настроен
3. Проверьте логи Edge Functions в Supabase
4. Попробуйте тестовую отправку через админ-панель

### Ошибка "Email service not configured":

1. Убедитесь что `RESEND_API_KEY` добавлен в Secrets
2. Перезапустите Edge Functions (повторный deploy)

### Cron не запускается:

1. Проверьте правильность URL endpoint
2. Проверьте правильность API ключа в заголовках
3. Проверьте расписание cron (правильный формат)

## 📞 Контакты

Если возникли проблемы с настройкой, проверьте:
1. Supabase Edge Functions Logs
2. Email во входящих/спаме
3. Cron service логи (если используете внешний сервис)
