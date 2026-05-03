#!/usr/bin/env node
/**
 * Проверка «всё ли в .env для СДЭК / Точки / Telegram / почты / БД».
 * Не падает с кодом 1 — только подсказки (кроме режима --strict).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");
dotenv.config({ path: path.join(root, ".env") });

function has(...keys) {
  return keys.some((k) => String(process.env[k] || "").trim());
}

const warnings = [];

const tgToken = has("TELEGRAM_BOT_TOKEN");
const tgChat = has("TELEGRAM_CHAT_ID");
const tgDirect = tgToken && tgChat;
const tgRelay = has("TELEGRAM_RELAY_URL") && has("TELEGRAM_RELAY_SECRET");
if (!tgDirect && !tgRelay) {
  warnings.push(
    "Telegram-уведомления (заказы, заявки): задайте TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID или TELEGRAM_RELAY_URL + TELEGRAM_RELAY_SECRET.",
  );
} else if (tgToken && !tgChat) {
  warnings.push("Есть TELEGRAM_BOT_TOKEN, нет TELEGRAM_CHAT_ID — укажите чат/канал для уведомлений.");
} else if (!tgToken && tgChat) {
  warnings.push("Есть TELEGRAM_CHAT_ID, нет TELEGRAM_BOT_TOKEN — укажите токен бота.");
} else if (has("TELEGRAM_RELAY_URL") && !has("TELEGRAM_RELAY_SECRET")) {
  warnings.push("Задан TELEGRAM_RELAY_URL без TELEGRAM_RELAY_SECRET — relay не сработает.");
}

if (!has("TOCHKA_JWT_TOKEN")) {
  warnings.push("Точка: нет TOCHKA_JWT_TOKEN — оплата/инвойсы Tochka API не заработают.");
}
if (has("TOCHKA_JWT_TOKEN") && !has("TOCHKA_CUSTOMER_CODE", "TOCHKA_MERCHANT_ID")) {
  warnings.push("Точка: есть токен, но нет TOCHKA_CUSTOMER_CODE / TOCHKA_MERCHANT_ID — часть сценариев может не хватить.");
}

if (!has("CDEK_ACCOUNT", "CDEK_SECRET")) {
  warnings.push("СДЭК: нет CDEK_ACCOUNT / CDEK_SECRET — расчёт доставки и заявки СДЭК в ЛК не работают.");
} else if (!has("CDEK_ACCOUNT") || !has("CDEK_SECRET")) {
  warnings.push("СДЭК: нужны оба — CDEK_ACCOUNT и CDEK_SECRET.");
}

const smtp = ["BACKUP_SMTP_HOST", "BACKUP_SMTP_USER", "BACKUP_SMTP_PASS"].every((k) => has(k));
if (!smtp) {
  warnings.push("Почта бэкапа: нет BACKUP_SMTP_HOST / USER / PASS — кнопка «отправить бэкап» и weekly-email не отправят письмо.");
}

if (!has("DATABASE_URL")) {
  warnings.push(
    "DATABASE_URL пуст — данные в файле server/data/db.json на диске VPS (нужен бэп диска). Для Postgres укажите DATABASE_URL.",
  );
}

if (!fs.existsSync(path.join(root, ".env"))) {
  console.error("[prod-integrations] Нет файла .env в корне проекта.");
  process.exit(strict ? 1 : 0);
}

console.log("\n════════ Проверка интеграций (.env) ════════\n");
console.log("(JWT и CORS уже проверяет: npm run env:check -- --production)\n");

if (warnings.length) {
  console.log("⚠ Без этого часть функций не заработает «на 100%»:\n");
  warnings.forEach((m) => console.log("   •", m));
  console.log("");
}

if (!warnings.length) {
  console.log("✓ Основные переменные интеграций заданы (локальная проверка по .env).\n");
} else {
  console.log("— Дозаполните .env на сервере или GitHub Secrets для деплоя.\n");
}

console.log("Фронт на домене: в GitHub Secret VITE_API_BASE_URL должен быть полный URL API, например:");
console.log("  https://api.ваш-домен.ru/api");
console.log("(тот же хост, что настроен для Node за nginx / install-api-proxy.sh)\n");

if (strict && warnings.length) {
  process.exit(1);
}
