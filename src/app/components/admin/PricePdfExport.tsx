import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { FileDown, Loader2 } from 'lucide-react';
import { fetchCoffeeItems, fetchCategoryOrder } from '../../lib/api';
import type { CoffeeItem } from '../../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const BADGE_LABELS: Record<string, string> = {
  new: 'Новинка',
  hit: 'Хит',
  rare: 'Редкий',
  favorite: 'Любимый',
  soldout: 'Sold out',
  comingsoon: 'Скоро',
};

const BADGE_STYLES: Record<string, string> = {
  new:        'background:#dbeafe;color:#1d4ed8;',
  hit:        'background:#fef3c7;color:#d97706;',
  rare:       'background:#e0e7ff;color:#4338ca;',
  favorite:   'background:#ffedd5;color:#c2410c;',
  soldout:    'background:#f1f5f9;color:#64748b;',
  comingsoon: 'background:#f3e8ff;color:#7c3aed;',
};

function calcPrice(price: number, discount: number): number {
  if (!discount) return price;
  return Math.round(price * (1 - discount / 100));
}

function fmt(price: number): string {
  return price.toLocaleString('ru-RU') + '\u00a0₽';
}

function renderRow(item: CoffeeItem, discount: number): string {
  const badge = item.badge
    ? `<div style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:600;margin-bottom:3px;${BADGE_STYLES[item.badge] || ''}">${BADGE_LABELS[item.badge] || ''}</div><br/>`
    : '';

  const p1 = fmt(calcPrice(item.price_kg, discount));
  const p2 = fmt(calcPrice(item.price_200, discount));

  return `
    <tr>
      <td style="padding:8px 8px;vertical-align:top;border-bottom:1px solid #f1f5f9;">
        ${badge}
        <span style="font-size:10px;color:#1a1a1a;">${item.name}</span>
      </td>
      <td style="padding:8px 8px;vertical-align:top;border-bottom:1px solid #f1f5f9;font-size:10px;color:#374151;">${item.process || '—'}</td>
      <td style="padding:8px 8px;vertical-align:top;border-bottom:1px solid #f1f5f9;font-size:10px;color:#374151;">${item.descriptors || '—'}</td>
      <td style="padding:8px 8px;vertical-align:top;border-bottom:1px solid #f1f5f9;font-size:10px;color:#374151;text-align:center;">${item.qScore || '—'}</td>
      <td style="padding:8px 8px;vertical-align:top;border-bottom:1px solid #f1f5f9;font-size:10px;color:#1a1a1a;text-align:right;font-weight:500;white-space:nowrap;">${p1}</td>
      <td style="padding:8px 8px;vertical-align:top;border-bottom:1px solid #f1f5f9;font-size:10px;color:#1a1a1a;text-align:right;font-weight:500;white-space:nowrap;">${p2}</td>
    </tr>`;
}

function renderSection(
  title: string,
  items: CoffeeItem[],
  discount: number,
  col1: string,
  col2: string
): string {
  if (items.length === 0) return '';
  return `
    <div style="margin-bottom:28px;">
      <div style="background:#FFF4E5;border-left:3px solid #F47D37;padding:7px 12px;margin-bottom:0;font-size:12px;font-weight:600;color:#1a1a1a;">
        ${title}
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
        <thead>
          <tr style="background:#f8f9fa;">
            <th style="text-align:left;padding:8px 8px;font-size:9px;font-weight:500;color:#64748b;border-bottom:2px solid #e2e8f0;min-width:160px;">Название</th>
            <th style="text-align:left;padding:8px 8px;font-size:9px;font-weight:500;color:#64748b;border-bottom:2px solid #e2e8f0;width:100px;">Обработка</th>
            <th style="text-align:left;padding:8px 8px;font-size:9px;font-weight:500;color:#64748b;border-bottom:2px solid #e2e8f0;width:190px;">Дескрипторы</th>
            <th style="text-align:center;padding:8px 8px;font-size:9px;font-weight:500;color:#64748b;border-bottom:2px solid #e2e8f0;width:60px;">Оценка&nbsp;Q</th>
            <th style="text-align:right;padding:8px 8px;font-size:9px;font-weight:500;color:#64748b;border-bottom:2px solid #e2e8f0;width:120px;">${col1}</th>
            <th style="text-align:right;padding:8px 8px;font-size:9px;font-weight:500;color:#64748b;border-bottom:2px solid #e2e8f0;width:120px;">${col2}</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => renderRow(i, discount)).join('')}
        </tbody>
      </table>
    </div>`;
}

function buildHtml(items: CoffeeItem[], discount: number, categoryOrder: string[]): string {
  const published = items.filter(i => i.published !== false);
  const grain = published.filter(i => i.type === 'grain');
  const drip  = published.filter(i => i.type === 'drip');
  const coldBrew = published.filter(i => i.type === 'coldbrew');
  const dateStr = format(new Date(), 'd MMMM yyyy', { locale: ru });

  // ─── Зерновой кофе: группируем по категориям согласно порядку ────────────
  const grainByCategory = new Map<string, CoffeeItem[]>();
  for (const item of grain) {
    const cat = item.category || 'Без категории';
    if (!grainByCategory.has(cat)) grainByCategory.set(cat, []);
    grainByCategory.get(cat)!.push(item);
  }

  // Сортируем категории по заданному порядку, остальные — в конец
  const sortedCats = [
    ...categoryOrder.filter(c => grainByCategory.has(c)),
    ...[...grainByCategory.keys()].filter(c => !categoryOrder.includes(c)),
  ];

  const colHeader = (txt: string, align = 'left', width = '') =>
    `<th style="text-align:${align};padding:7px 12px;font-size:9px;font-weight:600;color:#64748b;border-bottom:2px solid #e2e8f0;${width ? `width:${width};` : ''}text-transform:uppercase;letter-spacing:0.4px;">${txt}</th>`;

  const tableHeader = `
    <thead>
      <tr style="background:#f8f9fa;">
        ${colHeader('Название', 'left')}
        ${colHeader('Обработка', 'left', '100px')}
        ${colHeader('Дескрипторы', 'left', '190px')}
        ${colHeader('Оценка&nbsp;Q', 'center', '58px')}
        ${colHeader('Цена за кг', 'right', '110px')}
        ${colHeader('Цена за 200&nbsp;г', 'right', '110px')}
      </tr>
    </thead>`;

  let grainBody = '';
  for (const cat of sortedCats) {
    const catItems = grainByCategory.get(cat)!;
    grainBody += `
      <tr>
        <td colspan="6" style="padding:7px 12px;background:#f0f4f8;font-size:8.5px;font-weight:700;color:#475569;letter-spacing:0.6px;text-transform:uppercase;border-bottom:1px solid #dde3eb;${grainBody ? 'border-top:2px solid #d1d9e6;' : ''}">
          ${cat}
        </td>
      </tr>`;
    grainBody += catItems.map(i => renderRow(i, discount)).join('');
  }

  const grainSection = grain.length === 0 ? '' : `
    <div style="margin-bottom:32px;">
      <div style="background:#FFF4E5;border-left:3px solid #F47D37;padding:7px 14px;margin-bottom:0;font-size:12px;font-weight:600;color:#1a1a1a;">
        Зерновой кофе
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
        ${tableHeader}
        <tbody>${grainBody}</tbody>
      </table>
    </div>`;

  const dripSection = renderSection('Дрипы', drip, discount, 'Цена за упак. (6\u00a0шт)', 'Цена за шт.');

  // Секция Колд брю — отдельная таблица с одной ценовой колонкой
  const coldBrewSection = coldBrew.length === 0 ? '' : (() => {
    const rows = coldBrew.map(item => {
      const badge = item.badge
        ? `<div style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:600;margin-bottom:3px;${BADGE_STYLES[item.badge] || ''}">${BADGE_LABELS[item.badge] || ''}</div><br/>`
        : '';
      const p = fmt(calcPrice(item.price_kg, item.no_discount ? 0 : discount));
      return `
        <tr>
          <td style="padding:8px 8px;vertical-align:top;border-bottom:1px solid #f1f5f9;">
            ${badge}
            <span style="font-size:10px;color:#1a1a1a;">${item.name}</span>
          </td>
          <td style="padding:8px 8px;vertical-align:top;border-bottom:1px solid #f1f5f9;font-size:10px;color:#1a1a1a;text-align:right;font-weight:500;white-space:nowrap;">${p}</td>
        </tr>`;
    }).join('');
    return `
      <div style="margin-bottom:28px;">
        <div style="background:#e0f7fa;border-left:3px solid #00acc1;padding:7px 12px;margin-bottom:0;font-size:12px;font-weight:600;color:#1a1a1a;">
          Колд брю
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="text-align:left;padding:8px 8px;font-size:9px;font-weight:500;color:#64748b;border-bottom:2px solid #e2e8f0;">Название</th>
              <th style="text-align:right;padding:8px 8px;font-size:9px;font-weight:500;color:#64748b;border-bottom:2px solid #e2e8f0;width:120px;">Цена за 5\u00a0л</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  })();

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <title>Прайс-лист НЕЧАЙ</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 22mm 16mm 22mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 10px;
      color: #1a1a1a;
      background: #fff;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 14px;
      margin-bottom: 22px;
      border-bottom: 2px solid #F47D37;
    }
    .logo-wrap { display: flex; align-items: center; gap: 10px; }
    .logo { height: 34px; width: auto; }
    .logo-fallback {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #1a1a1a;
    }
    .header-right { text-align: right; }
    .price-title { font-size: 17px; font-weight: 700; color: #1a1a1a; }
    .price-sub   { font-size: 9px;  color: #64748b; margin-top: 3px; }
    .footer {
      margin-top: 22px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 8.5px;
      color: #94a3b8;
      text-align: center;
    }
    tr:nth-child(even) td { background: #fafafa; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tr { break-inside: avoid; }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-wrap">
      <img
        class="logo"
        src="https://static.tildacdn.com/tild6163-6438-4039-b766-333133303937/logo.svg"
        alt="НЕЧАЙ"
        onerror="this.style.display='none';document.getElementById('logo-text').style.display='block';"
      />
      <span id="logo-text" class="logo-fallback" style="display:none;">НЕЧАЙ</span>
    </div>
    <div class="header-right">
      <div class="price-title">Прайс-лист</div>
      <div class="price-sub">${dateStr}</div>
    </div>
  </div>

  ${grainSection}
  ${dripSection}
  ${coldBrewSection}

  <div class="footer">
    nechai.ru &nbsp;·&nbsp; Оптовый прайс-лист &nbsp;·&nbsp; Цены действительны на ${dateStr}
  </div>
</body>
</html>`;
}

export function PricePdfExport() {
  const [open, setOpen]       = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, categoryOrder] = await Promise.all([
        fetchCoffeeItems(),
        fetchCategoryOrder(),
      ]);
      const html  = buildHtml(items, discount, categoryOrder);

      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) {
        setError('Браузер заблокировал открытие нового окна. Разрешите всплывающие окна и попробуйте снова.');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();

      setTimeout(() => {
        win.focus();
        win.print();
      }, 900);

      setOpen(false);
    } catch (e) {
      setError('Не удалось загрузить прайс. Попробуйте ещё раз.');
      console.error('PricePdfExport error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2"
      >
        <FileDown className="w-4 h-4" />
        <span className="hidden sm:inline">Скачать прайс</span>
        <span className="sm:hidden">Прайс PDF</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-[#F47D37]" />
              Скачать прайс-лист
            </DialogTitle>
            <DialogDescription>
              Выберите скидку — цены будут пересчитаны автоматически.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <p className="text-sm text-muted-foreground">
              Укажите скидку от базовой стоимости. Итоговые цены будут рассчитаны автоматически — скидка в PDF отображаться не будет.
            </p>

            <div className="space-y-2">
              <Label htmlFor="pdf-discount" className="text-sm font-medium">
                Скидка от базовой цены
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="pdf-discount"
                  type="number"
                  min={0}
                  max={80}
                  step={1}
                  value={discount}
                  onChange={e => setDiscount(Math.min(80, Math.max(0, Number(e.target.value))))}
                  className="w-28 text-center text-lg font-semibold"
                />
                <span className="text-lg font-semibold text-muted-foreground">%</span>
              </div>
              {discount > 0 && (
                <p className="text-xs text-[#F47D37]">
                  Цены в прайсе будут снижены на {discount}% от базовых
                </p>
              )}
              {discount === 0 && (
                <p className="text-xs text-muted-foreground">
                  Базовые цены без скидки
                </p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
              <div className="font-medium text-foreground text-sm">Что войдёт в прайс:</div>
              <div>· Логотип НЕЧАЙ + дата составления</div>
              <div>· Зерновой кофе и д��ипы (опубликованные позиции)</div>
              <div>· Название, обработка, дескрипторы, оценка Q, цены</div>
              <div>· Откроется диалог «Печать» — сохраните как PDF</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-[#F47D37] hover:bg-[#d96a2a] text-white"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Загрузка...</>
              ) : (
                <><FileDown className="w-4 h-4 mr-2" />Открыть PDF</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}