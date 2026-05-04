/**
 * Общая загрузка .env для CLI-скриптов, использующих server/src/store.js.
 * Если DATABASE_URL смотрит на localhost, а Postgres не нужен — переключаемся на server/data/db.json.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export function dbUrlLooksLocal(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const normalized = url.replace(/^postgres(ql)?:/i, "http:");
    const { hostname } = new URL(normalized);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

/**
 * Подставляет переменные из .env в process (только пустые ключи).
 * При необходимости убирает DATABASE_URL → store работает через db.json.
 *
 * @param {string} label — префикс в console.warn
 * @returns {{ dry: boolean; localFlag: boolean }}
 */
export function loadStoreEnvForScripts(label = "store") {
  const dry = process.argv.includes("--dry-run");
  const localFlag = process.argv.includes("--local") || process.env.FORCE_DB_JSON === "1";
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const parsed = dotenv.parse(fs.readFileSync(envPath, "utf-8"));
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
    }
  }

  const forcePg = process.env.STORE_FORCE_PG === "1";
  const autoJson =
    !forcePg &&
    !dry &&
    !localFlag &&
    dbUrlLooksLocal(process.env.DATABASE_URL);

  const useJsonFile = dry || localFlag || autoJson;
  if (useJsonFile && process.env.DATABASE_URL) {
    if (autoJson) {
      console.warn(
        `[${label}] DATABASE_URL указывает на localhost — используется server/data/db.json ` +
          "(каталог на продакшене не меняется). Postgres на localhost: STORE_FORCE_PG=1. " +
          "Прод: GitHub Actions «Merge wholesale seed on VPS» или SSH на VPS и node …/merge-wholesale-from-pdf.mjs.",
      );
    }
    delete process.env.DATABASE_URL;
  }

  return { dry, localFlag };
}
