# GitHub Actions — актуальные workflow

В репозитории **нет** отдельного `keep-alive.yml` для Supabase: основной бэкенд — **Node на VPS**, фронт — **сборка в `dist/`** и FTP.

## 1. Deploy to Reg VPS (`deploy-reg-vps.yml`)

**Когда:** push в `main` при изменениях в `server/**`, `package.json`, `package-lock.json`, `ecosystem.config.cjs` или самом workflow; либо **Run workflow** вручную.

**Что делает:** SSH на сервер → `git reset --hard origin/main` в `VPS_APP_PATH` → при наличии секретов — патч строк в `.env` через `server/deploy/patch_dotenv.py` → `npm ci` → перезапуск **PM2** (`site-api`) → проверка **`/api/health`**. При заданных `API_PUBLIC_HOST` и `CERTBOT_EMAIL` может подключаться скрипт nginx / Let’s Encrypt (см. `DEPLOY_REGRU.md`).

**Секреты:** см. таблицу в **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`** и **`DEPLOY_REGRU.md`** (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_PATH`, `ALLOWED_ORIGINS`, интеграции, опционально `JWT_SECRET`, `DATABASE_URL`, …).

## 2. Deploy Frontend to Reg.ru FTP (`deploy-reg-ftp.yml`)

**Когда:** push в `main` при изменениях во **`src/**`**, **`public/**`**, **`index.html`**, **`vite.config.ts`**, lockfile или workflow.

**Что делает:** `npm ci` → **`npm run build`** с переменными из Secrets (`VITE_API_BASE_URL`, опционально `VITE_YANDEX_MAPS_API_KEY`) → выгрузка **`./dist/`** на FTP в `FTP_TARGET_DIR`.

Убедитесь, что **`VITE_API_BASE_URL`** указывает на тот же публичный API, что открывается с сайта (часто `https://api.домен/api`).

## 3. Weekly database email backup (`weekly-database-email-backup.yml`)

**Когда:** по cron **понедельник 06:35 UTC** и вручную (**Run workflow**). Job выполняется, если **`WEEKLY_EMAIL_BACKUP_ENABLED`** = `1` в **GitHub → Settings → Variables** *или* запуск вручную.

**Что делает:** SSH на VPS → обновление кода → `npm ci --omit=dev` → `node server/scripts/weekly-email-backup.mjs`. Нужны секреты VPS и SMTP в `.env` на сервере — см. **`DEPLOY_REGRU.md`** и комментарии в начале файла workflow.

## Проверка

1. **Actions** → последний зелёный запуск нужного workflow.
2. Сайт: исходный код главной страницы должен ссылаться на **`/assets/*.js`**, не на **`/src/main.tsx`**.
3. **`https://<ваш-api-хост>/api/health`** — ответ «ок».

---

_Старые инструкции про workflow `keep-alive.yml` и ping Supabase в этом файле заменены описанием выше._
