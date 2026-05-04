/**
 * Telegram Webhook Setup Utilities
 * 
 * Функции для настройки и управления webhook Telegram бота
 */

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

/**
 * Устанавливает webhook для Telegram бота
 */
export async function setWebhook(): Promise<{ success: boolean; message: string; info?: any }> {
  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  
  if (!TELEGRAM_BOT_TOKEN) {
    return {
      success: false,
      message: 'TELEGRAM_BOT_TOKEN не настроен в переменных окружения'
    };
  }

  if (!SUPABASE_URL) {
    return {
      success: false,
      message: 'SUPABASE_URL не настроен в переменных окружения'
    };
  }

  // Извлекаем project ID из SUPABASE_URL
  const projectIdMatch = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
  const projectId = projectIdMatch ? projectIdMatch[1] : null;

  if (!projectId) {
    return {
      success: false,
      message: 'Не удалось определить Project ID из SUPABASE_URL'
    };
  }

  // ВАЖНО: Используем publicAnonKey вместо service role key для webhook URL
  // Это позволит Telegram отправлять запросы с анонимной авторизацией
  const PUBLIC_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  
  // Webhook URL с встроенным анонимным ключом в query параметрах
  // Это обходит проблему с отсутствием Authorization header от Telegram
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/telegram-webhook?apikey=${PUBLIC_ANON_KEY}`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: true // Удаляем старые необработанные обновления
        })
      }
    );

    const data = await response.json();

    if (!data.ok) {
      return {
        success: false,
        message: `Ошибка Telegram API: ${data.description || 'Unknown error'}`
      };
    }

    return {
      success: true,
      message: 'Webhook успешно настроен!',
      info: data.result
    };
  } catch (error) {
    console.error('Error setting webhook:', error);
    return {
      success: false,
      message: `Ошибка настройки webhook: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Получает текущую информацию о webhook
 */
export async function getWebhookInfo(): Promise<{ success: boolean; info?: any; message?: string }> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    );

    const data = await response.json();
    
    if (!response.ok || !data.ok) {
      return {
        success: false,
        message: data.description || 'Ошибка получения информации о webhook'
      };
    }

    return {
      success: true,
      info: data.result
    };
  } catch (error) {
    console.error('Ошибка получения информации о webhook:', error);
    return {
      success: false,
      message: `Ошибка: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Удаляет webhook (для отладки)
 */
export async function deleteWebhook(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`
    );

    const data = await response.json();
    
    if (!response.ok || !data.ok) {
      return {
        success: false,
        message: data.description || 'Ошибка удаления webhook'
      };
    }

    return {
      success: true,
      message: 'Webhook успешно удален'
    };
  } catch (error) {
    console.error('Ошибка удаления webhook:', error);
    return {
      success: false,
      message: `Ошибка: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Тестирует работу бота отправкой сообщения
 */
export async function testBot(chatId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🧪 Тестовое сообщение от бота. Система работает!',
          parse_mode: 'HTML'
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok || !data.ok) {
      return {
        success: false,
        message: data.description || 'Ошибка отправки сообщения'
      };
    }

    return {
      success: true,
      message: 'Тестовое сообщение успешно отправлено'
    };
  } catch (error) {
    console.error('Ошибка тестирования бота:', error);
    return {
      success: false,
      message: `Ошибка: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}