import { useState, useEffect } from 'react';
import { Order, CartItem, CoffeeItem } from '../types';
import { fetchUserOrders, fetchCoffeeItems } from '../lib/api';
import { formatWholesaleItemQuantity } from '../lib/wholesaleUnits';
import { Button } from './ui/button';
import { ArrowLeft, Package, Loader2 } from 'lucide-react';
import { Logo } from './Logo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { UserDashboard } from './UserDashboard';

interface MyOrdersProps {
  userId: string;
  userCompanyName: string;
  userDiscount?: number;
  onBack: () => void;
  onLogout: () => void;
  onRepeatOrder: (items: any[], orderId: string) => Promise<void>;
  onNavigateToRetail?: () => void;
}

export function MyOrders({ userId, userCompanyName, userDiscount = 0, onBack, onLogout, onRepeatOrder, onNavigateToRetail }: MyOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [coffeeItems, setCoffeeItems] = useState<CoffeeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [repeatingOrderId, setRepeatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
    loadCoffeeItems();
  }, [userId]);

  useEffect(() => {
    // Слушаем событие обновления заказов (например, после успешной оплаты)
    const handleOrdersUpdate = () => {
      console.log('📦 Orders update event received, reloading orders...');
      loadOrders();
    };
    
    window.addEventListener('orders-updated', handleOrdersUpdate);
    return () => window.removeEventListener('orders-updated', handleOrdersUpdate);
  }, [userId]);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const userOrders = await fetchUserOrders(userId);
      setOrders(userOrders);
    } catch (error) {
      console.error('Failed to load user orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCoffeeItems = async () => {
    try {
      const items = await fetchCoffeeItems();
      setCoffeeItems(items);
    } catch (error) {
      console.error('Failed to load coffee items:', error);
    }
  };

  const handleRepeatOrder = async (items: any[], orderId: string) => {
    try {
      setRepeatingOrderId(orderId);
      await onRepeatOrder(items, orderId);
    } finally {
      setRepeatingOrderId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Функция для получения категории товара
  const getCategoryForItem = (itemId: string, itemName: string, itemCategory?: string): string | undefined => {
    // Если категория уже есть в заказе, возвращаем её
    if (itemCategory) return itemCategory;
    
    // Ищем товар в текущем прайсе по ID
    const coffeeItem = coffeeItems.find(c => c.id === itemId);
    if (coffeeItem) return coffeeItem.category;
    
    // Если не нашли по ID, пробуем найти по названию (для старых заказов)
    const coffeeByName = coffeeItems.find(c => c.name === itemName);
    if (coffeeByName) return coffeeByName.category;
    
    return undefined;
  };

  // Для дрипов с одновременным заказом упаковок и штук — разворачиваем в две строки
  type DisplayRow = {
    key: string;
    item: CartItem;
    displayName: string;
    displayQuantity: string;
    displaySubtotal: number;
    category: string | undefined;
  };

  const getDisplayRows = (items: CartItem[]): DisplayRow[] => {
    const rows: DisplayRow[] = [];
    items.forEach((item, index) => {
      const category = getCategoryForItem(item.id, item.name, item.category);
      const kg = Number(item.kg) || 0;
      const packs200 = Number(item.packs200) || 0;
      if (item.type === 'drip' && kg > 0 && packs200 > 0) {
        const packSubtotal = item.priceKg
          ? Math.round(kg * item.priceKg)
          : Math.round((item.subtotal || 0) * kg / (kg + packs200));
        const unitSubtotal = (item.subtotal || 0) - packSubtotal;
        rows.push({
          key: `${index}-packs`,
          item,
          displayName: `${item.name} (упак. 10 шт.)`,
          displayQuantity: `${kg} упак.`,
          displaySubtotal: packSubtotal,
          category,
        });
        rows.push({
          key: `${index}-units`,
          item,
          displayName: `${item.name} (1 шт.)`,
          displayQuantity: `${packs200} шт.`,
          displaySubtotal: unitSubtotal,
          category,
        });
      } else {
        rows.push({
          key: String(index),
          item,
          displayName: item.name,
          displayQuantity: formatWholesaleItemQuantity(item),
          displaySubtotal: item.subtotal || 0,
          category,
        });
      }
    });
    return rows;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <Logo onClick={onNavigateToRetail} />
            <div className="flex items-center gap-2">
              {onNavigateToRetail && (
                <Button 
                  variant="ghost"
                  onClick={onNavigateToRetail}
                  className="text-sm"
                >
                  Розница
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={onLogout}
              >
                Выйти
              </Button>
            </div>
          </div>
          <h1 className="text-foreground">{userCompanyName}</h1>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Вернуться в каталог
        </Button>

        <Tabs defaultValue="history" className="space-y-6">
          <div className="flex justify-start border-b border-border pb-4 mb-6">
             <TabsList>
                <TabsTrigger value="history">История заказов</TabsTrigger>
                <TabsTrigger value="stats">Моя статистика</TabsTrigger>
             </TabsList>
          </div>
          
          <TabsContent value="history" className="focus-visible:outline-none focus-visible:ring-0">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Загрузка заказов...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 border border-border rounded-lg">
                <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">У вас пока нет заказов</p>
              </div>
            ) : (
              <div className="space-y-6">
                {orders.map((order) => (
                  <div key={order.orderId} className="border border-border rounded-lg overflow-hidden">
                    {/* Заголовок заказа */}
                    <div className="bg-muted/50 px-6 py-4 border-b border-border">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-foreground">Заказ {order.orderId}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(order.date)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-foreground">{order.total.toLocaleString('ru-RU')} ₽</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRepeatOrder(order.items, order.orderId)}
                            disabled={repeatingOrderId === order.orderId}
                          >
                            {repeatingOrderId === order.orderId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Повторить заказ'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Детали заказа */}
                    <div className="p-6 space-y-4">
                      <div>
                        <h3 className="text-sm text-muted-foreground mb-2">Информация о доставке</h3>
                        <div className="space-y-1 text-sm">
                          <p className="text-foreground">{order.company}</p>
                          <p className="text-muted-foreground">{order.address}</p>
                          <p className="text-muted-foreground">
                            {order.delivery_method === 'delivery' ? 'Доставка' : 'Самовывоз'}
                            {order.delivery_company && ` (${order.delivery_company})`}
                          </p>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm text-muted-foreground mb-2">Состав заказа</h3>
                        <div className="space-y-2">
                          {getDisplayRows(order.items).map((row) => (
                            <div key={row.key} className="flex justify-between text-sm">
                              <div>
                                <p className="text-foreground">
                                  {row.displayName}
                                  {row.category && <span className="text-muted-foreground text-xs ml-2">({row.category})</span>}
                                </p>
                                <p className="text-muted-foreground">
                                  {row.displayQuantity}
                                </p>
                              </div>
                              <p className="text-foreground">{row.displaySubtotal.toLocaleString('ru-RU')} ₽</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="stats" className="focus-visible:outline-none focus-visible:ring-0">
             <UserDashboard userId={userId} currentDiscount={userDiscount} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}