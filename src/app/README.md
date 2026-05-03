# Nechai Wholesale Coffee

B2B и розница: каталог, корзина, оплата (Точка), доставка (СДЭК), уведомления в Telegram, админка.

## Стек (актуально)

- **Frontend:** React 18, TypeScript, Vite, Tailwind, часть UI на Radix / MUI.
- **Backend:** Node.js, Express (`server/`), PostgreSQL (рекомендуется) или fallback `server/data/db.json`.
- **Интеграции:** API Точки, СДЭК, DaData, Telegram Bot API; опционально **Supabase Edge** только как **relay** для Telegram (`TELEGRAM_RELAY_*` в `.env`), не как основная БД сайта.

## Запуск и документация

В корне репозитория:

- **`НАЧАЛО-БЕЗ-КОДА.md`** — локальный запуск (`npm run go`), архив для хостинга.
- **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`** — прод, Secrets, Actions.
- **`DEPLOY_REGRU.md`** — VPS, nginx, FTP, Postgres.
- **`README.md`** — краткий обзор команд и структуры.

```bash
cd /path/to/Site
npm install
npm run go
```

Продакшен-статика: **`npm run build`** → выкладывать **`dist/`** (не корневой dev-`index.html`).

## Прочие `.md` в этой папке

Файлы вида `*_FIX*.md`, `CHANGELOG_*.md`, отчёты по SEO/Telegram — в основном **архив задач**. В начале многих добавлен блок «Сводка по проекту» со ссылкой на актуальные файлы в корне.

---

© Nechai Wholesale Coffee.
