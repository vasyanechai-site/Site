import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { eventBus, EVENTS } from '../lib/events';

export function useRegistrationCount() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadCount = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/business-registrations`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const pending = data.registrations?.filter((r: any) => r.status === 'pending').length || 0;
        setPendingCount(pending);
      }
    } catch (error) {
      console.error('Failed to load registration count:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCount();
    
    // Подписываемся на событие обновления заявок
    eventBus.on(EVENTS.REGISTRATIONS_UPDATED, loadCount);
    
    // Обновляем каждые 30 секунд
    const interval = setInterval(loadCount, 30000);
    
    return () => {
      eventBus.off(EVENTS.REGISTRATIONS_UPDATED, loadCount);
      clearInterval(interval);
    };
  }, []);

  return { pendingCount, isLoading, refresh: loadCount };
}
