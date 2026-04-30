import { useAgent } from './AgentLayout';
import { Wallet, CheckCircle2, BadgePercent, Clock } from 'lucide-react@0.454.0';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const fmt = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
const fmtDate = (s?: string | null) => s ? format(new Date(s), 'd MMM yyyy', { locale: ru }) : '—';

function MetricCard({
  label, value, icon, color = '#F47D37', highlight = false,
}: {
  label: string; value: string; icon: React.ReactNode; color?: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${highlight ? 'border-[#F47D37]/30 bg-[#FFF4E5]/60' : 'border-border bg-white'}`}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: color + '18' }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold mt-0.5">{value}</div>
      </div>
    </div>
  );
}

export function AgentPayouts() {
  const { agentData } = useAgent();

  const stats = agentData?.stats;
  const payouts = agentData?.payouts ?? [];
  const sorted = payouts.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Финансы</h1>
        <p className="text-sm text-muted-foreground mt-0.5">История выплат и баланс комиссии</p>
      </div>

      {/* Metrics */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard
            label="Всего начислено"
            value={fmt(stats.totalCommission)}
            icon={<BadgePercent className="w-4 h-4" />}
            color="#F47D37"
          />
          <MetricCard
            label="Выплачено"
            value={fmt(stats.totalPaid)}
            icon={<CheckCircle2 className="w-4 h-4" />}
            color="#10b981"
          />
          <MetricCard
            label="Остаток к выплате"
            value={fmt(stats.balance)}
            icon={<Wallet className="w-4 h-4" />}
            color={stats.balance > 0 ? '#ef4444' : '#10b981'}
            highlight={stats.balance > 0}
          />
        </div>
      )}

      {/* Balance notice */}
      {stats && stats.balance > 0 && (
        <div className="bg-[#FFF4E5] border border-[#F47D37]/20 rounded-xl px-4 py-3 text-sm text-[#7a3d1a]">
          На вашем счету <strong>{fmt(stats.balance)}</strong> комиссии к выплате. Свяжитесь с нами для получения выплаты.
        </div>
      )}
      {stats && stats.balance === 0 && stats.totalPaid > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          Все начисленные комиссии выплачены. Баланс: 0 ₽
        </div>
      )}

      {/* Payouts table */}
      <div>
        <h2 className="text-sm font-semibold mb-3">История выплат ({payouts.length})</h2>
        {payouts.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl py-12 text-center">
            <Clock className="w-7 h-7 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Выплат пока не было</p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-normal text-muted-foreground">Сумма</th>
                  <th className="text-left px-4 py-3 font-normal text-muted-foreground">Статус</th>
                  <th className="text-left px-4 py-3 font-normal text-muted-foreground">Создана</th>
                  <th className="text-left px-4 py-3 font-normal text-muted-foreground">Оплачена</th>
                  <th className="text-left px-4 py-3 font-normal text-muted-foreground hidden sm:table-cell">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => (
                  <tr key={p.id} className="border-t border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 font-semibold">{fmt(p.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.status === 'paid' ? (
                          <><CheckCircle2 className="w-3 h-3" /> Оплачено</>
                        ) : (
                          <><Clock className="w-3 h-3" /> Ожидает</>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.paid_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{p.comment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
