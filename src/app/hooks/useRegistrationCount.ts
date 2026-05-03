import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../lib/backendConfig';
import { eventBus, EVENTS } from '../lib/events';

export function useRegistrationCount() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadCount = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/business-registrations`);

      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : data.registrations || [];
        const pending = list.filter((r: any) => r.status === 'pending').length || 0;
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
