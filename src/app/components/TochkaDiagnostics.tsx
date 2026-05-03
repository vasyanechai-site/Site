import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { API_BASE_URL, API_AUTH_HEADER } from '../lib/backendConfig';
import { getTochkaDebugRetailers, logLinesForRetailersResponse } from '../lib/tochkaDebugGetRetailers';

interface DiagnosticResult {
  success: boolean;
  test?: {
    apiBase: string;
    customerCode: string;
    jwtTokenExists: boolean;
    jwtTokenRawLength?: number;
    jwtTokenCleanedLength?: number;
    jwtTokenLength?: number; // для обратной совместимости
    jwtTokenStart: string;
    authorizationHeader: string;
    hasNewlineInRaw?: boolean;
    hasWhitespaceInRaw?: boolean;
    hasNewlineInCleaned?: boolean;
    hasWhitespaceInCleaned?: boolean;
    // Retail токен
    retailJwtTokenExists?: boolean;
    retailJwtTokenRawLength?: number;
    retailJwtTokenCleanedLength?: number;
    retailJwtTokenStart?: string;
    // Wholesale токен
    wholesaleJwtTokenExists?: boolean;
    wholesaleJwtTokenRawLength?: number;
    wholesaleJwtTokenCleanedLength?: number;
    wholesaleJwtTokenStart?: string;
    validation?: {
      tokenValid?: boolean;
      wholesaleTokenValid?: boolean;
      retailTokenValid?: boolean;
      apiBaseValid: boolean;
      customerCodeValid: boolean;
      allValid: boolean;
    };
  };
  error?: string;
}

export function TochkaDiagnostics() {
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retailersLog, setRetailersLog] = useState<string | null>(null);
  const [retailersLoading, setRetailersLoading] = useState(false);

  const runDiagnostics = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/tochka/acquiring/test-token`,
        {
          headers: {
            ...API_AUTH_HEADER
          }
        }
      );

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadRetailers = async () => {
    setRetailersLoading(true);
    setRetailersLog(null);
    try {
      const { httpStatus, data } = await getTochkaDebugRetailers();
      setRetailersLog(logLinesForRetailersResponse(httpStatus, data).join('\n'));
    } catch (error) {
      setRetailersLog(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setRetailersLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl mb-6">🔍 Диагностика интеграции Точка Банк</h1>

      <Card className="p-6 mb-6">
        <h2 className="text-xl mb-4">Проверка переменных окружения</h2>
        <p className="text-muted-foreground mb-4">
          Этот инструмент проверяет, что все необходимые переменные для интеграции с Точка Банком настроены корректно.
        </p>
        
        <Button 
          onClick={runDiagnostics} 
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Проверка...
            </>
          ) : (
            'Запустить диагностику'
          )}
        </Button>
      </Card>

      <Card className="p-6 mb-6 border-primary/30 bg-primary/5">
        <h2 className="text-xl mb-2">Get Retailers (terminalId)</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Метод Точки <code className="text-xs bg-muted px-1 rounded">GET …/acquiring/v1.0/retailers</code> через ваш API{' '}
          <code className="text-xs bg-muted px-1 rounded">/api/debug/tochka/retailers</code>. В ответе — пары{' '}
          <code className="text-xs">merchantId</code> и <code className="text-xs">terminalId</code> для переменных{' '}
          <code className="text-xs">TOCHKA_MERCHANT_ID</code> и <code className="text-xs">TOCHKA_TERMINAL_ID</code>. Тот же сценарий,
          что кнопка на <code className="text-xs">/debug</code> → вкладка «Точка».
        </p>
        <Button type="button" onClick={() => void loadRetailers()} disabled={retailersLoading} className="w-full sm:w-auto gap-2">
          {retailersLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Запросить Get Retailers
        </Button>
        {retailersLog ? (
          <pre className="mt-4 text-xs font-mono whitespace-pre-wrap break-words max-h-[480px] overflow-y-auto bg-muted/50 rounded-lg p-4 border">
            {retailersLog}
          </pre>
        ) : null}
      </Card>

      {result && (
        <Card className="p-6">
          <h2 className="text-xl mb-4">Результаты диагностики</h2>

          {result.error ? (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-900">Ошибка</p>
                <p className="text-red-700">{result.error}</p>
              </div>
            </div>
          ) : result.test ? (
            <div className="space-y-4">
              {/* API Base */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                {result.test.apiBase && result.test.apiBase !== 'MISSING' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium">TOCHKA_API_BASE</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {result.test.apiBase}
                  </p>
                </div>
              </div>

              {/* Customer Code */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                {result.test.customerCode === '303195679' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium">TOCHKA_CUSTOMER_CODE</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {result.test.customerCode}
                  </p>
                  {result.test.customerCode !== '303195679' && (
                    <p className="text-sm text-red-600 mt-1">
                      Ожидается: 303195679
                    </p>
                  )}
                </div>
              </div>

              {/* JWT Token */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                {result.test.jwtTokenExists && (result.test.jwtTokenCleanedLength || result.test.jwtTokenLength) > 500 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : result.test.jwtTokenExists && (result.test.jwtTokenCleanedLength || result.test.jwtTokenLength) > 0 ? (
                  <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium">TOCHKA_JWT_TOKEN (Wholesale / B2B)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Используется для оптовых платежей</p>
                  <div className="space-y-1 mt-1">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Существует:</span>{' '}
                      <span className={result.test.jwtTokenExists ? 'text-green-600' : 'text-red-600'}>
                        {result.test.jwtTokenExists ? 'Да ✓' : 'Нет ✗'}
                      </span>
                    </p>
                    
                    {/* Показываем обе длины если доступны */}
                    {result.test.jwtTokenRawLength !== undefined && result.test.jwtTokenCleanedLength !== undefined ? (
                      <>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Исходная длина:</span>{' '}
                          <span className={result.test.jwtTokenRawLength > result.test.jwtTokenCleanedLength ? 'text-yellow-600' : 'text-green-600'}>
                            {result.test.jwtTokenRawLength} символов
                            {result.test.jwtTokenRawLength > result.test.jwtTokenCleanedLength && ' ⚠️ (есть пробелы/переводы)'}
                          </span>
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">После очистки:</span>{' '}
                          <span className={result.test.jwtTokenCleanedLength > 500 ? 'text-green-600' : result.test.jwtTokenCleanedLength > 0 ? 'text-yellow-600' : 'text-red-600'}>
                            {result.test.jwtTokenCleanedLength} символов
                            {result.test.jwtTokenCleanedLength > 500 && ' ✓'}
                            {result.test.jwtTokenCleanedLength > 0 && result.test.jwtTokenCleanedLength <= 500 && ' (ожидается ~572)'}
                          </span>
                        </p>
                        
                        {/* Показываем статус очистки */}
                        {(result.test.hasNewlineInRaw || result.test.hasWhitespaceInRaw) && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Очистка:</span>{' '}
                            <span className={!result.test.hasNewlineInCleaned && !result.test.hasWhitespaceInCleaned ? 'text-green-600' : 'text-red-600'}>
                              {!result.test.hasNewlineInCleaned && !result.test.hasWhitespaceInCleaned 
                                ? '✓ Успешно (удалены пробелы/переводы)'
                                : '✗ Ошибка очистки'
                              }
                            </span>
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Длина:</span>{' '}
                        <span className={result.test.jwtTokenLength > 500 ? 'text-green-600' : result.test.jwtTokenLength > 0 ? 'text-yellow-600' : 'text-red-600'}>
                          {result.test.jwtTokenLength || 0} символов
                          {result.test.jwtTokenLength > 500 && ' ✓'}
                          {result.test.jwtTokenLength > 0 && result.test.jwtTokenLength <= 500 && ' (ожидается ~572)'}
                        </span>
                      </p>
                    )}
                    
                    {result.test.jwtTokenStart && result.test.jwtTokenStart !== 'MISSING' && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Начало:</span>{' '}
                        <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">
                          {result.test.jwtTokenStart}
                        </code>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Authorization Header */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                {result.test.authorizationHeader && !result.test.authorizationHeader.includes('MISSING') ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium">Authorization Header (Wholesale)</p>
                  <p className="text-sm text-muted-foreground font-mono text-xs break-all">
                    {result.test.authorizationHeader}
                  </p>
                </div>
              </div>

              {/* Retail JWT Token - ВАЖНО для онлайн-платежей! */}
              {result.test.retailJwtTokenExists !== undefined && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                  {result.test.retailJwtTokenExists && result.test.retailJwtTokenCleanedLength > 500 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : result.test.retailJwtTokenExists && result.test.retailJwtTokenCleanedLength > 0 ? (
                    <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-blue-900">TOCHKA_RETAIL_JWT_TOKEN 🔥</p>
                    <p className="text-xs text-blue-700 mt-0.5 font-semibold">⚠️ ОБЯЗАТЕЛЕН для розничных платежей (карта/СБП)</p>
                    <div className="space-y-1 mt-2">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Существует:</span>{' '}
                        <span className={result.test.retailJwtTokenExists ? 'text-green-600' : 'text-red-600'}>
                          {result.test.retailJwtTokenExists ? 'Да ✓' : 'Нет ✗ - Добавьте СРОЧНО!'}
                        </span>
                      </p>
                      
                      {result.test.retailJwtTokenExists && result.test.retailJwtTokenRawLength !== undefined && result.test.retailJwtTokenCleanedLength !== undefined && (
                        <>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Исходная длина:</span>{' '}
                            <span className={result.test.retailJwtTokenRawLength > result.test.retailJwtTokenCleanedLength ? 'text-yellow-600' : 'text-green-600'}>
                              {result.test.retailJwtTokenRawLength} символов
                              {result.test.retailJwtTokenRawLength > result.test.retailJwtTokenCleanedLength && ' ⚠️ (есть пробелы/переводы)'}
                            </span>
                          </p>
                          <p className="text-sm">
                            <span className="text-muted-foreground">После очистки:</span>{' '}
                            <span className={result.test.retailJwtTokenCleanedLength > 500 ? 'text-green-600' : result.test.retailJwtTokenCleanedLength > 0 ? 'text-yellow-600' : 'text-red-600'}>
                              {result.test.retailJwtTokenCleanedLength} символов
                              {result.test.retailJwtTokenCleanedLength > 500 && ' ✓'}
                              {result.test.retailJwtTokenCleanedLength > 0 && result.test.retailJwtTokenCleanedLength <= 500 && ' (ожидается ~572)'}
                            </span>
                          </p>
                        </>
                      )}
                      
                      {result.test.retailJwtTokenStart && result.test.retailJwtTokenStart !== 'MISSING' && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Начало:</span>{' '}
                          <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">
                            {result.test.retailJwtTokenStart}
                          </code>
                        </p>
                      )}
                      
                      {!result.test.retailJwtTokenExists && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-xs text-red-800 font-semibold">
                            ⚠️ БЕЗ ЭТОГО ТОКЕНА ОНЛАЙН-ПЛАТЕЖИ НЕ БУДУТ РАБОТАТЬ!
                          </p>
                          <p className="text-xs text-red-700 mt-1">
                            Ошибка 403 Forbidden by consent означает, что используется оптовый токен вместо розничного.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="mt-6 p-4 border-t">
                {result.test.jwtTokenExists && 
                 ((result.test.jwtTokenCleanedLength || result.test.jwtTokenLength || 0) > 500) && 
                 result.test.customerCode === '303195679' &&
                 result.test.apiBase && result.test.apiBase !== 'MISSING' ? (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-900 text-lg">
                        ✅ Все настроено правильно!
                      </p>
                      <p className="text-green-700 mt-1">
                        Интеграция с Точка Банком готова к использованию. 
                        Попробуйте создать тестовый заказ с онлайн-оплатой.
                      </p>
                      {result.test.jwtTokenRawLength && result.test.jwtTokenCleanedLength && 
                       result.test.jwtTokenRawLength > result.test.jwtTokenCleanedLength && (
                        <p className="text-green-700 mt-2 text-sm">
                          ℹ️ Токен содержал пробелы/переводы строк, но был автоматически очищен.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-900 text-lg">
                        ⚠️ Требуется внимание
                      </p>
                      <ul className="text-yellow-700 mt-2 space-y-1 text-sm">
                        {!result.test.jwtTokenExists && (
                          <li>• JWT токен отсутствует - добавьте TOCHKA_JWT_TOKEN в Supabase Secrets</li>
                        )}
                        {result.test.jwtTokenExists && ((result.test.jwtTokenCleanedLength || result.test.jwtTokenLength || 0) <= 500) && (
                          <li>• JWT токен слишком короткий - убедитесь, что скопировали его полностью</li>
                        )}
                        {result.test.customerCode !== '303195679' && (
                          <li>• Customer Code неправильный - должен быть 303195679</li>
                        )}
                        {(!result.test.apiBase || result.test.apiBase === 'MISSING') && (
                          <li>• API Base отсутствует - добавьте TOCHKA_API_BASE в Supabase Secrets</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </Card>
      )}

      <Card className="p-6 mt-6 bg-blue-50 border-blue-200">
        <h3 className="font-medium mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          Справка
        </h3>
        <div className="text-sm text-blue-900 space-y-2">
          <p>
            <strong>Где настроить переменные:</strong><br />
            Supabase Dashboard → Edge Functions → Secrets (Environment Variables)
          </p>
          <p>
            <strong>Необходимые переменные:</strong>
          </p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li><code>TOCHKA_API_BASE</code> = https://enter.tochka.com</li>
            <li><code>TOCHKA_CUSTOMER_CODE</code> = 303195679</li>
            <li><code>TOCHKA_JWT_TOKEN</code> = (ваш JWT токен, ~572 символа)</li>
          </ul>
          <p className="mt-3">
            После изменения переменных подождите 30-60 секунд и повторите диагностику.
          </p>
        </div>
      </Card>
    </div>
  );
}