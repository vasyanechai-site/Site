/**
 * Supabase Edge Function для автоматической проверки статусов оплаты
 * Запускается по расписанию через Supabase Cron
 * 
 * Настройка в Supabase Dashboard:
 * 1. Перейти в Edge Functions → payment-status-checker
 * 2. Settings → Cron
 * 3. Установить расписание: */5 * * * * (каждые 5 минут)
 */

Deno.serve(async (req) => {
  console.log('⏰ Payment Status Checker Cron Job started');
  
  try {
    // Получаем конфигурацию из переменных окружения
    const projectId = Deno.env.get('SUPABASE_URL')?.replace('https://', '').replace('.supabase.co', '') || '';
    const publicAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    if (!projectId || !publicAnonKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    }
    
    // Вызываем endpoint для массовой проверки статусов
    const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail/check-pending-payments`;
    
    console.log('📡 Calling server endpoint:', serverUrl);
    
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Server endpoint failed:', response.status, errorText);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Server endpoint failed',
        details: errorText
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await response.json();
    console.log('✅ Payment check completed:', result);
    
    return new Response(JSON.stringify({ 
      success: true,
      timestamp: new Date().toISOString(),
      ...result
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Cron job error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});