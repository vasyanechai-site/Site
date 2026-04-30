import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RefreshCw } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { eventBus, EVENTS } from '../lib/events';
import { toast } from 'sonner';

interface Registration {
  id: string;
  phone: string;
  companyName: string;
  messenger: 'telegram' | 'whatsapp';
  createdAt: string;
  status: 'pending' | 'processed' | 'rejected';
}

export function RegistrationRequests() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRegistrations();

    // Подписываемся на событие обновления
    eventBus.on(EVENTS.REGISTRATIONS_UPDATED, loadRegistrations);

    return () => {
      eventBus.off(EVENTS.REGISTRATIONS_UPDATED, loadRegistrations);
    };
  }, []);

  const loadRegistrations = async () => {
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
        setRegistrations(data.registrations || []);
      }
    } catch (error) {
      console.error('Failed to load registrations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, status: 'processed' | 'rejected') => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/business-registration/${id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ status })
        }
      );

      if (response.ok) {
        await loadRegistrations();
        eventBus.emit(EVENTS.REGISTRATIONS_UPDATED);
        toast.success(
          status === 'processed' ? 'Заявка помечена как обработанная' : 'Заявка отклонена'
        );
      } else {
        toast.error('Не удалось обновить статус');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Ошибка при обновлении статуса');
    }
  };

  const deleteRegistration = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту заявку?')) {
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/business-registration/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        await loadRegistrations();
        eventBus.emit(EVENTS.REGISTRATIONS_UPDATED);
        toast.success('Заявка удалена');
      } else {
        toast.error('Не удалось удалить заявку');
      }
    } catch (error) {
      console.error('Failed to delete registration:', error);
      toast.error('Ошибка при удалении заявки');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Ожидает</Badge>;
      case 'processed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Обработана</Badge>;
      case 'rejected':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Отклонена</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Загрузка заявок...</div>;
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2>Заявки на регистрацию оптовых клиентов</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={loadRegistrations}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {registrations.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          Заявок пока нет
        </p>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[800px]">
            <thead className="border-b border-border">
              <tr className="text-sm">
                <th className="text-left p-3">Дата</th>
                <th className="text-left p-3">Телефон</th>
                <th className="text-left p-3">Компания</th>
                <th className="text-left p-3">Мессенджер</th>
                <th className="text-left p-3">Статус</th>
                <th className="text-left p-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((registration) => (
                <tr key={registration.id} className="border-b border-border text-sm">
                  <td className="p-3 whitespace-nowrap">
                    {new Date(registration.createdAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="p-3 font-mono whitespace-nowrap">{registration.phone}</td>
                  <td className="p-3">{registration.companyName}</td>
                  <td className="p-3 whitespace-nowrap">
                    {registration.messenger === 'telegram' ? '📱 Telegram' : '💬 WhatsApp'}
                  </td>
                  <td className="p-3">{getStatusBadge(registration.status)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {registration.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(registration.id, 'processed')}
                          >
                            Обработана
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(registration.id, 'rejected')}
                          >
                            Отклонить
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => deleteRegistration(registration.id)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
