# Keep-alive Supabase — устарело для текущей схемы

Раньше документ описывал борьбу с паузой **бесплатного проекта Supabase** и workflow **`.github/workflows/keep-alive.yml`**.

**Сейчас:** основной бэкенд — **Node API на VPS** (`server/`), данные в **PostgreSQL** или в `server/data/db.json`. Отдельный GitHub Action «пинговать Supabase раз в 5 дней» **удалён**.

Что использовать вместо этого:

- **Регулярные заходы на сайт** — API сам по себе не «засыпает» как free-tier Supabase.
- **Бэкапы:** workflow **`weekly-database-email-backup.yml`** (переменная **`WEEKLY_EMAIL_BACKUP_ENABLED`**, см. **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`** и **`DEPLOY_REGRU.md`**).
- Если **Telegram** с VPS не достучаться до `api.telegram.org`, в `.env` на сервере можно задать **`TELEGRAM_RELAY_URL`** / **`TELEGRAM_RELAY_SECRET`** (в т.ч. через старый Edge relay) — это не про «пробуждение БД», а про сеть.

Во фронте могут остаться вызовы `keepAlive` из прошлой логики — ориентируйтесь на фактический URL API (`/api/health`), а не на Supabase Edge как единственный сервер.
