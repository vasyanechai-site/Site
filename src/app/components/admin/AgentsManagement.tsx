import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Plus, Pencil, Eye, Power, PowerOff, Loader2, TrendingUp,
  Users, ShoppingBag, Wallet, ArrowLeft, BadgePercent, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  fetchAgents, createAgent, updateAgent, fetchAgentStats, createPayout, updatePayout, createAgentClient,
} from '../../lib/agentApi';
import type { Agent, AgentFullData, AgentPayout } from '../../types/agent';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
const fmtDate = (s?: string | null) => s ? format(new Date(s), 'd MMM yyyy', { locale: ru }) : '—';

function StatCard({ label, value, icon, color = '#F47D37' }: {
  label: string; value: string; icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: color + '18' }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold text-foreground mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// ── Agent Detail Modal ─────────────────────────────────────────────────────

function AgentDetailModal({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const [data, setData] = useState<AgentFullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutComment, setPayoutComment] = useState('');
  const [payoutStatus, setPayoutStatus] = useState<'pending' | 'paid'>('paid');
  const [payoutLoading, setPayoutLoading] = useState(false);
  // New client form
  const [clientOpen, setClientOpen] = useState(false);
  const [clientPhone, setClientPhone] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientLoading, setClientLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetchAgentStats(agentId);
      setData(d);
    } catch (e) {
      toast.error('Не удалось загрузить данные агента');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [agentId]);

  const handleCreatePayout = async () => {
    if (!payoutAmount || isNaN(Number(payoutAmount))) {
      toast.error('Укажите корректную сумму');
      return;
    }
    setPayoutLoading(true);
    try {
      await createPayout(agentId, { amount: Number(payoutAmount), comment: payoutComment, status: payoutStatus });
      toast.success('Выплата добавлена');
      setPayoutOpen(false);
      setPayoutAmount('');
      setPayoutComment('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания выплаты');
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleMarkPaid = async (payout: AgentPayout) => {
    try {
      await updatePayout(payout.id, { status: 'paid' });
      toast.success('Выплата отмечена как оплаченная');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка');
    }
  };

  const handleCreateClient = async () => {
    if (!clientPhone || !clientPassword || !clientCompany) {
      toast.error('Заполните все поля');
      return;
    }
    setClientLoading(true);
    try {
      await createAgentClient(agentId, { phone: clientPhone, password: clientPassword, company_name: clientCompany });
      toast.success('Клиент создан');
      setClientOpen(false);
      setClientPhone(''); setClientPassword(''); setClientCompany('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания клиента');
    } finally {
      setClientLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!data) return null;

  const { agent, clients, orders, payouts, stats } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-semibold">{agent.name}</h2>
          <p className="text-sm text-muted-foreground">@{agent.phone} · {agent.commission_rate}% комиссии</p>
        </div>
        <Badge className={`ml-auto ${agent.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
          {agent.status === 'active' ? 'Активен' : 'Отключён'}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Клиентов" value={String(stats.totalClients)} icon={<Users className="w-4 h-4" />} />
        <StatCard label="Заказов" value={String(stats.totalOrders)} icon={<ShoppingBag className="w-4 h-4" />} />
        <StatCard label="Выручка" value={fmt(stats.totalRevenue)} icon={<TrendingUp className="w-4 h-4" />} color="#10b981" />
        <StatCard label="Начислено" value={fmt(stats.totalCommission)} icon={<BadgePercent className="w-4 h-4" />} color="#F47D37" />
        <StatCard label="Выплачено" value={fmt(stats.totalPaid)} icon={<CheckCircle2 className="w-4 h-4" />} color="#6366f1" />
        <StatCard label="Остаток" value={fmt(stats.balance)} icon={<Wallet className="w-4 h-4" />} color={stats.balance > 0 ? '#ef4444' : '#10b981'} />
      </div>

      {/* Clients */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">Клиенты ({clients.length})</h3>
          <Button size="sm" variant="outline" onClick={() => setClientOpen(true)} className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" /> Добавить клиента
          </Button>
        </div>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center border border-dashed rounded-lg">Нет клиентов</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 font-normal text-muted-foreground">Компания</th>
                  <th className="text-left px-3 py-2 font-normal text-muted-foreground">Логин</th>
                  <th className="text-right px-3 py-2 font-normal text-muted-foreground">Заказов</th>
                  <th className="text-right px-3 py-2 font-normal text-muted-foreground">Сумма</th>
                  <th className="text-right px-3 py-2 font-normal text-muted-foreground">Создан</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(cl => {
                  const clOrders = orders.filter(o => o.userId === cl.id);
                  const clTotal = clOrders.reduce((s, o) => s + (o.total || 0), 0);
                  return (
                    <tr key={cl.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-medium">{cl.company_name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{cl.phone}</td>
                      <td className="px-3 py-2.5 text-right">{clOrders.length}</td>
                      <td className="px-3 py-2.5 text-right">{fmt(clTotal)}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{fmtDate(cl.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Orders */}
      <div>
        <h3 className="font-medium text-sm mb-3">Заказы ({orders.length})</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center border border-dashed rounded-lg">Нет заказов</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-normal text-muted-foreground">Номер</th>
                    <th className="text-left px-3 py-2 font-normal text-muted-foreground">Клиент</th>
                    <th className="text-left px-3 py-2 font-normal text-muted-foreground">Дата</th>
                    <th className="text-right px-3 py-2 font-normal text-muted-foreground">Сумма</th>
                    <th className="text-right px-3 py-2 font-normal text-muted-foreground">Комиссия</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(o => {
                    const client = clients.find(c => c.id === o.userId);
                    const commission = Math.round((o.total || 0) * (agent.commission_rate || 0) / 100);
                    return (
                      <tr key={o.orderId} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{o.orderId}</td>
                        <td className="px-3 py-2.5">{client?.company_name || o.company || '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(o.date)}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{fmt(o.total || 0)}</td>
                        <td className="px-3 py-2.5 text-right text-[#F47D37]">{fmt(commission)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Payouts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">Выплаты ({payouts.length})</h3>
          <Button size="sm" variant="outline" onClick={() => setPayoutOpen(true)} className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" /> Выплатить
          </Button>
        </div>
        {payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center border border-dashed rounded-lg">Нет выплат</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 font-normal text-muted-foreground">Сумма</th>
                  <th className="text-left px-3 py-2 font-normal text-muted-foreground">Статус</th>
                  <th className="text-left px-3 py-2 font-normal text-muted-foreground">Создана</th>
                  <th className="text-left px-3 py-2 font-normal text-muted-foreground">Оплачена</th>
                  <th className="text-left px-3 py-2 font-normal text-muted-foreground">Комментарий</th>
                  <th className="text-right px-3 py-2 font-normal text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {payouts.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(p => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-medium">{fmt(p.amount)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.status === 'paid' ? 'Оплачено' : 'Ожидает'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(p.created_at)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(p.paid_at)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.comment || '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      {p.status === 'pending' && (
                        <Button size="sm" variant="ghost" className="h-6 text-xs text-green-700 hover:text-green-900"
                          onClick={() => handleMarkPaid(p)}>
                          Оплатить
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create payout dialog */}
      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Создать выплату</DialogTitle>
            <DialogDescription>Укажите сумму выплаты агенту {agent.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Сумма</Label>
              <div className="flex gap-2 items-center">
                <Input type="number" min={1} value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} placeholder="5000" />
                <span className="text-muted-foreground">₽</span>
              </div>
              {stats.balance > 0 && <p className="text-xs text-muted-foreground">Остаток к выплате: {fmt(stats.balance)}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Статус</Label>
              <Select value={payoutStatus} onValueChange={v => setPayoutStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Оплачено</SelectItem>
                  <SelectItem value="pending">Ожидает</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Комментарий</Label>
              <Input value={payoutComment} onChange={e => setPayoutComment(e.target.value)} placeholder="Необязательно" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayoutOpen(false)}>Отмена</Button>
            <Button onClick={handleCreatePayout} disabled={payoutLoading}
              className="bg-[#F47D37] hover:bg-[#d96a2a] text-white">
              {payoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create client dialog */}
      <Dialog open={clientOpen} onOpenChange={setClientOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Новый клиент</DialogTitle>
            <DialogDescription>Оптовый клиент, привязанный к агенту {agent.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Компания</Label>
              <Input value={clientCompany} onChange={e => setClientCompany(e.target.value)} placeholder="ООО Кофе" />
            </div>
            <div className="space-y-1.5">
              <Label>Логин</Label>
              <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="client_login" />
            </div>
            <div className="space-y-1.5">
              <Label>Пароль</Label>
              <Input type="password" value={clientPassword} onChange={e => setClientPassword(e.target.value)} placeholder="Пароль" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClientOpen(false)}>Отмена</Button>
            <Button onClick={handleCreateClient} disabled={clientLoading}
              className="bg-[#F47D37] hover:bg-[#d96a2a] text-white">
              {clientLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Agent Form ─────────────────────────────────────────────────────────────

function AgentForm({ agent, onSave, onClose }: {
  agent?: Agent | null; onSave: () => void; onClose: () => void;
}) {
  const [name, setName] = useState(agent?.name || '');
  const [phone, setPhone] = useState(agent?.phone || '');
  const [password, setPassword] = useState('');
  const [rate, setRate] = useState(String(agent?.commission_rate ?? 5));
  const [status, setStatus] = useState<string>(agent?.status || 'active');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!name || !phone || (!agent && !password)) {
      toast.error('Заполните обязательные поля');
      return;
    }
    setLoading(true);
    try {
      if (agent) {
        await updateAgent(agent.id, { name, phone, commission_rate: Number(rate), status: status as any, ...(password ? { password } : {}) });
        toast.success('Агент обновлён');
      } else {
        await createAgent({ name, phone, password, commission_rate: Number(rate), status });
        toast.success('Агент создан');
      }
      onSave();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Имя <span className="text-destructive">*</span></Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" />
      </div>
      <div className="space-y-1.5">
        <Label>Логин <span className="text-destructive">*</span></Label>
        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="agent_ivan" />
      </div>
      <div className="space-y-1.5">
        <Label>{agent ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль *'}</Label>
        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" />
      </div>
      <div className="space-y-1.5">
        <Label>Комиссия (%)</Label>
        <div className="flex gap-2 items-center">
          <Input type="number" min={0} max={50} value={rate} onChange={e => setRate(e.target.value)} className="w-24" />
          <span className="text-muted-foreground text-sm">%</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Статус</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Активен</SelectItem>
            <SelectItem value="disabled">Отключён</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onClose} className="flex-1">Отмена</Button>
        <Button onClick={handle} disabled={loading} className="flex-1 bg-[#F47D37] hover:bg-[#d96a2a] text-white">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : agent ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </div>
  );
}

// ── Top Agents Widget ──────────────────────────────────────────────────────

export function AgentTopWidget() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents()
      .then(a => setAgents(a.sort((x, y) => (y.totalRevenue || 0) - (x.totalRevenue || 0)).slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-white rounded-xl border border-border p-5 flex items-center justify-center h-32">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
  if (agents.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[#F47D37]" /> Топ агентов
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left pb-2 font-normal text-muted-foreground">Агент</th>
              <th className="text-center pb-2 font-normal text-muted-foreground">Клиентов</th>
              <th className="text-center pb-2 font-normal text-muted-foreground">Заказов</th>
              <th className="text-right pb-2 font-normal text-muted-foreground">Выручка</th>
              <th className="text-right pb-2 font-normal text-muted-foreground">Начислено</th>
              <th className="text-right pb-2 font-normal text-muted-foreground">Остаток</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                <td className="py-2.5">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.commission_rate}%</div>
                </td>
                <td className="py-2.5 text-center text-muted-foreground">{a.totalClients ?? 0}</td>
                <td className="py-2.5 text-center text-muted-foreground">{a.totalOrders ?? 0}</td>
                <td className="py-2.5 text-right font-medium">{fmt(a.totalRevenue ?? 0)}</td>
                <td className="py-2.5 text-right text-[#F47D37]">{fmt(a.totalCommission ?? 0)}</td>
                <td className={`py-2.5 text-right font-medium ${(a.balance ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmt(a.balance ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function AgentsManagement() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toggleAgent, setToggleAgent] = useState<Agent | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAgents();
      setAgents(data);
    } catch (e: any) {
      toast.error('Не удалось загрузить агентов: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async () => {
    if (!toggleAgent) return;
    try {
      await updateAgent(toggleAgent.id, { status: toggleAgent.status === 'active' ? 'disabled' : 'active' });
      toast.success(toggleAgent.status === 'active' ? 'Агент отключён' : 'Агент активирован');
      setToggleAgent(null);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка');
    }
  };

  if (detailId) {
    return (
      <AgentDetailModal
        agentId={detailId}
        onClose={() => { setDetailId(null); load(); }}
      />
    );
  }

  // Суммарные показатели по всем агентам
  const totals = agents.reduce(
    (acc, a) => ({
      clients:    acc.clients    + (a.totalClients    ?? 0),
      orders:     acc.orders     + (a.totalOrders     ?? 0),
      revenue:    acc.revenue    + (a.totalRevenue    ?? 0),
      commission: acc.commission + (a.totalCommission ?? 0),
      paid:       acc.paid       + (a.totalPaid       ?? 0),
      balance:    acc.balance    + (a.balance         ?? 0),
    }),
    { clients: 0, orders: 0, revenue: 0, commission: 0, paid: 0, balance: 0 }
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Агенты</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Партнёры, привлекающие оптовых клиентов</p>
        </div>
        <Button
          onClick={() => { setEditAgent(null); setFormOpen(true); }}
          className="bg-[#F47D37] hover:bg-[#d96a2a] text-white gap-2"
        >
          <Plus className="w-4 h-4" /> Создать агента
        </Button>
      </div>

      {/* ── Сводный дашборд ── */}
      {!loading && agents.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard
            label="Клиентов"
            value={String(totals.clients)}
            icon={<Users className="w-4 h-4" />}
            color="#F47D37"
          />
          <StatCard
            label="Заказов"
            value={String(totals.orders)}
            icon={<ShoppingBag className="w-4 h-4" />}
            color="#F47D37"
          />
          <StatCard
            label="Выручка"
            value={fmt(totals.revenue)}
            icon={<TrendingUp className="w-4 h-4" />}
            color="#F47D37"
          />
          <StatCard
            label="Начислено"
            value={fmt(totals.commission)}
            icon={<BadgePercent className="w-4 h-4" />}
            color="#F47D37"
          />
          <StatCard
            label="Выплачено"
            value={fmt(totals.paid)}
            icon={<CheckCircle2 className="w-4 h-4" />}
            color="#6366F1"
          />
          <StatCard
            label="Остаток"
            value={fmt(totals.balance)}
            icon={<Wallet className="w-4 h-4" />}
            color={totals.balance > 0 ? '#EF4444' : '#22C55E'}
          />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : agents.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-14 text-center text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Агентов пока нет</p>
          <Button variant="outline" className="mt-4" onClick={() => { setEditAgent(null); setFormOpen(true); }}>
            Создать первого агента
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-normal text-muted-foreground">Агент</th>
                  <th className="text-center px-3 py-3 font-normal text-muted-foreground">%</th>
                  <th className="text-center px-3 py-3 font-normal text-muted-foreground">Клиентов</th>
                  <th className="text-center px-3 py-3 font-normal text-muted-foreground">Заказов</th>
                  <th className="text-right px-3 py-3 font-normal text-muted-foreground">Выручка</th>
                  <th className="text-right px-3 py-3 font-normal text-muted-foreground">Начислено</th>
                  <th className="text-right px-3 py-3 font-normal text-muted-foreground">Выплачено</th>
                  <th className="text-right px-3 py-3 font-normal text-muted-foreground">Остаток</th>
                  <th className="text-center px-3 py-3 font-normal text-muted-foreground">Статус</th>
                  <th className="text-right px-3 py-3 font-normal text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a, i) => (
                  <motion.tr
                    key={a.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-t border-border hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">@{a.phone}</div>
                    </td>
                    <td className="px-3 py-3 text-center text-[#F47D37] font-medium">{a.commission_rate}%</td>
                    <td className="px-3 py-3 text-center">{a.totalClients ?? 0}</td>
                    <td className="px-3 py-3 text-center">{a.totalOrders ?? 0}</td>
                    <td className="px-3 py-3 text-right">{fmt(a.totalRevenue ?? 0)}</td>
                    <td className="px-3 py-3 text-right text-[#F47D37]">{fmt(a.totalCommission ?? 0)}</td>
                    <td className="px-3 py-3 text-right text-indigo-600">{fmt(a.totalPaid ?? 0)}</td>
                    <td className={`px-3 py-3 text-right font-medium ${(a.balance ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmt(a.balance ?? 0)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {a.status === 'active' ? 'Активен' : 'Откл.'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setDetailId(a.id)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditAgent(a); setFormOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setToggleAgent(a)}>
                          {a.status === 'active' ? <PowerOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Power className="w-3.5 h-3.5 text-green-600" />}
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editAgent ? 'Редактировать агента' : 'Новый агент'}</DialogTitle>
            <DialogDescription>
              {editAgent ? `Изменение данных агента ${editAgent.name}` : 'Создание нового агента-партнёра'}
            </DialogDescription>
          </DialogHeader>
          <AgentForm
            agent={editAgent}
            onSave={() => { setFormOpen(false); load(); }}
            onClose={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Toggle confirm */}
      <AlertDialog open={!!toggleAgent} onOpenChange={open => !open && setToggleAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleAgent?.status === 'active' ? 'Отключить агента?' : 'Активировать агента?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleAgent?.status === 'active'
                ? `Агент ${toggleAgent?.name} не сможет войти в систему.`
                : `Агент ${toggleAgent?.name} получит доступ в личный кабинет.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggle}>Подтвердить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}