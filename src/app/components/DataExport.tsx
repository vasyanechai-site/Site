import { useState } from 'react';
import { Button } from './ui/button';
import { Download, FileJson, Mail, Calendar, Database } from 'lucide-react@0.454.0';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { FadeIn } from './ui/fade-in';
import { toast } from 'sonner@2.0.3';

export function DataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [exportStatus, setExportStatus] = useState('');

  const sendBackupToEmail = async () => {
    try {
      setIsSending(true);
      toast.loading('Создание и отправка бэкапа...');

      const { projectId, publicAnonKey } = await import('../utils/supabase/info');
      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09`;

      const response = await fetch(`${baseUrl}/backup/send-email`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Ошибка отправки');
      }

      const result = await response.json();
      console.log('Backup sent:', result);
      
      toast.success('Бэкап успешно отправлен на dmlomov321@gmail.com!');
    } catch (error) {
      console.error('Error sending backup:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка при отправке бэкапа');
    } finally {
      setIsSending(false);
    }
  };

  const exportAllData = async () => {
    try {
      setIsExporting(true);
      setExportStatus('Экспорт данных...');

      const { projectId, publicAnonKey } = await import('../utils/supabase/info');
      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09`;

      // Получаем все данные
      const [coffeeResponse, ordersResponse, usersResponse, promosResponse, rateResponse] = await Promise.all([
        fetch(`${baseUrl}/coffee-items`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }),
        fetch(`${baseUrl}/orders`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }),
        fetch(`${baseUrl}/users`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }),
        fetch(`${baseUrl}/promo-codes`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }),
        fetch(`${baseUrl}/exchange-rate`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        })
      ]);

      if (!coffeeResponse.ok || !ordersResponse.ok || !usersResponse.ok) {
        throw new Error('Ошибка при получении данных');
      }

      const coffeeItems = await coffeeResponse.json();
      const orders = await ordersResponse.json();
      const users = await usersResponse.json();
      const promoCodes = await promosResponse.json();
      const exchangeRate = await rateResponse.json();

      // Формируем объект с данными
      const exportData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        coffeeItems: coffeeItems,
        orders: orders,
        users: users,
        promoCodes: promoCodes || [],
        exchangeRate: exchangeRate || null,
        stats: {
          totalCoffeeItems: coffeeItems.length,
          totalOrders: orders.length,
          totalUsers: users.length,
          totalPromoCodes: (promoCodes || []).length
        }
      };

      // Создаем и скачиваем JSON файл
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nechai-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus(`Успешно экспортировано: ${exportData.stats.totalCoffeeItems} товаров, ${exportData.stats.totalOrders} заказов, ${exportData.stats.totalUsers} пользователей`);
      toast.success('Файл успешно скачан!');
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('Ошибка при экспорте данных');
      toast.error('Ошибка при экспорте данных');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h2 className="text-foreground mb-2">Бэкапы и экспорт данных</h2>
          <p className="text-sm text-muted-foreground">
            Управление резервными копиями и экспорт данных для переноса проекта
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertTitle>Автоматические бэкапы</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              Система автоматически создает бэкапы каждые 3 дня в 00:00 (МСК) и отправляет их на <strong>dmlomov321@gmail.com</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              💾 Бэкапы хранятся в базе данных (30 последних копий). Автоматически удаляются бэкапы старше 30 дней.
            </p>
          </AlertDescription>
        </Alert>
      </FadeIn>

      <div className="grid gap-6 md:grid-cols-2">
        <FadeIn delay={0.15}>
          <div className="border border-border rounded-lg p-6 space-y-4 h-full">
            <div className="flex items-start gap-4">
              <Mail className="w-10 h-10 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-foreground mb-2">Отправить на почту</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Отправить полный бэкап всех данных на email прямо сейчас.
                </p>
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-muted-foreground">
                    📧 Email: <strong>dmlomov321@gmail.com</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    📦 Включает: товары, заказы, пользователей, промокоды, курс USD
                  </p>
                </div>
                <Button
                  onClick={sendBackupToEmail}
                  disabled={isSending}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  {isSending ? 'Отправка...' : 'Отправить на почту'}
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.18}>
          <div className="border border-border rounded-lg p-6 space-y-4 h-full">
            <div className="flex items-start gap-4">
              <Download className="w-10 h-10 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-foreground mb-2">Скачать файл</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Сохранить бэкап на локальный компьютер в формате JSON.
                </p>
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-muted-foreground">
                    💻 Формат: JSON
                  </p>
                  <p className="text-xs text-muted-foreground">
                    🔄 Для переноса на другую Figma Make
                  </p>
                </div>
                <Button
                  onClick={exportAllData}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Экспорт...' : 'Скачать JSON'}
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>

      {exportStatus && (
        <FadeIn delay={0.2}>
          <div className={`p-4 rounded-lg ${exportStatus.includes('Ошибка') ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'}`}>
            <p className="text-sm">{exportStatus}</p>
          </div>
        </FadeIn>
      )}
    </div>
  );
}