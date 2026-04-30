// Форматирование Telegram сообщений для розничных заказов
// Исправлена кодировка UTF-8

export function formatRetailOrderTelegramMessage(
  order: any,
  invoiceUrl?: string
): string {
  const itemsList = order.items.map((item: any, index: number) => {
    const weightText = item.weight ? ` (${item.weight})` : '';
    const roastText = item.roast ? ` - ${item.roast}` : '';
    const grindText = item.grind ? ` - ${item.grind}` : '';
    return `${index + 1}. ${item.name}${weightText}${roastText}${grindText} × ${item.quantity} шт. — ${item.subtotal.toLocaleString('ru-RU')} ₽`;
  }).join('\n');

  let deliveryText = '🏪 Самовывоз';
  if (order.delivery_method === 'cdek') {
    deliveryText = `🚚 Доставка СДЭК: ${order.delivery_address}`;
    if (order.delivery_cost > 0) {
      deliveryText += `\n💰 Стоимость доставки: ${order.delivery_cost} ₽`;
    } else {
      deliveryText += `\n💰 Доставка: Бесплатно`;
    }
    if (order.cdek_number) {
      deliveryText += `\n📦 Трек-номер СДЭК: <code>${order.cdek_number}</code>`;
    }
    if (order.cdek_status === 'failed' || order.cdek_status === 'error') {
      deliveryText += `\n⚠️ <b>ВНИМАНИЕ:</b> Ошибка при создании заказа в СДЭК`;
      if (order.cdek_error?.message) {
        deliveryText += `\n❌ Ошибка: ${order.cdek_error.message}`;
      }
    }
  } else if (order.delivery_method === 'delivery') {
    deliveryText = `🚚 Доставка: ${order.delivery_address}`;
  }

  const message = `
🛍 <b>НОВЫЙ РОЗНИЧНЫЙ ЗАКАЗ</b>

📦 <b>Заказ:</b> <code>${order.orderId}</code>
📅 <b>Дата:</b> ${new Date(order.date).toLocaleString('ru-RU')}

👤 <b>Клиент:</b> ${order.contact}
📞 <b>Телефон:</b> ${order.phone}
${order.email ? `📧 <b>Email:</b> ${order.email}\n` : ''}
${deliveryText}

<b>Состав заказа:</b>
${itemsList}

${order.subtotal ? `💵 <b>Сумма товаров:</b> ${order.subtotal.toLocaleString('ru-RU')} ₽\n` : ''}💰 <b>Итого:</b> ${order.total.toLocaleString('ru-RU')} ₽
${invoiceUrl ? `\n🧾 <b>Счет в ЛК Точка:</b> ${invoiceUrl}` : ''}
  `.trim();

  return message;
}
