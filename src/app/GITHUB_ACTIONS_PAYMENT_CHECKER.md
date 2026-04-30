# ⚡ Автоматическая проверка платежей через GitHub Actions

## 🎯 Что это дает?

✅ Автоматическая проверка статусов оплаты каждые 5 минут  
✅ Полностью бесплатно (GitHub Actions)  
✅ Не требует Supabase Edge Functions  
✅ Логи всех проверок в GitHub  
✅ Можно запустить вручную одной кнопкой  

---

## 📝 Быстрая настройка (3 минуты)

### Шаг 1: Файл уже создан! ✅

Файл `.github/workflows/payment-checker.yml` уже находится в проекте.

### Шаг 2: Добавьте секреты в GitHub

1. Откройте ваш репозиторий на GitHub
2. Перейдите в **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **New repository secret**

Добавьте два секрета:

#### Секрет 1: SUPABASE_PROJECT_ID
- **Name**: `SUPABASE_PROJECT_ID`
- **Value**: ID вашего проекта Supabase

**Где взять:**
1. Откройте Supabase Dashboard
2. Settings → API
3. Project URL: `https://ВАSH_ID.supabase.co`
4. Скопируйте только ID (например, `abcdefghijklmnop`)

#### Секрет 2: SUPABASE_ANON_KEY
- **Name**: `SUPABASE_ANON_KEY`
- **Value**: Ваш публичный anon ключ

**Где взять:**
1. Supabase Dashboard → Settings → API
2. Раздел "Project API keys"
3. Скопируйте **anon public** ключ (начинается с `eyJ...`)

### Шаг 3: Закоммитьте и запушьте

```bash
git add .github/workflows/payment-checker.yml
git commit -m "Add automatic payment status checker"
git push
```

### Шаг 4: Проверьте работу

1. Откройте GitHub → **Actions**
2. Вы увидите workflow "Check Payment Statuses"
3. Он запустится автоматически каждые 5 минут
4. Или нажмите **Run workflow** чтобы запустить вручную прямо сейчас

---

## 🔍 Как проверить что работает?

### В интерфейсе GitHub Actions:

1. Перейдите в **Actions**
2. Выберите последний запуск "Check Payment Statuses"
3. Откройте job "check-payments"
4. Вы увидите логи:

```
🔄 Starting payment status check...
📊 Response status: 200
📄 Response body: {"success":true,"checked":5,"updated":2,"paid":2,...}
✅ Payment check completed successfully
```

### В вашем магазине:

1. Создайте тестовый заказ
2. Оплатите через Точка Банк
3. Подождите 5 минут (или запустите workflow вручную)
4. Зайдите в личный кабинет - статус должен обновиться!

---

## ⚙️ Настройка частоты проверки

Откройте `.github/workflows/payment-checker.yml` и измените строку:

```yaml
# Каждые 5 минут (текущая настройка)
- cron: '*/5 * * * *'

# Каждые 10 минут
- cron: '*/10 * * * *'

# Каждые 15 минут
- cron: '*/15 * * * *'

# Каждый час
- cron: '0 * * * *'

# Каждые 30 минут
- cron: '*/30 * * * *'

# Только в рабочее время (9:00-18:00 UTC)
- cron: '*/5 9-18 * * *'
```

---

## 📊 Мониторинг

### Просмотр статистики:

1. GitHub → Actions → Check Payment Statuses
2. Каждый запуск показывает:
   - Сколько заказов проверено
   - Сколько обновлено
   - Сколько оплачено
   - Сколько отменено/ошибок

### Email уведомления:

GitHub автоматически отправит email если workflow упадет с ошибкой.

Настройка:
1. GitHub Settings → Notifications
2. Включите "Actions" notifications

---

## 🔧 Troubleshooting

### Проблема: Workflow не запускается

**Решение:**
1. Убедитесь что файл закоммичен в ветку `main` или `master`
2. Проверьте что Actions включены: Settings → Actions → Allow all actions
3. Первый запуск может занять до 10 минут

### Проблема: Ошибка "Bad credentials"

**Решение:**
- Проверьте что секреты `SUPABASE_PROJECT_ID` и `SUPABASE_ANON_KEY` добавлены правильно
- Убедитесь что в ключе нет лишних пробелов

### Проблема: HTTP 500 ошибка

**Решение:**
- Проверьте что endpoint работает:
  ```bash
  curl -X POST https://ВАШ_ID.supabase.co/functions/v1/make-server-aa167a09/retail/check-pending-payments
  ```
- Проверьте логи в Supabase Dashboard → Edge Functions → make-server-aa167a09 → Logs

---

## 🎉 Готово!

После настройки GitHub Actions:

✅ Система автоматически проверяет платежи каждые 5 минут  
✅ Обновляет статусы заказов  
✅ Начисляет/списывает баллы лояльности  
✅ Пользователи видят актуальную информацию  

**Никаких дополнительных действий не требуется!**

---

## 💡 Бонус: Ручной запуск

В любой момент можете запустить проверку вручную:

1. GitHub → Actions
2. "Check Payment Statuses" → Run workflow
3. Выберите ветку (main)
4. Run workflow
5. Результат появится через несколько секунд!

Это полезно для:
- Тестирования настройки
- Срочной проверки после получения оплаты
- Отладки проблем
