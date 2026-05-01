/**
 * PM2: переменные TELEGRAM_* и др. читает `dotenv` из `.env` в корне репозитория
 * (рядом с package.json). Запуск: `cd /path/to/Site && pm2 start ecosystem.config.cjs`
 */
module.exports = {
  apps: [
    {
      name: "site-api",
      script: "server/src/index.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 8787,
      },
    },
  ],
};
