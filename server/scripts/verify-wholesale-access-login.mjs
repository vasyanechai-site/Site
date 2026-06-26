/**
 * Проверка: request-access → пароль в БД → login → PUT без пароля не затирает → login снова.
 * Запуск: node server/scripts/verify-wholesale-access-login.mjs [baseUrl]
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const base = (process.argv[2] || "http://127.0.0.1:8787/api").replace(/\/+$/, "");
const ts = Date.now();
const phone = `89${String(ts).slice(-9)}`;

async function json(method, urlPath, body) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

import fs from "node:fs";

const dbPath = path.resolve(__dirname, "../data/db.json");
function readUsersFromFile() {
  try {
    const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    return Array.isArray(db.users) ? db.users : [];
  } catch {
    return [];
  }
}

console.log("1) POST /wholesale/request-access");
const create = await json("POST", "/wholesale/request-access", {
  name: "Verify Test",
  company: "Verify Co",
  phone,
  channel: "whatsapp",
});
if (create.status !== 201) {
  console.error("FAIL create", create.status, create.data);
  process.exit(1);
}
const userId = create.data?.request?.wholesaleUserId;
console.log("   userId:", userId, "phone:", phone);

const stored = readUsersFromFile().find((u) => u.id === userId);
if (!stored?.password) {
  console.error("FAIL: password not in store after create");
  process.exit(1);
}
const pwd = stored.password;
console.log("2) Password saved in store, length:", pwd.length);

console.log("3) POST /users/login (exact phone)");
let login = await json("POST", "/users/login", { phone, password: pwd });
if (login.status !== 200) {
  console.error("FAIL login exact", login.status, login.data);
  process.exit(1);
}
console.log("   OK");

console.log("4) POST /users/login (formatted phone)");
login = await json("POST", "/users/login", {
  phone: `8 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`,
  password: pwd,
});
if (login.status !== 200) {
  console.error("FAIL login formatted", login.status, login.data);
  process.exit(1);
}
console.log("   OK");

console.log("5) PUT /users/:id with empty password (admin save simulation)");
const put = await json("PUT", `/users/${userId}`, {
  phone,
  password: "",
  company_name: "Verify Co",
  role: "wholesale",
});
if (put.status !== 200) {
  console.error("FAIL put", put.status, put.data);
  process.exit(1);
}
const afterPut = readUsersFromFile().find((u) => u.id === userId);
if (afterPut?.password !== pwd) {
  console.error("FAIL: password wiped after empty PUT", afterPut?.password);
  process.exit(1);
}
console.log("   OK — password preserved");

console.log("6) POST /users/login after empty PUT");
login = await json("POST", "/users/login", { phone, password: pwd });
if (login.status !== 200) {
  console.error("FAIL login after put", login.status, login.data);
  process.exit(1);
}
console.log("   OK");

console.log("\nAll checks passed.");
