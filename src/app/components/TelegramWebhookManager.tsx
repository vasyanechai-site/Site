/**
 * Telegram Webhook Manager Component
 * 
 * Компонент для настройки и управления webhook Telegram бота
 */

import React, { useState, useEffect } from 'react';
import { TELEGRAM_EDGE_BASE_URL, telegramEdgeHeaders } from '../lib/telegramEdgeConfig';
import { CheckCircle, XCircle, RefreshCw, Trash2, Send, AlertCircle, TestTube } from 'lucide-react';

function telegramAdminBase(): string | null {
  const b = TELEGRAM_EDGE_BASE_URL.trim();
  return b ? b : null;
}

interface WebhookInfo {
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

export function TelegramWebhookManager() {
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testChatId, setTestChatId] = useState('');
  const [testLogs, setTestLogs] = useState<string[]>([]);

  // Загрузить информацию о webhook при монтировании
  useEffect(() => {
    loadWebhookInfo();
  }, []);

  const loadWebhookInfo = async () => {
    setLoading(true);
    setError(null);

    const base = telegramAdminBase();
    if (!base) {
      setError('Задайте VITE_TELEGRAM_EDGE_BASE_URL — база Edge (например …/functions/v1/make-server-aa167a09) для вызовов /telegram/webhook/…');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${base}/telegram/webhook/info`, {
        headers: telegramEdgeHeaders(true),
      });

      const data = await response.json();
      
      if (data.success && data.info) {
        setWebhookInfo(data.info);
      } else {
        setError(data.message || 'Не удалось получить информацию о webhook');
      }
    } catch (err) {
      console.error('Error loading webhook info:', err);
      setError('Ошибка загрузки информации о webhook');
    } finally {
      setLoading(false);
    }
  };

  const setupWebhook = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const base = telegramAdminBase();
    if (!base) {
      setError('Задайте VITE_TELEGRAM_EDGE_BASE_URL');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${base}/telegram/webhook/setup`, {
        method: 'POST',
        headers: telegramEdgeHeaders(true),
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess('✅ Webhook успешно настроен!');
        await loadWebhookInfo();
      } else {
        setError(data.message || 'Не удалось настроить webhook');
      }
    } catch (err) {
      console.error('Error setting up webhook:', err);
      setError('Ошибка настройки webhook');
    } finally {
      setLoading(false);
    }
  };

  const deleteWebhook = async () => {
    if (!confirm('Вы уверены, что хотите удалить webhook? Бот перестанет получать сообщения.')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const base = telegramAdminBase();
    if (!base) {
      setError('Задайте VITE_TELEGRAM_EDGE_BASE_URL');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${base}/telegram/webhook/delete`, {
        method: 'DELETE',
        headers: telegramEdgeHeaders(true),
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess('✅ Webhook успешно удален');
        await loadWebhookInfo();
      } else {
        setError(data.message || 'Не удалось удалить webhook');
      }
    } catch (err) {
      console.error('Error deleting webhook:', err);
      setError('Ошибка удаления webhook');
    } finally {
      setLoading(false);
    }
  };

  const testBot = async () => {
    if (!testChatId.trim()) {
      setError('Введите Chat ID для тестирования');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const base = telegramAdminBase();
    if (!base) {
      setError('Задайте VITE_TELEGRAM_EDGE_BASE_URL');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${base}/telegram/webhook/test`, {
        method: 'POST',
        headers: telegramEdgeHeaders(true),
        body: JSON.stringify({ chatId: testChatId }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess('✅ Тестовое сообщение отправлено!');
        setTestLogs([...testLogs, `Тестовое сообщение отправлено в чат ${testChatId}`]);
      } else {
        setError(data.message || 'Не удалось отправить тестовое сообщение');
        setTestLogs([...testLogs, `Ошибка отправки тестового сообщения в чат ${testChatId}: ${data.message}`]);
      }
    } catch (err) {
      console.error('Error testing bot:', err);
      setError('Ошибка тестирования бота');
      setTestLogs([...testLogs, `Ошибка тестирования бота в чат ${testChatId}: ${err}`]);
    } finally {
      setLoading(false);
    }
  };

  const testWebhookEndpoint = async () => {
    if (!testChatId.trim()) {
      setError('Введите Chat ID для тестирования');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    
    const base = telegramAdminBase();
    if (!base) {
      setError('Задайте VITE_TELEGRAM_EDGE_BASE_URL');
      setLoading(false);
      return;
    }

    const logs: string[] = [];
    logs.push(`🧪 Начало тестирования webhook endpoint`);
    logs.push(`📍 URL: ${base}/telegram-webhook`);

    try {
      // Создаем тестовый update от Telegram
      const testUpdate = {
        update_id: 999999999,
        message: {
          message_id: 123,
          from: {
            id: parseInt(testChatId),
            first_name: 'Test User',
            username: 'testuser'
          },
          chat: {
            id: parseInt(testChatId),
            type: 'private'
          },
          text: 'Тест webhook от админ-панели'
        }
      };
      
      logs.push(`📤 Отправка тестового update...`);
      logs.push(`📋 Update: ${JSON.stringify(testUpdate, null, 2)}`);

      const response = await fetch(`${base}/telegram-webhook`, {
        method: 'POST',
        headers: telegramEdgeHeaders(true),
        body: JSON.stringify(testUpdate),
      });

      logs.push(`📥 Статус ответа: ${response.status} ${response.statusText}`);
      
      const responseText = await response.text();
      logs.push(`📋 Ответ сервера: ${responseText}`);

      if (response.ok) {
        setSuccess('✅ Webhook endpoint работает! Проверьте бота - должно прийти подтверждение.');
        logs.push(`✅ Успех! Webhook endpoint отработал корректно`);
      } else {
        setError(`❌ Ошибка webhook: ${response.status} ${response.statusText}`);
        logs.push(`❌ Ошибка: ${response.status} ${response.statusText}`);
      }
      
      setTestLogs([...testLogs, ...logs]);
    } catch (err) {
      console.error('Error testing webhook endpoint:', err);
      logs.push(`❌ Критическая ошибка: ${err}`);
      setError(`Ошибка тестирования webhook: ${err}`);
      setTestLogs([...testLogs, ...logs]);
    } finally {
      setLoading(false);
    }
  };

  const isWebhookActive = webhookInfo?.url && webhookInfo.url.length > 0;
  const edgeReady = Boolean(telegramAdminBase());

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h2 className="mb-2">Настройка Webhook</h2>
        <p className="text-gray-600">
          Управление webhook для получения сообщений от пользователей Telegram
        </p>
      </div>

      {!edgeReady && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          Укажите <code className="bg-amber-100 px-1 rounded">VITE_TELEGRAM_EDGE_BASE_URL</code> и при необходимости{' '}
          <code className="bg-amber-100 px-1 rounded">VITE_TELEGRAM_EDGE_ANON_KEY</code> в окружении фронтенда — вызовы идут на
          Edge (Telegram), не на основной Node API.
        </div>
      )}

      {/* Сообщения об ошибках и успехе */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-green-800">{success}</p>
          </div>
        </div>
      )}

      {/* Статус webhook */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2">
            {isWebhookActive ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>Webhook активен</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-gray-400" />
                <span>Webhook не настроен</span>
              </>
            )}
          </h3>
          <button
            onClick={loadWebhookInfo}
            disabled={loading || !edgeReady}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
            title="Обновить информацию"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {webhookInfo && (
          <div className="space-y-3 text-sm">
            {webhookInfo.url && (
              <div>
                <span className="text-gray-600">URL:</span>
                <p className="mt-1 font-mono text-xs bg-gray-50 p-2 rounded break-all">
                  {webhookInfo.url}
                </p>
              </div>
            )}

            {webhookInfo.pending_update_count !== undefined && (
              <div>
                <span className="text-gray-600">Необработанных обновлений:</span>
                <span className="ml-2 font-medium">{webhookInfo.pending_update_count}</span>
              </div>
            )}

            {webhookInfo.last_error_message && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-900">
                      Последняя ошибка: {webhookInfo.last_error_message}
                    </p>
                    {webhookInfo.last_error_date && (
                      <p className="text-xs text-yellow-700 mt-1">
                        {new Date(webhookInfo.last_error_date * 1000).toLocaleString('ru-RU')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {webhookInfo.allowed_updates && (
              <div>
                <span className="text-gray-600">Отслеживаемые типы обновлений:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {webhookInfo.allowed_updates.map((update) => (
                    <span
                      key={update}
                      className="px-2 py-1 bg-gray-100 rounded text-xs"
                    >
                      {update}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Действия с webhook */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="mb-4">Управление</h3>
        <div className="flex flex-wrap gap-3">
          {!isWebhookActive ? (
            <button
              onClick={setupWebhook}
              disabled={loading || !edgeReady}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Установить webhook
            </button>
          ) : (
            <>
              <button
                onClick={setupWebhook}
                disabled={loading || !edgeReady}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Переустановить webhook
              </button>
              <button
                onClick={deleteWebhook}
                disabled={loading || !edgeReady}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Удалить webhook
              </button>
            </>
          )}
        </div>
      </div>

      {/* Тестирование бота */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="mb-4">Тестирование</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Chat ID для тестирования:
            </label>
            <input
              type="text"
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
              placeholder="123456789"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Введите Chat ID пользователя для отправки тестового сообщения
            </p>
          </div>
          <button
            onClick={testBot}
            disabled={loading || !edgeReady || !testChatId.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Отправить тестовое сообщение
          </button>
          <button
            onClick={testWebhookEndpoint}
            disabled={loading || !edgeReady || !testChatId.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <TestTube className="w-4 h-4" />
            Тестировать webhook endpoint
          </button>
        </div>
        {testLogs.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm text-gray-600">Логи тестирования:</h4>
              <button
                onClick={() => setTestLogs([])}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Очистить логи
              </button>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 max-h-96 overflow-y-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {testLogs.join('\n')}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Инструкции */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="mb-3 text-blue-900">📘 Инструкция по использованию</h3>
        <div className="space-y-3 text-sm text-blue-800">
          <div>
            <p className="font-medium">1. Настройка webhook:</p>
            <p className="mt-1">Нажмите "Установить webhook" для автоматической настройки</p>
          </div>
          <div>
            <p className="font-medium">2. Получение Chat ID:</p>
            <p className="mt-1">Пользователь должен написать боту команду <code className="bg-blue-100 px-1 rounded">/start</code> или слово "подписаться", его Chat ID будет сохранен автоматически</p>
          </div>
          <div>
            <p className="font-medium">3. Как найти свой Chat ID:</p>
            <p className="mt-1">Напишите боту <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline">@userinfobot</a> команду /start - он покажет ваш ID</p>
          </div>
          <div>
            <p className="font-medium">4. Тестирование:</p>
            <p className="mt-1">Используйте реальный Chat ID для проверки работы бота</p>
          </div>
          <div>
            <p className="font-medium">5. Проверка статуса:</p>
            <p className="mt-1">Обновляйте информацию о webhook для проверки наличия ошибок</p>
          </div>
        </div>
      </div>
    </div>
  );
}