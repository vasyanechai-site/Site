/**
 * Вывести в консоль число позиций опта в хранилище и разбивку по category (для диагностики «в админке мало строк»).
 *
 *   node server/scripts/audit-coffee-items.mjs
 *   FORCE_DB_JSON=1 node server/scripts/audit-coffee-items.mjs
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const useFile = process.env.FORCE_DB_JSON === "1";
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const parsed = dotenv.parse(fs.readFileSync(envPath, "utf-8"));
  for (const [k, v] of Object.entries(parsed)) {
    if (useFile && k === "DATABASE_URL") continue;
    if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
  }
}

const { initStorage, getCoffeeItems } = await import("../src/store.js");

await initStorage();
const items = await getCoffeeItems();
const byCat = new Map();
for (const it of items) {
  const c = it.category || "(без категории)";
  byCat.set(c, (byCat.get(c) || 0) + 1);
}
console.log(`coffeeItems всего: ${items.length}`);
for (const [c, n] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c}: ${n}`);
}
