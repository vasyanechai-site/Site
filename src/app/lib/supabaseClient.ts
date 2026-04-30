import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;

// Настройки для максимально длительного хранения сессии
export const supabase = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    // Хранить сессию в localStorage (не в sessionStorage)
    storage: localStorage,
    // Автоматически обновлять токен при истечении
    autoRefreshToken: true,
    // Обнаруживать сессии в других вкладках
    detectSessionInUrl: true,
    // Персистентная сессия (сохраняется между закрытиями браузера)
    persistSession: true,
    // Политика хранения - использовать localStorage
    storageKey: 'nechai-supabase-auth',
    // Максимальное время жизни сессии - используем значения по умолчанию Supabase
    // (обычно refresh token действителен 30 дней, access token обновляется автоматически)
  }
});
