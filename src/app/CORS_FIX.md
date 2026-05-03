> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# 🔧 Исправление ошибок CORS и подключения к серверу

## 🐛 Проблема
```
❌ Error in fetchOrdersAdmin: TypeError: Failed to fetch
❌ TypeError detected - likely network or CORS issue
```

## ✅ Выполненные исправления

### 1. **Улучшена конфигурация CORS на сервере**

**Файл:** `/supabase/functions/server/index.tsx`

**Было:**
```typescript
app.use('*', cors());
```

**Стало:**
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

**Что это дает:**
- ✅ Явное разрешение всех источников (origin: '*')
- ✅ Разрешение всех необходимых HTTP методов
- ✅ Разрешение заголовков Authorization и Content-Type
- ✅ Кэширование preflight запросов на 10 минут

### 2. **Добавлены OPTIONS handlers для CORS preflight**

Добавлены обработчики для preflight запросов:

```typescript
// Общие OPTIONS handlers для всех маршрутов
app.options(`${prefix}/admin/*`, (c) => {
  return c.text('', 204);
});

app.options(`${prefix}/retail/*`, (c) => {
  return c.text('', 204);
});

app.options(`${prefix}/*`, (c) => {
  return c.text('', 204);
});
```

**Что это дает:**
- ✅ Браузер может выполнять preflight запросы (OPTIONS)
- ✅ Поддержка сложных CORS запросов с пользовательскими заголовками

### 3. **Улучшено логирование в /admin/orders**

**Добавлено:**
```typescript
console.log('📥 GET /admin/orders - Request received');
console.log('📥 CORS headers present:', c.req.header('origin'));
console.log('📥 Found orders:', orders.length);
console.log('✅ Returning', sorted.length, 'wholesale orders');
```

**Улучшена обработка ошибок:**
```typescript
console.error('❌ Error fetching admin orders:', error);
console.error('❌ Error stack:', error instanceof Error ? error.stack : 'no stack');
return c.json({ 
  error: 'Failed to fetch orders',
  details: error instanceof Error ? error.message : String(error)
}, 500);
```

**Что это дает:**
- ✅ Подробные логи для отладки
- ✅ Информация об ошибках с stack trace
- ✅ Детальные сообщения об ошибках для клиента

## 🧪 Проверка работоспособности

### 1. Проверить health endpoint:
```bash
curl https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/health
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "timestamp": "2026-02-12T...",
  "service": "nechai-server"
}
```

### 2. Проверить CORS preflight для /admin/orders:
```bash
curl -X OPTIONS \
  https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/admin/orders \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -H "Origin: http://localhost:5173" \
  -v
```

Ожидаемые заголовки в ответе:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### 3. Проверить GET /admin/orders:
```bash
curl https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/admin/orders \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## 📋 Затронутые эндпоинты

Исправления применены ко всем эндпоинтам:

### Админские эндпоинты:
- ✅ `GET /admin/orders`
- ✅ `GET /admin/retail/orders`
- ✅ `GET /admin/users`
- ✅ `GET /admin/retail-users`
- ✅ `DELETE /admin/retail-users/:id`
- ✅ `POST /admin/retail-users/:id/balance`
- ✅ `POST /admin/grant-welcome-bonus`
- ✅ `POST /admin/grant-bonus-by-email`
- ✅ `GET /admin/debug-users`
- ✅ `POST /admin/fix-user-profiles`

### Розничные эндпоинты:
- ✅ `GET /retail/products`
- ✅ `POST /retail/orders`
- ✅ И все остальные retail эндпоинты

### Общие эндпоинты:
- ✅ `/health`
- ✅ `/coffee-items`
- ✅ `/orders`
- ✅ `/users`
- ✅ И все остальные эндпоинты

## 🔍 Если проблема сохраняется

### 📖 См. полное руководство по устранению проблем

Все детальные инструкции по диагностике и исправлению ошибок перенесены в отдельный документ:

**👉 [SERVER_TROUBLESHOOTING.md](./SERVER_TROUBLESHOOTING.md)**

В нем вы найдете:
- 🎯 Быструю диагностику со встроенным инструментом
- 🔧 Все возможные причины ошибок и их решения
- 📋 Пошаговый чеклист проверки
- 🔍 Расширенную диагностику через DevTools и curl
- 📞 Что делать, если ничего не помогает

### Быстрая проверка:

1. **На странице админки нажмите "Запустить диагностику"** (появляется при ошибке)
2. **Проверьте, развернута ли Edge Function:**
   - Supabase Dashboard → Edge Functions → server → Deploy
3. **Посмотрите логи:**
   - Supabase Dashboard → Edge Functions → Logs

## 🎯 Итог

| Компонент | Статус | Описание |
|-----------|--------|----------|
| CORS конфигурация | 🟢 | Явно настроена |
| OPTIONS handlers | 🟢 | Добавлены |
| Логирование | 🟢 | Улучшено |
| Обработка ошибок | 🟢 | Детализирована |
| Все эндпоинты | 🟢 | Обновлены |

---
**Дата исправления:** 12 февраля 2026
**Статус:** ✅ Исправлено
