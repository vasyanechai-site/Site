#!/usr/bin/env node
/**
 * Упаковывает папку dist/ в архив site-dist-for-upload.zip в корне проекта.
 * Нужен системный `zip` (есть на macOS). Запуск: npm run zip:dist
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const zipPath = path.join(root, "site-dist-for-upload.zip");

if (!fs.existsSync(distDir)) {
  console.error("[zip-dist] Нет папки dist/. Сначала выполните: npm run build");
  process.exit(1);
}

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

try {
  execSync(`cd "${distDir}" && zip -q -r "${zipPath}" .`, { stdio: "inherit" });
} catch {
  console.error("[zip-dist] Команда zip не сработала. На Mac она есть по умолчанию.");
  process.exit(1);
}

const mb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
console.log("\n[zip-dist] Готово. Загрузите на хостинг этот файл:");
console.log("         ", zipPath);
console.log(`         (размер ~${mb} МБ)\n`);
console.log("На хостинге: распакуйте так, чтобы index.html оказался в корне сайта (или в папке,");
console.log("которую открывает домен — как вам скажет поддержка хостинга).\n");
