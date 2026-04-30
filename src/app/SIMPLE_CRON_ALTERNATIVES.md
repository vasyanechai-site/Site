# 🕐 Простые альтернативы для автоматической проверки платежей

Не нужно создавать Edge Function! Используйте один из этих простых способов:

## ✅ Вариант 1: GitHub Actions (РЕКОМЕНДУЕТСЯ - бесплатно)

### Шаг 1: Создайте файл в репозитории
Создайте файл `.github/workflows/payment-checker.yml`:

```yaml
name: Check Payment Statuses

on:
  schedule:
    # Запускать каждые 5 минут
    - cron: '*/5 * * * *'
  
  # Возможность запустить вручную
  workflow_dispatch:

jobs:
  check-payments:
    runs-on: ubuntu-latest
    
    steps:
      - name: Check pending payments
        run: |
          RESPONSE=$(curl -s -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            https://${{ secrets.SUPABASE_PROJECT_ID }}.supabase.co/functions/v1/make-server-aa167a09/retail/check-pending-payments)
          
          echo "Result: $RESPONSE"
```

### Шаг 2: Добавьте секреты в GitHub
1. Откройте репозиторий → Settings → Secrets and variables → Actions
2. Добавьте секреты:
   - `SUPABASE_PROJECT_ID` - ID вашего проекта Supabase
   - `SUPABASE_ANON_KEY` - ваш публичный anon key

### Шаг 3: Включите workflow
1. Закоммитьте файл
2. Откройте GitHub → Actions
3. Workflow запустится автоматически каждые 5 минут!

**Преимущества:**
- ✅ Полностью бесплатно
- ✅ Не требует Supabase CLI
- ✅ Легко настроить
- ✅ Видны логи в GitHub Actions
- ✅ Можно запустить вручную

---

## ✅ Вариант 2: cron-job.org (бесплатно, без GitHub)

### Шаг 1: Регистрация
1. Перейдите на https://cron-job.org
2. Создайте бесплатный аккаунт

### Шаг 2: Создайте Cron Job
1. Dashboard → Create cronjob
2. Настройки:
   - **Title**: Check Payment Statuses
   - **URL**: `https://ВАШ_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/retail/check-pending-payments`
   - **Request method**: POST
   - **Schedule**: Every 5 minutes
   - **Custom headers**: 
     ```
     Authorization: Bearer ВАШ_ANON_KEY
     Content-Type: application/json
     ```
3. Save

**Преимущества:**
- ✅ Полностью бесплатно
- ✅ Простой веб-интерфейс
- ✅ Не требует кода
- ✅ Логи выполнения

---

## ✅ Вариант 3: EasyCron (бесплатно)

1. Зарегистрируйтесь на https://www.easycron.com
2. Create New Cron Job
3. URL: `https://ВАШ_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/retail/check-pending-payments`
4. HTTP Method: POST
5. HTTP Headers:
   ```
   Authorization: Bearer ВАШ_ANON_KEY
   Content-Type: application/json
   ```
6. Cron Expression: `*/5 * * * *` (каждые 5 минут)
7. Create

---

## ✅ Вариант 4: Render.com Cron Jobs (бесплатно)

1. Зарегистрируйтесь на https://render.com
2. New → Cron Job
3. Command: 
   ```bash
   curl -X POST -H "Authorization: Bearer ВАШ_ANON_KEY" -H "Content-Type: application/json" https://ВАШ_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/retail/check-pending-payments
   ```
4. Schedule: `*/5 * * * *`
5. Create

---

## 📊 Как проверить работу?

После настройки любого варианта:

1. Создайте тестовый заказ с оплатой
2. Подождите 5 минут
3. Проверьте:
   - Логи выбранного сервиса
   - Статус заказа в админке
   - Баланс вушей в личном кабинете

---

## 🎯 Рекомендация

**Используйте GitHub Actions** (Вариант 1) если:
- У вас есть GitHub репозиторий ✅
- Хотите полный контроль
- Нужны детальные логи

**Используйте cron-job.org** (Вариант 2) если:
- Хотите самое простое решение ✅
- Не хотите настраивать GitHub
- Нужен веб-интерфейс

---

## ⚡ Быстрый старт (1 минута)

### Самый быстрый способ:

1. Откройте https://cron-job.org
2. Зарегистрируйтесь
3. Create cronjob:
   - URL: `https://ВАШ_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/retail/check-pending-payments`
   - Method: POST
   - Header: `Authorization: Bearer ВАШ_ANON_KEY`
   - Schedule: Every 5 minutes
4. Save
5. **Готово!** Система работает автоматически 🎉

---

## 🔧 Получить PROJECT_ID и ANON_KEY

### Supabase Dashboard:
1. Откройте проект
2. Settings → API
3. **Project URL**: извлеките ID из URL (например, `abcdefgh` из `https://abcdefgh.supabase.co`)
4. **anon public key**: скопируйте ключ

---

## ❓ Что лучше?

| Метод | Сложность | Надежность | Логи | Бесплатно |
|-------|-----------|------------|------|-----------|
| GitHub Actions | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ |
| cron-job.org | ⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ |
| EasyCron | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ✅ |
| Render.com | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ |

**Вывод**: Для начала используйте **cron-job.org**, а позже можете перейти на GitHub Actions для более профессионального решения.
