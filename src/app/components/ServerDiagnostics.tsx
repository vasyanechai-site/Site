import { useState } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09`;

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
    setResults(prev => [...prev, result]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);

    // Test 1: Check environment variables
    addResult({
      test: 'Environment Variables',
      status: projectId && publicAnonKey ? 'success' : 'error',
      message: projectId && publicAnonKey 
        ? 'projectId and publicAnonKey are present' 
        : 'Missing environment variables',
      details: { projectId, hasKey: !!publicAnonKey }
    });

    // Test 2: Check if server URL is reachable
    try {
      const healthUrl = `${API_URL}/health`;
      console.log('Testing:', healthUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        addResult({
          test: 'Health Check',
          status: 'success',
          message: `Server is reachable (${response.status})`,
          details: data
        });
      } else {
        addResult({
          test: 'Health Check',
          status: 'error',
          message: `Server returned error: ${response.status} ${response.statusText}`,
          details: { status: response.status, statusText: response.statusText }
        });
      }
    } catch (error) {
      addResult({
        test: 'Health Check',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }

    // Test 3: Try to fetch orders
    try {
      const ordersUrl = `${API_URL}/admin/orders`;
      console.log('Testing:', ordersUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(ordersUrl, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        addResult({
          test: 'Fetch Orders',
          status: 'success',
          message: `Successfully fetched ${Array.isArray(data) ? data.length : 0} orders`,
          details: { count: Array.isArray(data) ? data.length : 0 }
        });
      } else {
        const errorText = await response.text();
        addResult({
          test: 'Fetch Orders',
          status: 'error',
          message: `Failed: ${response.status} ${response.statusText}`,
          details: { status: response.status, error: errorText }
        });
      }
    } catch (error) {
      addResult({
        test: 'Fetch Orders',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }

    // Test 4: Check CORS headers
    try {
      const response = await fetch(`${API_URL}/health`, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization,content-type',
          'Origin': window.location.origin
        }
      });

      const corsHeaders = {
        'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
      };

      addResult({
        test: 'CORS Preflight',
        status: response.status === 204 || response.status === 200 ? 'success' : 'error',
        message: `Preflight response: ${response.status}`,
        details: corsHeaders
      });
    } catch (error) {
      addResult({
        test: 'CORS Preflight',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error
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
          <h3 className="font-bold text-lg mb-2">⚡ Быстрое решение</h3>
          <p className="text-sm mb-3">
            Если видите ошибку "Failed to fetch" - скорее всего Edge Function не развернута.
          </p>
          <a 
            href={`https://supabase.com/dashboard/project/${projectId}/functions/server`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-center"
          >
            🚀 Развернуть Edge Function (Deploy)
          </a>
          <p className="text-xs text-gray-600 mt-2">
            После нажатия Deploy подождите 30-60 секунд и обновите страницу
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
                  <span className="text-2xl">
                    {result.status === 'success' ? '✅' : '❌'}
                  </span>
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
          <h3 className="font-bold mb-2">📋 Информация о сервере</h3>
          <div className="text-sm space-y-1 font-mono">
            <div><strong>Project ID:</strong> {projectId}</div>
            <div><strong>API URL:</strong> {API_URL}</div>
            <div><strong>Has Anon Key:</strong> {publicAnonKey ? 'Да' : 'Нет'}</div>
          </div>
          <div className="mt-4">
            <a 
              href={`https://supabase.com/dashboard/project/${projectId}/functions/server`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              🚀 Открыть Edge Functions в Supabase Dashboard
            </a>
          </div>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
          <h3 className="font-bold mb-2">💡 Что делать при ошибках:</h3>
          <ul className="text-sm space-y-2 list-disc list-inside">
            <li><strong>Health Check failed:</strong> Edge Function не развернута или недоступна. Проверьте Supabase Dashboard → Edge Functions.</li>
            <li><strong>CORS errors:</strong> Сервер не настроен для CORS или использует неправильную конфигурацию.</li>
            <li><strong>403 Forbidden:</strong> Проблема с авторизацией (но админ-панель теперь открыта, так что это не должно происходить).</li>
            <li><strong>Timeout:</strong> Сервер слишком долго отвечает. Проверьте логи в Supabase.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
