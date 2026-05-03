> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# 🔧 Устранение проблем с подключением к серверу

## ❌ Ошибка: "Failed to fetch"

Эта ошибка означает, что браузер не может установить соединение с Edge Function сервером. 

## 🎯 Быстрая диагностика

### 1. **Используйте встроенную диагностику**

При появлении ошибки на странице админки автоматически отобразится панель "Диагностика сервера". Нажмите кнопку **"Запустить диагностику"** для проверки:

- ✅ Наличие переменных окружения (projectId, publicAnonKey)
- ✅ Доступность сервера (health check)
- ✅ Возможность получить заказы
- ✅ Правильность настройки CORS

### 2. **Ручная проверка через curl**

Откройте терминал и выполните:

```bash
# Проверка health endpoint
curl https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/health

# Ожидаемый ответ:
# {"status":"ok","timestamp":"...","service":"nechai-server"}
```

Если получаете ошибку, переходите к следующему шагу.

## 🚀 Возможные причины и решения

### Причина 1: Edge Function не развернута

**Признаки:**
- Health check возвращает 404 или "Not Found"
- Timeout при попытке подключения
- В логах Supabase нет записей о запросах

**Решение:**

1. Откройте Supabase Dashboard
2. Перейдите в **Edge Functions** → **server**
3. Убедитесь, что функция развернута (статус: Active/Running)
4. Если функция неактивна, нажмите **Deploy** для развертывания

```bash
# Или через CLI:
supabase functions deploy server
```

### Причина 2: CORS настроен неправильно

**Признаки:**
- В консоли браузера: "CORS policy: No 'Access-Control-Allow-Origin' header"
- Preflight запросы (OPTIONS) возвращают ошибку

**Решение:**

Убедитесь, что в файле `/supabase/functions/server/index.tsx` есть правильная CORS конфигурация:

```typescript
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 600,
  credentials: false
}));
```

И OPTIONS handlers:

```typescript
app.options(`${prefix}/admin/*`, (c) => {
  return c.text('', 204);
});
```

После изменений **переразверните функцию**.

### Причина 3: Переменные окружения не установлены

**Признаки:**
- Диагностика показывает "Missing environment variables"
- Ошибки 500 в логах сервера о missing env vars

**Решение:**

Проверьте, что в Supabase Dashboard → Edge Functions → server → Settings установлены:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Все эти переменные должны автоматически подставляться Supabase.

### Причина 4: Сервер падает при запуске

**Признаки:**
- Health check не отвечает
- В логах Supabase есть ошибки запуска функции
- 500 или 502 ошибки

**Решение:**

1. Откройте **Supabase Dashboard** → **Edge Functions** → **server** → **Logs**
2. Найдите ошибки в логах (красные записи)
3. Типичные проблемы:
   - Синтаксические ошибки в коде
   - Неправильный импорт модулей
   - Ошибки в kv_store.tsx

Пример типичной ошибки:
```
Error: Cannot find module 'npm:hono/middleware'
```

Решение: заменить на правильный импорт:
```typescript
import { cors } from 'npm:hono/cors'  // ✅ Правильно
import { cors } from 'npm:hono/middleware'  // ❌ Неправильно
```

### Причина 5: Проблемы с сетью или DNS

**Признаки:**
- Все Supabase сервисы недоступны
- Другие сайты работают нормально

**Решение:**

1. Проверьте статус Supabase: https://status.supabase.com/
2. Попробуйте очистить DNS кэш:
   ```bash
   # Windows
   ipconfig /flushdns
   
   # Mac/Linux
   sudo dscacheutil -flushcache
   ```
3. Попробуйте другую сеть или отключите VPN

## 📋 Чеклист проверки (по порядку)

- [ ] 1. Запустить встроенную диагностику на странице админки
- [ ] 2. Проверить health endpoint через curl
- [ ] 3. Проверить, что Edge Function развернута в Supabase Dashboard
- [ ] 4. Посмотреть логи Edge Function в Supabase Dashboard
- [ ] 5. Убедиться, что CORS настроен правильно
- [ ] 6. Проверить переменные окружения
- [ ] 7. Попробовать переразвернуть функцию

## 🔍 Расширенная диагностика

### Проверка через DevTools браузера

1. Откройте DevTools (F12)
2. Перейдите на вкладку **Network**
3. Обновите страницу
4. Найдите запрос к `/admin/orders`
5. Проверьте:
   - **Status**: должен быть 200
   - **Type**: должен быть "fetch"
   - **Initiator**: должен быть ваш компонент
   - **Response Headers**: должны содержать `Access-Control-Allow-Origin: *`

### Проверка CORS через curl

```bash
# Preflight запрос
curl -X OPTIONS \
  https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/admin/orders \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -H "Origin: http://localhost:5173" \
  -v

# Должны увидеть в ответе:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Status: 204
```

## 📞 Если ничего не помогает

1. **Сохраните логи:**
   - Скриншот результатов диагностики
   - Логи из DevTools → Console
   - Логи из Supabase Dashboard → Edge Functions

2. **Проверьте базовую связность:**
   ```bash
   ping pkhinqiplfezrzvsqgwo.supabase.co
   ```

3. **Попробуйте в режиме инкогнито:**
   - Это исключит проблемы с расширениями браузера
   - Очистит кэш и cookies

4. **Временное решение:**
   - В файле `/lib/api.ts` измените `USE_FALLBACK` на `true`
   - Это переключит приложение на работу с localStorage
   - **Внимание:** это только для тестирования, данные не будут синхронизированы!

## 🎯 Итог

Наиболее частая причина ошибки "Failed to fetch" - **Edge Function не развернута**.

**Быстрое решение:**
1. Supabase Dashboard → Edge Functions → server
2. Нажать **Deploy**
3. Подождать 30-60 секунд
4. Обновить страницу админки

---

**Последнее обновление:** 12 февраля 2026  
**Статус документа:** Актуальный
