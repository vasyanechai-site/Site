#!/usr/bin/env node
/**
 * Пишет .vercel/project.json из env (для vercel env add в CI).
 * Нужны VERCEL_ORG_ID и VERCEL_PROJECT_ID (Settings → General в Vercel).
 */
import fs from "node:fs";
import path from "node:path";

const orgId = String(process.env.VERCEL_ORG_ID || "").trim();
const projectId = String(process.env.VERCEL_PROJECT_ID || "").trim();
if (!orgId || !projectId) {
  console.error("vercel-write-project-json: задайте VERCEL_ORG_ID и VERCEL_PROJECT_ID");
  process.exit(1);
}
const dir = path.join(process.cwd(), ".vercel");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify({ orgId, projectId }, null, 0));
console.log("Wrote .vercel/project.json");
