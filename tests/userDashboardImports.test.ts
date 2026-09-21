import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/app/components/UserDashboard.tsx',
);

/**
 * «Моя статистика» падала белым экраном: компонент использовал хуки и UI,
 * но Figma Make не записал import. Vite не считает это ошибкой сборки.
 */
const REQUIRED = [
  'useState',
  'useEffect',
  'useMemo',
  'Order',
  'fetchUserOrders',
  'fetchUserLoyalty',
  'format',
  'subDays',
  'startOfDay',
  'endOfDay',
  'isWithinInterval',
  'ru',
  'Card',
  'CardContent',
  'CardHeader',
  'CardTitle',
  'CardDescription',
  'Button',
  'Input',
  'CreditCard',
  'ShoppingBag',
  'TrendingUp',
  'ChevronRight',
  'Users',
];

function importedNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  for (const match of source.matchAll(/import\s+(\w+)\s+from/g)) {
    names.add(match[1]);
  }
  return names;
}

describe('UserDashboard statistics screen', () => {
  it('imports every symbol that the statistics screen uses', () => {
    const source = fs.readFileSync(file, 'utf8');
    const imported = importedNames(source);
    const missing = REQUIRED.filter((name) => !imported.has(name));
    expect(missing).toEqual([]);
  });
});
