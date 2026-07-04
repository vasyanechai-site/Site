# Telegram-бот записи на фотосессию

Отдельный сервис в репозитории сайта Кофе Нечай. **Не связан с сайтом и API** — только общий репозиторий и VPS.

## Возможности

**Пользователь:** `/start` → «Записаться» → дата → время → предоплата → «Оплатить» / «Отменить».

**Администратор:**
- `/addslot 23.07.2026 17:00` — один слот
- `/addslots` — несколько слотов списком
- `/listslots` — все будущие слоты и статусы
- `/deleteslot` — удалить свободный слот
- `/bookings` — кто дошёл до оплаты

При нажатии «Оплатить» администратор получает уведомление в Telegram.

## Локальный запуск

```bash
cd photo-booking-bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # и заполните значения
python -m bot
```

## Деплой на VPS (рядом с site-api)

1. На VPS в `${VPS_APP_PATH}/photo-booking-bot/.env` — те же переменные, что в `.env.example`.
2. Один раз на сервере:

```bash
cd /var/www/site/photo-booking-bot   # ваш VPS_APP_PATH
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. PM2 (в корне репозитория уже есть `ecosystem.config.cjs` с процессом `photo-booking-bot`):

```bash
cd /var/www/site
pm2 start ecosystem.config.cjs --only photo-booking-bot
pm2 save
```

Автодеплой: workflow `.github/workflows/deploy-photo-booking-bot.yml` (push в `main` при изменениях в `photo-booking-bot/**`).

## Настройки (.env)

| Переменная | Описание |
|------------|----------|
| `BOT_TOKEN` | Токен от @BotFather |
| `ADMIN_ID` | Telegram user ID администратора |
| `PHONE` | Номер для СБП |
| `RECIPIENT_NAME` | Имя получателя |
| `TELEGRAM_BOT_PROXY_URL` | Cloudflare Worker для Bot API (бесплатно, если Telegram заблокирован на VPS) |
| `TELEGRAM_BOT_PROXY_SECRET` | Секрет worker (можно тот же, что `TELEGRAM_RELAY_SECRET`) |
| `HTTPS_PROXY` | Платный запасной вариант, если worker не используется |

Полная стоимость и % предоплаты — в админке **/anna**, таблица `app_settings` в SQLite.

## Статусы слотов

- **свободен** — доступен для записи
- **забронирован** — пользователь выбрал время, ещё не нажал «Оплатить»
- **ожидает оплату** — нажал «Оплатить», админ уведомлён

Данные хранятся в SQLite: `photo-booking-bot/data/booking.db`.

## Веб-админка

CRM доступна на **`/anna`** (пароль по умолчанию `4321`, переменная `ANNA_ADMIN_PASSWORD` в `.env` сервера).
Админка использует ту же базу данных — изменения синхронизируются с Telegram-ботом.
