/**
 * Smoke/regression tests for short order numbering and display helpers.
 * Run: node server/scripts/test-order-numbering.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDisplayOrderNumber } from "../src/orderNumbers.js";
import {
  formatWholesaleOrderMessage,
  formatRetailOrderMessage,
  formatPaymentReceived,
} from "../src/telegram.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const dataDir = path.join(repoRoot, "server", "data");
const dbFile = path.join(dataDir, "db.json");

let passed = 0;
let failed = 0;

function ok(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

async function okAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

console.log("\n=== getDisplayOrderNumber ===");
ok("prefers orderNumber", () => {
  assert.equal(getDisplayOrderNumber({ orderNumber: "01-5", orderId: "ORD-x" }), "01-5");
});
ok("falls back to invoiceNumber", () => {
  assert.equal(getDisplayOrderNumber({ invoiceNumber: "01-3", orderId: "ORD-x" }), "01-3");
});
ok("falls back to orderId for legacy orders", () => {
  assert.equal(
    getDisplayOrderNumber({ orderId: "ORD-1782820193993-365" }),
    "ORD-1782820193993-365",
  );
});
ok("retail short number", () => {
  assert.equal(getDisplayOrderNumber({ orderNumber: "02-7", orderId: "RETAIL-123" }), "02-7");
});

console.log("\n=== Telegram messages (public number, not ORD-) ===");
ok("wholesale telegram uses 01-X", () => {
  const msg = formatWholesaleOrderMessage({
    orderNumber: "01-12",
    orderId: "ORD-1782820193993-365",
    date: "2026-06-26T12:00:00.000Z",
    company: "Test LLC",
    items: [{ name: "Brazil", kg: 5, subtotal: 5000, type: "grain" }],
    total: 5000,
  });
  assert.match(msg, /01-12/);
  assert.doesNotMatch(msg, /ORD-1782820193993/);
});
ok("retail telegram uses 02-X", () => {
  const msg = formatRetailOrderMessage({
    orderNumber: "02-4",
    orderId: "RETAIL-999-1",
    date: "2026-06-26T12:00:00.000Z",
    contact: "Иван",
    phone: "+79001234567",
    items: [{ name: "Дрип", quantity: 1, subtotal: 500 }],
    total: 500,
    delivery_method: "pickup",
  });
  assert.match(msg, /02-4/);
  assert.doesNotMatch(msg, /RETAIL-999/);
});
ok("payment received uses short number", () => {
  const msg = formatPaymentReceived({
    orderNumber: "02-2",
    orderId: "RETAIL-abc",
    total: 1000,
    contact: "A",
    phone: "+7",
  });
  assert.match(msg, /02-2/);
  assert.doesNotMatch(msg, /RETAIL-abc/);
});

console.log("\n=== Counter reservation (JSON store, isolated) ===");

const backupPath = dbFile + ".test-backup";
let hadBackup = false;
let originalDb = null;

function backupDb() {
  if (fs.existsSync(dbFile)) {
    originalDb = fs.readFileSync(dbFile, "utf-8");
    fs.copyFileSync(dbFile, backupPath);
    hadBackup = true;
  } else if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function restoreDb() {
  if (hadBackup && fs.existsSync(backupPath)) {
    fs.writeFileSync(dbFile, originalDb);
    fs.unlinkSync(backupPath);
  }
}

backupDb();

// Fresh module load with no DATABASE_URL
delete process.env.DATABASE_URL;

const {
  reserveNextWholesaleInvoiceNumber,
  reserveNextRetailOrderNumber,
  setWholesaleInvoiceCounter,
} = await import("../src/store.js");

await okAsync("wholesale counter reserves 01-X sequentially", async () => {
  await setWholesaleInvoiceCounter({ next: 1, prefix: "01-" });
  const a = await reserveNextWholesaleInvoiceNumber();
  const b = await reserveNextWholesaleInvoiceNumber();
  assert.equal(a.number, "01-1");
  assert.equal(b.number, "01-2");
  assert.notEqual(a.number, b.number);
});

await okAsync("retail counter is independent (02-X)", async () => {
  const r1 = await reserveNextRetailOrderNumber();
  const r2 = await reserveNextRetailOrderNumber();
  assert.match(r1.number, /^02-\d+$/);
  assert.match(r2.number, /^02-\d+$/);
  assert.notEqual(r1.number, r2.number);
  // Wholesale prefix must not leak into retail
  assert.doesNotMatch(r1.number, /^01-/);
});

restoreDb();

console.log("\n=== Frontend display helper (mirrors server) ===");
const frontendHelperPath = path.join(repoRoot, "src/app/lib/orderNumbers.ts");
ok("frontend helper file exists", () => {
  assert.ok(fs.existsSync(frontendHelperPath));
  const src = fs.readFileSync(frontendHelperPath, "utf-8");
  assert.match(src, /orderNumber/);
  assert.match(src, /invoiceNumber/);
  assert.match(src, /orderId/);
});

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
process.exit(failed > 0 ? 1 : 0);
