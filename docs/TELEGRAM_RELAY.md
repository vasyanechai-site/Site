# Telegram из РФ: relay без Supabase

С VPS Reg.ru до `api.telegram.org` часто **ETIMEDOUT** (блокировка). Прямой Bot API с сервера не работает.

**Решение:** маленький **relay** за рубежом: VPS шлёт POST с текстом заказа → relay вызывает Telegram → сообщение в канал.

Раньше использовался Supabase Edge (`telegram-relay`). Аналог **бесплатно** — **Cloudflare Workers** (лимит ~100 000 запросов/день, для уведомлений о заказах с запасом).

## Рекомендуемый вариант: Cloudflare Workers

Код: [`workers/telegram-relay/`](../workers/telegram-relay/)

### 1. Аккаунт Cloudflare

1. [dash.cloudflare.com](https://dash.cloudflare.com) → регистрация (бесплатно).
2. Workers & Pages → Create → Worker (или деплой из репозитория ниже).

### 2. Деплой worker (один раз)

```bash
cd workers/telegram-relay
npm install
npx wrangler login
npx wrangler deploy
```

Сгенерируйте длинный секрет (один раз):

```bash
openssl rand -hex 32
```

Задайте секреты worker (значения из BotFather и id канала):

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put TELEGRAM_RELAY_SECRET
```

После деплоя URL вида:

`https://telegram-relay.<ваш-subdomain>.workers.dev`

Проверка:

```bash
curl -sS -X POST "https://telegram-relay.<ваш>.workers.dev" \
  -H "Authorization: Bearer ВАШ_RELAY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"text":"🔧 Тест relay"}'
```

Ответ `{"ok":true,...}` и сообщение в Telegram — всё настроено.

### 3. VPS (GitHub Secrets или `.env`)

В **GitHub → Settings → Secrets → Actions** (workflow `Deploy to Reg VPS`) или в `.env` на сервере:

| Переменная | Значение |
|------------|----------|
| `TELEGRAM_RELAY_URL` | `https://telegram-relay.<ваш>.workers.dev` |
| `TELEGRAM_RELAY_SECRET` | тот же, что в worker |

`TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` на VPS **не обязательны**, если всё идёт через relay (они живут только в Cloudflare).

Деплой бэкенда или на сервере:

```bash
pm2 restart site-api --update-env
```

Тест с продакшена:

```bash
curl -sS -X POST "https://api.coffeenechai.ru/api/debug/telegram/ping" \
  -H "Content-Type: application/json" \
  -d '{"message":"🔧 Тест с VPS"}'
```

### 4. CI (опционально)

Workflow **Deploy telegram-relay (Cloudflare)** — ручной запуск из GitHub Actions после секретов:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_RELAY_SECRET`

---

## Другие варианты

| Вариант | Плюсы | Минусы |
|---------|--------|--------|
| **Cloudflare Workers** | Бесплатный tier, без сервера, уже есть код в репо | Нужен аккаунт CF; «навсегда» = пока действует free tier |
| **HTTPS-прокси** (`TELEGRAM_HTTPS_PROXY` в `.env`) | Менять код не нужно | Платный EU-прокси (~$3–10/мес) |
| **Свой VPS в EU** (Oracle Free Tier и т.п.) | Полный контроль | Админка, обновления, может пропасть free tier |
| **Supabase Edge** | Уже был в проекте | Платный план / старый project-ref |
| **Прямой Bot API с VPS** | Просто | В РФ на Reg.ru обычно **не работает** |

---

## Как устроено в коде

- VPS: [`server/src/telegram.js`](../server/src/telegram.js) — при `TELEGRAM_RELAY_URL` шлёт POST `{ text, reply_markup? }` с `Authorization: Bearer <secret>`.
- Диагностика: `GET /api/debug/telegram/status`, `POST /api/debug/telegram/ping`.
- Старый Supabase relay: [`supabase/functions/telegram-relay/`](../supabase/functions/telegram-relay/) — тот же контракт, можно не использовать.

## TELEGRAM_CHAT_ID

- Канал для заявок: id вида `-100…` (бот — **админ** канала с правом публиковать).
- Личный чат: положительный числовой id (для тестов).

Узнать id: написать боту [@userinfobot](https://t.me/userinfobot) или добавить бота в канал и вызвать `getUpdates` у Bot API через relay-тест.
