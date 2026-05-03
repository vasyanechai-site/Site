#!/usr/bin/env node
/**
 * Один старт для «посмотреть сайт у себя»: проверка .env + API + Vite.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runShell(command) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`код ${code}`))));
    p.on("error", reject);
  });
}

console.log("\n═══ Кофе Нечай — локальный запуск ═══\n");
console.log("Сейчас проверю .env, затем подниму сервер данных и сайт.\n");
console.log("Когда в блоке [web] появится «Local:» — откройте ЭТОТ адрес в браузере.\n");
console.log("   Обычно http://localhost:5173 — если порт занят, будет 5174 или другой.\n");
console.log("Остановить всё: в этом окне нажмите Ctrl+C\n");

try {
  await runShell("npm run env:check");
} catch {
  console.log("\n(env:check завершился с ошибкой — откройте НАЧАЛО-БЕЗ-КОДА.md, раздел про .env)\n");
}

await runShell("npm run dev:stack");
