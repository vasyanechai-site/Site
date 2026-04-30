# Инструкция по предотвращению автоматического отключения Supabase базы данных

## Проблема
Supabase Free tier автоматически приостанавливает проекты после 1 недели неактивности.

---

## ✅ ОСНОВНОЕ РЕШЕНИЕ (Автоматическое, без сторонних сервисов)

### Встроенный Keep-Alive в приложении

**Уже настроено и работает автоматически!** 

При каждом открытии сайта приложение автоматически проверяет, не прошло ли 5 дней с последнего keep-alive запроса. Если прошло - автоматически отправляется запрос для поддержания активности базы данных.

#### Как это работает:
1. При загрузке `App.tsx` вызывается функция `autoKeepAlive()` из `/lib/keepAlive.ts`
2. Функция проверяет timestamp последнего keep-alive в `localStorage`
3. Если прошло больше 5 дней - отправляется GET запрос к `/keep-alive` endpoint
4. Timestamp сохраняется и следующая проверка будет через 5 дней
5. В консоли браузера можно увидеть логи работы системы

#### Преимущества:
- ✅ Не требует сторонних сервисов или регистраций
- ✅ Работает автоматически при любом посещении сайта
- ✅ Для B2B сервиса (где клиенты заходят регулярно) это идеальное решение
- ✅ Нулевая стоимость и нулевая дополнительная настройка

#### Требования:
- Хотя бы один заход на сайт раз в 5-7 дней
- Для активного B2B сервиса с оптовыми заказами это абсолютно реалистичное требование

#### Проверка работы:
Откройте консоль браузера (F12) при загрузке сайта и увидите одно из сообщений:
- `[Keep-Alive] Отправка keep-alive запроса...` - если отправляется запрос
- `[Keep-Alive] База данных активна: {...}` - успешный результат
- `[Keep-Alive] Следующий keep-alive запланирован на: ...` - если запрос не требуется

---

## Альтернативные решения (если нужна полная независимость от посещений)

Если вам критически важна абсолютная гарантия (например, сайт может быть неактивен неделями), можно дополнительно настроить один из вариантов ниже.

### URL и заголовки для внешних пингов

**URL:**
```
https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/keep-alive
```

**Обязательный заголовок Authorization:**
```
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraGlucWlwbGZlenJ6dnNxZ3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTE3NTksImV4cCI6MjA3NTg4Nzc1OX0.Cr24g9iYvoRES7v0qzdq5GWkdgEhGZrHr0fi84AcQJE
```

---

## Вариант 1: Использование cron-job.org

### Шаги настройки:

1. **Зарегистрируйтесь на https://cron-job.org** (бесплатно)

2. **Создайте новый cronjob:**
   - Title: `Nechai Coffee Keep-Alive`
   - URL: `https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/keep-alive`
   - Schedule: Каждые 3 дня (или Every 72 hours)
   - HTTP Method: GET
   - **Headers (заголовки):** Нажмите "Add header" и добавьте:
     - Name: `Authorization`
     - Value: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraGlucWlwbGZlenJ6dnNxZ3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTE3NTksImV4cCI6MjA3NTg4Nzc1OX0.Cr24g9iYvoRES7v0qzdq5GWkdgEhGZrHr0fi84AcQJE`

3. **Сохраните настройки**

4. **Протестируйте:** Нажмите "Execute now" - должен быть статус 200 OK

---

## Вариант 2: UptimeRobot (бесплатный мониторинг)

1. **Зарегистрируйтесь на https://uptimerobot.com** (бесплатно до 50 мониторов)

2. **Добавьте новый монитор:**
   - Monitor Type: HTTP(s)
   - Friendly Name: `Nechai Coffee API`
   - URL: `https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/keep-alive`
   - Monitoring Interval: Каждые 5 дней (или чаще, если доступно)
   - **Custom HTTP Headers:** Добавьте:
     - `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraGlucWlwbGZlenJ6dnNxZ3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTE3NTksImV4cCI6MjA3NTg4Nzc1OX0.Cr24g9iYvoRES7v0qzdq5GWkdgEhGZrHr0fi84AcQJE`

3. **Включите email уведомления** (опционально)

---

## Вариант 3: EasyCron

1. **Зарегистрируйтесь на https://www.easycron.com** (бесплатно до 5 задач)

2. **Создайте новый cron job:**
   - URL to call: `https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/keep-alive`
   - When to call: Каждые 3 дня
   - Method: GET
   - **HTTP Headers:** Добавьте:
     - `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraGlucWlwbGZlenJ6dnNxZ3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTE3NTksImV4cCI6MjA3NTg4Nzc1OX0.Cr24g9iYvoRES7v0qzdq5GWkdgEhGZrHr0fi84AcQJE`

---

## Вариант 4: GitHub Actions (если у вас есть репозиторий на GitHub)

Создайте файл `.github/workflows/keep-alive.yml` в вашем репозитории:

```yaml
name: Keep Alive

on:
  schedule:
    # Запускать каждые 3 дня в 10:00 UTC
    - cron: '0 10 */3 * *'
  workflow_dispatch: # Позволяет запустить вручную

jobs:
  keep-alive:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Keep-Alive Endpoint
        run: |
          curl -X GET "https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/keep-alive" \
          -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraGlucWlwbGZlenJ6dnNxZ3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTE3NTksImV4cCI6MjA3NTg4Nzc1OX0.Cr24g9iYvoRES7v0qzdq5GWkdgEhGZrHr0fi84AcQJE"
```

---

## Проверка работы

После настройки проверьте endpoint вручную:

```bash
curl -X GET "https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/keep-alive" \
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraGlucWlwbGZlenJ6dnNxZ3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTE3NTksImV4cCI6MjA3NTg4Nzc1OX0.Cr24g9iYvoRES7v0qzdq5GWkdgEhGZrHr0fi84AcQJE"
```

Или откройте в браузере (вставьте в адресную строку):
```
https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/keep-alive
```
(в браузере заголовок не передается, поэтому может быть ошибка 401 - это нормально)

Ответ должен быть:
```json
{
  "status": "ok",
  "timestamp": "2024-11-17T...",
  "message": "Database is active"
}
```

---

## Рекомендация

### Для максимальной надёжности используйте комбинированный подход:

1. **Встроенный keep-alive** (уже работает) - основной механизм
   - Срабатывает при каждом посещении сайта
   - Для 99% случаев этого достаточно

2. **GitHub Actions** (см. `GITHUB_ACTIONS_SETUP.md`) - страховка
   - Работает автоматически каждые 5 дней
   - Не требует сторонних сервисов (только GitHub, где уже лежит код)
   - Защищает от простоя даже если месяц никто не заходит

**Это идеальное решение:** встроенная автоматика + GitHub Actions = 100% гарантия работы без дополнительных сервисов и затрат.
