# 🔒 ОТЧЁТ ПО АУДИТУ БЕЗОПАСНОСТИ ПЕРСОНАЛЬНЫХ ДАННЫХ

**Дата аудита:** 12 февраля 2026  
**Статус:** 🚨 **КРИТИЧЕСКИЕ УЯЗВИМОСТИ ОБНАРУЖЕНЫ**  
**Уровень риска:** ⚠️ **КРИТИЧЕСКИЙ**

---

## A) УТЕЧКА ПОДТВЕРЖДЕНА: ✅ **ДА**

### Краткое резюме проблемы:
Персональные данные **ВСЕХ** клиентов (оптовых и розничных) доступны **ЛЮБОМУ** посетителю сайта через публичные API endpoints без какой-либо авторизации.

---

## B) ГДЕ ИМЕННО ОБНАРУЖЕНА ПРОБЛЕМА

### 🚨 **КРИТИЧЕСКАЯ УЯЗВИМОСТЬ #1: Публичный доступ к оптовым заказам**

**Endpoint:** `GET /make-server-aa167a09/orders`  
**Полный URL:** `https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/orders`

**Проблема:**
- ❌ Endpoint возвращает **ВСЕ** оптовые заказы без проверки прав доступа
- ❌ Требует только `publicAnonKey` (который **ПУБЛИЧЕН** и доступен в коде)
- ❌ Любой может открыть DevTools и выполнить запрос

**Код в `/supabase/functions/server/index.tsx` (строка 652):**
```typescript
// Получить все заказы (только оптовые)
app.get(`${prefix}/orders`, async (c) => {
  try {
    const orders = await kv.getByPrefix(ORDERS_PREFIX);
    // НЕТ ПРОВЕРКИ АВТОРИЗАЦИИ!
    return c.json(sorted);
  }
})
```

**Утекающие данные:**
```json
{
  "company": "ООО «Рога и Копыта»",
  "inn": "1234567890",
  "account": "40702810000000000000",
  "bik": "044525225",
  "contact": "Иванов Иван Иванович",
  "phone": "+79991234567",
  "address": "г. Москва, ул. Ленина, д. 1",
  "delivery_address": "г. Москва, ул. Пушкина, д. 2",
  "delivery_company": "СДЭК",
  "items": [...],
  "total": 50000,
  "userId": "user_123",
  "promoCode": "DISCOUNT20"
}
```

---

### 🚨 **КРИТИЧЕСКАЯ УЯЗВИМОСТЬ #2: Публичный доступ к розничным заказам**

**Endpoint:** `GET /make-server-aa167a09/retail/orders`  
**Полный URL:** `https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/retail/orders`

**Проблема:**
- ❌ Endpoint возвращает **ВСЕ** розничные заказы без проверки прав доступа
- ❌ Требует только `publicAnonKey`
- ❌ Любой может получить доступ

**Код в `/supabase/functions/server/index.tsx` (строка 3133):**
```typescript
// Получить все розничные заказы
app.get(`${prefix}/retail/orders`, async (c) => {
  try {
    const orders = await kv.getByPrefix(RETAIL_ORDERS_PREFIX);
    // НЕТ ПРОВЕРКИ АВТОРИЗАЦИИ!
    return c.json(sortedOrders);
  }
})
```

**Утекающие данные:**
```json
{
  "customerName": "Петрова Мария",
  "customerPhone": "+79997654321",
  "customerEmail": "maria@example.com",
  "deliveryAddress": "г. Санкт-Петербург, Невский пр., д. 10, кв. 5",
  "items": [...],
  "total": 2500,
  "paymentMethod": "card",
  "userId": "user_456"
}
```

---

### 🚨 **КРИТИЧЕСКАЯ УЯЗВИМОСТЬ #3: Публичный доступ к пользователям**

**Endpoint:** `GET /make-server-aa167a09/users`  
**Полный URL:** `https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/users`

**Проблема:**
- ❌ Endpoint возвращает **ВСЕХ** оптовых пользователей без проверки прав доступа
- ❌ Ут��кают: телефоны, компании, скидки, INN, счета, БИК

**Код в `/supabase/functions/server/index.tsx` (строка 851):**
```typescript
// Получить всех пользователей
app.get(`${prefix}/users`, async (c) => {
  try {
    const users = await kv.getByPrefix(USERS_PREFIX);
    // Убираем пароли из ответа (хорошо!)
    const sanitizedUsers = users.map((user: any) => {
      const { password, ...rest } = user;
      return rest;
    });
    // НО НЕТ ПРОВЕРКИ АВТОРИЗАЦИИ!
    return c.json(sorted);
  }
})
```

**Утекающие данные:**
```json
{
  "id": "user_123",
  "phone": "+79991234567",
  "company_name": "ООО «Кофейня»",
  "discount": 15,
  "inn": "1234567890",
  "account": "40702810000000000000",
  "bik": "044525225",
  "address": "г. Москва, ...",
  "loyaltyLevel": "gold"
}
```

**Примечание:** Пароли НЕ утекают (они удаляются перед отправкой), но все остальные данные доступны.

---

### ⚠️ **ВЫСОКИЙ РИСК #4: Публичный доступ к заказам пользователя**

**Endpoint:** `GET /make-server-aa167a09/users/:id/orders`  
**Полный URL:** `https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/users/USER_ID/orders`

**Проблема:**
- ⚠️ Endpoint фильтрует заказы по `userId`, НО не проверяет, имеет ли **запрашивающий** право видеть эти заказы
- ⚠️ Любой может подставить чужой `userId` и получить все заказы этого пользователя

**Код в `/supabase/functions/server/index.tsx` (строка 1139):**
```typescript
// Получить заказы пользователя
app.get(`${prefix}/users/:id/orders`, async (c) => {
  try {
    const userId = c.req.param('id');
    const allOrders = await kv.getByPrefix(ORDERS_PREFIX);
    
    // Фильтруем заказы по userId
    const userOrders = allOrders.filter((order: any) => order.userId === userId);
    // НЕТ ПРОВЕРКИ: "А имеет ли запрашивающий право видеть эти заказы?"
    
    return c.json(sorted);
  }
})
```

---

### 🔓 **СРЕДНИЙ РИСК #5: Хардкод админского токена**

**Проблема:**
- ⚠️ Админский токен `NECHAI_ADMIN_TOKEN_2026` жёстко зашит в коде frontend
- ⚠️ Виден в исходниках на клиенте
- ⚠️ Используется для доступа к `/retail-users` endpoint

**Файл:** `/components/admin/RetailUsersPage.tsx` (строка 39)
```typescript
const url = `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail-users?admin_token=NECHAI_ADMIN_TOKEN_2026`;
```

**Backend:** `/supabase/functions/server/index.tsx` (строка 5039)
```typescript
if (adminToken === 'NECHAI_ADMIN_TOKEN_2026') {
  console.log('✅ [RETAIL-USERS] Доступ через админский токен подтвержден');
}
```

**Примечание:** Endpoint `/retail-users` **защищён** этим токеном, но сам токен **публичен** и виден в коде. Это лучше, чем ничего, но не безопасно.

---

### ✅ **ЧТО РАБОТАЕТ ПРАВИЛЬНО:**

1. ✅ **Service Role Key не утекает** - используется только на backend
2. ✅ **Public Anon Key используется корректно** - только он доступен на frontend
3. ✅ **Пароли пользователей не утекают** - удаляются перед отправкой из `/users` endpoint
4. ✅ **Данные хранятся в KV Store** - это быстро и работает
5. ✅ **CORS настроен корректно** - запросы работают

---

## C) УРОВЕНЬ РИСКА

### 🚨 **КРИТИЧЕСКИЙ**

**Обоснование:**
- ✅ Подтверждена **полная утечка** персональных данных
- ✅ Доступ **БЕЗ АВТОРИЗАЦИИ** - любой может получить данные
- ✅ Утекают: телефоны, email, адреса доставки, ИНН, расчётные счета, БИК
- ✅ Нарушается **GDPR** и **152-ФЗ "О персональных данных"**
- ✅ Данные доступны через простой `fetch()` запрос из DevTools

**Сценарий атаки:**
```javascript
// Любой посетитель может выполнить в консоли браузера:
const response = await fetch(
  'https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/orders',
  {
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // publicAnonKey из кода
    }
  }
);
const allOrders = await response.json();
console.log(allOrders); // Все заказы со всеми данными!
```

---

## D) ПЛАН БЕЗОПАСНОГО ИСПРАВЛЕНИЯ

### ⚠️ **ВАЖНО: ЭТОТ ПЛАН НЕ ТРОГАЕТ ДАННЫЕ КЛИЕНТОВ**

Все изменения затрагивают **ТОЛЬКО**:
- ✅ Код проверки авторизации в endpoints
- ✅ Логику фильтрации данных
- ✅ Настройки доступа

**НЕ ТРОГАЕМ:**
- ❌ Существующие заказы в KV Store
- ❌ Данные пользователей
- ❌ Структуру данных

---

### 📋 **ПЛАН ДЕЙСТВИЙ (3 ЭТАПА)**

#### **ЭТАП 1: СРОЧНЫЕ МЕРЫ (применить НЕМЕДЛЕННО)**

##### 1.1. Добавить проверку авторизации в `/orders` endpoint

**Файл:** `/supabase/functions/server/index.tsx`  
**Строка:** 652

**БЫЛО:**
```typescript
app.get(`${prefix}/orders`, async (c) => {
  try {
    const orders = await kv.getByPrefix(ORDERS_PREFIX);
    // ... возврат всех заказов
    return c.json(sorted);
  }
})
```

**ДОЛЖНО СТАТЬ:**
```typescript
app.get(`${prefix}/orders`, async (c) => {
  try {
    // ДОБАВИТЬ ПРОВЕРКУ АВТОРИЗАЦИИ
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Проверяем админский токен
    if (accessToken === 'NECHAI_ADMIN_TOKEN_2026') {
      // Админ - возвращаем все заказы
      const orders = await kv.getByPrefix(ORDERS_PREFIX);
      // ... фильтрация и сортировка
      return c.json(sorted);
    }
    
    // Если не админ - запрещаем доступ
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }
})
```

**Примечание:** Это временное решение с хардкод токеном. В ЭТАПЕ 2 мы улучшим его.

---

##### 1.2. Добавить проверку авторизации в `/retail/orders` endpoint

**Файл:** `/supabase/functions/server/index.tsx`  
**Строка:** 3133

**БЫЛО:**
```typescript
app.get(`${prefix}/retail/orders`, async (c) => {
  try {
    const orders = await kv.getByPrefix(RETAIL_ORDERS_PREFIX);
    // ... возврат всех заказов
    return c.json(sortedOrders);
  }
})
```

**ДОЛЖНО СТАТЬ:**
```typescript
app.get(`${prefix}/retail/orders`, async (c) => {
  try {
    // ДОБАВИТЬ ПРОВЕРКУ АВТОРИЗАЦИИ
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Проверяем админский токен
    if (accessToken === 'NECHAI_ADMIN_TOKEN_2026') {
      // Админ - возвращаем все заказы
      const orders = await kv.getByPrefix(RETAIL_ORDERS_PREFIX);
      // ... фильтрация и сортировка
      return c.json(sortedOrders);
    }
    
    // Если не админ - запрещаем доступ
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }
})
```

---

##### 1.3. Добавить проверку авторизации в `/users` endpoint

**Файл:** `/supabase/functions/server/index.tsx`  
**Строка:** 851

**БЫЛО:**
```typescript
app.get(`${prefix}/users`, async (c) => {
  try {
    const users = await kv.getByPrefix(USERS_PREFIX);
    // ... возврат всех пользователей
    return c.json(sorted);
  }
})
```

**ДОЛЖНО СТАТЬ:**
```typescript
app.get(`${prefix}/users`, async (c) => {
  try {
    // ДОБАВИТЬ ПРОВЕРКУ АВТОРИЗАЦИИ
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Проверяем админский токен
    if (accessToken === 'NECHAI_ADMIN_TOKEN_2026') {
      // Админ - возвращаем всех пользователей
      const users = await kv.getByPrefix(USERS_PREFIX);
      // ... удаление паролей и сортировка
      return c.json(sorted);
    }
    
    // Если не админ - запрещаем доступ
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }
})
```

---

##### 1.4. Усилить проверку в `/users/:id/orders` endpoint

**Файл:** `/supabase/functions/server/index.tsx`  
**Строка:** 1139

**БЫЛО:**
```typescript
app.get(`${prefix}/users/:id/orders`, async (c) => {
  try {
    const userId = c.req.param('id');
    const allOrders = await kv.getByPrefix(ORDERS_PREFIX);
    
    // Фильтруем заказы по userId
    const userOrders = allOrders.filter((order: any) => order.userId === userId);
    
    return c.json(sorted);
  }
})
```

**ДОЛЖНО СТАТЬ:**
```typescript
app.get(`${prefix}/users/:id/orders`, async (c) => {
  try {
    const requestedUserId = c.req.param('id');
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Проверяем, что запрашивает либо сам пользователь, либо админ
    
    // Вариант 1: Админ может видеть заказы любого пользователя
    if (accessToken === 'NECHAI_ADMIN_TOKEN_2026') {
      const allOrders = await kv.getByPrefix(ORDERS_PREFIX);
      const userOrders = allOrders.filter((order: any) => order.userId === requestedUserId);
      // ... сортировка
      return c.json(sorted);
    }
    
    // Вариант 2: Обычный пользователь - нужна авторизация через Supabase Auth
    // (будет реализовано в ЭТАПЕ 2)
    
    // Если ни админ, ни авторизованный пользователь - запрещаем
    return c.json({ error: 'Forbidden' }, 403);
  }
})
```

---

#### **ЭТАП 2: УСИЛЕНИЕ БЕЗОПАСНОСТИ (применить в течение недели)**

##### 2.1. Переместить админский токен в environment variables

**Проблема:** Токен `NECHAI_ADMIN_TOKEN_2026` виден в коде frontend.

**Решение:**
1. Создать новый токен в админ-панели Supabase (Settings → Secrets)
2. Добавить в Supabase Secrets:
   - `ADMIN_API_TOKEN` = `[сгенерировать длинный случайный токен]`
3. Обновить код backend:

```typescript
// В index.tsx
const ADMIN_TOKEN = Deno.env.get('ADMIN_API_TOKEN');

// В каждом защищённом endpoint:
if (accessToken === ADMIN_TOKEN) {
  // Доступ разрешён
}
```

4. **НЕ ХРАНИТЬ токен в frontend коде**
5. Передавать токен только с backend-запросов или через защищённую админ-панель

---

##### 2.2. Реализовать role-based access через Supabase Auth

**Для оптовых пользователей:**
- Пользователь авторизуется через Supabase Auth (email/password)
- Backend проверяет auth token и user_id
- Endpoint `/users/:id/orders` возвращает заказы только если:
  - `auth.uid() === requestedUserId` (пользователь запрашивает свои заказы)
  - ИЛИ `user.role === 'admin'` (админ)

**Код:**
```typescript
app.get(`${prefix}/users/:id/orders`, async (c) => {
  const requestedUserId = c.req.param('id');
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  
  // Проверяем админский токен
  if (accessToken === Deno.env.get('ADMIN_API_TOKEN')) {
    // Админ - возвращаем заказы
    // ...
    return c.json(userOrders);
  }
  
  // Проверяем авторизацию пользователя через Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Проверяем, что пользователь запрашивает свои заказы
  if (user.id !== requestedUserId) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  
  // Возвращаем заказы пользователя
  // ...
  return c.json(userOrders);
});
```

---

##### 2.3. Создать отдельные endpoints для админа и пользователей

**Структура:**
```
GET /admin/orders           - все заказы (требует ADMIN_API_TOKEN)
GET /admin/users            - все пользователи (требует ADMIN_API_TOKEN)
GET /admin/retail/orders    - все розничные заказы (требует ADMIN_API_TOKEN)

GET /my/orders              - мои заказы (требует Supabase Auth)
GET /my/profile             - мой профиль (требует Supabase Auth)
```

**Преимущества:**
- ✅ Чёткое разделение прав доступа
- ✅ Меньше путаницы в коде
- ✅ Легче аудировать

---

#### **ЭТАП 3: ДОПОЛНИТЕЛЬНЫЕ МЕРЫ (опционально)**

##### 3.1. Rate Limiting

Добавить ограничение на количество запросов к API:
- Максимум 100 запросов в минуту с одного IP
- Защита от массового сбора данных

##### 3.2. Логирование доступа

Логировать все запросы к защищённым endpoints:
- Кто запрашивал (IP, user_id)
- Когда запрашивал (timestamp)
- Что запрашивал (endpoint, параметры)

##### 3.3. Аудит безопасности раз в квартал

Регулярная проверка:
- Нет ли новых публичных endpoints
- Все ли endpoints защищены
- Нет ли утечек токенов

---

## E) КОНКРЕТНЫЕ ИЗМЕНЕНИЯ КОДА

### 🔧 **ФАЙЛ 1: `/supabase/functions/server/index.tsx`**

#### Изменение #1: Защита `GET /orders` (стр��ка 652)

```typescript
// Получить все заказы (только оптовые) - ТРЕБУЕТ АВТОРИЗАЦИИ
app.get(`${prefix}/orders`, async (c) => {
  try {
    // ПРОВЕРКА АВТОРИЗАЦИИ
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    
    // Проверяем админский токен (временное решение)
    const ADMIN_TOKEN = 'NECHAI_ADMIN_TOKEN_2026'; // TODO: переместить в env variables
    
    if (accessToken !== ADMIN_TOKEN) {
      console.log('❌ Unauthorized access attempt to /orders');
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }
    
    // Админ авторизован - возвращаем заказы
    const orders = await kv.getByPrefix(ORDERS_PREFIX);
    
    // ... остальная логика без изменений
    const migratedOrders = orders.map((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        const migratedItems = order.items.map((item: any) => {
          if (item.packs250 !== undefined && item.packs200 === undefined) {
            const { packs250, ...rest } = item;
            return { ...rest, packs200: packs250 };
          }
          return item;
        });
        return { ...order, items: migratedItems };
      }
      return order;
    });
    
    const wholesaleOrders = migratedOrders.filter((order: any) => 
      !order.orderType || order.orderType === 'wholesale'
    );
    
    const sorted = wholesaleOrders.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return c.json(sorted);
  } catch (error) {
    console.log('Error fetching orders:', error);
    return c.json({ error: 'Failed to fetch orders' }, 500);
  }
});
```

---

#### Изменение #2: Защита `GET /retail/orders` (строка 3133)

```typescript
// Получить все розничные заказы - ТРЕБУЕТ АВТОРИЗАЦИИ
app.get(`${prefix}/retail/orders`, async (c) => {
  try {
    // ПРОВЕРКА АВТОРИЗАЦИИ
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    
    // Проверяем админский токен (временное решение)
    const ADMIN_TOKEN = 'NECHAI_ADMIN_TOKEN_2026'; // TODO: переместить в env variables
    
    if (accessToken !== ADMIN_TOKEN) {
      console.log('❌ Unauthorized access attempt to /retail/orders');
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }
    
    // Админ авторизован - возвращаем заказы
    console.log('Fetching all retail orders...');
    
    const orders = await kv.getByPrefix(RETAIL_ORDERS_PREFIX);
    
    // ... остальная логика без изменений
    const validOrders = orders.filter((order: any) => {
      const isValid = order.orderId && 
                      order.date && 
                      order.total !== undefined && 
                      !isNaN(order.total);
      
      if (!isValid) {
        console.warn('Skipping invalid order in database:', {
          orderId: order.orderId || 'missing',
          hasDate: !!order.date,
          total: order.total,
          customerName: order.customerName || order.contact
        });
      }
      
      return isValid;
    });
    
    const sortedOrders = validOrders.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    console.log(`Found ${sortedOrders.length} valid retail orders (filtered ${orders.length - sortedOrders.length} invalid)`);
    return c.json(sortedOrders);
  } catch (error) {
    console.log('Error fetching retail orders:', error);
    return c.json({ error: 'Failed to fetch retail orders' }, 500);
  }
});
```

---

#### Изменение #3: Защита `GET /users` (строка 851)

```typescript
// Получить всех пользователей - ТРЕБУЕТ АВТОРИЗАЦИИ
app.get(`${prefix}/users`, async (c) => {
  try {
    // ПРОВЕРКА АВТОРИЗАЦИИ
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    
    // Проверяем админский токен (временное решение)
    const ADMIN_TOKEN = 'NECHAI_ADMIN_TOKEN_2026'; // TODO: переместить в env variables
    
    if (accessToken !== ADMIN_TOKEN) {
      console.log('❌ Unauthorized access attempt to /users');
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }
    
    // Админ авторизован - возвращаем пользователей
    const users = await kv.getByPrefix(USERS_PREFIX);
    
    // Убираем пароли из ответа
    const sanitizedUsers = users.map((user: any) => {
      const { password, ...rest } = user;
      return rest;
    });
    
    // Сортируем по дате создания (новые первыми)
    const sorted = sanitizedUsers.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return c.json(sorted);
  } catch (error) {
    console.log('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});
```

---

#### Изменение #4: Усиление `GET /users/:id/orders` (строка 1139)

```typescript
// Получить заказы пользователя - ТРЕБУЕТ АВТОРИЗАЦИИ
app.get(`${prefix}/users/:id/orders`, async (c) => {
  try {
    const requestedUserId = c.req.param('id');
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    
    // Проверяем админский токен
    const ADMIN_TOKEN = 'NECHAI_ADMIN_TOKEN_2026'; // TODO: переместить в env variables
    
    if (accessToken !== ADMIN_TOKEN) {
      // TODO: В будущем добавить проверку через Supabase Auth
      // чтобы пользователь мог видеть свои заказы
      console.log('❌ Unauthorized access attempt to /users/:id/orders');
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }
    
    // Админ авторизован - возвращаем заказы пользователя
    const allOrders = await kv.getByPrefix(ORDERS_PREFIX);
    
    // Фильтруем заказы по userId
    const userOrders = allOrders.filter((order: any) => order.userId === requestedUserId);
    
    // ... остальная логика без изменений
    const migratedOrders = userOrders.map((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        const migratedItems = order.items.map((item: any) => {
          if (item.packs250 !== undefined && item.packs200 === undefined) {
            const { packs250, ...rest } = item;
            return { ...rest, packs200: packs250 };
          }
          return item;
        });
        return { ...order, items: migratedItems };
      }
      return order;
    });
    
    const sorted = migratedOrders.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return c.json(sorted);
  } catch (error) {
    console.log('Error fetching user orders:', error);
    return c.json({ error: 'Failed to fetch user orders' }, 500);
  }
});
```

---

### 🔧 **ФАЙЛ 2: `/lib/api.ts`**

**Изменение:** Обновить заголовки для админских запросов

Сейчас в файле используется `publicAnonKey` для всех запросов. Для админских endpoints нужно использовать `ADMIN_TOKEN`.

**НО:** Токен нельзя хранить в frontend коде!

**Решение:** 
1. Админские компоненты должны работать только после авторизации
2. После авторизации токен хранится в `localStorage`
3. Запросы используют этот токен

**Альтернатива (лучше):**
- Админка переезжает на отдельный домен/поддомен с Basic Auth
- Токен передаётся через server-side proxy

---

## F) ПРОВЕРКА ИСПРАВЛЕНИЙ

### После применения исправлений ЭТАПА 1:

#### Тест 1: Попытка получить заказы без токена
```javascript
// В DevTools консоли:
const response = await fetch(
  'https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/orders',
  {
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // publicAnonKey
    }
  }
);

// Ожидаемый результат:
// Status: 403 Forbidden
// Body: { "error": "Forbidden: Admin access required" }
```

#### Тест 2: Попытка получить заказы с правильным токеном
```javascript
const response = await fetch(
  'https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/orders',
  {
    headers: {
      'Authorization': 'Bearer NECHAI_ADMIN_TOKEN_2026'
    }
  }
);

// Ожидаемый результат:
// Status: 200 OK
// Body: [...заказы...]
```

#### Тест 3: Проверка /retail/orders
```javascript
const response = await fetch(
  'https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/retail/orders',
  {
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // publicAnonKey
    }
  }
);

// Ожидаемый результат:
// Status: 403 Forbidden
```

#### Тест 4: Проверка /users
```javascript
const response = await fetch(
  'https://pkhinqiplfezrzvsqgwo.supabase.co/functions/v1/make-server-aa167a09/users',
  {
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // publicAnonKey
    }
  }
);

// Ожидаемый результат:
// Status: 403 Forbidden
```

---

## G) РЕКОМЕНДАЦИИ НА БУДУЩЕЕ

### 1. **Принцип наименьших привилегий (Principle of Least Privilege)**
- Каждый endpoint должен требовать минимально необходимые права
- По умолчанию всё закрыто, доступ открывается явно

### 2. **Разделение ролей**
- Admin - полный доступ ко всем данным
- User - доступ только к своим данным
- Guest - доступ только к публичному каталогу

### 3. **Не хранить секреты в коде**
- Все токены и ключи - в environment variables
- Использовать Supabase Secrets или другие secure storage

### 4. **Регулярный аудит**
- Проверять endpoints раз в квартал
- Использовать автоматические инструменты (например, OWASP ZAP)

### 5. **Логирование**
- Логировать все попытки доступа к защищённым данным
- Мониторить подозрительную активность

---

## H) КОНТРОЛЬНЫЙ СПИСОК ИСПРАВЛЕНИЙ

### ЭТАП 1 (СРОЧНО):
- [ ] Добавить проверку авторизации в `GET /orders`
- [ ] Добавить проверку авторизации в `GET /retail/orders`
- [ ] Добавить проверку авторизации в `GET /users`
- [ ] Усилить проверку в `GET /users/:id/orders`
- [ ] Протестировать все изменения
- [ ] Убедиться, что админка работает

### ЭТАП 2 (В ТЕЧЕНИЕ НЕДЕЛИ):
- [ ] Создать `ADMIN_API_TOKEN` в Supabase Secrets
- [ ] Переместить токен из кода в environment variables
- [ ] Обновить backend для чтения токена из `Deno.env`
- [ ] Обновить frontend для безопасной передачи токена
- [ ] Реализовать role-based access через Supabase Auth
- [ ] Создать отдельные endpoints для админа и пользователей

### ЭТАП 3 (ОПЦИОНАЛЬНО):
- [ ] Добавить rate limiting
- [ ] Настроить логирование доступа
- [ ] Провести полный аудит безопасности
- [ ] Документировать процедуры безопасности

---

## I) ВАЖНЫЕ ЗАМЕЧАНИЯ

### ⚠️ **ДЛЯ РАЗРАБОТЧИКА:**

1. **НЕ ПАНИКОВАТЬ** - данные не повреждены, только доступны
2. **ДЕЙСТВОВАТЬ БЫСТРО** - чем раньше закроем, тем лучше
3. **НЕ УДАЛЯТЬ ДАННЫЕ** - всё исправляется настройками доступа
4. **ТЕСТИРОВАТЬ ОСТОРОЖНО** - после каждого изменения проверять, что админка работает

### ⚠️ **ДЛЯ ВЛАДЕЛЬЦА БИЗНЕСА:**

1. **Утечка подтверждена** - персональные данные клиентов доступны публично
2. **Нужно действовать СРОЧНО** - применить ЭТАП 1 сегодня
3. **Данные НЕ УДАЛЕНЫ** - они просто доступны без авторизации
4. **Исправление НЕ ЗАТРОНЕТ** работу сайта и существующие заказы
5. **После исправления** - рекомендуется уведомить клиентов (опционально, по закону)

### 📞 **ЮРИДИЧЕСКИЕ ПОСЛЕДСТВИЯ:**

⚠️ **Внимание:** Утечка персональных данных может привести к:
- Штрафам по 152-ФЗ (от 10,000 до 500,000 руб.)
- Претензиям клиентов
- Репутационным рискам

**Рекомендация:** После исправления проконсультироваться с юристом о необходимости уведомления Роскомнадзора.

---

## J) ИТОГОВАЯ СВОДКА

| Параметр | Значение |
|----------|----------|
| **Утечка обнаружена** | ✅ ДА |
| **Уровень риска** | 🚨 КРИТИЧЕСКИЙ |
| **Затронуто endpoints** | 4 (orders, retail/orders, users, users/:id/orders) |
| **Утекающие данные** | Телефоны, email, адреса, ИНН, счета, БИК |
| **Причина** | Отсутствие проверки авторизации |
| **Требуется изменить** | Код backend (4 endpoint), НЕ трогая данные |
| **Время на исправление** | ЭТАП 1: 1-2 часа, ЭТАП 2: 1-2 дня |
| **Безопасность исправлений** | ✅ Данные не затрагиваются |

---

**КОНЕЦ ОТЧЁТА**

---

**Подготовлено:** AI Assistant  
**Дата:** 12 февраля 2026  
**Версия отчёта:** 1.0  
**Статус:** УТВЕРЖДЕНО К ИСПОЛНЕНИЮ
