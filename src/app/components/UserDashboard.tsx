import { useEffect, useMemo, useState } from 'react';
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CreditCard, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { Order } from '../types';
import { fetchUserLoyalty, fetchUserOrders } from '../lib/api';
import { wholesaleItemWeightKg } from '../lib/wholesaleUnits';
import { FadeIn } from './ui/fade-in';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

// ─── LOYALTY WIDGET (inline) ─────────────────────────────────────────────────

const BRAND_ORANGE = '#F47D37';

const LOYALTY_LEVELS = [
  {
    level: 0, label: 'Случайный визит',    discount: 0,  color: '#222222',
    description: 'По умолчанию у всех новых клиентов.',
    conditions: [] as string[],
  },
  {
    level: 1, label: 'Нечайная встреча',   discount: 5,  color: BRAND_ORANGE,
    description: null as string | null,
    conditions: ['4 заказа за 3 месяца'],
  },
  {
    level: 2, label: 'Приятная нечайность',discount: 7,  color: BRAND_ORANGE,
    description: null as string | null,
    conditions: ['8 заказов за 6 месяцев', 'Отсутствие перерывов более 45 дней'],
  },
  {
    level: 3, label: 'Главный Нечай',      discount: 10, color: BRAND_ORANGE,
    description: null as string | null,
    conditions: ['12 заказов за 12 месяцев', 'Отсутствие перерывов более 40 дней'],
  },
];

interface LoyaltyWidgetProps {
  userId: string;
  orders: Order[];
  loyaltyInfo: {
    level: number;
    date: string;
    ordersIn3Mo: number;
    ordersIn6Mo: number;
    ordersIn12Mo: number;
    isManualOverride: boolean;
    nextLevel: { level: number; label: string; discount: number } | null;
  };
}

function LoyaltyWidget({ orders, loyaltyInfo }: LoyaltyWidgetProps) {
  const levelIndex = Number.isFinite(loyaltyInfo.level) ? loyaltyInfo.level : 0;
  const currentLevelData = LOYALTY_LEVELS[Math.min(Math.max(levelIndex, 0), LOYALTY_LEVELS.length - 1)];
  const isMaxLevel       = loyaltyInfo.level >= LOYALTY_LEVELS.length - 1;
  const nextLevelData    = !isMaxLevel ? LOYALTY_LEVELS[loyaltyInfo.level + 1] : null;

  // Прогресс к следующей ступени по количеству заказов
  const getProgress = () => {
    if (isMaxLevel || !nextLevelData) return 100;
    const lvl = loyaltyInfo.level;
    if (lvl === 0) return Math.min(100, (loyaltyInfo.ordersIn3Mo / 4) * 100);
    if (lvl === 1) return Math.min(100, (loyaltyInfo.ordersIn6Mo / 8) * 100);
    if (lvl === 2) return Math.min(100, (loyaltyInfo.ordersIn12Mo / 12) * 100);
    return 100;
  };

  const getProgressLabel = () => {
    if (isMaxLevel || !nextLevelData) return null;
    const lvl = loyaltyInfo.level;
    if (lvl === 0) return `${loyaltyInfo.ordersIn3Mo} / 4 заказа за 3 мес.`;
    if (lvl === 1) return `${loyaltyInfo.ordersIn6Mo} / 8 заказов за 6 мес.`;
    if (lvl === 2) return `${loyaltyInfo.ordersIn12Mo} / 12 заказов за 12 мес.`;
    return null;
  };

  const progress      = getProgress();
  const progressLabel = getProgressLabel();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Ступень лояльности</CardTitle>
          <p className="text-2xl font-bold mt-1">{currentLevelData.label}</p>
        </div>
        {currentLevelData.discount > 0 && (
          <p className="text-sm font-medium" style={{ color: BRAND_ORANGE }}>
            −{currentLevelData.discount}%
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">За 3 месяца</p>
              <p className="text-2xl font-bold">{loyaltyInfo.ordersIn3Mo} зак.</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Всего заказов</p>
              <p className="text-2xl font-bold">{orders.length}</p>
            </div>
          </div>

          {loyaltyInfo.isManualOverride && (
            <p className="text-xs text-muted-foreground">
              Ступень зафиксирована менеджером вручную
            </p>
          )}

          {!isMaxLevel && nextLevelData && progressLabel && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  До ступени{' '}
                  <span className="font-medium text-foreground">{nextLevelData.label}</span>
                </span>
                <span className="text-xs text-muted-foreground">{progressLabel}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progress}%`, backgroundColor: BRAND_ORANGE }}
                />
              </div>
            </div>
          )}

          {isMaxLevel && (
            <p className="text-xs text-muted-foreground">
              Вы на максимальной ступени — Главный Нечай
            </p>
          )}

          <Dialog>
            <DialogTrigger asChild>
              <button
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                Как перейти на следующую ступень?
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Система лояльности</DialogTitle>
                <DialogDescription>
                  Накопительная система скидок для постоянных клиентов
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                {LOYALTY_LEVELS.map((lvl) => {
                  return (
                    <div
                      key={lvl.level}
                      className="p-4 rounded-xl border transition-colors"
                      style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}
                    >
                      <p className="text-sm font-bold mb-1" style={{ color: lvl.level === 0 ? '#222222' : lvl.color }}>
                        Ступень {lvl.level} — {lvl.label} ({lvl.discount}%)
                      </p>
                      {lvl.description && (
                        <p className="text-sm text-[#444]">{lvl.description}</p>
                      )}
                      {lvl.conditions.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {lvl.conditions.map((cond, i) => (
                            <li key={i} className="text-sm text-[#444] flex items-start gap-1.5">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#444] flex-shrink-0" />
                              {cond}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                <p className="text-sm font-bold text-[#222222] pt-1">
                  При невыполнении условий ступень снижается на 1.
                </p>
                {currentLevelData.discount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <sup>*</sup> Цена, на которую не распространяется скидка
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Footnote */}
          {currentLevelData.discount > 0 && (
            <p className="text-xs text-muted-foreground">
              <sup>*</sup> Цена, на которую не распространяется скидка
            </p>
          )}
      </CardContent>
    </Card>
  );
}

// ─── BRAND COLOURS ────────────────────────────────────────────────────────────

const COLORS = {
  orange: '#F47D37',
  blue: '#93ADDA',
  purple: '#B6ABD4',
  pink: '#F597A1',
  slate: '#64748b'
};

const PIE_COLORS = [COLORS.orange, COLORS.blue, COLORS.purple, COLORS.pink];

// ─── Custom vertical bar chart (no recharts) ──────────────────────────────────
function CustomBarChart({ data }: { data: { date: string; revenue: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.revenue), 1);
  const YTICKS = 4;

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 gap-px items-end overflow-x-auto pb-5 relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-5 flex flex-col justify-between items-end pr-1 w-10 text-[10px] text-muted-foreground select-none pointer-events-none">
          {Array.from({ length: YTICKS + 1 }, (_, i) => {
            const v = (maxVal / YTICKS) * (YTICKS - i);
            return (
              <span key={`y-${i}`}>
                {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : Math.round(v)}
              </span>
            );
          })}
        </div>
        {/* Bars */}
        <div className="flex-1 flex items-end gap-px ml-10 h-[280px] relative">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {Array.from({ length: YTICKS + 1 }, (_, i) => (
              <div key={`grid-${i}`} className="border-t border-gray-100 w-full" />
            ))}
          </div>
          {data.map((d, i) => {
            const pct = maxVal > 0 ? (d.revenue / maxVal) * 100 : 0;
            const maxLabels = 10;
            const step = data.length <= maxLabels ? 1 : Math.ceil(data.length / maxLabels);
            let label = '';
            try { label = format(new Date(d.date), 'dd MMM', { locale: ru }); } catch {}
            return (
              <div
                key={`bar-${i}-${d.date}`}
                className="flex-1 flex flex-col items-center justify-end gap-0 group relative"
                style={{ minWidth: 4 }}
              >
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max(pct * 2.8, pct > 0 ? 2 : 0)}px`,
                    backgroundColor: COLORS.blue,
                  }}
                />
                {/* Hover tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 whitespace-nowrap bg-white border border-gray-200 rounded px-2 py-1 text-xs shadow-md">
                  <div className="font-medium">{label}</div>
                  <div>{d.revenue.toLocaleString('ru-RU')} ₽</div>
                </div>
                {/* X label */}
                {(i % step === 0 || i === data.length - 1) && (
                  <div className="absolute -bottom-5 text-[9px] text-muted-foreground text-center" style={{ fontSize: 9 }}>
                    {label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Custom Donut / Category chart (no recharts) ──────────────────────────────
function CustomPieChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item, idx) => (
        <div key={`cat-${idx}-${item.name}`} className="space-y-1">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
              <span className="text-foreground truncate max-w-[160px]" title={item.name}>{item.name}</span>
            </div>
            <span className="text-muted-foreground ml-2 shrink-0 text-xs">
              {item.value.toLocaleString('ru-RU')} ₽ · {Math.round((item.value / total) * 100)}%
            </span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(item.value / maxVal) * 100}%`, backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface UserDashboardProps {
  userId: string;
  currentDiscount: number; // Used for charts logic if needed
}

export function UserDashboard({ userId, currentDiscount }: UserDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loyaltyInfo, setLoyaltyInfo] = useState<{
    level: number;
    date: string;
    ordersIn3Mo: number;
    ordersIn6Mo: number;
    ordersIn12Mo: number;
    isManualOverride: boolean;
    nextLevel: { level: number; label: string; discount: number } | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const loadData = async () => {
        try {
            setIsLoading(true);
            const [userOrders, loyaltyData] = await Promise.all([
                fetchUserOrders(userId),
                fetchUserLoyalty(userId)
            ]);
            setOrders(userOrders.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
            
            setLoyaltyInfo({
                level: loyaltyData.loyaltyLevel,
                date: loyaltyData.loyaltyLevelSetDate,
                ordersIn3Mo: loyaltyData.ordersIn3Mo ?? 0,
                ordersIn6Mo: loyaltyData.ordersIn6Mo ?? 0,
                ordersIn12Mo: loyaltyData.ordersIn12Mo ?? 0,
                isManualOverride: loyaltyData.isManualOverride ?? false,
                nextLevel: loyaltyData.nextLevel ?? null,
            });
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, [userId]);

  // Filter orders by date range for Dashboard Charts
  const filteredOrders = useMemo(() => {
    if (!dateFrom) return orders;

    const start = startOfDay(new Date(dateFrom));
    const end = dateTo ? endOfDay(new Date(dateTo)) : endOfDay(new Date(dateFrom));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return orders;

    return orders.filter(order => {
      const orderDate = new Date(order.date);
      if (Number.isNaN(orderDate.getTime())) return false;
      return isWithinInterval(orderDate, { start, end });
    });
  }, [orders, dateFrom, dateTo]);

  // Calculate KPIs
  const kpiStats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalItems = filteredOrders.reduce((sum, order) =>
      sum + (Array.isArray(order.items) ? order.items : []).reduce((is, i) => is + wholesaleItemWeightKg(i as any), 0), 0
    );

    return {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      totalItems
    };
  }, [filteredOrders]);

  // Prepare Chart Data
  const chartData = useMemo(() => {
    if (filteredOrders.length === 0) return [];

    const dataMap = new Map<string, { date: string; revenue: number; count: number }>();

    filteredOrders.forEach(order => {
      const orderDate = new Date(order.date);
      if (Number.isNaN(orderDate.getTime())) return;
      const dateKey = format(orderDate, 'yyyy-MM-dd');
      const current = dataMap.get(dateKey) || { date: dateKey, revenue: 0, count: 0 };

      dataMap.set(dateKey, {
        date: dateKey,
        revenue: current.revenue + (Number(order.total) || 0),
        count: current.count + 1
      });
    });

    return Array.from(dataMap.values());
  }, [filteredOrders]);

  const categoryData = useMemo(() => {
    const catMap = new Map<string, number>();

    filteredOrders.forEach(order => {
      (Array.isArray(order.items) ? order.items : []).forEach(item => {
        const category = item.category || 'Без категории';
        const current = catMap.get(category) || 0;
        catMap.set(category, current + (Number(item.subtotal) || 0));
      });
    });

    return Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredOrders]);

  const setPresetRange = (days: number) => {
    setDateFrom(format(subDays(new Date(), days), 'yyyy-MM-dd'));
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
  };


  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Загрузка статистики...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Loyalty Section */}
      {loyaltyInfo && (
        <LoyaltyWidget userId={userId} orders={orders} loyaltyInfo={loyaltyInfo} />
      )}

      {/* Dashboard Controls */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Моя статистика</h2>
            <p className="text-muted-foreground">
              Обзор ваших заказов и расходов
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex gap-2 mr-2">
              <Button variant="outline" size="sm" onClick={() => setPresetRange(30)}>30 дней</Button>
              <Button variant="outline" size="sm" onClick={() => setPresetRange(90)}>3 месяца</Button>
              <Button variant="outline" size="sm" onClick={() => setPresetRange(180)}>6 месяцев</Button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input 
                type="date" 
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 sm:w-[140px]"
              />
              <span className="text-muted-foreground">—</span>
              <Input 
                type="date" 
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 sm:w-[140px]"
              />
            </div>
          </div>
        </div>
      </FadeIn>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Мои расходы
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.totalRevenue.toLocaleString('ru-RU')} ₽</div>
              <p className="text-xs text-muted-foreground">
                за выбранный период
              </p>
            </CardContent>
          </Card>
        </FadeIn>
        
        <FadeIn delay={0.3}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Количество заказов
              </CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                за выбранный период
              </p>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.4}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Средний чек
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(kpiStats.avgOrderValue).toLocaleString('ru-RU')} ₽</div>
              <p className="text-xs text-muted-foreground">
                средняя стоимость заказа
              </p>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.5}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Объем покупок
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.totalItems.toFixed(1)} кг</div>
              <p className="text-xs text-muted-foreground">
                общий вес кофе
              </p>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Charts */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-7">
        {/* Main Revenue Chart */}
        <FadeIn delay={0.6} className="md:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Динамика расходов</CardTitle>
              <CardDescription>
                Траты по дням за выбранный период
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[350px]">
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
        <FadeIn delay={0.7} className="md:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Предпочтения</CardTitle>
              <CardDescription>
                Распределение покупок по категориям
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  Нет данных за выбранный период
                </div>
              ) : (
                <CustomPieChart data={categoryData} />
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}