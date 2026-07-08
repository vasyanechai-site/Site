/**
 * Ежедневная smoke-проверка ключевых сценариев сайта Кофе Нечай.
 *
 * Что проверяется (функциональные сценарии против ЛОКАЛЬНО поднятого API —
 * без побочных эффектов в проде: без реальных СДЭК/Точки/Telegram-уведомлений):
 *   - здоровье API, каталоги (розница/опт), пункты выдачи;
 *   - регистрация и вход розничного пользователя;
 *   - оформление розничного заказа (самовывоз);
 *   - оформление оптового заказа;
 *   - промокоды (создание + проверка).
 *
 * Дополнительно (только чтение) при заданном PROD_BASE_URL — проверка, что
 * живой сайт реально отвечает: health + каталоги.
 *
 * Итог: краткий отчёт в консоль, файлы smoke-report.txt / smoke-report.json и
 * (при SMOKE_SEND_TELEGRAM=1) одно сообщение в Telegram.
 *
 * Управляется переменными окружения:
 *   SMOKE_BASE_URL       — база локального API (по умолчанию http://127.0.0.1:8787)
 *   PROD_BASE_URL        — база прод-API для read-only проверок (необязательно)
 *   SMOKE_SEND_TELEGRAM  — "1", чтобы отправить отчёт в Telegram
 *   UNIT_TESTS_RESULT    — "ok" | "fail" | "skip" (результат npm test из workflow)
 *   FRONTEND_BUILD_RESULT — "ok" | "fail" | "skip" (результат npm run build)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const SMOKE_BASE_URL = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const PROD_BASE_URL = (process.env.PROD_BASE_URL || "").replace(/\/+$/, "");
const SEND_TELEGRAM = process.env.SMOKE_SEND_TELEGRAM === "1";
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 20000);

function apiUrl(base, p) {
  const suffix = p.startsWith("/") ? p : `/${p}`;
  return `${base}/api${suffix}`;
}

async function http(base, p, { method = "GET", body, headers } = {}) {
  const res = await fetch(apiUrl(base, p), {
    method,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/** Один сценарий: {name, group, run} где run бросает исключение при провале. */
async function runCheck(name, group, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    return { name, group, ok: true, ms: Date.now() - started, detail: detail || null };
  } catch (e) {
    const msg = e?.name === "TimeoutError" ? `таймаут > ${TIMEOUT_MS} мс` : e?.message || String(e);
    return { name, group, ok: false, ms: Date.now() - started, error: msg };
  }
}

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/** Функциональные сценарии против локального API. */
function functionalScenarios(base) {
  const suffix = uniqueSuffix();
  const email = `smoke+${suffix}@example.com`;
  const password = `Smoke!${suffix}`;
  const promoCode = `SMOKE${suffix}`.toUpperCase();

  return [
    {
      name: "API доступен (health)",
      group: "Инфраструктура",
      run: async () => {
        const r = await http(base, "/health");
        assert(r.ok && r.data?.ok === true, `health вернул ${r.status}`);
        return `env=${r.data?.env ?? "?"}`;
      },
    },
    {
      name: "Каталог розницы",
      group: "Каталог",
      run: async () => {
        const r = await http(base, "/retail/products");
        assert(r.ok, `HTTP ${r.status}`);
        assert(Array.isArray(r.data), "ответ не массив");
        return `${r.data.length} товаров`;
      },
    },
    {
      name: "Каталог опта",
      group: "Каталог",
      run: async () => {
        const r = await http(base, "/coffee-items");
        assert(r.ok, `HTTP ${r.status}`);
        assert(Array.isArray(r.data), "ответ не массив");
        return `${r.data.length} позиций`;
      },
    },
    {
      name: "Пункты выдачи (СДЭК-локации)",
      group: "Каталог",
      run: async () => {
        const r = await http(base, "/retail-locations");
        assert(r.ok, `HTTP ${r.status}`);
        assert(Array.isArray(r.data), "ответ не массив");
        return `${r.data.length} точек`;
      },
    },
    {
      name: "Регистрация розничного пользователя",
      group: "Аккаунты",
      run: async () => {
        const r = await http(base, "/retail-signup", {
          method: "POST",
          body: { email, password, name: "Smoke Test" },
        });
        assert(r.status === 201 && r.data?.success, `HTTP ${r.status}: ${JSON.stringify(r.data)?.slice(0, 160)}`);
        return `создан ${email}`;
      },
    },
    {
      name: "Вход розничного пользователя",
      group: "Аккаунты",
      run: async () => {
        const r = await http(base, "/auth/retail/login", {
          method: "POST",
          body: { email, password },
        });
        assert(r.ok && r.data?.access_token, `HTTP ${r.status}: ${JSON.stringify(r.data)?.slice(0, 160)}`);
        return "токен получен";
      },
    },
    {
      name: "Заказ в рознице (самовывоз)",
      group: "Заказы",
      run: async () => {
        const r = await http(base, "/retail/orders", {
          method: "POST",
          body: {
            customerName: "Smoke Тест",
            customerPhone: "+79001234567",
            customerEmail: email,
            items: [
              {
                product: { id: "smoke-p1", name: "Кофе Smoke", category: "coffee", price: 1877, imageUrl: "" },
                quantity: 4,
                weight: 250,
                roast: "filter",
                grind: "whole",
              },
            ],
            deliveryInfo: null,
            usedPoints: 0,
          },
        });
        assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(r.data)?.slice(0, 200)}`);
        assert(r.data?.orderId, "нет orderId в ответе");
        assert(r.data?.orderType === "retail", `orderType=${r.data?.orderType}`);
        assert(r.data?.total === 7508, `total=${r.data?.total} (ожидалось 7508)`);
        assert(r.data?.status === "pending", `status=${r.data?.status}`);
        return `заказ ${r.data.orderId}, итого ${r.data.total} ₽`;
      },
    },
    {
      name: "Заказ в опте",
      group: "Заказы",
      run: async () => {
        const r = await http(base, "/orders", {
          method: "POST",
          body: {
            company: "ООО Smoke",
            inn: "7700000000",
            contact: "Smoke Контакт",
            phone: "+79001234567",
            address: "Санкт-Петербург",
            delivery_method: "pickup",
            items: [
              { type: "coffee", name: "Эспрессо Смесь", category: "espresso", kg: 5, packs200: 0, subtotal: 9000 },
              { type: "drip", name: "Дрип Эфиопия", category: "filter", kg: 2, packs200: 0, subtotal: 2400 },
            ],
            total: 11400,
          },
        });
        assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(r.data)?.slice(0, 200)}`);
        assert(r.data?.orderId, "нет orderId в ответе");
        assert(r.data?.orderType === "wholesale", `orderType=${r.data?.orderType}`);
        assert(Number(r.data?.total) === 11400, `total=${r.data?.total} (ожидалось 11400)`);
        return `заказ ${r.data.orderId}, итого ${r.data.total} ₽`;
      },
    },
    {
      name: "Промокод (создание + проверка)",
      group: "Промо",
      run: async () => {
        const create = await http(base, "/promo-codes", {
          method: "POST",
          body: { code: promoCode, discountPercent: 15, active: true },
        });
        assert(create.status === 201, `создание HTTP ${create.status}`);
        const verify = await http(base, "/verify-promo", { method: "POST", body: { code: promoCode } });
        assert(verify.ok && verify.data?.valid === true, `проверка HTTP ${verify.status}: ${JSON.stringify(verify.data)?.slice(0, 160)}`);
        assert(Number(verify.data?.discountPercent) === 15, `скидка=${verify.data?.discountPercent}`);
        return `${promoCode} — скидка 15%`;
      },
    },
  ];
}

/** Read-only проверки живого прод-API (без побочных эффектов). */
function prodScenarios(base) {
  return [
    {
      name: "Прод: API отвечает (health)",
      group: "Прод (live)",
      run: async () => {
        const r = await http(base, "/health");
        assert(r.ok && r.data?.ok === true, `health вернул ${r.status}`);
        return "ok";
      },
    },
    {
      name: "Прод: каталог розницы отдаётся",
      group: "Прод (live)",
      run: async () => {
        const r = await http(base, "/retail/products");
        assert(r.ok && Array.isArray(r.data), `HTTP ${r.status}`);
        return `${r.data.length} товаров`;
      },
    },
    {
      name: "Прод: каталог опта отдаётся",
      group: "Прод (live)",
      run: async () => {
        const r = await http(base, "/coffee-items");
        assert(r.ok && Array.isArray(r.data), `HTTP ${r.status}`);
        return `${r.data.length} позиций`;
      },
    },
  ];
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Внешние (из workflow) статусы сборки/юнит-тестов как отдельные пункты отчёта. */
function externalResults() {
  const map = { ok: true, fail: false };
  const out = [];
  const unit = (process.env.UNIT_TESTS_RESULT || "").toLowerCase();
  const build = (process.env.FRONTEND_BUILD_RESULT || "").toLowerCase();
  if (unit && unit !== "skip") {
    out.push({ name: "Юнит-тесты (vitest)", group: "Код", ok: map[unit] === true, ms: 0, error: unit === "fail" ? "npm test завершился с ошибкой" : undefined });
  }
  if (build && build !== "skip") {
    out.push({ name: "Сборка фронтенда (vite build)", group: "Код", ok: map[build] === true, ms: 0, error: build === "fail" ? "npm run build завершился с ошибкой" : undefined });
  }
  return out;
}

function buildReport(results) {
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  const dateStr = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });

  const lines = [];
  if (failed.length === 0) {
    lines.push(`✅ <b>Кофе Нечай — ежедневная проверка: всё работает</b>`);
    lines.push(`Пройдено сценариев: <b>${passed.length}/${results.length}</b>`);
  } else {
    lines.push(`❗️ <b>Кофе Нечай — ежедневная проверка: есть проблемы</b>`);
    lines.push(`Провалено: <b>${failed.length}/${results.length}</b>`);
    lines.push("");
    lines.push("<b>Где именно упало:</b>");
    for (const r of failed) {
      lines.push(`• ❌ [${escapeHtml(r.group)}] ${escapeHtml(r.name)} — ${escapeHtml(r.error || "ошибка")}`);
    }
  }
  lines.push("");
  lines.push("<b>Все сценарии:</b>");
  for (const r of results) {
    const icon = r.ok ? "✅" : "❌";
    const info = r.ok ? (r.detail ? ` — ${escapeHtml(r.detail)}` : "") : ` — ${escapeHtml(r.error || "ошибка")}`;
    lines.push(`${icon} ${escapeHtml(r.name)}${info}`);
  }
  lines.push("");
  lines.push(`🕒 ${escapeHtml(dateStr)} (МСК)`);

  const html = lines.join("\n");
  const plain = html.replace(/<[^>]+>/g, "");
  return { html, plain, failed };
}

async function maybeSendTelegram(html) {
  if (!SEND_TELEGRAM) return { skipped: true, reason: "SMOKE_SEND_TELEGRAM!=1" };
  try {
    const mod = await import("../server/src/telegram.js");
    const r = await mod.sendTelegramHtml(html);
    return r;
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function main() {
  const scenarios = [...functionalScenarios(SMOKE_BASE_URL)];
  if (PROD_BASE_URL) scenarios.push(...prodScenarios(PROD_BASE_URL));

  const results = [];
  for (const s of scenarios) {
    const res = await runCheck(s.name, s.group, s.run);
    results.push(res);
    const icon = res.ok ? "PASS" : "FAIL";
    console.log(`[${icon}] ${res.name}${res.ok ? (res.detail ? ` — ${res.detail}` : "") : ` — ${res.error}`} (${res.ms}ms)`);
  }
  results.push(...externalResults());

  const report = buildReport(results);
  console.log("\n" + report.plain);

  fs.writeFileSync(path.join(repoRoot, "smoke-report.txt"), report.plain, "utf-8");
  fs.writeFileSync(
    path.join(repoRoot, "smoke-report.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
    "utf-8",
  );

  const tg = await maybeSendTelegram(report.html);
  if (SEND_TELEGRAM) {
    if (tg?.ok) console.log("[telegram] отчёт отправлен");
    else console.error("[telegram] не отправлен:", JSON.stringify(tg)?.slice(0, 300));
  }

  process.exit(report.failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal smoke runner error:", e);
  process.exit(2);
});
