> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# 📊 Создание таблицы telegram_users в Supabase

## Метод 1: SQL Editor (Рекомендуется) ⭐

### Шаг 1: Откройте SQL Editor
1. Перейдите в **Supabase Dashboard**: https://supabase.com/dashboard
2. Выберите ваш проект
3. В левом меню найдите **SQL Editor**
4. Нажмите **New Query**

### Шаг 2: Скопируйте и выполните SQL

```sql
-- ============================================
-- Создание таблицы telegram_users
-- ============================================

-- 1. Создание таблицы
CREATE TABLE IF NOT EXISTS telegram_users (
  id BIGINT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Создание индекса для производительности
CREATE INDEX IF NOT EXISTS idx_telegram_users_created_at 
ON telegram_users(created_at DESC);

-- 3. Включение Row Level Security
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

-- 4. Политика для анонимных пользователей (регистрация)
CREATE POLICY "Allow anon insert telegram_users" 
ON telegram_users 
FOR INSERT 
TO anon 
WITH CHECK (true);

-- 5. Политика для сервисной роли (полный доступ)
CREATE POLICY "Allow service role all telegram_users" 
ON telegram_users 
FOR ALL 
TO service_role 
USING (true);

-- ============================================
-- Готово! ✅
-- ============================================
```

### Шаг 3: Запустите запрос
1. Нажмите кнопку **Run** (или Ctrl+Enter / Cmd+Enter)
2. Дождитесь сообщения **Success** ✅

---

## Метод 2: Table Editor (Визуальный интерфейс)

### Шаг 1: Создание таблицы
1. Откройте **Supabase Dashboard**
2. Перейдите в **Table Editor**
3. Нажмите кнопку **Create a new table**

### Шаг 2: Настройка таблицы
```
Table Name: telegram_users
Description: Telegram subscribers for broadcast system
Enable Row Level Security (RLS): ✅ Да
```

### Шаг 3: Добавление колонок

#### Колонка 1: id (Primary Key)
```
Name: id
Type: int8 (BIGINT)
Default Value: (оставьте пустым)
Primary: ✅ Да
Nullable: ❌ Нет
```

#### Колонка 2: created_at
```
Name: created_at
Type: timestamptz
Default Value: now()
Primary: ❌ Нет
Nullable: ✅ Да
```

### Шаг 4: Сохранение
Нажмите **Save** для создания таблицы.

### Шаг 5: Настройка RLS политик

После создания таблицы нужно добавить политики:

1. Откройте вкладку **Authentication** → **Policies**
2. Найдите таблицу `telegram_users`
3. Нажмите **New Policy**

#### Политика 1: Разрешить вставку для анонимных пользователей
```
Policy name: Allow anon insert
Operation: INSERT
Target roles: anon
WITH CHECK expression: true
```

#### Политика 2: Полный доступ для сервисной роли
```
Policy name: Allow service role all
Operation: ALL
Target roles: service_role
USING expression: true
```

---

## Проверка таблицы

### Через SQL Editor:
```sql
-- Проверить структуру таблицы
\d telegram_users

-- Проверить количество записей
SELECT COUNT(*) FROM telegram_users;

-- Посмотреть последних подписчиков
SELECT * FROM telegram_users ORDER BY created_at DESC LIMIT 10;
```

### Через Table Editor:
1. Откройте **Table Editor**
2. Найдите таблицу `telegram_users`
3. Вы должны увидеть 2 колонки: `id` и `created_at`

---

## Что дальше?

После создания таблицы:

✅ **Настройте Telegram Webhook**  
Следуйте инструкциям в файле `WEBHOOK_SETUP.md`

✅ **Протестируйте систему**  
Отправьте сообщение вашему боту в Telegram

✅ **Проверьте таблицу**  
В таблице должна появиться запись с вашим chat_id

✅ **Отправьте тестовую рассылку**  
Используйте админ-панель → Опт → Рассылка

---

## Устранение проблем

### Ошибка: "relation telegram_users does not exist"
**Решение:** Таблица не создана. Повторите Метод 1.

### Ошибка: "permission denied for table telegram_users"
**Решение:** RLS политики не настроены. Выполните SQL из Метода 1.

### Ошибка при вставке через webhook
**Решение:** Убедитесь, что политика "Allow anon insert" создана.

### Ошибка при чтении в админ-панели
**Решение:** Убедитесь, что политика "Allow service role all" создана.

---

## Дополнительно: Миграция с KV Store (если использовали ранее)

Если у вас уже были подписчики в KV хранилище с префиксом `telegram_user_`:

```sql
-- ВНИМАНИЕ: Это псевдокод. Данные из KV нельзя перенести напрямую через SQL
-- Используйте скрипт миграции или добавьте пользователей вручную

INSERT INTO telegram_users (id, created_at)
VALUES 
  (123456789, NOW()),  -- Замените на реальные chat_id
  (987654321, NOW());
```

---

## Структура таблицы (справка)

```
┌─────────────┬──────────────┬──────────┬──────────┐
│   Column    │     Type     │ Nullable │ Default  │
├─────────────┼──────────────┼──────────┼──────────┤
│ id          │ BIGINT       │ NOT NULL │          │ (PK)
│ created_at  │ TIMESTAMPTZ  │ NULL     │ NOW()    │
└─────────────┴──────────────┴──────────┴──────────┘
```

**Примечания:**
- `id` - это chat_id пользователя из Telegram (может быть очень большим числом)
- `created_at` - дата и время подписки
- Primary Key на `id` гарантирует уникальность подписчиков

---

**🎉 Готово! Таблица создана и готова к использованию.**

Следующий шаг: [Настройка Webhook →](WEBHOOK_SETUP.md)
