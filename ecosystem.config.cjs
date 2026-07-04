/**
 * PM2: переменные TELEGRAM_* и др. читает `dotenv` из `.env` в корне репозитория
 * (рядом с package.json). Запуск: `cd /path/to/Site && pm2 start ecosystem.config.cjs`
 */
const path = require("path");

const BOOKING_DB = path.join(__dirname, "photo-booking-bot/data/booking.db");

module.exports = {
  apps: [
    {
      name: "site-api",
      script: "server/src/index.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 8787,
        PHOTO_BOOKING_DB_PATH: BOOKING_DB,
      },
    },
    {
      name: "photo-booking-bot",
      script: ".venv/bin/python",
      args: "-m bot",
      cwd: path.join(__dirname, "photo-booking-bot"),
      env: {
        PYTHONUNBUFFERED: "1",
        DATABASE_PATH: BOOKING_DB,
      },
    },
  ],
};
