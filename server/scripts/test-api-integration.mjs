/**
 * HTTP integration smoke test (local API).
 * Run: node server/scripts/test-api-integration.mjs
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const port = 9876;
const base = `http://127.0.0.1:${port}/api`;

const dbFile = path.join(repoRoot, "server", "data", "db.json");
const backupPath = dbFile + ".integration-backup";
let hadBackup = false;
let originalDb = null;

if (fs.existsSync(dbFile)) {
  originalDb = fs.readFileSync(dbFile, "utf-8");
  fs.copyFileSync(dbFile, backupPath);
  hadBackup = true;
}

function restoreDb() {
  if (hadBackup && fs.existsSync(backupPath)) {
    fs.writeFileSync(dbFile, originalDb);
    fs.unlinkSync(backupPath);
  }
}

function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(`${base}/health`);
        if (res.ok) return resolve(await res.json());
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("API health timeout"));
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

const server = spawn("node", ["server/src/index.js"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    PORT: String(port),
    DATABASE_URL: "",
    NODE_ENV: "test",
    TELEGRAM_BOT_TOKEN: "",
    TELEGRAM_CHAT_ID: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });

let failed = 0;

async function step(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`  ✗ ${name}: ${e.message}`);
  }
}

try {
  console.log("\n=== Local API integration ===");
  await waitForHealth();
  console.log("  ✓ API started");

  let wholesaleOrderId = null;
  let retailOrderId = null;

  await step("GET /api/orders returns array (legacy orders intact)", async () => {
    const res = await fetch(`${base}/orders`);
    assert.equal(res.status, 200);
    const orders = await res.json();
    assert.ok(Array.isArray(orders));
    // Legacy order without orderNumber should still be readable
    const legacy = orders.find((o) => o.orderId && !o.orderNumber);
    if (legacy) {
      assert.ok(legacy.orderId.length > 0);
    }
  });

  await step("POST /api/orders assigns 01-X orderNumber", async () => {
    const res = await fetch(`${base}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: "TEST AUTO",
        inn: "0000000000",
        account: "40702810000000000000",
        bik: "044525225",
        contact: "Test",
        phone: "+79000000000",
        address: "Test",
        delivery_company: "—",
        delivery_method: "—",
        delivery_address: "Test",
        items: [{ name: "Test Coffee", kg: 5, subtotal: 1000, type: "grain" }],
        total: 1000,
      }),
    });
    const text = await res.text();
    assert.equal(res.status, 200, text);
    const order = JSON.parse(text);
    wholesaleOrderId = order.orderId;
    assert.match(order.orderNumber || "", /^01-\d+$/, `got ${order.orderNumber}`);
    if (order.invoiceNumber) {
      assert.equal(order.orderNumber, order.invoiceNumber);
    }
    assert.ok(order.orderId.startsWith("ORD-"));
  });

  await step("GET /api/orders/:id finds wholesale order by technical id", async () => {
    const res = await fetch(`${base}/orders/${encodeURIComponent(wholesaleOrderId)}`);
    assert.equal(res.status, 200);
    const order = await res.json();
    assert.match(order.orderNumber, /^01-\d+$/);
  });

  await step("POST /api/retail/orders assigns 02-X orderNumber", async () => {
    const res = await fetch(`${base}/retail/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Test Retail",
        customerPhone: "+79000000001",
        customerEmail: "test@example.com",
        items: [
          {
            product: {
              id: "test-product",
              name: "Test Drip",
              price: 500,
              packageWeight: 120,
            },
            quantity: 1,
          },
        ],
      }),
    });
    const text = await res.text();
    assert.equal(res.status, 200, text);
    const order = JSON.parse(text);
    retailOrderId = order.orderId;
    assert.match(order.orderNumber || "", /^02-\d+$/, `got ${order.orderNumber}`);
    assert.ok(order.orderId.startsWith("RETAIL-"));
  });

  await step("GET order-payment-info returns orderNumber", async () => {
    const res = await fetch(`${base}/retail/order-payment-info/${encodeURIComponent(retailOrderId)}`);
    assert.equal(res.status, 200);
    const info = await res.json();
    assert.match(info.orderNumber, /^02-\d+$/);
    assert.equal(info.orderId, retailOrderId);
  });

  await step("cleanup test orders", async () => {
    if (wholesaleOrderId) {
      const res = await fetch(`${base}/orders/${encodeURIComponent(wholesaleOrderId)}`, {
        method: "DELETE",
      });
      assert.ok([200, 204].includes(res.status), `wholesale delete ${res.status}`);
    }
    if (retailOrderId) {
      const res = await fetch(`${base}/retail/orders/${encodeURIComponent(retailOrderId)}`, {
        method: "DELETE",
      });
      assert.ok([200, 204].includes(res.status), `retail delete ${res.status}`);
    }
  });

  console.log(`\n--- Integration: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ---\n`);
} catch (e) {
  failed = 1;
  console.error("Integration aborted:", e.message);
  if (serverLog) console.error("Server log:\n", serverLog.slice(-2000));
} finally {
  server.kill("SIGTERM");
  restoreDb();
  process.exit(failed > 0 ? 1 : 0);
}
