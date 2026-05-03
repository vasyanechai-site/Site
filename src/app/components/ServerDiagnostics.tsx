import { useState } from 'react';
import { API_BASE_URL } from '../lib/backendConfig';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const viteApiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  details?: any;
}

export function ServerDiagnostics() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (result: DiagnosticResult) => {
    setResults((prev) => [...prev, result]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);

    addResult({
      test: 'Конфигурация API (клиент)',
      status: 'success',
      message: viteApiBase
        ? `VITE_API_BASE_URL задан: ${viteApiBase}`
        : 'VITE_API_BASE_URL не задан — используется относительный путь /api (прокси Vite в dev)',
      details: { API_BASE_URL, viteApiBase: viteApiBase || null },
    });

    try {
      const healthUrl = `${API_BASE_URL}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        mode: 'cors',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        addResult({
          test: 'Health Check',
          status: 'success',
          message: `Сервер отвечает (${response.status})`,
          details: data,
        });
      } else {
        addResult({
          test: 'Health Check',
          status: 'error',
          message: `Ошибка: ${response.status} ${response.statusText}`,
          details: { status: response.status, statusText: response.statusText },
        });
      }
    } catch (error) {
      addResult({
        test: 'Health Check',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }

    try {
      const ordersUrl = `${API_BASE_URL}/admin/orders`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(ordersUrl, {
        method: 'GET',
        mode: 'cors',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        addResult({
          test: 'Fetch Orders (admin)',
          status: 'success',
          message: `Получено заказов: ${Array.isArray(data) ? data.length : 0}`,
          details: { count: Array.isArray(data) ? data.length : 0 },
        });
      } else {
        const errorText = await response.text();
        addResult({
          test: 'Fetch Orders (admin)',
          status: 'error',
          message: `Не удалось: ${response.status} ${response.statusText}`,
          details: { status: response.status, error: errorText },
        });
      }
    } catch (error) {
      addResult({
        test: 'Fetch Orders (admin)',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }

    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization,content-type',
          Origin: window.location.origin,
        },
      });

      const corsHeaders = {
        'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
      };

      addResult({
        test: 'CORS Preflight',
        status: response.status === 204 || response.status === 200 ? 'success' : 'error',
        message: `OPTIONS ответ: ${response.status}`,
        details: corsHeaders,
      });
    } catch (error) {
      addResult({
        test: 'CORS Preflight',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      });
    }

    setIsRunning(false);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto my-8">
      <CardHeader>
        <CardTitle className="text-2xl">🔍 Диагностика сервера</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-lg mb-4">
          <h3 className="font-bold text-lg mb-2">⚡ Подсказка</h3>
          <p className="text-sm mb-3">
            Если видите «Failed to fetch», проверьте, что Node API запущен и что{' '}
            <code className="bg-orange-100 px-1 rounded">VITE_API_BASE_URL</code> указывает на него в проде.
          </p>
        </div>

        <div className="flex gap-4 items-center">
          <Button
            onClick={runDiagnostics}
            disabled={isRunning}
            className="bg-[#E91E63] hover:bg-[#C2185B] text-white"
          >
            {isRunning ? 'Выполняется...' : 'Запустить диагностику'}
          </Button>
          {isRunning && (
            <span className="text-sm text-gray-600">Проверка подключения к серверу...</span>
          )}
        </div>

        {results.length > 0 && (
          <div className="space-y-3 mt-6">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 ${
                  result.status === 'success'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{result.status === 'success' ? '✅' : '❌'}</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{result.test}</h3>
                    <p className="text-sm mb-2">{result.message}</p>
                    {result.details && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                          Детали
                        </summary>
                        <pre className="mt-2 p-2 bg-white rounded border overflow-x-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <h3 className="font-bold mb-2">📋 Базовый URL API</h3>
          <div className="text-sm space-y-1 font-mono break-all">
            <div>
              <strong>API_BASE_URL:</strong> {API_BASE_URL}
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
          <h3 className="font-bold mb-2">💡 Что делать при ошибках:</h3>
          <ul className="text-sm space-y-2 list-disc list-inside">
            <li>
              <strong>Health Check failed:</strong> не запущен процесс API или неверный URL в{' '}
              <code className="bg-yellow-100 px-1 rounded">VITE_API_BASE_URL</code>.
            </li>
            <li>
              <strong>CORS:</strong> на API задайте <code className="bg-yellow-100 px-1 rounded">ALLOWED_ORIGINS</code>{' '}
              с origin фронтенда.
            </li>
            <li>
              <strong>Timeout:</strong> проверьте сеть и логи процесса Node (pm2 / docker).
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
