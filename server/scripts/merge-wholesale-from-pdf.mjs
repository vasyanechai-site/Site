/**
 * Добавляет позиции опта из JSON (выгрузка с прайс-листа PDF) в текущий список coffeeItems.
 * Дубликаты пропускаются: тот же type + country + name (без учёта регистра и лишних пробелов).
 *
 * Использование из корня репозитория (нужен DATABASE_URL или локальный server/data/db.json):
 *   node server/scripts/merge-wholesale-from-pdf.mjs --dry-run
 *   node server/scripts/merge-wholesale-from-pdf.mjs --local --dry-run   # без Postgres
 *   node server/scripts/merge-wholesale-from-pdf.mjs --local
 *   node server/scripts/merge-wholesale-from-pdf.mjs
 *   node server/scripts/merge-wholesale-from-pdf.mjs /path/to/other.json
 *
 * Источник по умолчанию: server/seed-data/wholesale-from-pdf-2026-04-24.json
 *
 * При --dry-run — без Postgres (db.json).
 * FORCE_DB_JSON=1 или --local — явно db.json.
 * Если в .env DATABASE_URL на localhost — автоматически db.json (иначе STORE_FORCE_PG=1 для Postgres на localhost).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadStoreEnvForScripts } from "./lib/store-env.mjs";

const { dry: __dry } = loadStoreEnvForScripts("merge-pdf");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeKey(item) {
  const t = item.type || "grain";
  if (t === "coldbrew") return `${t}|${norm(item.name)}`;
  return `${t}|${norm(item.country)}|${norm(item.name)}|${norm(item.category)}`;
}

function loadIncomingArray(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.coffeeItems)) return raw.coffeeItems;
  throw new Error("JSON должен быть массивом или объектом { coffeeItems: [...] }");
}

async function main() {
  const { initStorage, getCoffeeItems, setCoffeeItems } = await import("../src/store.js");

  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const paths = args.filter((a) => !a.startsWith("--"));
  const defaultPath = path.join(__dirname, "..", "seed-data", "wholesale-from-pdf-2026-04-24.json");
  const filePath = path.resolve(process.cwd(), paths[0] || defaultPath);

  if (!fs.existsSync(filePath)) {
    console.error("Файл не найден:", filePath);
    process.exit(1);
  }

  const incoming = loadIncomingArray(filePath);
  console.log(`[merge-pdf] файл: ${filePath}, позиций в файле: ${incoming.length}`);

  if (dry) {
    console.log("[merge-pdf] dry-run: чтение текущего списка для отчёта…");
  }

  await initStorage();
  const current = await getCoffeeItems();
  const existingKeys = new Set(current.map(dedupeKey));

  const toAdd = [];
  const skipped = [];
  for (const row of incoming) {
    if (!row || typeof row !== "object") continue;
    const key = dedupeKey(row);
    if (existingKeys.has(key)) {
      skipped.push({ key, name: row.name, country: row.country });
      continue;
    }
    existingKeys.add(key);
    const id =
      row.id ||
      `import-pdf20260424-${String(toAdd.length + 1).padStart(3, "0")}-${Math.floor(Math.random() * 1000)}`;
    toAdd.push({ ...row, id });
  }

  console.log(
    `[merge-pdf] уже в базе: ${current.length}; добавится: ${toAdd.length}; пропущено (дубликат): ${skipped.length}`,
  );
  if (skipped.length && skipped.length <= 30) {
    for (const s of skipped) console.log("  skip:", s.key);
  } else if (skipped.length) {
    console.log("  (первые 15 пропусков)");
    skipped.slice(0, 15).forEach((s) => console.log("  skip:", s.key));
  }

  if (dry) {
    console.log("[merge-pdf] dry-run: запись не выполнялась.");
    process.exit(0);
  }

  await setCoffeeItems([...current, ...toAdd]);
  const after = await getCoffeeItems();
  console.log(`[merge-pdf] готово. coffeeItems всего: ${after.length}`);
}

function pgRefused(err) {
  const s = String(err?.message ?? err);
  if (err?.code === "ECONNREFUSED" || s.includes("ECONNREFUSED")) return true;
  if (Array.isArray(err?.errors) && err.errors.some((x) => x?.code === "ECONNREFUSED")) return true;
  return false;
}

main().catch((e) => {
  if (pgRefused(e)) {
    console.error(`
Postgres недоступен (ECONNREFUSED). Запустите БД или используйте server/data/db.json:
  npm run wholesale:merge:local
  # либо в .env уберите localhost из DATABASE_URL / задайте STORE_FORCE_PG=1 только если Postgres на localhost нужен принудительно.
`);
    process.exit(1);
  }
  console.error(e);
  process.exit(1);
});
