import { useState, useEffect } from 'react';
import { RetailOrder } from '../types';
import { fetchRetailOrdersAdmin, deleteRetailOrder } from '../lib/api';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from './ui/drawer';
import { Eye, Copy, X, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
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

export function RetailOrdersManagement() {
  const [orders, setOrders] = useState<RetailOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RetailOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Админ-панель открыта для всех - загружаем данные сразу
    loadOrders();
    
    // Определяем мобильное устройство
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const allOrders = await fetchRetailOrdersAdmin();
      setOrders(allOrders);
    } catch (error) {
      console.error('Failed to load retail orders:', error);
      toast.error('Не удалось загрузить заказы');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!orderToDelete) return;

    try {
      await deleteRetailOrder(orderToDelete);
      setOrders(orders.filter(o => o.orderId !== orderToDelete));
      toast.success('Заказ удален');
    } catch (error) {
      console.error('Failed to delete order:', error);
      toast.error('Не удалось удалить заказ');
    } finally {
      setOrderToDelete(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано в буфер обмена');
  };

  const OrderDetailsContent = ({ order }: { order: RetailOrder }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-border">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Номер заказа</div>
          <div className="flex items-center gap-2">
            <span className="text-foreground">{order.orderId}</span>
            <button
              onClick={() => copyToClipboard(order.orderId)}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <Copy className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        </div>
        
        <div>
          <div className="text-sm text-muted-foreground mb-1">Дата заказа</div>
          <div className="text-foreground">{new Date(order.date).toLocaleString('ru-RU')}</div>
        </div>
      </div>

      <div className="space-y-3 pb-4 border-b border-border">
        <h3 className="text-foreground">Контактная информация</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Контактное лицо</div>
            <div className="text-foreground">{order.contact}</div>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground mb-1">Телефон</div>
            <div className="flex items-center gap-2">
              <span className="text-foreground">{order.phone}</span>
              <button
                onClick={() => copyToClipboard(order.phone)}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                <Copy className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          </div>

          {order.email && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Email</div>
              <div className="flex items-center gap-2">
                <span className="text-foreground">{order.email}</span>
                <button
                  onClick={() => copyToClipboard(order.email)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  <Copy className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 pb-4 border-b border-border">
        <h3 className="text-foreground">Доставка</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Способ получения</div>
            <div className="text-foreground">
              {order.delivery_method === 'delivery' ? 'Доставка' : 'Самовывоз'}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground mb-1">Адрес доставки</div>
            <div className="text-foreground break-words">{order.delivery_address}</div>
          </div>
        </div>
      </div>

      {order.notes && (
        <div className="space-y-2 pb-4 border-b border-border">
          <h3 className="text-foreground">Примечания</h3>
          <div className="text-foreground text-sm break-words">{order.notes}</div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-foreground">Состав заказа</h3>
        
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-foreground text-sm whitespace-nowrap">Наименование</th>
                  <th className="text-center px-4 py-3 text-foreground text-sm whitespace-nowrap">Количество</th>
                  <th className="text-right px-4 py-3 text-foreground text-sm whitespace-nowrap">Цена</th>
                  <th className="text-right px-4 py-3 text-foreground text-sm whitespace-nowrap">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={`${order.orderId}-${item.id}-${index}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground text-sm">
                      <div className="break-words">
                        {item.name}
                        {item.category && <span key="category" className="text-muted-foreground text-xs block mt-0.5">({item.category})</span>}
                        {item.weight && <span key="weight" className="text-muted-foreground text-xs block mt-0.5">Вес: {item.weight}</span>}
                        {item.grind && <span key="grind" className="text-muted-foreground text-xs block mt-0.5">Помол: {item.grind}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-foreground text-sm whitespace-nowrap">
                      {item.quantity} шт
                    </td>
                    <td className="px-4 py-3 text-right text-foreground text-sm whitespace-nowrap">
                      {item.price.toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-4 py-3 text-right text-foreground text-sm whitespace-nowrap">
                      {(item.subtotal || 0).toLocaleString('ru-RU')} ₽
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/50 border-t border-border">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-foreground">Итого:</td>
                  <td className="px-4 py-3 text-right text-foreground whitespace-nowrap">
                    {(order.total || 0).toLocaleString('ru-RU')} ₽
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <FadeIn>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-foreground">Розничные заказы</h2>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка заказов...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Розничных заказов пока нет</div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-foreground text-sm whitespace-nowrap">Номер заказа</th>
                    <th className="text-left px-4 py-3 text-foreground text-sm whitespace-nowrap">Дата</th>
                    <th className="text-left px-4 py-3 text-foreground text-sm whitespace-nowrap">Контакт</th>
                    <th className="text-left px-4 py-3 text-foreground text-sm whitespace-nowrap">Телефон</th>
                    <th className="text-right px-4 py-3 text-foreground text-sm whitespace-nowrap">Сумма</th>
                    <th className="text-right px-4 py-3 text-foreground text-sm whitespace-nowrap">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => (
                    <motion.tr 
                      key={order.orderId} 
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <td className="px-4 py-3 text-foreground text-sm whitespace-nowrap">{order.orderId}</td>
                      <td className="px-4 py-3 text-foreground text-sm whitespace-nowrap">
                        {new Date(order.date).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 text-foreground text-sm">{order.contact}</td>
                      <td className="px-4 py-3 text-foreground text-sm whitespace-nowrap">{order.phone}</td>
                      <td className="px-4 py-3 text-right text-foreground text-sm whitespace-nowrap">
                        {(order.total || 0).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => setSelectedOrder(order)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => setOrderToDelete(order.orderId)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
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
      </FadeIn>

      {/* Desktop Dialog */}
      {!isMobile && selectedOrder && (
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Детали заказа</DialogTitle>
              <DialogDescription>
                Информация о розничном заказе {selectedOrder.orderId}
              </DialogDescription>
            </DialogHeader>
            <OrderDetailsContent order={selectedOrder} />
          </DialogContent>
        </Dialog>
      )}

      {/* Mobile Drawer */}
      {isMobile && selectedOrder && (
        <Drawer open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Детали заказа</DrawerTitle>
              <DrawerDescription>
                Информация о розничном заказе {selectedOrder.orderId}
              </DrawerDescription>
              <DrawerClose className="absolute right-4 top-4">
                <X className="h-4 w-4" />
              </DrawerClose>
            </DrawerHeader>
            <div className="px-4 pb-4 overflow-y-auto max-h-[80vh]">
              <OrderDetailsContent order={selectedOrder} />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить заказ?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Заказ будет удален навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}