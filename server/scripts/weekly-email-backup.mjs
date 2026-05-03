#!/usr/bin/env node
/**
 * Полный бэкап данных API (опт + розница): Postgres — таблицы orders, retail_orders, app_settings;
 * без DATABASE_URL — файл server/data/db.json.
 * Отправка на почту через SMTP (BACKUP_SMTP_*).
 *
 * Запуск с корня репозитория (как на VPS):
 *   node server/scripts/weekly-email-backup.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const DEFAULT_TO = "dakolosovs@mail.ru";

async function buildBackupPayload() {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  const exportedAt = new Date().toISOString();

  if (databaseUrl) {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    try {
      const [o, ro, as] = await Promise.all([
        pool.query(
          "SELECT order_id, payload, created_at FROM orders ORDER BY created_at ASC",
        ),
        pool.query(
          "SELECT order_id, payload, created_at FROM retail_orders ORDER BY created_at ASC",
        ),
        pool.query("SELECT key, payload, updated_at FROM app_settings ORDER BY key ASC"),
      ]);
      return {
        meta: {
          version: 1,
          exportedAt,
          source: "postgres",
          note: "orders=опт, retail_orders=розница, app_settings=товары, пользователи, лояльность, промокоды, настройки и пр.",
        },
        orders: o.rows,
        retail_orders: ro.rows,
        app_settings: as.rows,
      };
    } finally {
      await pool.end();
    }
  }

  const dbFile = path.join(repoRoot, "server", "data", "db.json");
  if (!fs.existsSync(dbFile)) {
    throw new Error("Нет DATABASE_URL и нет server/data/db.json — нечего бэкапить.");
  }
  const raw = JSON.parse(fs.readFileSync(dbFile, "utf8"));
  return {
    meta: {
      version: 1,
      exportedAt,
      source: "json_file",
      path: "server/data/db.json",
      note: "Локальный JSON-сторадж (все ключи опта/розницы в одном файле).",
    },
    db: raw,
  };
}

function summarizeAppSettings(rows) {
  if (!Array.isArray(rows)) return "";
  const keys = rows.map((r) => r.key).filter(Boolean);
  const loyalty = keys.filter((k) => k.startsWith("loyalty:")).length;
  const userSettings = keys.filter((k) => k.startsWith("userSettings:")).length;
  const known = [
    "coffeeItems",
    "users",
    "promoCodes",
    "retailProducts",
    "categoryOrder",
    "favoritesByUser",
    "businessRegistrations",
    "retailUsers",
    "tickerSettings",
    "wholesaleAccessRequests",
    "exchangeRate",
    "retailLocations",
    "retailLocationRequests",
  ];
  const lines = [
    `Всего ключей app_settings: ${keys.length}`,
    `  loyalty:* … ${loyalty}`,
    `  userSettings:* … ${userSettings}`,
    `  прочие ключи (первые 40): ${keys.filter((k) => !k.startsWith("loyalty:") && !k.startsWith("userSettings:")).slice(0, 40).join(", ") || "—"}`,
  ];
  for (const k of known) {
    if (keys.includes(k)) lines.push(`  ✓ ${k}`);
  }
  return lines.join("\n");
}

async function main() {
  const to = String(process.env.BACKUP_EMAIL_TO || DEFAULT_TO).trim();
  const host = String(process.env.BACKUP_SMTP_HOST || "").trim();
  const port = Number(process.env.BACKUP_SMTP_PORT || 465);
  const user = String(process.env.BACKUP_SMTP_USER || "").trim();
  const pass = String(process.env.BACKUP_SMTP_PASS || "").trim();
  const secure =
    String(process.env.BACKUP_SMTP_SECURE || "true").toLowerCase() !== "false";

  if (!host || !user || !pass) {
    throw new Error(
      "Для почты задайте BACKUP_SMTP_HOST, BACKUP_SMTP_USER, BACKUP_SMTP_PASS (и при необходимости BACKUP_SMTP_PORT, BACKUP_SMTP_SECURE).",
    );
  }

  const payload = await buildBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const gz = gzipSync(Buffer.from(json, "utf8"));
  const day = payload.meta.exportedAt.slice(0, 10);
  const filename = `nechai-full-backup-${day}.json.gz`;

  let statsText = "";
  if (payload.meta.source === "postgres") {
    statsText = [
      `Источник: PostgreSQL`,
      `Строк orders (опт): ${payload.orders?.length ?? 0}`,
      `Строк retail_orders (розница): ${payload.retail_orders?.length ?? 0}`,
      summarizeAppSettings(payload.app_settings),
      `Размер JSON (прибл.): ${(json.length / 1024).toFixed(1)} KB, gzip: ${(gz.length / 1024).toFixed(1)} KB`,
    ].join("\n");
  } else {
    statsText = `Источник: ${payload.meta.path}\nРазмер JSON: ${(json.length / 1024).toFixed(1)} KB`;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const subject = `[Кофе Нечай] Бэкап БД ${day}`;
  const text = [
    "Автоматический еженедельный бэкап данных сайта (опт и розница).",
    "",
    statsText,
    "",
    "Вложение: gzip JSON. Распаковать: gunzip -c файл.json.gz > backup.json",
  ].join("\n");

  await transporter.sendMail({
    from: user,
    to,
    subject,
    text,
    attachments: [{ filename, content: gz, contentType: "application/gzip" }],
  });

  console.log(`[weekly-email-backup] Отправлено на ${to}, файл ${filename} (${gz.length} bytes gzip)`);
}

main().catch((e) => {
  console.error("[weekly-email-backup]", e.message || e);
  process.exit(1);
});
