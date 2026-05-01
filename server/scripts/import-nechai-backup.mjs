/**
 * Import Nechai JSON backup (Figma Make / legacy) into this API's store (Postgres app_settings or db.json).
 *
 * Usage (from repo root, with .env / DATABASE_URL as on production):
 *   node server/scripts/import-nechai-backup.mjs /path/to/nechai-backup-2025-11-26.json
 *   node server/scripts/import-nechai-backup.mjs --dry-run /path/to/backup.json
 *
 * Passwords: backup usually has no passwords. For users without password, sets
 * password to last 6 digits of normalized phone (digits only); print summary at end.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import {
  initStorage,
  getUsers,
  setUsers,
  getCoffeeItems,
  setCoffeeItems,
  addOrder,
  getPromoCodes,
  setPromoCodes,
  setExchangeRate,
} from "../src/store.js";

function normalizePhone(raw) {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 && d[0] === "9") return `7${d}`;
  if (d.length === 11 && d[0] === "8") return `7${d.slice(1)}`;
  if (d.length === 11 && d[0] === "7") return d;
  return d;
}

function tempPasswordFromPhone(phoneDigits) {
  const tail = phoneDigits.replace(/\D/g, "").slice(-6);
  return tail.length >= 4 ? tail : `imp${tail || "0000"}`;
}

function normalizeBackupUser(raw) {
  const phone = normalizePhone(raw.phone);
  const id =
    raw.id ||
    `import-${phone || "nophone"}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const name =
    raw.company_name ||
    raw.company ||
    raw.contact ||
    raw.name ||
    (phone ? `Клиент ${phone}` : "Клиент (импорт)");
  const company = raw.company || raw.company_name || "";
  const created_at = raw.created_at || new Date().toISOString();
  const password = raw.password != null && raw.password !== "" ? raw.password : tempPasswordFromPhone(phone);

  return {
    ...raw,
    id,
    phone: phone || raw.phone || id,
    name,
    company: company || undefined,
    company_name: raw.company_name || company || undefined,
    created_at,
    loyaltyLevel: Number(raw.loyaltyLevel ?? 0),
    discount: Number(raw.discount ?? 0),
    loyaltyLevelSetDate: raw.loyaltyLevelSetDate || created_at,
    totalKg: Number(raw.totalKg ?? 0),
    role: raw.role && raw.role !== "user" ? raw.role : "user",
    password,
  };
}

function mergeCoffeeItems(current, incoming) {
  const byId = new Map(current.map((x) => [String(x.id), x]));
  for (const item of incoming) {
    if (item && item.id != null) byId.set(String(item.id), { ...byId.get(String(item.id)), ...item });
  }
  return [...byId.values()];
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const paths = args.filter((a) => !a.startsWith("--"));
  const filePath = paths[0] || process.env.BACKUP_PATH;
  if (!filePath) {
    console.error("Usage: node server/scripts/import-nechai-backup.mjs [--dry-run] <path-to-backup.json>");
    process.exit(1);
  }
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    console.error("File not found:", abs);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(abs, "utf-8"));
  const coffeeItems = Array.isArray(raw.coffeeItems) ? raw.coffeeItems : [];
  const orders = Array.isArray(raw.orders) ? raw.orders : [];
  const backupUsers = Array.isArray(raw.users) ? raw.users : [];
  const promoCodes = Array.isArray(raw.promoCodes) ? raw.promoCodes : [];
  const exchangeRate = raw.exchangeRate && typeof raw.exchangeRate === "object" ? raw.exchangeRate : null;

  console.log(
    `[import] backup ${abs}: coffee=${coffeeItems.length} orders=${orders.length} users=${backupUsers.length} promos=${promoCodes.length}`,
  );
  if (dry) {
    console.log("[import] dry-run: no writes.");
    process.exit(0);
  }

  await initStorage();

  const currentUsers = await getUsers();
  const admins = currentUsers.filter((u) => u.role === "admin");
  const rest = currentUsers.filter((u) => u.role !== "admin");

  const byPhone = new Map();
  for (const u of rest) {
    const phoneKey = normalizePhone(u.phone);
    const mapKey = phoneKey || `id:${u.id}`;
    if (mapKey) byPhone.set(mapKey, { ...u });
  }

  let importedUsers = 0;
  for (const rawUser of backupUsers) {
    const nu = normalizeBackupUser(rawUser);
    const phoneKey = normalizePhone(nu.phone);
    const mapKey = phoneKey || `id:${nu.id}`;
    if (!mapKey) continue;
    const prev = byPhone.get(mapKey);
    if (prev) {
      const merged = { ...prev, ...nu, id: prev.id || nu.id };
      const hadPwdInBackup = rawUser.password != null && rawUser.password !== "";
      merged.password = hadPwdInBackup ? rawUser.password : prev.password ?? nu.password;
      byPhone.set(mapKey, merged);
    } else {
      byPhone.set(mapKey, nu);
    }
    importedUsers++;
  }

  const mergedUsers = [...admins, ...byPhone.values()];
  await setUsers(mergedUsers);

  const currentCoffee = await getCoffeeItems();
  await setCoffeeItems(mergeCoffeeItems(currentCoffee, coffeeItems));

  let ordersOk = 0;
  let ordersErr = 0;
  for (const order of orders) {
    const oid = order.orderId || order.invoiceId;
    if (!oid) {
      ordersErr++;
      continue;
    }
    try {
      await addOrder({ ...order, orderId: oid });
      ordersOk++;
    } catch (e) {
      ordersErr++;
      console.error("[import] order failed", oid, e?.message || e);
    }
  }

  const existingPromos = await getPromoCodes();
  const promoByCode = new Map(existingPromos.map((p) => [String(p.code).toUpperCase(), p]));
  for (const p of promoCodes) {
    if (!p?.code) continue;
    const k = String(p.code).toUpperCase();
    const prevP = promoByCode.get(k) || {};
    promoByCode.set(k, { ...prevP, ...p });
  }
  await setPromoCodes([...promoByCode.values()]);

  if (exchangeRate && exchangeRate.usd_to_rub != null) {
    await setExchangeRate(Number(exchangeRate.usd_to_rub));
  }

  console.log(
    `[import] done: users total=${mergedUsers.length} (admins=${admins.length}), coffee=${(await getCoffeeItems()).length}, orders ok=${ordersOk} err=${ordersErr}, promos=${(await getPromoCodes()).length}`,
  );
  console.log(
    "[import] users without password in backup got password = last 6 digits of phone (digits only). Ask clients to change after first login if you use a different policy.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
