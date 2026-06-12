import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Order } from '../types/index';
import { fetchOrdersAdmin } from '../lib/api';
import { wholesaleItemWeightKg } from '../lib/wholesaleUnits';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { TrendingUp, ShoppingBag, CreditCard, Users, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ServerDiagnostics } from './ServerDiagnostics';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { FadeIn } from './ui/fade-in';

// Brand colors
const CHART_COLORS = ['#93ADDA', '#F47D37', '#B6ABD4', '#F597A1', '#64748b'];

// ─── Custom Bar Chart (vertical) ────────────────────────────────────────────
interface BarItem { date: string; label: string; revenue: number; count: number }

function CustomBarChart({ data }: { data: BarItem[] }) {
  const maxVal = Math.max(...data.map(d => d.revenue), 1);
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    Math.round((maxVal / (tickCount - 1)) * i)
  );

  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `${v}`;

  return (
    <div className="flex flex-col h-full">
      {/* Chart area */}
      <div className="flex flex-1 gap-1 items-end overflow-x-auto pb-6 relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between items-end pr-2 w-12 text-[10px] text-muted-foreground select-none">
          {[...ticks].reverse().map((t, i) => (
            <span key={`ytick-${i}-${t}`}>{fmt(t)}</span>
          ))}
        </div>
        {/* Bars */}
        <div className="flex-1 flex items-end gap-1 ml-12 h-full relative">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {ticks.map((t, i) => (
              <div key={`gridline-${i}-${t}`} className="border-t border-gray-100 w-full" />
            ))}
          </div>
          {/* Bar columns */}
          {data.map((d, i) => {
            const pct = maxVal > 0 ? (d.revenue / maxVal) * 100 : 0;
            return (
              <div
                key={`bar-col-${i}-${d.date}`}
                className="flex-1 flex flex-col items-center justify-end gap-1 group relative"
                style={{ minWidth: 4 }}
              >
                <div className="w-full relative">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(pct, pct > 0 ? 2 : 0)}px`,
                      maxHeight: '200px',
                      minHeight: pct > 0 ? '3px' : '0px',
                      backgroundColor: CHART_COLORS[0],
                    }}
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 whitespace-nowrap bg-white border border-gray-200 rounded px-2 py-1 text-xs shadow-md">
                    <div className="font-medium">{d.label}</div>
                    <div>{d.revenue.toLocaleString('ru-RU')} ₽</div>
                    <div className="text-muted-foreground">{d.count} заказов</div>
                  </div>
                </div>
                {/* X-axis label */}
                <div
                  className="absolute -bottom-6 text-[9px] text-muted-foreground text-center"
                  style={{ fontSize: '9px', lineHeight: '12px', maxWidth: 36, overflow: 'hidden' }}
                >
                  {data.length <= 15 ? d.label : (i % Math.ceil(data.length / 15) === 0 ? d.label : '')}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Custom Horizontal Bar Chart (for top products) ─────────────────────────
interface HBarItem { name: string; value: number; id: string }

function CustomHBarChart({ data }: { data: HBarItem[] }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `${v}`;

  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = (d.value / maxVal) * 100;
        return (
          <div key={d.id} className="flex items-center gap-3">
            <div className="w-36 text-sm text-right text-muted-foreground truncate flex-shrink-0">
              {d.name}
            </div>
            <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: CHART_COLORS[2] }}
              >
                <span className="text-xs font-medium text-white whitespace-nowrap">
                  {fmt(d.value)} ₽
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Custom Category Chart (segmented horizontal bar + legend) ──────────────
interface CatItem { name: string; value: number; id: string }

function CustomCategoryChart({ data }: { data: CatItem[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
      Нет данных за выбранный период
    </div>
  );

  return (
    <div className="flex flex-col gap-4 h-full justify-center">
      {/* Segmented bar */}
      <div className="flex h-10 rounded-lg overflow-hidden gap-px">
        {data.map((d, i) => (
          <div
            key={d.id}
            className="group relative flex-shrink-0 h-full"
            style={{ width: `${(d.value / total) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            title={`${d.name}: ${d.value.toLocaleString('ru-RU')} ₽`}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 whitespace-nowrap bg-white border border-gray-200 rounded px-2 py-1 text-xs shadow-md">
              <div className="font-medium">{d.name}</div>
              <div>{d.value.toLocaleString('ru-RU')} ₽</div>
              <div className="text-muted-foreground">{((d.value / total) * 100).toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        {data.map((d, i) => (
          <div key={d.id} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <div className="truncate">
              <span className="text-muted-foreground">{d.name}</span>
              <span className="ml-1 font-medium text-xs">
                {((d.value / total) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
      {/* Values list */}
      <div className="space-y-1 mt-2">
        {data.map((d, i) => (
          <div key={d.id} className="flex justify-between text-sm">
            <span className="text-muted-foreground truncate">{d.name}</span>
            <span className="font-medium ml-2">{d.value.toLocaleString('ru-RU')} ₽</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const allOrders = await fetchOrdersAdmin();
      setOrders(allOrders.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Загрузка при монтировании
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Автообновление каждые 2 минуты
  useEffect(() => {
    const interval = setInterval(() => {
      loadOrders();
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    if (!dateFrom) return orders;
    // Добавляем 'T00:00:00' чтобы дата парсилась в локальной timezone, а не UTC
    const start = startOfDay(new Date(dateFrom + 'T00:00:00'));
    const end = dateTo ? endOfDay(new Date(dateTo + 'T00:00:00')) : endOfDay(new Date(dateFrom + 'T00:00:00'));
    return orders.filter(o => isWithinInterval(new Date(o.date), { start, end }));
  }, [orders, dateFrom, dateTo]);

  const kpiStats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((s, o) => s + o.total, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalItems = filteredOrders.reduce((s, o) =>
      s + o.items.reduce((is, i) => is + wholesaleItemWeightKg(i as any), 0), 0);
    return { totalOrders, totalRevenue, avgOrderValue, totalItems };
  }, [filteredOrders]);

  const chartData = useMemo((): BarItem[] => {
    if (filteredOrders.length === 0) return [];
    const map = new Map<string, BarItem>();
    filteredOrders.forEach(o => {
      const d = new Date(o.date);
      const key = format(d, 'yyyy-MM-dd');
      const label = format(d, 'dd MMM', { locale: ru });
      const cur = map.get(key) ?? { date: key, label, revenue: 0, count: 0 };
      map.set(key, { ...cur, revenue: cur.revenue + o.total, count: cur.count + 1 });
    });
    return Array.from(map.values());
  }, [filteredOrders]);

  const categoryData = useMemo((): CatItem[] => {
    const map = new Map<string, number>();
    filteredOrders.forEach(o => o.items.forEach(item => {
      const cat = item.category || 'Без категории';
      map.set(cat, (map.get(cat) ?? 0) + item.subtotal);
    }));
    return Array.from(map.entries())
      .map(([name, value], i) => ({ name, value, id: `cat-${i}-${name}` }))
      .sort((a, b) => b.value - a.value);
  }, [filteredOrders]);

  const productData = useMemo((): HBarItem[] => {
    const map = new Map<string, number>();
    filteredOrders.forEach(o => o.items.forEach(item => {
      const k = item.name || 'Без названия';
      map.set(k, (map.get(k) ?? 0) + item.subtotal);
    }));
    return Array.from(map.entries())
      .map(([name, value], i) => ({ name, value, id: `prod-${i}-${name}` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredOrders]);

  const setPresetRange = (days: number) => {
    setDateFrom(format(subDays(new Date(), days), 'yyyy-MM-dd'));
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
    // Также обновляем данные при смене диапазона
    loadOrders();
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Ошибка загрузки данных</AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="whitespace-pre-line">{error}</p>
              <Button onClick={loadOrders} variant="outline" size="sm" className="mt-2">
                Попробовать снова
              </Button>
            </AlertDescription>
          </Alert>
          <ServerDiagnostics />
        </div>
      )}

      {isLoading && (
        <div className="p-8 text-center text-muted-foreground">Загрузка статистики...</div>
      )}

      {!isLoading && (
        <>
          {/* Header & Filter */}
          <FadeIn>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Дашборд</h2>
                <p className="text-muted-foreground">Обзор продаж и активности за выбранный период</p>
                {lastUpdated && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Обновлено: {format(lastUpdated, 'dd.MM.yyyy HH:mm:ss', { locale: ru })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Кнопка ручного обновления */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadOrders}
                  disabled={isLoading}
                  className="flex items-center gap-1.5"
                  title="Обновить данные"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Обновить</span>
                </Button>
                <div className="hidden sm:flex gap-2 mr-2">
                  <Button variant="outline" size="sm" onClick={() => setPresetRange(7)}>7 дней</Button>
                  <Button variant="outline" size="sm" onClick={() => setPresetRange(30)}>30 дней</Button>
                  <Button variant="outline" size="sm" onClick={() => setPresetRange(90)}>3 месяца</Button>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="flex-1 sm:w-[150px]" />
                  <span className="text-muted-foreground">—</span>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="flex-1 sm:w-[150px]" />
                </div>
              </div>
            </div>
          </FadeIn>

          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FadeIn delay={0.1}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Общая выручка</span>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{kpiStats.totalRevenue.toLocaleString('ru-RU')} ₽</div>
                  <p className="text-xs text-muted-foreground mt-1">за выбранный период</p>
                </CardContent>
              </Card>
            </FadeIn>
            <FadeIn delay={0.2}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Количество заказов</span>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{kpiStats.totalOrders}</div>
                  <p className="text-xs text-muted-foreground mt-1">за выбранный период</p>
                </CardContent>
              </Card>
            </FadeIn>
            <FadeIn delay={0.3}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Средний чек</span>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{Math.round(kpiStats.avgOrderValue).toLocaleString('ru-RU')} ₽</div>
                  <p className="text-xs text-muted-foreground mt-1">средняя стоимость заказа</p>
                </CardContent>
              </Card>
            </FadeIn>
            <FadeIn delay={0.4}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Объём продаж</span>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{kpiStats.totalItems.toFixed(1)} кг</div>
                  <p className="text-xs text-muted-foreground mt-1">общий вес кофе</p>
                </CardContent>
              </Card>
            </FadeIn>
          </div>

          {/* Charts */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-7">
            {/* Revenue Chart */}
            <FadeIn delay={0.5} className="md:col-span-4">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Динамика выручки</CardTitle>
                  <CardDescription>Выручка по дням за выбранный период</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    {chartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                        Нет данных за выбранный период
                      </div>
                    ) : (
                      <CustomBarChart data={chartData} />
                    )}
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            {/* Category Distribution */}
            <FadeIn delay={0.6} className="md:col-span-3">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Продажи по категориям</CardTitle>
                  <CardDescription>Распределение выручки по типам кофе</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px] overflow-y-auto">
                    <CustomCategoryChart data={categoryData} />
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          </div>

          {/* Top Products */}
          <FadeIn delay={0.7}>
            <Card>
              <CardHeader>
                <CardTitle>Топ-5 продуктов</CardTitle>
                <CardDescription>Самые продаваемые позиции за период</CardDescription>
              </CardHeader>
              <CardContent>
                {productData.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                    Нет данных за выбранный период
                  </div>
                ) : (
                  <CustomHBarChart data={productData} />
                )}
              </CardContent>
            </Card>
          </FadeIn>
        </>
      )}
    </div>
  );
}