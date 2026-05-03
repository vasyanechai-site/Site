#!/usr/bin/env node
/**
 * Локальные команды окружения: init / secret / check.
 * Запуск из корня репозитория: npm run env:init | env:secret | env:check
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const cmd = process.argv[2] || "help";
const production = process.argv.includes("--production");

function init() {
  const envPath = path.join(root, ".env");
  const examplePath = path.join(root, ".env.example");
  if (fs.existsSync(envPath)) {
    console.log("[env:init] Файл .env уже существует — не перезаписываю.");
    console.log("           Нужен чистый шаблон: удалите .env и снова npm run env:init");
    return;
  }
  if (!fs.existsSync(examplePath)) {
    console.error("[env:init] Нет .env.example");
    process.exit(1);
  }
  fs.copyFileSync(examplePath, envPath);
  console.log("[env:init] Создан .env из .env.example.");
  console.log("           1) npm run env:secret  → вставьте строку в JWT_SECRET=…");
  console.log("           2) поправьте ALLOWED_ORIGIN(S) под URL сайта");
  console.log("           3) npm run env:check -- --production");
}

function secret() {
  const s = crypto.randomBytes(32).toString("hex");
  console.log(s);
  console.error("[env:secret] ↑ вставьте в .env как JWT_SECRET=<строка выше>");
}

function check() {
  dotenv.config({ path: path.join(root, ".env") });
  const issues = [];
  const notes = [];

  const jwt = String(process.env.JWT_SECRET || process.env.RETAIL_AUTH_SECRET || "").trim();
  const origin = String(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "").trim();
  const viteApi = String(process.env.VITE_API_BASE_URL || "").trim();

  if (production) {
    if (!jwt) {
      issues.push("Нет JWT_SECRET и RETAIL_AUTH_SECRET — в проде обязательно (npm run env:secret).");
    } else if (jwt.length < 24) {
      issues.push("Секрет JWT слишком короткий; лучше npm run env:secret и 64 hex-символа.");
    }
    if (!origin) {
      issues.push("Нет ALLOWED_ORIGINS / ALLOWED_ORIGIN — CORS заблокирует фронт на другом домене.");
    }
    if (!viteApi) {
      notes.push(
        "VITE_API_BASE_URL не задан в .env — для CI/сборки фронта укажите полный URL API (…/api) или в nginx проксируйте /api.",
      );
    }
  } else {
    if (!jwt) {
      notes.push("JWT_SECRET пуст — для dev допустим fallback в коде; для прода задайте npm run env:secret.");
    }
    if (!origin) {
      notes.push("ALLOWED_ORIGIN пуст — для Vite dev обычно http://localhost:5173 в .env.example.");
    }
  }

  if (!String(process.env.DATABASE_URL || "").trim()) {
    notes.push("DATABASE_URL пуст — данные в server/data (db.json); для Postgres задайте DATABASE_URL.");
  }

  if (issues.length) {
    console.error("[env:check] ОШИБКИ (режим --production):");
    issues.forEach((m) => console.error("  •", m));
    console.error("\nИсправьте .env и повторите: npm run env:check -- --production");
    process.exit(1);
  }
  if (production) {
    console.log("[env:check] Обязательные для прод поля выглядят заполненными.");
  } else {
    console.log("[env:check] Режим dev: блокирующих ошибок нет (строгая проверка: флаг --production).");
  }

  if (notes.length) {
    console.log("\nПодсказки:");
    notes.forEach((m) => console.log("  ·", m));
  }

  if (!issues.length && !production) {
    console.log("\nПеред деплоем: npm run env:check -- --production");
  }
}

function help() {
  console.log(`Использование (из корня репозитория):
  npm run env:init
      Создать .env из .env.example, если .env ещё нет.

  npm run env:secret
      Случайная строка для JWT_SECRET (скопировать в .env).

  npm run env:check
      Проверка .env (мягко).

  npm run env:check -- --production
      Строго: без секрета JWT и без CORS-origin — код выхода 1.`);
}

switch (cmd) {
  case "init":
    init();
    break;
  case "secret":
    secret();
    break;
  case "check":
    check();
    break;
  default:
    help();
}
