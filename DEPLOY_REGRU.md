# Deploy to Reg.ru VPS via GitHub Actions

## 1) Required GitHub Secrets

- `VPS_HOST` - server IP or domain
- `VPS_USER` - SSH user
- `VPS_SSH_KEY` - private SSH key for deploy user
- `VPS_PORT` - optional, default `22`
- `VPS_APP_PATH` - project path on server (example: `/var/www/site`)
- `API_PUBLIC_HOST` *(optional)* — subdomain that points **by DNS A-record** to this VPS (example: `api.coffeenechai.ru`). If set, each VPS deploy runs `server/deploy/install-api-proxy.sh`: nginx reverse proxy to `127.0.0.1:8787`, optional Let's Encrypt.
- `CERTBOT_EMAIL` *(optional)* — email for Let's Encrypt; required **on first** HTTPS issuance for `API_PUBLIC_HOST` (after DNS already resolves to the VPS).
- `ALLOWED_ORIGINS` *(optional)* — e.g. `https://coffeenechai.ru,https://www.coffeenechai.ru`. If set, each deploy writes this line into `${VPS_APP_PATH}/.env` (via `server/deploy/patch_dotenv.py`) so you do not need to edit `.env` over SSH for CORS.

**Optional — same `patch_dotenv` on each VPS deploy** (Repository secrets; if empty, строка в `.env` не трогается):

- `CDEK_ACCOUNT`, `CDEK_SECRET` — СДЭК API
- `TOCHKA_JWT_TOKEN` — JWT для API Точки (оптовые счета `bills`, эквайринг и т.д.)
- `TOCHKA_CUSTOMER_CODE`, `TOCHKA_MERCHANT_ID`, `TOCHKA_TERMINAL_ID`, `TOCHKA_CLIENT_ID` — как в `.env.example` (для розничной оплаты через эквайринг обычно нужен и **`TOCHKA_TERMINAL_ID`**)
- `TOCHKA_INVOICE_ACCOUNT_ID` — р/с для выставления счетов (если не задан, в коде остаётся fallback как в старом Supabase)
- `TELEGRAM_HTTPS_PROXY` / `HTTPS_PROXY` — если хостинг блокирует прямой доступ к `api.telegram.org` (ETIMEDOUT)
- `TELEGRAM_RELAY_URL`, `TELEGRAM_RELAY_SECRET` — отправка через **Supabase Edge Function** `telegram-relay`: URL вида `https://<project-ref>.supabase.co/functions/v1/telegram-relay` и тот же секрет, что в Secrets функции в Supabase; на VPS при заданном `TELEGRAM_RELAY_URL` прямой вызов Telegram не используется

### Supabase (Edge Function `telegram-relay`)

Инфраструктура Telegram — на стороне Supabase (исходящий HTTPS к `api.telegram.org` с их сети, не с вашего VPS). В репозитории: [`supabase/functions/telegram-relay/index.ts`](supabase/functions/telegram-relay/index.ts), [`supabase/config.toml`](supabase/config.toml) (`verify_jwt = false` для вызова с VPS по своему `Bearer`).

**Локально или в CI:** [Supabase CLI](https://supabase.com/docs/guides/cli) — `supabase login`, `supabase link --project-ref <ref>`, затем:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN="..." TELEGRAM_CHAT_ID="..." TELEGRAM_RELAY_SECRET="..."
supabase functions deploy telegram-relay
supabase functions deploy keepalive
```

**Автодеплой из GitHub:** workflow [`.github/workflows/deploy-supabase-telegram-relay.yml`](.github/workflows/deploy-supabase-telegram-relay.yml). Нужны Secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`; опционально те же `TELEGRAM_*` для шага синхронизации секретов в Supabase. Variable `SUPABASE_RELAY_DEPLOY_ENABLED` = `1` — чтобы job запускался при push (иначе только **Run workflow** вручную). Деплой поднимает и **`keepalive`** — лёгкую функцию для анти-паузы (см. ниже).

**Анти-пауза бесплатного Supabase (~7 дней без запросов):** workflow [`.github/workflows/supabase-keepalive-ping.yml`](.github/workflows/supabase-keepalive-ping.yml) раз в ~5 дней делает `GET` на `https://<ref>.supabase.co/functions/v1/keepalive`. Включение: Variables → **`SUPABASE_KEEPALIVE_ENABLED`** = `1` (нужен тот же Secret **`SUPABASE_PROJECT_REF`**). Ручной прогон: Actions → **Supabase keepalive ping** → Run workflow.

**На VPS:** `TELEGRAM_RELAY_URL=https://<ref>.supabase.co/functions/v1/telegram-relay`, `TELEGRAM_RELAY_SECRET` = значение `TELEGRAM_RELAY_SECRET` из Supabase Secrets, затем `pm2 restart site-api --update-env`.

**DNS (you do once in ISP / Reg.ru):** create `A` record `api` → your VPS IP (same as `VPS_HOST` if it is the IP).

**Sudo:** the deploy SSH user must be able to run `nginx`, `systemctl reload nginx` / `service nginx reload`, `certbot`, and `apt-get install` via `sudo` **without an interactive password** (configure `sudoers` for that user), or run `bash server/deploy/install-api-proxy.sh` once manually as root and then only use Actions for app restarts.

For FTP deploy workflow (`deploy-reg-ftp.yml`) add:

- `VITE_API_BASE_URL` — at build time, e.g. `https://api.coffeenechai.ru/api` (must match the public API URL the browser will call).
- `FTP_HOST`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_PORT` (usually `21`)
- `FTP_PROTOCOL` (`ftp` or `ftps`)
- `FTP_TARGET_DIR` (example: `/www/`)

## 2) Server environment (`.env` on VPS)

Create `.env` in `${VPS_APP_PATH}` with values from `.env.example`.

Minimum production keys for payments/shipping:

- `DATABASE_URL` (recommended; if missing, server falls back to local JSON storage)
- `CDEK_ACCOUNT`
- `CDEK_SECRET`
- `TOCHKA_JWT_TOKEN`
- `TOCHKA_CUSTOMER_CODE`
- `TOCHKA_MERCHANT_ID`
- `TOCHKA_TERMINAL_ID`
- `TOCHKA_CLIENT_ID`
- `FRONTEND_BASE_URL` (example: `https://your-domain.ru`)
- `ALLOWED_ORIGINS` — when the API is on `https://api.your-domain.ru`, set e.g. `https://your-domain.ru,https://www.your-domain.ru` so the browser on the main site can call the API (CORS).

## 3) PostgreSQL (recommended)

Use managed PostgreSQL or local PostgreSQL on VPS.

Example local DB bootstrap:

```bash
sudo -u postgres psql -c "CREATE DATABASE site_db;"
sudo -u postgres psql -c "CREATE USER site_user WITH PASSWORD 'strong_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE site_db TO site_user;"
sudo -u postgres psql site_db -c "GRANT CREATE ON SCHEMA public TO site_user;"
sudo -u postgres psql site_db -c "GRANT ALL PRIVILEGES ON SCHEMA public TO site_user;"
sudo -u postgres psql site_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO site_user;"
```

PostgreSQL **15+** и часть hosted-решений дают ошибку **`permission denied for schema public`** роли приложения без `CREATE` на `public`; команды выше это снимают. Если таблицы уже созданы администратором, а приложению нужны только DML-права, достаточно `GRANT … ON ALL TABLES IN SCHEMA public` (или полный текст из сообщения при старте/импорте).

`DATABASE_URL` example:

```bash
postgres://site_user:strong_password@127.0.0.1:5432/site_db
```

### Если импорт / API падает с `permission denied for schema public` и «таблицы отсутствуют»

Таблицы **`orders`**, **`retail_orders`**, **`app_settings`** должны существовать. Создайте их **один раз** под суперпользователем (на VPS, если Postgres локальный):

```bash
cd /var/www/site
sudo -u postgres psql -d site_db -f server/sql/pg-bootstrap.sql
```

Имя базы (`site_db`) возьмите из **`DATABASE_URL`** (последний сегмент пути URL).

Затем выдайте права роли приложения (имя роли — пользователь из `DATABASE_URL`, до `:`):

```sql
GRANT CREATE ON SCHEMA public TO site_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO site_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO site_user;
```

Если Postgres **не на этом VPS** (managed Reg.ru и т.д.), выполните **`pg-bootstrap.sql`** в SQL-консоли панели провайдера под администратором, затем в той же панели выдайте `GRANT` на роль из `DATABASE_URL`.

## 4) PM2 setup once on VPS

```bash
npm i -g pm2
cd /var/www/site
npm ci
pm2 start ecosystem.config.cjs --env production
pm2 save
```

## 5) Deploy flow

Push to `main` branch. Workflow:

1. builds frontend
2. copies repo to VPS
3. installs production dependencies
4. restarts `site-api` via PM2

---

## FTP-only mode

If you use only FTP deploy, GitHub Action uploads `dist/` to hosting.

Important:

- FTP hosting deploys frontend only.
- CDEK/Tochka/order APIs still require backend runtime (VPS or external API).
- If backend is not available, set `VITE_API_BASE_URL` to your currently working API before build.

