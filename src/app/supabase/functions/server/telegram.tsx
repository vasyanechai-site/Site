// Telegram notification helper

interface TelegramMessage {
  orderId: string;
  date: string;
  company: string;
  inn: string;
  account: string;
  bik: string;
  contact: string;
  phone: string;
  address: string;
  delivery_address?: string; // Добавляем адрес доставки
  delivery_company: string;
  delivery_method: string;
  items: Array<{
    name: string;
    category?: string;
    kg: number;
    packs200: number;
    subtotal: number;
    type?: string; // Добавляем тип товара
  }>;
  total: number;
  invoiceUrl?: string; // Добавляем ссылку на счет
}

export async function sendTelegramNotification(order: TelegramMessage): Promise<void> {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');

  console.log('Telegram notification - Bot Token exists:', !!botToken);
  console.log('Telegram notification - Chat ID exists:', !!chatId);

  if (!botToken || !chatId) {
    console.log('Telegram credentials not configured, skipping notification');
    return;
  }

  // Проверяем наличие items
  if (!order.items || !Array.isArray(order.items)) {
    console.log('Invalid order items, skipping notification');
    return;
  }

  // Форматируем список товаров
  const itemsList = order.items.map(item => {
    let quantity: string;
    if ((item as any).type === 'coldbrew') {
      quantity = `${item.kg} × 5 л`;
    } else {
      const kgText = item.kg > 0 ? `${item.kg} кг` : '';
      const packsText = item.packs200 > 0 ? `${item.packs200} × 200 г` : '';
      const separator = kgText && packsText ? ', ' : '';
      quantity = `${kgText}${separator}${packsText}`;
    }
    const categoryText = item.category ? ` (${item.category})` : '';
    return `• ${item.name}${categoryText} — ${quantity} — ${item.subtotal.toLocaleString('ru-RU')} ₽`;
  }).join('\n');

  // Подсчитываем общий вес (только зерно и дрипы, не колд брю)
  const totalKg = order.items.reduce((sum, item) => {
    if ((item as any).type === 'coldbrew') return sum;
    return sum + item.kg + (item.packs200 * 0.2);
  }, 0);

  // Формируем сообщение с учетом ссылки на счет
  const invoiceSection = order.invoiceUrl 
    ? `\n\n💳 <b>Счет:</b> <a href="${order.invoiceUrl}">Открыть счет в Точка Банке</a>` 
    : '';

  // Форматируем сообщение
  const message = `
🔔 <b>Новый заказ Nechai Wholesale Coffee</b>

📦 <b>Заказ:</b> <code>${order.orderId}</code>
📅 <b>Дата:</b> ${new Date(order.date).toLocaleString('ru-RU')}

🏢 <b>Компания:</b> <code>${order.company}</code>
ИНН: <code>${order.inn}</code>
Расчетный счет: <code>${order.account}</code>
БИК: <code>${order.bik}</code>
👤 <b>Контакт:</b> <code>${order.contact}</code>
📞 <b>Телефон:</b> <code>${order.phone}</code>
📍 <b>Адрес:</b> <code>${order.address}</code>

🚚 <b>Доставка:</b> <code>${order.delivery_company}</code>
📦 <b>Способ:</b> <code>${order.delivery_method}</code>
📍 <b>Адрес доставки:</b> <code>${order.delivery_address || 'Не указан'}</code>

<b>Состав заказа:</b>
${itemsList}

⚖️ <b>Общий вес:</b> ${totalKg.toFixed(2)} кг
💰 <b>Итого:</b> ${order.total.toLocaleString('ru-RU')} ₽${invoiceSection}
  `.trim();

  console.log('Preparing to send Telegram message...');
  console.log('Chat ID:', chatId);

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    };

    console.log('Sending request to Telegram API...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.log('Failed to send Telegram notification. Status:', response.status);
      console.log('Error response:', JSON.stringify(responseData, null, 2));
    } else {
      console.log('Telegram notification sent successfully!');
      console.log('Response:', JSON.stringify(responseData, null, 2));
    }
  } catch (error) {
    console.log('Error sending Telegram notification:', error);
    console.log('Error details:', JSON.stringify(error, null, 2));
  }
}

// Функция для отправки простого текстового сообщения в Telegram
export async function sendTelegramMessage(message: string): Promise<void> {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');

  console.log('Telegram message - Bot Token exists:', !!botToken);
  console.log('Telegram message - Chat ID exists:', !!chatId);

  if (!botToken || !chatId) {
    console.log('Telegram credentials not configured, skipping message');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    };

    console.log('Sending text message to Telegram API...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.log('Failed to send Telegram message. Status:', response.status);
      console.log('Error response:', JSON.stringify(responseData, null, 2));
    } else {
      console.log('Telegram message sent successfully!');
    }
  } catch (error) {
    console.log('Error sending Telegram message:', error);
  }
}