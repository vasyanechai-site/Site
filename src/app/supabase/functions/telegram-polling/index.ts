import { createClient } from 'jsr:@supabase/supabase-js';

// Edge Function для Long Polling Telegram бота
// Запускается по расписанию каждую минуту через Supabase Cron

const TG_USER_PREFIX = 'telegram_user:';
const LAST_UPDATE_ID_KEY = 'telegram_last_update_id';

Deno.serve(async (req) => {
  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!TELEGRAM_BOT_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured' }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Получаем последний обработанный update_id
    const { data: lastUpdateData } = await supabase
      .from('kv_store_aa167a09')
      .select('value')
      .eq('key', LAST_UPDATE_ID_KEY)
      .single();

    const lastUpdateId = lastUpdateData ? JSON.parse(lastUpdateData.value) : 0;

    console.log('📊 Last processed update_id:', lastUpdateId);

    // Получаем новые обновления от Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`,
      { method: 'GET' }
    );

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    const updates = data.result || [];
    console.log(`📨 Received ${updates.length} updates`);

    let newLastUpdateId = lastUpdateId;
    let processedCount = 0;

    // Обрабатываем каждое обновление
    for (const update of updates) {
      try {
        const chatId = update?.message?.chat?.id;
        const messageText = update?.message?.text || '';
        const username = update?.message?.from?.username || '';
        const firstName = update?.message?.from?.first_name || '';

        console.log(`💬 Processing update ${update.update_id} from chat ${chatId}`);

        if (chatId) {
          // Сохраняем пользователя
          const key = `${TG_USER_PREFIX}${chatId}`;
          const userData = {
            chat_id: chatId,
            username: username || null,
            first_name: firstName || null,
            created_at: new Date().toISOString(),
            last_message: messageText
          };

          await supabase
            .from('kv_store_aa167a09')
            .upsert({
              key: key,
              value: JSON.stringify(userData)
            });

          console.log(`✅ User ${chatId} saved`);

          // Отправляем приветственное сообщение при первом контакте или команде /start
          if (messageText.startsWith('/start') || messageText.toLowerCase().includes('подписаться')) {
            try {
              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: '✅ Вы подписались на рассылку!\n\nТеперь вы будете получать уведомления о новинках и специальных предложениях от нашего магазина кофе.',
                    parse_mode: 'HTML'
                  })
                }
              );
              console.log(`✅ Welcome message sent to ${chatId}`);
            } catch (error) {
              console.error(`❌ Error sending welcome message:`, error);
            }
          }

          processedCount++;
        }

        // Обновляем последний update_id
        if (update.update_id > newLastUpdateId) {
          newLastUpdateId = update.update_id;
        }
      } catch (error) {
        console.error(`❌ Error processing update ${update.update_id}:`, error);
      }
    }

    // Сохраняем новый последний update_id
    if (newLastUpdateId > lastUpdateId) {
      await supabase
        .from('kv_store_aa167a09')
        .upsert({
          key: LAST_UPDATE_ID_KEY,
          value: JSON.stringify(newLastUpdateId)
        });

      console.log(`✅ Updated last_update_id to ${newLastUpdateId}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: processedCount,
        total_updates: updates.length,
        last_update_id: newLastUpdateId
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in telegram polling:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
