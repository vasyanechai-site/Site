/**
 * Вывести в консоль число позиций опта в хранилище и разбивку по category (для диагностики «в админке мало строк»).
 *
 *   node server/scripts/audit-coffee-items.mjs
 *   node server/scripts/audit-coffee-items.mjs --local
 * На Mac с DATABASE_URL=localhost без Postgres — автоматически db.json (см. server/scripts/lib/store-env.mjs).
 */
import { loadStoreEnvForScripts } from "./lib/store-env.mjs";

loadStoreEnvForScripts("audit");

const { initStorage, getCoffeeItems } = await import("../src/store.js");

function pgRefused(err) {
  const s = String(err?.message ?? err);
  if (err?.code === "ECONNREFUSED" || s.includes("ECONNREFUSED")) return true;
  if (Array.isArray(err?.errors) && err.errors.some((x) => x?.code === "ECONNREFUSED")) return true;
  return false;
}

try {
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
} catch (e) {
  if (pgRefused(e)) {
    console.error(`
Postgres недоступен (ECONNREFUSED). Пример: npm run wholesale:audit:local или STORE_FORCE_PG=1 если Postgres на localhost нужен.
`);
    process.exit(1);
  }
  throw e;
}
