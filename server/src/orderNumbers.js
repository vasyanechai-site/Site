/**
 * Публичный номер заказа (01-12, 02-4) vs технический orderId (ORD-..., RETAIL-...).
 */
export function getDisplayOrderNumber(order) {
  if (!order || typeof order !== "object") return "";
  return (
    order.orderNumber ||
    order.order_number ||
    order.invoiceNumber ||
    order.invoice_number ||
    order.orderId ||
    order.order_id ||
    ""
  );
}
