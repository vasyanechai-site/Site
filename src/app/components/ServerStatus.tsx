import { useEffect, useState } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

export function ServerStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    checkServer();
  }, []);

  const checkServer = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/exchange-rate`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        setStatus('online');
        console.log('✅ Сервер работает');
      } else {
        setStatus('offline');
        console.log('❌ Сервер не отвечает');
      }
    } catch (error) {
      setStatus('offline');
      console.log('❌ Ошибка подключения к серверу:', error);
    }
  };

  if (status === 'checking') {
    return null;
  }

  if (status === 'offline') {
    return (
      <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-sm">Сервер не отвечает</span>
        </div>
        <p className="text-xs mt-1 opacity-80">
          Проверьте Edge Function в Supabase
        </p>
      </div>
    );
  }

  return null;
}
