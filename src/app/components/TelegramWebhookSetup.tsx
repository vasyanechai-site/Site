import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle, AlertCircle, Loader2, Link as LinkIcon, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { TELEGRAM_EDGE_BASE_URL, telegramEdgeHeaders } from '../lib/telegramEdgeConfig';

export function TelegramWebhookSetup() {
  const [isLoading, setIsLoading] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);

  const base = TELEGRAM_EDGE_BASE_URL;
  const webhookUrl = base ? `${base}/telegram-webhook` : '';

  const ensureBase = () => {
    if (!base) {
      toast.error('Задайте VITE_TELEGRAM_EDGE_BASE_URL (база Edge с маршрутами telegram/*).');
      return false;
    }
    return true;
  };

  const setupWebhook = async () => {
    if (!ensureBase()) return;
    try {
      setIsLoading(true);

      const response = await fetch(`${base}/telegram/webhook/setup`, {
        method: 'POST',
        headers: telegramEdgeHeaders(true),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('✅ Webhook успешно настроен!');
        getWebhookInfo();
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
    if (!ensureBase()) return;
    try {
      setIsLoading(true);

      const response = await fetch(`${base}/telegram/webhook/info`, {
        headers: telegramEdgeHeaders(false),
      });

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
    if (!ensureBase()) return;
    try {
      setIsLoading(true);

      const response = await fetch(`${base}/telegram/webhook/delete`, {
        method: 'DELETE',
        headers: telegramEdgeHeaders(false),
      });

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
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="w-5 h-5" />
          Настройка Telegram Webhook
        </CardTitle>
        <CardDescription>
          Только если админка Telegram на отдельном Edge: задайте{' '}
          <code className="text-xs">VITE_TELEGRAM_EDGE_BASE_URL</code> и при необходимости{' '}
          <code className="text-xs">VITE_TELEGRAM_EDGE_ANON_KEY</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!base && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Переменная <code>VITE_TELEGRAM_EDGE_BASE_URL</code> не задана — настройка webhook из этой панели
              недоступна.
            </AlertDescription>
          </Alert>
        )}

        {webhookUrl && (
          <div className="p-3 bg-muted rounded-lg text-sm break-all">
            <strong>URL webhook:</strong> {webhookUrl}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={setupWebhook} disabled={isLoading || !base}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Настроить
          </Button>
          <Button variant="outline" onClick={getWebhookInfo} disabled={isLoading || !base}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Обновить инфо
          </Button>
          <Button variant="destructive" onClick={deleteWebhook} disabled={isLoading || !base}>
            <Trash2 className="w-4 h-4 mr-1" />
            Удалить
          </Button>
        </div>

        {webhookInfo && (
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-60">
            {JSON.stringify(webhookInfo, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
