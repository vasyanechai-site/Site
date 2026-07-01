import type { Order, RetailOrder } from '../types';

type OrderLike = Partial<Order & RetailOrder> | null | undefined;

/** Публичный номер заказа (01-12, 02-4) vs технический orderId (ORD-..., RETAIL-...). */
export function getDisplayOrderNumber(order: OrderLike): string {
  if (!order || typeof order !== 'object') return '';
  return (
    order.orderNumber ||
    order.invoiceNumber ||
    order.orderId ||
    ''
  );
}
