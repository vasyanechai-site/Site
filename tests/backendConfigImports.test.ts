import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '..', 'src', 'app');

/**
 * Регрессионный тест на баг «Can't find variable: API_BASE_URL».
 *
 * `vite build` НЕ ловит использование необъявленной глобальной переменной
 * (esbuild считает её глобалом), поэтому такой баг доходил до рантайма и
 * ронял оформление заказа. Этот тест статически проверяет, что каждый файл,
 * который использует экспорт из backendConfig, реально его импортирует.
 */
const GUARDED_EXPORTS = ['API_BASE_URL', 'API_AUTH_HEADER'] as const;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = walk(appDir).filter((f) => !f.endsWith(path.join('lib', 'backendConfig.ts')));

describe('backendConfig usage requires an import', () => {
  for (const name of GUARDED_EXPORTS) {
    it(`every file using ${name} imports it from backendConfig`, () => {
      const offenders: string[] = [];
      const usageRe = new RegExp(`\\b${name}\\b`);
      const importRe = new RegExp(`import[^;]*\\b${name}\\b[^;]*from\\s+['\"][^'\"]*backendConfig['\"]`);

      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        if (!usageRe.test(content)) continue;
        if (!importRe.test(content)) {
          offenders.push(path.relative(appDir, file));
        }
      }

      expect(
        offenders,
        `Файлы используют ${name}, но не импортируют его из backendConfig: ${offenders.join(', ')}`,
      ).toEqual([]);
    });
  }

  it('RetailStorefront imports both API_BASE_URL and API_AUTH_HEADER', () => {
    const file = path.join(appDir, 'components', 'RetailStorefront.tsx');
    const content = fs.readFileSync(file, 'utf-8');
    expect(content).toMatch(/import\s*\{[^}]*API_BASE_URL[^}]*\}\s*from\s*['"][^'"]*backendConfig['"]/);
    expect(content).toMatch(/import\s*\{[^}]*API_AUTH_HEADER[^}]*\}\s*from\s*['"][^'"]*backendConfig['"]/);
  });
});
