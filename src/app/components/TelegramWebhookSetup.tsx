import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle, AlertCircle, Loader2, Link as LinkIcon, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';

export function TelegramWebhookSetup() {
  const [isLoading, setIsLoading] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);

  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/telegram-webhook`;

  const setupWebhook = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/telegram/webhook/setup`,
        { 
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('✅ Webhook успешно настроен!');
        getWebhookInfo(); // Обновляем информацию
      } else {
        toast.error(`Ошибка: ${data.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Error setting webhook:', error);
      toast.error('Ошибка настройки webhook');
    } finally {
      setIsLoading(false);
    }
  };

  const getWebhookInfo = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/telegram/webhook/info`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        setWebhookInfo(data.info);
      } else {
        toast.error(`Ошибка: ${data.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Error getting webhook info:', error);
      toast.error('Ошибка получения информации');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteWebhook = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/telegram/webhook/delete`,
        { 
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('🗑️ Webhook удален');
        setWebhookInfo(null);
      } else {
        toast.error(`Ошибка: ${data.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Error deleting webhook:', error);
      toast.error('Ошибка удаления webhook');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Настройка Telegram Webhook</CardTitle>
        <CardDescription>
          Автоматическая настройка получения сообщений от бота
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Webhook URL */}
        <div className="space-y-2">
          <div className="text-sm font-semibold">Webhook URL:</div>
          <div className="p-3 bg-muted rounded-lg text-xs font-mono break-all">
            {webhookUrl}
          </div>
        </div>

        {/* Кнопки управления */}
        <div className="flex gap-2">
          <Button
            onClick={setupWebhook}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Настройка...
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4 mr-2" />
                Настроить webhook
              </>
            )}
          </Button>

          <Button
            onClick={getWebhookInfo}
            disabled={isLoading}
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Проверить
          </Button>

          <Button
            onClick={deleteWebhook}
            disabled={isLoading}
            variant="destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Удалить
          </Button>
        </div>

        {/* Информация о webhook */}
        {webhookInfo && (
          <Alert variant={webhookInfo.url === webhookUrl ? 'default' : 'destructive'}>
            {webhookInfo.url === webhookUrl ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Статус:</strong>{' '}
                  {webhookInfo.url === webhookUrl ? (
                    <span className="text-green-600 dark:text-green-400">✅ Настроен правильно</span>
                  ) : webhookInfo.url ? (
                    <span className="text-yellow-600 dark:text-yellow-400">⚠️ Неправильный URL</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">❌ Не настроен</span>
                  )}
                </div>
                {webhookInfo.url && webhookInfo.url !== webhookUrl && (
                  <div className="text-xs">
                    <strong>Текущий URL:</strong>
                    <div className="font-mono bg-muted p-2 rounded mt-1 break-all">
                      {webhookInfo.url}
                    </div>
                  </div>
                )}
                <div>
                  <strong>Получено обновлений:</strong> {webhookInfo.pending_update_count || 0}
                </div>
                {webhookInfo.last_error_date && (
                  <div className="text-xs text-destructive">
                    <strong>Последняя ошибка:</strong> {webhookInfo.last_error_message}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Инструкция */}
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="text-xs space-y-2">
            <div>
              <strong>📋 Инструкция:</strong>
            </div>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Нажмите кнопку "Настроить webhook"</li>
              <li>Дождитесь подтверждения</li>
              <li>Нажмите "Проверить" для проверки статуса</li>
              <li>Напишите боту любое сообщение или команду /start</li>
              <li>Пользователь автоматически появится в списке подписчиков</li>
            </ol>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
