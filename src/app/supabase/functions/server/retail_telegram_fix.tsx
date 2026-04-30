// Вспомогательная функция для форматирования розничного заказа для Telegram
export function formatRetailOrderMessage(orderData: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    product: { name: string; price: number };
    weight: string;
    grind: string;
    quantity: number;
  }>;
  total: number;
  createdAt: string;
}): string {
  const { orderId, customerName, customerPhone, items, total, createdAt } = orderData;
  
  let message = `🛍 <b>НОВЫЙ РОЗНИЧНЫЙ ЗАКАЗ #${orderId}</b>\n\n`;
  message += `👤 <b>Клиент:</b> ${customerName}\n`;
  message += `📞 <b>Телефон:</b> ${customerPhone}\n\n`;
  message += `📦 <b>Состав заказа:</b>\n`;
  
  items.forEach((item, index) => {
    message += `${index + 1}. ${item.product.name}\n`;
    message += `   • Вес: ${item.weight}\n`;
    message += `   • Помол: ${item.grind}\n`;
    message += `   • Количество: ${item.quantity} шт.\n`;
    message += `   • Цена: ${item.product.price * item.quantity} ₽\n\n`;
  });
  
  message += `💰 <b>Итого: ${total} ₽</b>\n`;
  message += `\n📅 Дата: ${new Date(createdAt).toLocaleString('ru-RU')}`;
  
  return message;
}
