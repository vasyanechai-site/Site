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
- `PUBLIC_API_BASE_URL` *(optional)* — если API на `https://api.…`, а `FRONTEND_BASE_URL` — основной сайт: явно `https://api.…` для корректных URL загрузок `/api/uploads/` (иначе сервер берёт `Host` из запроса — обычно тоже верно за nginx).

**Optional — same `patch_dotenv` on each VPS deploy** (Repository secrets; if empty, строка в `.env` не трогается):

- `JWT_SECRET` — подпись розничных токенов (если задан в Secrets, патчится на VPS при деплое)
- `DATABASE_URL` — Postgres (если задан; иначе на VPS используется `server/data/db.json`)
- `CDEK_ACCOUNT`, `CDEK_SECRET` — СДЭК API
- `CDEK_API_URL` *(optional)* — если тестовые ключи СДЭК: `https://api.edu.cdek.ru/v2` (боевой по умолчанию `https://api.cdek.ru/v2`; путаница даёт OAuth «No such account secure»)
- `TOCHKA_JWT_TOKEN` — JWT для API Точки (оптовые счета `bills`, эквайринг и т.д.)
- `TOCHKA_CUSTOMER_CODE`, `TOCHKA_MERCHANT_ID`, `TOCHKA_TERMINAL_ID`, `TOCHKA_CLIENT_ID` — как в `.env.example` (для розничной оплаты через эквайринг обычно нужен и **`TOCHKA_TERMINAL_ID`**)
- `TOCHKA_INVOICE_ACCOUNT_ID` — р/с для выставления счетов (если не задан, в коде остаётся fallback как в старом Supabase)
- `TELEGRAM_HTTPS_PROXY` / `HTTPS_PROXY` — если хостинг блокирует прямой доступ к `api.telegram.org` (ETIMEDOUT)
- `TELEGRAM_RELAY_URL`, `TELEGRAM_RELAY_SECRET` — отправка через **Supabase Edge Function** `telegram-relay`: URL вида `https://<project-ref>.supabase.co/functions/v1/telegram-relay` и тот же секрет, что в Secrets функции в Supabase; на VPS при заданном `TELEGRAM_RELAY_URL` прямой вызов Telegram не используется
- **Бэкап БД на почту (опционально):** `BACKUP_EMAIL_TO`, `BACKUP_SMTP_HOST`, `BACKUP_SMTP_PORT`, `BACKUP_SMTP_USER`, `BACKUP_SMTP_PASS`, `BACKUP_SMTP_SECURE` — для [еженедельного workflow](.github/workflows/weekly-database-email-backup.yml); получатель по умолчанию в коде `dakolosovs@mail.ru`, если `BACKUP_EMAIL_TO` не задан

### Еженедельный бэкап БД на почту

Workflow [`.github/workflows/weekly-database-email-backup.yml`](.github/workflows/weekly-database-email-backup.yml): по понедельникам **06:35 UTC** по SSH обновляет код на VPS, `npm ci`, запускает `node server/scripts/weekly-email-backup.mjs` — в письме **gzip JSON**: таблицы `orders` (опт), `retail_orders` (розница), `app_settings` (товары, пользователи, лояльность `loyalty:*`, промокоды, избранное, локации, заявки и т.д.). Без `DATABASE_URL` прикладывается `server/data/db.json`.

Включение: GitHub → **Variables** → `WEEKLY_EMAIL_BACKUP_ENABLED` = `1`. Ручная проверка: Actions → **Weekly database email backup** → Run workflow. На VPS в `.env` нужны `DATABASE_URL` (если используете Postgres) и рабочий SMTP (для Mail.ru — пароль приложения, порт 465).

### Telegram relay (опционально)

GitHub Actions для автодеплоя **Supabase** `telegram-relay` / **keepalive** удалены — сайт и API на вашем VPS. Если исходящий HTTPS к `api.telegram.org` с VPS по-прежнему недоступен, можно вручную держать relay где угодно (в т.ч. старый Edge) и задать на VPS в `.env`: `TELEGRAM_RELAY_URL`, `TELEGRAM_RELAY_SECRET`, затем `pm2 restart site-api --update-env`.

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

## 5) Deploy flow (GitHub Actions)

Two workflows:

**`deploy-reg-vps.yml`** (paths: `server/**`, lockfile, workflow itself):

1. SSH to VPS → `git reset --hard origin/main` in `VPS_APP_PATH`
2. Optional: `patch_dotenv.py` lines from Secrets (CORS, JWT, DB, CDEK, Tochka, Telegram, backup SMTP, etc.)
3. `npm ci` (production deps for the whole repo on server — needed for API)
4. `pm2 restart` for `site-api`, health check `/api/health`
5. If `API_PUBLIC_HOST` is set: nginx + HTTPS helper script (see earlier sections)

**`deploy-reg-ftp.yml`** (paths: `src/**`, `public/**`, `index.html`, Vite, lockfile):

1. `npm ci` on the runner
2. `npm run build` with `VITE_API_BASE_URL` (and optional maps key) from Secrets
3. Upload **`./dist/`** to `FTP_TARGET_DIR` — **only built assets**, not the dev `index.html` from repo root as the “live” site root unless that is what you intend for local preview.

---

## FTP-only mode

The FTP workflow uploads **`dist/`** after a production Vite build.

Critical:

- **Never** replace the live site’s `index.html` with the **repository root** `index.html` used for `npm run dev` (it references `/src/main.tsx`). Production HTML must reference **`/assets/index-*.js`**. If you see a blank page, “View source” and confirm script URLs.
- FTP deploys **static frontend only**. CDEK / Tochka / orders require the **Node API** (VPS or another host) and correct **`VITE_API_BASE_URL`** at build time (e.g. `https://api.example.ru/api`).

