# Деплой Telegram-бота записи на фотосессию (24/7 на VPS)

Бот работает через **PM2** (`photo-booking-bot`), API админки — в **site-api**.

## GitHub Secrets (репозиторий → Settings → Secrets)

| Secret | Значение |
|--------|----------|
| `PHOTO_BOOKING_BOT_TOKEN` | Токен @AnnaNechaiBot от BotFather |
| `PHOTO_BOOKING_ADMIN_ID` | Telegram ID администратора |
| `PHOTO_BOOKING_PHONE` | Номер для СБП |
| `PHOTO_BOOKING_RECIPIENT_NAME` | Имя получателя |
| `ANNA_ADMIN_PASSWORD` | Пароль для `/anna` |

**Стоимость и % предоплаты** — не в секретах. Настраиваются в админке **/anna** (блок «Цены и предоплата»).

Уже должны быть: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_PATH`.

Если `api.telegram.org` недоступен с VPS — **бесплатно** через Cloudflare Worker (как заявки с сайта Нечай):

| Secret | Значение |
|--------|----------|
| `TELEGRAM_BOT_PROXY_URL` | `https://telegram-bot-proxy.<account>.workers.dev` |
| `TELEGRAM_BOT_PROXY_SECRET` | опционально, если уже есть `TELEGRAM_RELAY_SECRET` — можно не дублировать |

Деплой worker: Actions → **Deploy telegram-bot-proxy (Cloudflare)** (нужны `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).

Подробнее: [TELEGRAM_RELAY.md](./TELEGRAM_RELAY.md#бот-записи-на-фотосессию).

Запасной вариант (платный): `TELEGRAM_HTTPS_PROXY` или `HTTPS_PROXY`.

## Автодеплой

При push в `main` запускаются:

- **Deploy photo booking bot** — бот PM2
- **Deploy to Reg VPS** — API с `/api/anna/*`
- **Deploy Frontend to Reg.ru FTP** — страница `/anna`

Ручной запуск: Actions → нужный workflow → Run workflow.

## Проверка на VPS

```bash
pm2 status
pm2 logs photo-booking-bot --lines 50
curl -s http://127.0.0.1:8787/api/health
```

Админка: `https://coffeenechai.ru/anna`
