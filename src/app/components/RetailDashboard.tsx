import { useState, useEffect, useMemo } from 'react';
import { RetailOrder } from '../types/index';
import { fetchRetailOrdersAdmin } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { TrendingUp, ShoppingBag, CreditCard, Package } from 'lucide-react@0.454.0';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { FadeIn } from './ui/fade-in';

const COLORS = {
  orange: '#F47D37',
  blue: '#93ADDA',
  purple: '#B6ABD4',
};

// ─── Custom SVG Line Chart ────────────────────────────────────────────────────
interface LineItem { date: string; value: number; label: string }

function CustomLineChart({ data, color, formatY }: { data: LineItem[]; color: string; formatY: (v: number) => string }) {
  const W = 600;
  const H = 200;
  const PAD = { top: 12, right: 16, bottom: 32, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const YTICKS = 4;

  const xScale = (i: number) => data.length <= 1 ? chartW / 2 : (i / (data.length - 1)) * chartW;
  const yScale = (v: number) => chartH - (v / maxVal) * chartH;

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.value)}`).join(' ');

  // Show x-axis labels sparsely to avoid overlap
  const maxLabels = 8;
  const step = data.length <= maxLabels ? 1 : Math.ceil(data.length / maxLabels);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minHeight: 160 }}
        aria-hidden="true"
      >
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Y grid lines + labels */}
          {Array.from({ length: YTICKS + 1 }, (_, i) => {
            const v = (maxVal / YTICKS) * i;
            const y = yScale(v);
            return (
              <g key={`y-${i}`}>
                <line x1={0} y1={y} x2={chartW} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                <text x={-6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#9ca3af">
                  {formatY(v)}
                </text>
              </g>
            );
          })}

          {/* Line */}
          {data.length > 1 && (
            <polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Dots */}
          {data.map((d, i) => (
            <circle key={`dot-${i}-${d.date}`} cx={xScale(i)} cy={yScale(d.value)} r={3} fill={color} />
          ))}

          {/* X-axis labels */}
          {data.map((d, i) => {
            if (i % step !== 0 && i !== data.length - 1) return null;
            return (
              <text
                key={`xl-${i}-${d.date}`}
                x={xScale(i)}
                y={chartH + 18}
                textAnchor="middle"
                fontSize={10}
                fill="#9ca3af"
              >
                {d.label}
              </text>
            );
          })}

          {/* Hover tooltips via title (native SVG) */}
          {data.map((d, i) => (
            <rect
              key={`hit-${i}-${d.date}`}
              x={xScale(i) - 10}
              y={0}
              width={20}
              height={chartH}
              fill="transparent"
            >
              <title>{`${d.label}: ${formatY(d.value)}`}</title>
            </rect>
          ))}
        </g>
      </svg>
    </div>
  );
}

// ─── Custom Horizontal Bar Chart ──────────────────────────────────────────────
function HBarChart({ data }: { data: { name: string; value: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k ₽` : `${v} ₽`;

  return (
    <div className="space-y-3 py-2">
      {data.map((item, idx) => (
        <div key={`hbar-${idx}-${item.name}`} className="space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="text-foreground truncate max-w-[60%]" title={item.name}>{item.name}</span>
            <span className="text-muted-foreground ml-2 shrink-0">{fmt(item.value)}</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(item.value / maxVal) * 100}%`, backgroundColor: COLORS.purple }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function RetailDashboard() {
  const [orders, setOrders] = useState<RetailOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Loading retail orders...');
      const all = await fetchRetailOrdersAdmin();
      setOrders(all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      console.log('✅ Retail orders loaded:', all.length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Failed to load retail orders:', msg);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!dateFrom) return orders;
    const start = startOfDay(new Date(dateFrom));
    const end = dateTo ? endOfDay(new Date(dateTo)) : endOfDay(new Date(dateFrom));
    return orders.filter(o => isWithinInterval(new Date(o.date), { start, end }));
  }, [orders, dateFrom, dateTo]);

  const kpi = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((s, o) => s + o.total, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalItems = filteredOrders.reduce((s, o) => s + o.items.reduce((is, i) => is + i.quantity, 0), 0);
    return { totalOrders, totalRevenue, avgOrderValue, totalItems };
  }, [filteredOrders]);

  // Aggregate by yyyy-MM-dd (unique key) to avoid duplicate entries
  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; label: string; revenue: number; count: number }>();
    filteredOrders.forEach(o => {
      const dk = format(new Date(o.date), 'yyyy-MM-dd');
      const lbl = format(new Date(o.date), 'dd MMM', { locale: ru });
      const cur = map.get(dk) || { date: dk, label: lbl, revenue: 0, count: 0 };
      map.set(dk, { ...cur, revenue: cur.revenue + o.total, count: cur.count + 1 });
    });
    return Array.from(map.values());
  }, [filteredOrders]);

  const revenueLineData: LineItem[] = chartData.map(d => ({ date: d.date, value: d.revenue, label: d.label }));
  const countLineData: LineItem[] = chartData.map(d => ({ date: d.date, value: d.count, label: d.label }));

  const productData = useMemo(() => {
    const map = new Map<string, number>();
    filteredOrders.forEach(o => {
      o.items.forEach(item => {
        const k = item.name || 'Неизвестный товар';
        map.set(k, (map.get(k) || 0) + item.subtotal);
      });
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredOrders]);

  const setPreset = (days: number) => {
    setDateFrom(format(subDays(new Date(), days), 'yyyy-MM-dd'));
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
  };

  const fmtRub = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;

  return (
    <div className="space-y-8">
      {error && (
        <div className="border border-red-200 rounded-lg p-6 bg-red-50 space-y-3">
          <p className="text-red-900 font-medium">❌ Ошибка загрузки данных</p>
          <p className="text-red-700 text-sm whitespace-pre-line">{error}</p>
          <Button onClick={loadOrders} variant="outline" size="sm" className="border-red-300 hover:bg-red-100">
            Попробовать снова
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="p-8 text-center text-muted-foreground">Загрузка статистики...</div>
      )}

      {!isLoading && (
        <>
          {/* Header & Filter */}
          <FadeIn>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-foreground mb-1">Статистика розничных продаж</h2>
                <p className="text-muted-foreground text-sm">Анализ заказов за выбранный период</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreset(7)}>7 дней</Button>
                  <Button variant="outline" size="sm" onClick={() => setPreset(30)}>30 дней</Button>
                  <Button variant="outline" size="sm" onClick={() => setPreset(90)}>90 дней</Button>
                </div>
                <div className="flex gap-2">
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full sm:w-auto" />
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full sm:w-auto" />
                </div>
              </div>
            </div>
          </FadeIn>

          {/* KPI Cards */}
          <FadeIn delay={0.1}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Всего заказов</CardTitle>
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{kpi.totalOrders}</div>
                  <p className="text-xs text-muted-foreground mt-1">За выбранный период</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Общая выручка</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{kpi.totalRevenue.toLocaleString('ru-RU')} ₽</div>
                  <p className="text-xs text-muted-foreground mt-1">Сумма всех заказов</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Средний чек</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{kpi.avgOrderValue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</div>
                  <p className="text-xs text-muted-foreground mt-1">На один заказ</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Всего товаров</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{kpi.totalItems}</div>
                  <p className="text-xs text-muted-foreground mt-1">Единиц товара продано</p>
                </CardContent>
              </Card>
            </div>
          </FadeIn>

          {/* Charts */}
          <FadeIn delay={0.2}>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Revenue Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle>Выручка по дням</CardTitle>
                  <CardDescription>Динамика дохода за выбранный период</CardDescription>
                </CardHeader>
                <CardContent>
                  {revenueLineData.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                      Нет данных за выбранный период
                    </div>
                  ) : (
                    <CustomLineChart
                      data={revenueLineData}
                      color={COLORS.orange}
                      formatY={fmtRub}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Orders Count Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle>Количество заказов</CardTitle>
                  <CardDescription>Динамика количества заказов</CardDescription>
                </CardHeader>
                <CardContent>
                  {countLineData.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                      Нет данных за выбранный период
                    </div>
                  ) : (
                    <CustomLineChart
                      data={countLineData}
                      color={COLORS.blue}
                      formatY={(v) => String(Math.round(v))}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Top Products */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Топ-5 продуктов</CardTitle>
                  <CardDescription>Самые продаваемые товары за период</CardDescription>
                </CardHeader>
                <CardContent>
                  {productData.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                      Нет данных за выбранный период
                    </div>
                  ) : (
                    <HBarChart data={productData} />
                  )}
                </CardContent>
              </Card>
            </div>
          </FadeIn>
        </>
      )}
    </div>
  );
}
