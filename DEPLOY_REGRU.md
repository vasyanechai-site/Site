# Deploy to Reg.ru VPS via GitHub Actions

## 1) Required GitHub Secrets

- `VPS_HOST` - server IP or domain
- `VPS_USER` - SSH user
- `VPS_SSH_KEY` - private SSH key for deploy user
- `VPS_PORT` - optional, default `22`
- `VPS_APP_PATH` - project path on server (example: `/var/www/site`)
- `VITE_API_BASE_URL` - frontend API base (example: `https://your-domain.ru/api`)

For FTP deploy workflow (`deploy-reg-ftp.yml`) add:

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

## 3) PostgreSQL (recommended)

Use managed PostgreSQL or local PostgreSQL on VPS.

Example local DB bootstrap:

```bash
sudo -u postgres psql -c "CREATE DATABASE site_db;"
sudo -u postgres psql -c "CREATE USER site_user WITH PASSWORD 'strong_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE site_db TO site_user;"
```

`DATABASE_URL` example:

```bash
postgres://site_user:strong_password@127.0.0.1:5432/site_db
```

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
