import { useState } from 'react';
import { useAgent } from './AgentLayout';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const fmt = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
const fmtDate = (s?: string | null) => s ? format(new Date(s), 'd MMM yyyy', { locale: ru }) : '—';

export function AgentOrders() {
  const { agentData } = useAgent();
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const clients = agentData?.clients ?? [];
  const orders = agentData?.orders ?? [];
  const agent = agentData?.agent;

  const sorted = orders.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered = sorted.filter(o => {
    const client = clients.find(c => c.id === o.userId);
    const company = client?.company_name || o.company || '';

    if (filterClient !== 'all' && o.userId !== filterClient) return false;
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (dateFrom && new Date(o.date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(o.date) > new Date(dateTo + 'T23:59:59')) return false;
    if (search && !company.toLowerCase().includes(search.toLowerCase()) && !o.orderId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalFiltered = filtered.reduce((s, o) => s + (o.total || 0), 0);
  const totalCommission = Math.round(totalFiltered * (agent?.commission_rate || 0) / 100);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Заказы клиентов</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {orders.length === 0 ? 'Заказов пока нет' : `${orders.length} заказ${orders.length === 1 ? '' : orders.length < 5 ? 'а' : 'ов'}`}
        </p>
      </div>

      {/* Filters */}
      {orders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Поиск по клиенту / номеру..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-48"
          />
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Все клиенты" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все клиенты</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-9 rounded-md border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="С даты"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-9 rounded-md border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="По дату"
          />
        </div>
      )}

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div className="flex gap-4 text-sm bg-white rounded-lg border border-border px-4 py-2.5">
          <span className="text-muted-foreground">Показано: <strong className="text-foreground">{filtered.length}</strong></span>
          <span className="text-muted-foreground">Сумма: <strong className="text-foreground">{fmt(totalFiltered)}</strong></span>
          <span className="text-muted-foreground">Ваша комиссия: <strong className="text-[#F47D37]">{fmt(totalCommission)}</strong></span>
        </div>
      )}

      {/* Table */}
      {orders.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-14 text-center">
          <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Заказов пока нет</p>
          <p className="text-xs text-muted-foreground mt-1">Заказы появятся, когда ваши клиенты начнут оформлять их в оптовом кабинете</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Ничего не найдено</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-normal text-muted-foreground">Номер</th>
                  <th className="text-left px-4 py-3 font-normal text-muted-foreground">Клиент</th>
                  <th className="text-left px-4 py-3 font-normal text-muted-foreground">Дата</th>
                  <th className="text-right px-4 py-3 font-normal text-muted-foreground">Сумма</th>
                  <th className="text-right px-4 py-3 font-normal text-muted-foreground">Комиссия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const client = clients.find(c => c.id === o.userId);
                  const commission = Math.round((o.total || 0) * (agent?.commission_rate || 0) / 100);
                  return (
                    <tr key={o.orderId} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.orderId}</td>
                      <td className="px-4 py-3 font-medium">{client?.company_name || o.company || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.date)}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(o.total || 0)}</td>
                      <td className="px-4 py-3 text-right text-[#F47D37] font-medium">{fmt(commission)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
