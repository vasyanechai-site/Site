# Интеграция СДЭК (CDEK API 2.0) в проекте

Документ описывает **актуальную серверную реализацию** в `server/src/` и HTTP-маршруты Express. Легаси-обработчики в `src/app/supabase/functions/server/cdek_*.tsx` могут дублировать идеи, но источник истины для деплоя на Node — файлы ниже.

---

## 1. Назначение в этом репозитории

СДЭК используется для **розничной доставки**: подбор города, ПВЗ, расчёт тарифа на фронте и **создание заказа в СДЭК** при оформлении доставки до ПВЗ.

Оптовые (B2B) заказы через этот же Node-модуль СДЭК в описанном виде **не** создаются — там другой сценарий (счёт Точки и т.д.).

---

## 2. Переменные окружения

См. также `.env.example` в корне репозитория.


| Переменная          | Обязательность | Описание                                                                                     |
| ------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `CDEK_ACCOUNT`      | Да             | **Идентификатор** из раздела интеграции API в ЛК СДЭК (не логин входа в ЛК).                 |
| `CDEK_SECRET`       | Да             | **Секретный ключ** (Secure password) пары для API 2.0.                                       |
| `CDEK_API_URL`      | Нет            | Явный базовый URL API. Если задан без `/v2`, к нему дописывается `/v2`.                      |
| `CDEK_USE_TEST_API` | Нет            | Если `1` / `true` / `yes` — используется `**https://api.edu.cdek.ru/v2`** (тестовый контур). |


Важно:

- **Боевые** ключи с `lk.cdek.ru` работают только с `**https://api.cdek.ru/v2`**.  
- **Тестовые** ключи — только с `**https://api.edu.cdek.ru/v2`**. Иначе OAuth вернёт ошибки вроде «No such account secure».

Функция выбора базы: `**getCdekApiBase()**` в `server/src/cdek.js`.

---

## 3. OAuth 2.0 (получение access_token)

- **Реализация:** `getCdekToken()` в `server/src/cdek.js`.  
- **Запрос:** `POST {base}/oauth/token`  
- **Content-Type:** `application/x-www-form-urlencoded`  
- **Тело:** `grant_type=client_credentials&client_id=<CDEK_ACCOUNT>&client_secret=<CDEK_SECRET>`

Ответ JSON: `access_token`, `expires_in`. Токен **кэшируется в памяти** процесса Node до `expires_in - 60` секунд; при смене `CDEK_API_URL` кэш сбрасывается привязкой к базе.

---

## 4. Публичные методы модуля `server/src/cdek.js`

Все запросы к API после OAuth идут с заголовком `**Authorization: Bearer <token>`** и `**Content-Type: application/json**` (внутренняя функция `cdekRequest`).

### 4.1. `searchCities(query)`

- Минимум 2 символа в `query`, иначе `{ cities: [] }`.  
- Вызов: `GET /location/cities?city_like=...&country_codes=RU&size=500` (с fallback на `country_code=RU` при ошибке).  
- На сервере результат фильтруется по подстроке в названии города/региона, возвращается до **20** городов с полями `code`, `city`, `region`, `full_name`, координаты и т.д.

### 4.2. `getPickupPoints({ city_to, city_code })`

- Нужен `**city_code`** или `**city_to**` (название — тогда сначала резолвится код города одним запросом `location/cities`).  
- Затем: `GET /deliverypoints?city_code=<code>&type=PVZ`.  
- Возврат: `city_code`, массив `**pickup_points**` с `code`, `name`, `address`, `location`, `work_time`, `phones`.

### 4.3. `calculateDelivery({ city_to, city_code, pvz_code, order_price, packages })`

- Обязательны `**pvz_code**` и `**order_price**`.  
- **Бизнес-правило в коде:** если `order_price >= 3500`, доставка **0 ₽** (возврат без запроса тарифа к СДЭК с фиктивными полями `tariff_code: 136` и т.д.).  
- Иначе подбирается код города получателя, собираются габариты из `**packages`** (вес/длина/ширина/высота по товарам с дефолтами), затем в цикле перебираются **тарифы** из массивов `FALLBACK_TARIFFS` или укороченного списка для доставки в тот же город отправителя.  
- Для каждого тарифа: `POST /calculator/tariff` с телом `type`, `currency`, `from_location`, `to_location`, `packages`, `tariff_code`.  
- Первый успешный ответ без ошибок, с `**total_sum`** в диапазоне **(0, 5000]** ₽, возвращается как стоимость доставки.

Константа `**SENDER_CITY_CODE = 137`** — город отправления в калькуляторе (в ЛК СДЭК должен соответствовать вашему договору).

---

## 5. Создание заказа в СДЭК при розничном чекауте

- **Файл:** `server/src/cdekOrderCreate.js`  
- **Экспорт:** `createCdekOrder(orderId, customerName, customerPhone, deliveryInfo, items)`

Условия вызова из `**server/src/retailOrderCreate.js`**: в теле чекаута передано `**deliveryInfo.pvzCode**` (доставка до ПВЗ).

### 5.1. Тело запроса к СДЭК

- **HTTP:** `POST {apiBase}/orders`  
- **Заголовки:** `Authorization`, `Content-Type: application/json`  
- **Поля верхнего уровня (упрощённо):**
  - `type: 1`  
  - `number: orderId` — номер заказа у вас  
  - `tariff_code` — из `deliveryInfo.tariffCode` или **136** по умолчанию  
  - `shipment_point: "SPB1204"` — **жёстко заданный** код офиса приёма отправителя в коде (`SENDER_OFFICE_CODE` в `cdekOrderCreate.js`). Его нужно менять под ваш договор/офис СДЭК.  
  - `delivery_point: deliveryInfo.pvzCode` — код ПВЗ получателя  
  - `sender` — компания, контакт, email, телефон (**зашиты константы** `COMPANY_NAME`, `CONTACT_PERSON`, `COMPANY_EMAIL`, `COMPANY_PHONE` — при смене юрлица обновите в файле).  
  - `recipient` — ФИО и телефон покупателя (телефон нормализуется в `+7…`).  
  - `packages` — один пакет с весом/габаритами и массивом `items` (название, `ware_key`, `payment.value: 0` — оплата на сайте, не при получении).

### 5.2. Успех / ошибка

- Успех: в ответе `entity.uuid`, `entity.cdek_number` — возвращаются как `cdek_uuid`, `cdek_number` и пишутся в заказ.  
- Ошибка: объект с `cdek_status`, `cdek_error`, при необходимости `diagnostic` (в т.ч. сырое тело ответа).

---

## 6. HTTP API сайта (прокси на модуль cdek.js)

Все в `**server/src/index.js`**:


| Метод и путь                 | Тело / query                                                                     | Делегат             |
| ---------------------------- | -------------------------------------------------------------------------------- | ------------------- |
| `GET /api/cdek/cities?q=...` | query `q`                                                                        | `searchCities`      |
| `POST /api/cdek/pvz`         | JSON: `city_to` или `city_code`                                                  | `getPickupPoints`   |
| `POST /api/cdek/calc`        | JSON: `pvz_code`, `order_price`, `packages`, опционально `city_to` / `city_code` | `calculateDelivery` |


Фронтенд обычно дергает их с базой `**VITE_API_BASE_URL**` (например `/api`).

---

## 7. Фронтенд

- `**src/app/components/CdekDelivery.tsx**` — UI выбора города / ПВЗ / расчёта (зависит от Яндекс.Карт при необходимости, см. `VITE_YANDEX_MAPS_API_KEY` в `.env.example`).  
- Отладка: `**src/app/components/debug/CdekDebugPanel.tsx**`, страница `**/debug**`.

---

## 8. Восстановление после сбоя

1. В ЛК СДЭК создать/проверить пару **Account / Secure password** для API 2.0.
2. Прописать `**CDEK_ACCOUNT`** и `**CDEK_SECRET**` без пробелов в конце строки.
3. Выбрать контур: боевой `api.cdek.ru` или тест `api.edu.cdek.ru` + тестовые ключи (`CDEK_USE_TEST_API=1` или явный `CDEK_API_URL`).
4. Убедиться, что `**SENDER_OFFICE_CODE**` и константы отправителя в `**cdekOrderCreate.js**` соответствуют вашему договору.
5. Перезапустить API, проверить `GET /api/cdek/cities?q=Санкт` и `POST /api/cdek/pvz` с телом из реального города.
6. Полный чекау с ПВЗ — через розничный магазин; при ошибке смотреть логи сервера и поле `cdek_error` в заказе.

---

## 9. Официальная документация СДЭК

Актуальные URL и поля тел запросов лучше сверять с **официальной документацией API 2.0** в ЛК интегратора СДЭК (раздел для разработчиков). Константы тарифов и лимит «3500 ₽ = бесплатная доставка» заданы **в коде проекта**, а не в ЛК СДЭК.