# Интеграция банка «Точка»: опт (B2B) и розница

Документ описывает **актуальную логику на Node.js API** (`server/src/`). Старые копии в Supabase Edge (`src/app/supabase/functions/server/`) могут отличаться; при восстановлении ориентируйтесь на файлы ниже.

---

## 1. Две разные интеграции

| Режим | Продукт Точки | Назначение | Основной HTTP-вызов к Точке |
|--------|----------------|------------|-----------------------------|
| **Опт (wholesale)** | Выставление **счёта** (invoice / bills) | После `POST /api/orders` покупатель получает ссылку на счёт в ЛК Точки | `POST https://enter.tochka.com/uapi/invoice/v1.0/bills` |
| **Розница (retail)** | **Интернет-эквайринг** + чек «Точка Чеки» | Платёжная ссылка (карта / СБП) и фискальный чек по заказу | `POST https://enter.tochka.com/uapi/acquiring/v1.0/payments_with_receipt` |

Общий секрет для авторизации к API Точки в обоих сценариях на бэкенде: **`TOCHKA_JWT_TOKEN`** (Bearer). Дополнительно для эквайринга нужны идентификаторы торговой точки: **`TOCHKA_CUSTOMER_CODE`**, **`TOCHKA_MERCHANT_ID`**, **`TOCHKA_TERMINAL_ID`**.

Официальные материалы Точки (актуализируйте по ссылкам из ЛК разработчика):

- Платёжные ссылки: [developers.tochka.com — платёжные ссылки](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/platyozhnye-ssylki)
- Вебхуки: [developers.tochka.com — вебхуки](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vebhuki)
- Публичный ключ для проверки JWT вебхука: `https://enter.tochka.com/doc/openapi/static/keys/public`

---

## 2. Переменные окружения (`.env` / секреты CI)

Сводка (подробности в корне репозитория: `.env.example`, `DEPLOY_REGRU.md`).

| Переменная | Обязательность | Назначение |
|------------|----------------|------------|
| `TOCHKA_JWT_TOKEN` | Да, для любых вызовов API Точки с сервера | JWT `Bearer` для `bills` и `payments_with_receipt` |
| `TOCHKA_CUSTOMER_CODE` | Да | Код клиента в API Точки |
| `TOCHKA_INVOICE_ACCOUNT_ID` | Нет (есть fallback в коде) | Расчётный счёт для **счёта** опта (`accountId` в теле bills) |
| `TOCHKA_MERCHANT_ID` | Да для розницы / эквайринга | `merchantId` в `payments_with_receipt` |
| `TOCHKA_TERMINAL_ID` | Да для розницы | Без него Точка часто **не возвращает** `paymentLink` |
| `TOCHKA_CLIENT_ID` | Опционально | Проверяется в `GET /api/tochka/acquiring/test-token`; не все сценарии его требуют |
| `TOCHKA_RECEIPT_TAX_SYSTEM_CODE` | Нет, по умолчанию `usn_income_outcome` | Система налогообложения в чеке |
| `TOCHKA_RECEIPT_SUPPLIER_INN` | Нет (fallback в коде) | ИНН продавца в чеке |
| `TOCHKA_RECEIPT_SUPPLIER_NAME` | Нет | Наименование продавца |
| `TOCHKA_RECEIPT_SUPPLIER_PHONE` | Нет | Телефон продавца для чека (нормализуется) |
| `TOCHKA_RECEIPT_FALLBACK_PHONE` | По ситуации | Телефон покупателя для ручного `POST /api/tochka/create-invoice`, если в заказе нет валидного РФ-телефона |
| `FRONTEND_BASE_URL` | Желательно | `redirectUrl` / `failRedirectUrl` для возврата после оплаты |

Проверка «всё ли заведено» без реального платежа: **`GET /api/tochka/acquiring/test-token`** — JSON с флагами `hasToken`, `hasCustomer`, `hasMerchant`, `hasTerminal`, `acquiringReady`.

Диагностика терминала: в админке страница **`/debug`** → вкладка «Точка»; на сервере см. **`server/src/debugRoutes.js`** (например, запрос списка retailers для подбора `terminalId`).

---

## 3. Опт (wholesale): счёт в Точке

### 3.1. Точка входа в приложении

- **HTTP:** `POST /api/orders`  
- **Файл:** `server/src/index.js` (обработчик заказа опта).  
- После сохранения заказа в БД вызывается **`createWholesaleTochkaBill(saved)`** из `server/src/tochkaWholesaleInvoice.js`.

### 3.2. Условия создания счёта

Счёт **не** создаётся, если:

- нет `TOCHKA_JWT_TOKEN`;
- нет `company`, ИНН (`inn`), позиций `items`;
- после разбора позиций массив для Точки пустой.

### 3.3. Запрос к Точке (bills)

- **URL:** `https://enter.tochka.com/uapi/invoice/v1.0/bills`  
- **Метод:** `POST`  
- **Заголовки:** `Authorization: Bearer <TOCHKA_JWT_TOKEN>`, `Content-Type: application/json`, `Accept: application/json`  
- **Тело:** JSON с вложенной структурой `Data` — счёт, вторая сторона (`SecondSide`: ИП/ООО по длине ИНН), позиции из корзины, сумма, номер документа = `order.orderId`, срок оплаты (+3 дня от «сегодня» в коде).

Позиции для Точки собираются в **`formatTochkaPositions(items)`** (учёт кг / упаковок 200 г / drip / coldbrew).

### 3.4. Результат

При успехе из ответа извлекаются `invoiceId` и формируется **`invoiceUrl`** вида `https://enter.tochka.com/invoice/<id>`. Поля дописываются в заказ через **`updateOrderById`**: `invoiceId`, `invoiceCreatedAt`, `invoiceUrl`.

При ошибке HTTP или исключении счёт **пропускается** (заказ уже сохранён), в лог пишется ошибка.

---

## 4. Розница (retail): эквайринг и чек

### 4.1. Точка входа

- **HTTP:** `POST /api/retail/orders`  
- **Файл:** `server/src/index.js` → при теле чекаута (есть `customerName`, массив `items` с `product`) вызывается **`createRetailOrderFromCheckout(body)`** из `server/src/retailOrderCreate.js`.

### 4.2. Последовательность

1. Собирается объект заказа (`orderId`, позиции, доставка, лояльность и т.д.).  
2. **`await addRetailOrder(order)`** — запись в `retail_orders` / `db.json`.  
3. Если настроены ключи Точки, вызывается **`createTochkaAcquiringPayment(order)`** (внутри `retailOrderCreate.js`):  
   - строится тело **`buildPaymentsWithReceiptData`** / **`fetchPaymentsWithReceipt`** из `server/src/tochkaAcquiringReceipt.js`;  
   - при успехе — **`updateRetailOrderById`** с полями вроде `paymentLink`, `invoiceId`, `tochkaStatusRaw` и т.д.

### 4.3. Запрос `payments_with_receipt`

- **URL:** `https://enter.tochka.com/uapi/acquiring/v1.0/payments_with_receipt`  
- **Метод:** `POST`  
- **Заголовки:** `Authorization: Bearer <TOCHKA_JWT_TOKEN>`, `Content-Type: application/json`  
- **Тело:** `{ "Data": <объект из buildPaymentsWithReceiptData> }`

Важные поля `Data` (см. код `buildPaymentsWithReceiptData`):

- `customerCode`, `merchantId`, `terminalId`, `amount` (строка с копейками), `purpose`  
- `paymentMode`: `["card", "sbp"]`  
- `taxSystemCode`, `Client` (имя, email, **телефон РФ** — иначе чек не соберётся), `Items` (товары + при необходимости строка «Доставка СДЭК»), `Supplier`  
- `redirectUrl` / `failRedirectUrl` — от `FRONTEND_BASE_URL` + query `orderId`  
- `paymentLinkId` — в коде выставляется равным `orderId` для связки с вебхуком

Телефон покупателя нормализуется **`tochkaClientPhone`**: только цифры, приведение к виду `7XXXXXXXXXX` (11 цифр).

Сумма позиций чека подгоняется к `order.total` функцией **`alignReceiptItemsTotal`** (расхождения из-за округления).

### 4.4. Ответ Точки

- **`extractPaymentLink(data)`** — ссылка на оплату (`Data.paymentLink` или запасные варианты).  
- **`extractOperationId(data)`** — идентификатор операции для сохранения в заказе.

Фронт после успешного чекаута ожидает в JSON поля вроде **`tochkaPaymentUrl`** / **`tochka_payment_url`** (см. `RetailStorefront.tsx`).

---

## 5. Ручное создание платёжной ссылки по существующему заказу

- **HTTP:** `POST /api/tochka/create-invoice`  
- **Тело JSON:** `orderId`, опционально `amount`, `purpose`.  
- Логика в **`server/src/index.js`**: подтягивается заказ из **`getRetailOrderById`** или **`getOrderById`**, собирается тело чека, вызывается **`fetchPaymentsWithReceipt`**, затем обновление заказа.

Если в заказе нет позиций, подставляется одна условная позиция; для телефона клиента нужен валидный номер или **`TOCHKA_RECEIPT_FALLBACK_PHONE`**.

---

## 6. Вебхук оплаты

- **HTTP:** `POST /api/tochka/webhook`  
- **Тип тела:** чаще всего **`text/plain`**: одна строка — **JWT RS256** от Точки (не JSON сразу).  
- **Парсинг:** `server/src/tochkaWebhookVerify.js` — загрузка JWK с `TOCHKA_WEBHOOK_JWK_URL`, **`jwtVerify`** через библиотеку `jose`.

Поведение обработчика (`server/src/index.js`):

- Всегда отвечать **200** важно (у Точки ретраи при ошибке).  
- Тип вебхука: **`acquiringInternetPayment`** (регистронезависимо в коде сравнивается как `acquiringinternetpayment`).  
- Статусы мапятся в `paymentStatus` / `payment_status`: например `APPROVED` → `paid`.  
- Идентификатор заказа ищется в `paymentLinkId` (мы кладём туда `orderId`), fallback — другие поля payload.  
- Обновление: **`updateRetailOrderById`** или **`updateOrderById`**.  
- При первом переходе в **`paid`** отправляется Telegram **`payment_received`** (форматтер в `server/src/telegram.js`).

**Настройка в ЛК Точки:** URL вебхука должен указывать на ваш прод-API, например  
`https://<ваш-api-домен>/api/tochka/webhook`  
(с учётом префикса `/api` за nginx).

---

## 7. Связанные файлы (карта кода)

| Файл | Роль |
|------|------|
| `server/src/tochkaWholesaleInvoice.js` | Счёт опта (`bills`), формат позиций |
| `server/src/tochkaAcquiringReceipt.js` | Чек + `payments_with_receipt`, телефон, Items, redirect |
| `server/src/tochkaWebhookVerify.js` | Проверка JWT вебхука |
| `server/src/retailOrderCreate.js` | Розничный заказ, СДЭК, вызов Точки |
| `server/src/index.js` | Маршруты `/api/orders`, `/api/retail/orders`, `/api/tochka/*` |
| `server/src/debugRoutes.js` | Отладка Get Retailers, тестовый заказ 10 ₽ (только `/debug`) |
| `src/app/components/RetailStorefront.tsx` | Клиент: POST розничного заказа, редирект на оплату |
| `src/app/components/debug/TochkaRetailDebugPanel.tsx` | UI отладки розницы |
| `src/app/components/TochkaDiagnostics.tsx` | Страница диагностики переменных (частично про старый Supabase — перепроверяйте) |

---

## 8. Восстановление логики после сбоя

1. Заполнить **все** переменные из раздела 2; для розницы обязательно проверить **`TOCHKA_TERMINAL_ID`** (через Get Retailers в `/debug` или ЛК Точки).  
2. Перезапустить процесс API с обновлённым `.env`.  
3. Проверить **`GET /api/tochka/acquiring/test-token`**.  
4. Оформить тестовый розничный заказ (или `/debug` → сценарий Точки).  
5. Убедиться, что вебхук в ЛК Точки указывает на **`POST /api/tochka/webhook`** и после оплаты в БД у заказа меняется статус оплаты.

---

## 9. Замечания по безопасности

- **`TOCHKA_JWT_TOKEN`** и все секреты — только на сервере, не в Vite `VITE_*`.  
- Вебхук: доверять только после **успешной верификации JWT** (как в текущем коде).  
- Не логировать полные токены и тела с ПДн в проде без необходимости.
