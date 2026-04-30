import { useEffect } from 'react';
import { useAgent } from './AgentLayout';
import { Users, ShoppingBag, TrendingUp, BadgePercent, CheckCircle2, Wallet, Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const fmt = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
const fmtDate = (s?: string | null) => s ? format(new Date(s), 'd MMM yyyy', { locale: ru }) : '—';

function StatCard({
  label, value, sub, icon, color = '#F47D37', highlight = false,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color?: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${highlight ? 'border-[#F47D37]/30 bg-[#FFF4E5]/60' : 'border-border bg-white'}`}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: color + '18' }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold text-foreground mt-0.5">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function AgentDashboard() {
  const { agentData, reload } = useAgent();
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();

  useEffect(() => { reload(); }, []);

  if (!agentData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { agent, stats, orders, clients, payouts } = agentData;
  const recentOrders = orders.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  const pendingPayouts = payouts.filter(p => p.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-semibold">Добро пожаловать, {agent.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ваша комиссия: {agent.commission_rate}% от суммы заказов</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          label="Всего клиентов"
          value={String(stats.totalClients)}
          icon={<Users className="w-4 h-4" />}
          color="#6366f1"
        />
        <StatCard
          label="Всего заказов"
          value={String(stats.totalOrders)}
          icon={<ShoppingBag className="w-4 h-4" />}
          color="#0ea5e9"
        />
        <StatCard
          label="Выручка клиентов"
          value={fmt(stats.totalRevenue)}
          icon={<TrendingUp className="w-4 h-4" />}
          color="#10b981"
        />
        <StatCard
          label="Начислено комиссии"
          value={fmt(stats.totalCommission)}
          icon={<BadgePercent className="w-4 h-4" />}
          color="#F47D37"
          highlight
        />
        <StatCard
          label="Выплачено"
          value={fmt(stats.totalPaid)}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="#10b981"
        />
        <StatCard
          label="К выплате"
          value={fmt(stats.balance)}
          icon={<Wallet className="w-4 h-4" />}
          color={stats.balance > 0 ? '#ef4444' : '#10b981'}
          highlight={stats.balance > 0}
        />
      </div>

      {/* Pending payouts banner */}
      {pendingPayouts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <Wallet className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="text-sm text-amber-800">
            {pendingPayouts.length === 1
              ? `Ожидает подтверждения выплата на ${fmt(pendingPayouts[0].amount)}`
              : `${pendingPayouts.length} выплаты ожидают подтверждения`}
          </div>
          <button onClick={() => navigate(`/agent/${agentId}/payouts`)}
            className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline">
            Перейти
          </button>
        </div>
      )}

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Последние заказы</h2>
            <button onClick={() => navigate(`/agent/${agentId}/orders`)}
              className="text-xs text-[#F47D37] hover:underline">
              Все заказы →
            </button>
          </div>
          <div className="border border-border rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-normal text-muted-foreground">Клиент</th>
                  <th className="text-left px-4 py-2.5 font-normal text-muted-foreground hidden sm:table-cell">Дата</th>
                  <th className="text-right px-4 py-2.5 font-normal text-muted-foreground">Сумма</th>
                  <th className="text-right px-4 py-2.5 font-normal text-muted-foreground">Комиссия</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(o => {
                  const client = clients.find(c => c.id === o.userId);
                  const commission = Math.round((o.total || 0) * (agent.commission_rate || 0) / 100);
                  return (
                    <tr key={o.orderId} className="border-t border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{client?.company_name || o.company || '—'}</div>
                        <div className="text-xs text-muted-foreground font-mono">{o.orderId}</div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{fmtDate(o.date)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmt(o.total || 0)}</td>
                      <td className="px-4 py-2.5 text-right text-[#F47D37] font-medium">{fmt(commission)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick links if no data */}
      {stats.totalClients === 0 && (
        <div className="border border-dashed border-border rounded-xl p-8 text-center">
          <Users className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium mb-1">Начните с добавления клиентов</p>
          <p className="text-xs text-muted-foreground mb-4">
            Создайте оптовых клиентов — их заказы автоматически будут засчитаны вашей комиссии
          </p>
          <button onClick={() => navigate(`/agent/${agentId}/clients`)}
            className="inline-flex items-center gap-2 bg-[#F47D37] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#d96a2a] transition-colors">
            Добавить клиента
          </button>
        </div>
      )}
    </div>
  );
}
