# Деплой Telegram-бота записи на фотосессию (24/7 на VPS)

Бот работает через **PM2** (`photo-booking-bot`), API админки — в **site-api**.

## GitHub Secrets (репозиторий → Settings → Secrets)

| Secret | Значение |
|--------|----------|
| `PHOTO_BOOKING_BOT_TOKEN` | Токен @AnnaNechaiBot от BotFather |
| `PHOTO_BOOKING_ADMIN_ID` | `393215352` |
| `PHOTO_BOOKING_PHONE` | `+79817726003` |
| `PHOTO_BOOKING_RECIPIENT_NAME` | `Анна Н.` |
| `PHOTO_BOOKING_FULL_PRICE` | `3000` |
| `PHOTO_BOOKING_PREPAY_PERCENT` | `50` |
| `ANNA_ADMIN_PASSWORD` | Пароль для `/anna` (например `4321`) |

Уже должны быть: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_PATH`.

Если `api.telegram.org` недоступен с VPS — добавьте `TELEGRAM_HTTPS_PROXY` или `HTTPS_PROXY`.

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
