import React, { useState, useEffect, useCallback } from 'react';
import { Order, CoffeeItem, User } from '../types';
import { fetchOrdersAdmin, deleteOrder, fetchUsersAdmin } from '../lib/api';
import { eventBus, EVENTS } from '../lib/events';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from './ui/drawer';
import { Eye, Copy, X, Trash2, Search, UserCheck, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { motion } from "motion/react";
import { FadeIn } from './ui/fade-in';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { fetchAgents } from '../lib/agentApi';
import type { Agent } from '../types/agent';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Компонент заголовка с сортировкой
function SortHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  className = '',
}: {
  label: string;
  field: string;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (f: string) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <th
      className={`px-6 py-4 text-foreground text-sm cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1 hover:text-foreground/70 transition-colors">
        {label}
        {active ? (
          sortDir === 'asc'
            ? <ChevronUp className="w-3.5 h-3.5 text-primary" />
            : <ChevronDown className="w-3.5 h-3.5 text-primary" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />
        )}
      </span>
    </th>
  );
}

interface OrdersManagementProps {
  coffeeItems: CoffeeItem[];
}

export function OrdersManagement({ coffeeItems }: OrdersManagementProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [creatingInvoiceForOrder, setCreatingInvoiceForOrder] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Сортировка
  const [sortField, setSortField] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Фильтры
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'direct' | 'agent'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  // Маппинг userId → agent_id
  const userAgentMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => {
      if ((u as any).agent_id) map[u.id] = (u as any).agent_id;
    });
    return map;
  }, [users]);

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const allOrders = await fetchOrdersAdmin();
      // Фильтруем только оптовые заказы по наличию orderId (retail-заказы имеют поле id, а не orderId)
      const wholesaleOrders = allOrders.filter(order => {
        // Тихо пропускаем розничные заказы (у них type='retail' или id вместо orderId)
        const isRetail = (order as any).type === 'retail' || (order as any).orderType === 'retail';
        if (isRetail) return false;
        const hasOrderId = order.orderId && order.orderId.trim() !== '';
        return hasOrderId;
      });
      // Сортируем: новые первыми
      wholesaleOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setOrders(wholesaleOrders);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    fetchUsersAdmin().then(setUsers).catch(() => {});
    fetchAgents().then(setAgents).catch(() => {});
    
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const handleOrdersUpdate = () => { loadOrders(); };
    eventBus.on(EVENTS.ORDERS_UPDATED, handleOrdersUpdate);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      eventBus.off(EVENTS.ORDERS_UPDATED, handleOrdersUpdate);
    };
  }, [loadOrders]);

  // Автообновление каждые 2 минуты
  useEffect(() => {
    const interval = setInterval(() => {
      loadOrders();
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    
    try {
      await deleteOrder(orderToDelete);
      toast.success('Заказ удален');
      setOrderToDelete(null);
      loadOrders();
    } catch (error) {
      console.error('Failed to delete order:', error);
      toast.error('Не удалось удалить заказ');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    // Пытаемся использовать современный Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          toast.success(`${label} скопировано`);
        })
        .catch(() => {
          // Fallback при ошибке
          fallbackCopyTextToClipboard(text, label);
        });
    } else {
      // Fallback для старых браузеров или заблокированного API
      fallbackCopyTextToClipboard(text, label);
    }
  };

  const fallbackCopyTextToClipboard = (text: string, label: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Делаем элемент невидимым
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        toast.success(`${label} скопировано`);
      } else {
        toast.error('Не удалось скопировать');
      }
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
      toast.error('Не удалось скопировать');
    }
    
    document.body.removeChild(textArea);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getItemsSummary = (order: Order) => {
    const coldBrewContainers = order.items
      .filter(item => (item as any).type === 'coldbrew')
      .reduce((sum, item) => sum + item.kg, 0);
    const totalKg = order.items
      .filter(item => (item as any).type !== 'coldbrew')
      .reduce((sum, item) => sum + item.kg, 0);
    const totalPacks = order.items
      .filter(item => (item as any).type !== 'coldbrew')
      .reduce((sum, item) => sum + item.packs200, 0);
    const parts = [];
    if (totalKg > 0) parts.push(`${totalKg} кг`);
    if (totalPacks > 0) parts.push(`${totalPacks} × 200 г`);
    if (coldBrewContainers > 0) parts.push(`${coldBrewContainers} × 5 л`);
    return parts.join(', ');
  };

  const getCategoryForItem = (itemId: string, itemName: string, itemCategory?: string): string | undefined => {
    if (itemCategory) return itemCategory;
    const coffeeItem = coffeeItems.find(c => c.id === itemId);
    if (coffeeItem) return coffeeItem.category;
    const coffeeByName = coffeeItems.find(c => c.name === itemName);
    if (coffeeByName) return coffeeByName.category;
    return undefined;
  };

  // Компонент с деталями заказа (переиспользуемый)
  const OrderDetailsContent = ({ order }: { order: Order }) => (
    <div className="space-y-6 px-4 pb-6">

      {/* Order Info */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground text-sm mb-1">Дата заказа</p>
            <p className="text-foreground break-words">{formatDate(order.date)}</p>
          </div>
          <button
            onClick={() => copyToClipboard(formatDate(order.date), 'Дата')}
            className="flex-shrink-0 p-2 hover:bg-muted rounded-md transition-colors"
          >
            <Copy className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground text-sm mb-1">Компания</p>
            <p className="text-foreground break-words">{order.company}</p>
          </div>
          <button
            onClick={() => copyToClipboard(order.company, 'Компания')}
            className="flex-shrink-0 p-2 hover:bg-muted rounded-md transition-colors"
          >
            <Copy className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {order.inn && (
          <div key="inn" className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-muted-foreground text-sm mb-1">ИНН</p>
              <p className="text-foreground break-words">{order.inn}</p>
            </div>
            <button
              onClick={() => copyToClipboard(order.inn, 'ИНН')}
              className="flex-shrink-0 p-2 hover:bg-muted rounded-md transition-colors"
            >
              <Copy className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {order.account && (
          <div key="account" className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-muted-foreground text-sm mb-1">Расчетный счет</p>
              <p className="text-foreground break-words">{order.account}</p>
            </div>
            <button
              onClick={() => copyToClipboard(order.account, 'Счет')}
              className="flex-shrink-0 p-2 hover:bg-muted rounded-md transition-colors"
            >
              <Copy className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {order.bik && (
          <div key="bik" className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-muted-foreground text-sm mb-1">БИК банка</p>
              <p className="text-foreground break-words">{order.bik}</p>
            </div>
            <button
              onClick={() => copyToClipboard(order.bik, 'БИК')}
              className="flex-shrink-0 p-2 hover:bg-muted rounded-md transition-colors"
            >
              <Copy className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground text-sm mb-1">Контактное лицо</p>
            <p className="text-foreground break-words">{order.contact}</p>
          </div>
          <button
            onClick={() => copyToClipboard(order.contact, 'Контакт')}
            className="flex-shrink-0 p-2 hover:bg-muted rounded-md transition-colors"
          >
            <Copy className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground text-sm mb-1">Телефон</p>
            <p className="text-foreground break-words">{order.phone}</p>
          </div>
          <button
            onClick={() => copyToClipboard(order.phone, 'Телефон')}
            className="flex-shrink-0 p-2 hover:bg-muted rounded-md transition-colors"
          >
            <Copy className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground text-sm mb-1">Юридический адрес</p>
            <p className="text-foreground break-words">{order.address}</p>
          </div>
          <button
            onClick={() => copyToClipboard(order.address, 'Юридический адрес')}
            className="flex-shrink-0 p-2 hover:bg-muted rounded-md transition-colors"
          >
            <Copy className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {order.delivery_address && (
          <div key="delivery_address" className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-muted-foreground text-sm mb-1">Адрес доставки</p>
              <p className="text-foreground break-words">{order.delivery_address}</p>
            </div>
            <button
              onClick={() => copyToClipboard(order.delivery_address || '', 'Адрес доставки')}
              className="flex-shrink-0 p-2 hover:bg-muted rounded-md transition-colors"
            >
              <Copy className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground text-sm mb-1">Транспортная компаия</p>
            <p className="text-foreground break-words">{order.delivery_company}</p>
          </div>
          <button
            onClick={() => copyToClipboard(order.delivery_company, 'ТК')}
            className="flex-shrink-0 p-2 hover:bg-muted rounded-md transition-colors"
          >
            <Copy className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground text-sm mb-1">Способ доставки</p>
            <p className="text-foreground break-words">{order.delivery_method}</p>
          </div>
          <button
            onClick={() => copyToClipboard(order.delivery_method, 'Способ доставки')}
            className="flex-shrink-0 p-2 hover:bg-muted rounded-md transition-colors"
          >
            <Copy className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Invoice Info */}
        {order.invoiceUrl && (
          <div key="invoice" className="pt-4 border-t border-border">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-muted-foreground text-sm mb-1">Счет в Точка Банке</p>
                <a
                  href={order.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  Открыть счет №{order.invoiceId}
                </a>
                {order.invoiceCreatedAt && (
                  <p className="text-muted-foreground text-xs mt-1">
                    Создан: {formatDate(order.invoiceCreatedAt)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Order Items */}
      <div>
        <p className="text-foreground mb-4">Состав заказа</p>
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-foreground text-sm whitespace-nowrap">Наименование</th>
                  <th className="text-center px-4 py-3 text-foreground text-sm whitespace-nowrap">Количество</th>
                  <th className="text-right px-4 py-3 text-foreground text-sm whitespace-nowrap">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => {
                  const category = getCategoryForItem(item.id, item.name, item.category);
                  return (
                    <tr key={`${order.orderId}-${item.id}-${index}`} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-foreground text-sm">
                        <div className="break-words">
                          {item.name}
                          {category && <span className="text-muted-foreground text-xs block mt-0.5">({category})</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-foreground text-sm whitespace-nowrap">
                        {(item as any).type === 'coldbrew'
                          ? `${item.kg} × 5 л`
                          : <>
                              {item.kg > 0 && `${item.kg} кг`}
                              {item.kg > 0 && item.packs200 > 0 && ', '}
                              {item.packs200 > 0 && `${item.packs200} × 200 г`}
                            </>
                        }
                      </td>
                      <td className="px-4 py-3 text-right text-foreground text-sm whitespace-nowrap">
                        {(item.subtotal || 0).toLocaleString('ru-RU')} ₽
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/50 border-t border-border">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-foreground">Итого:</td>
                  <td className="px-4 py-3 text-right text-foreground whitespace-nowrap">
                    {order.total.toLocaleString('ru-RU')} ₽
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  // Отфильтрованные заказы
  const filteredOrders = orders
    .filter(order => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          (order.orderId || '').toLowerCase().includes(q) ||
          (order.company || '').toLowerCase().includes(q) ||
          (order.phone || '').toLowerCase().includes(q) ||
          (order.contact || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      const agentId = order.userId ? userAgentMap[order.userId] : undefined;
      if (sourceFilter === 'direct' && agentId) return false;
      if (sourceFilter === 'agent' && !agentId) return false;
      if (agentFilter !== 'all' && agentId !== agentFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === 'company') {
        cmp = (a.company || '').localeCompare(b.company || '', 'ru');
      } else if (sortField === 'total') {
        cmp = a.total - b.total;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  return (
    <div>
      <FadeIn>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-foreground">Заказы</h2>
            <p className="text-muted-foreground mt-1">
              Всего заказов: {orders.length}
            </p>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Обновлено: {format(lastUpdated, 'dd.MM.yyyy HH:mm:ss', { locale: ru })}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadOrders}
            disabled={isLoading}
            className="flex items-center gap-1.5 flex-shrink-0 mt-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </Button>
        </div>
      </FadeIn>

      {/* ── Панель фильтров ── */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по № заказа, компании, телефону..."
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['all', 'direct', 'agent'] as const).map(v => (
              <button
                key={v}
                onClick={() => { setSourceFilter(v); setAgentFilter('all'); }}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  sourceFilter === v
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {v === 'all' ? 'Все' : v === 'direct' ? 'Прямые' : 'От агентов'}
              </button>
            ))}
          </div>

          {sourceFilter === 'agent' && agents.length > 0 && (
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Все агенты" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все агенты</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <span className="text-sm text-muted-foreground ml-auto">
            Показано: {filteredOrders.length} из {orders.length}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground opacity-50">Загрузка...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground opacity-50">
            {searchQuery || sourceFilter !== 'all'
              ? 'Ничего не найдено. Попробуйте изменить фильтры.'
              : 'Заказов пока нет'}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-6 py-4 text-foreground text-sm whitespace-nowrap">№ заказа</th>
                  <SortHeader label="Дата" field="date" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
                  <SortHeader label="Компания" field="company" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
                  <th className="text-left px-6 py-4 text-foreground text-sm">Контактное лицо</th>
                  <th className="text-left px-6 py-4 text-foreground text-sm">Телефон</th>
                  <th className="text-left px-6 py-4 text-foreground text-sm">Количество</th>
                  <SortHeader label="Сумма" field="total" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                  <th className="text-center px-6 py-4 text-foreground text-sm">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, index) => {
                  const MotionTr = motion.tr;
                  const agentId = order.userId ? userAgentMap[order.userId] : undefined;
                  const orderAgent = agentId ? agents.find(a => a.id === agentId) : null;
                  return (
                    <MotionTr 
                      key={order.orderId} 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-10px" }}
                      transition={{ 
                        duration: 0.3, 
                        delay: 0.1 + (index * 0.03),
                        ease: "easeOut"
                      }}
                      className="border-b border-border hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="px-6 py-4 text-foreground text-sm">{order.orderId}</td>
                      <td className="px-6 py-4 text-foreground text-sm">{formatDate(order.date)}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="text-foreground">{order.company}</div>
                        {orderAgent && (
                          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-[#FFF4E5] text-[#F47D37] font-medium border border-[#F47D37]/20 mt-0.5">
                            <UserCheck className="w-2.5 h-2.5" />
                            {orderAgent.name}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-foreground text-sm">{order.contact}</td>
                      <td className="px-6 py-4 text-foreground text-sm">{order.phone}</td>
                      <td className="px-6 py-4 text-foreground text-sm">{getItemsSummary(order)}</td>
                      <td className="px-6 py-4 text-right text-foreground text-sm">
                        {order.total.toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrderToDelete(order.orderId);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </MotionTr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Desktop: Dialog */}
      {!isMobile && (
        <Dialog open={selectedOrder !== null} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedOrder && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground">
                    Заказ {selectedOrder.orderId}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Подробная информация о заказе от {formatDate(selectedOrder.date)}
                  </DialogDescription>
                </DialogHeader>
                <OrderDetailsContent order={selectedOrder} />
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Mobile: Drawer */}
      {isMobile && (
        <Drawer open={selectedOrder !== null} onOpenChange={() => setSelectedOrder(null)}>
          <DrawerContent className="max-h-[90vh]">
            {selectedOrder && (
              <>
                <div className="sticky top-0 bg-background border-b border-border z-10">
                  <DrawerHeader className="relative">
                    <DrawerTitle className="text-foreground text-left pr-8">
                      Заказ {selectedOrder.orderId}
                    </DrawerTitle>
                    <DrawerDescription className="text-muted-foreground text-left">
                      Подробная информация о заказе от {formatDate(selectedOrder.date)}
                    </DrawerDescription>
                    <DrawerClose className="absolute top-4 right-4 p-2 hover:bg-muted rounded-md transition-colors">
                      <X className="w-4 h-4" />
                    </DrawerClose>
                  </DrawerHeader>
                </div>
                <div className="overflow-y-auto flex-1">
                  <OrderDetailsContent order={selectedOrder} />
                </div>
              </>
            )}
          </DrawerContent>
        </Drawer>
      )}

      <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Заказ будет безвозвратно удален из системы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}