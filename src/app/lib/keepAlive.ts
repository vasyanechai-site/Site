import { projectId, publicAnonKey } from '../utils/supabase/info';

const KEEP_ALIVE_KEY = 'nechai_last_keep_alive';
const KEEP_ALIVE_INTERVAL = 5 * 24 * 60 * 60 * 1000; // 5 дней в миллисекундах

/**
 * Автоматический keep-alive для предотвращения отключения базы данных
 * Вызывается при загрузке приложения
 */
export async function autoKeepAlive(): Promise<void> {
  try {
    const lastKeepAlive = localStorage.getItem(KEEP_ALIVE_KEY);
    const now = Date.now();
    
    // Проверяем, нужно ли отправлять keep-alive
    if (!lastKeepAlive || now - parseInt(lastKeepAlive) > KEEP_ALIVE_INTERVAL) {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/keep-alive`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        localStorage.setItem(KEEP_ALIVE_KEY, now.toString());
      }
    }
  } catch (error) {
    // Тихо игнорируем ошибки keep-alive
  }
}