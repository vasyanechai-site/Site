import { useState } from 'react';
import { useAgent } from './AgentLayout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Plus, Users, Loader2 } from 'lucide-react@0.454.0';
import { toast } from 'sonner@2.0.3';
import { createAgentClient } from '../../lib/agentApi';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const fmt = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
const fmtDate = (s?: string | null) => s ? format(new Date(s), 'd MMM yyyy', { locale: ru }) : '—';

export function AgentClients() {
  const { agentData, reload, agentId } = useAgent();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const handleCreate = async () => {
    if (!phone || !password || !company) {
      toast.error('Заполните все поля');
      return;
    }
    setLoading(true);
    try {
      await createAgentClient(agentId, { phone, password, company_name: company });
      toast.success('Клиент создан. Передайте ему логин и пароль для входа.');
      setOpen(false);
      setPhone(''); setPassword(''); setCompany('');
      reload();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания клиента');
    } finally {
      setLoading(false);
    }
  };

  const clients = agentData?.clients ?? [];
  const orders = agentData?.orders ?? [];

  const filtered = clients.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Мои клиенты</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clients.length === 0 ? 'Нет клиентов' : `${clients.length} клиент${clients.length === 1 ? '' : clients.length < 5 ? 'а' : 'ов'}`}
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-[#F47D37] hover:bg-[#d96a2a] text-white gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> Новый клиент
        </Button>
      </div>

      {/* Search */}
      {clients.length > 0 && (
        <Input
          placeholder="Поиск по компании или логину..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
      )}

      {/* Table */}
      {clients.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-14 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mb-4">Клиентов пока нет</p>
          <Button variant="outline" onClick={() => setOpen(true)}>Добавить первого клиента</Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Ничего не найдено</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-normal text-muted-foreground">Компания</th>
                <th className="text-left px-4 py-3 font-normal text-muted-foreground">Логин</th>
                <th className="text-right px-4 py-3 font-normal text-muted-foreground">Заказов</th>
                <th className="text-right px-4 py-3 font-normal text-muted-foreground">Сумма</th>
                <th className="text-right px-4 py-3 font-normal text-muted-foreground">Создан</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(cl => {
                const clOrders = orders.filter(o => o.userId === cl.id);
                const clTotal = clOrders.reduce((s, o) => s + (o.total || 0), 0);
                return (
                  <tr key={cl.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{cl.company_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{cl.phone}</td>
                    <td className="px-4 py-3 text-right">{clOrders.length}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(clTotal)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtDate(cl.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Новый оптовый клиент</DialogTitle>
            <DialogDescription>
              Создайте клиента и передайте ему логин и пароль для входа в оптовый кабинет.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Название компании <span className="text-destructive">*</span></Label>
              <Input
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="ООО Кофейня"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Логин (телефон или имя) <span className="text-destructive">*</span></Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="79001234567 или client_name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Пароль <span className="text-destructive">*</span></Label>
              <Input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
              />
              <p className="text-xs text-muted-foreground">
                Запишите пароль — вы передадите его клиенту для входа
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="bg-[#F47D37] hover:bg-[#d96a2a] text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
