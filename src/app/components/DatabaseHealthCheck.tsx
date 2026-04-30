import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { CheckCircle2, XCircle, Loader2, RefreshCw, Info } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'checking';
  message?: string;
  data?: any;
}

export function DatabaseHealthCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<HealthStatus[]>([]);

  const checkHealth = async () => {
    setIsChecking(true);
    const checks: HealthStatus[] = [];

    try {
      // 1. Проверка Exchange Rate
      checks.push({ service: 'Курс доллара', status: 'checking' });
      setResults([...checks]);
      
      try {
        const rateResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/exchange-rate`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );
        
        if (rateResponse.ok) {
          const rateData = await rateResponse.json();
          checks[checks.length - 1] = {
            service: 'Курс доллара',
            status: 'healthy',
            message: `${rateData.usd_to_rub} ₽/$`,
            data: rateData
          };
        } else {
          checks[checks.length - 1] = {
            service: 'Курс доллара',
            status: 'unhealthy',
            message: `Ошибка: ${rateResponse.status}`
          };
        }
      } catch (error) {
        checks[checks.length - 1] = {
          service: 'Курс доллара',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Ошибка запроса'
        };
      }
      setResults([...checks]);

      // 2. Проверка Coffee Items
      checks.push({ service: 'Товары кофе', status: 'checking' });
      setResults([...checks]);
      
      try {
        const itemsResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/coffee-items`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );
        
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          checks[checks.length - 1] = {
            service: 'Товары кофе',
            status: 'healthy',
            message: `Загружено ${itemsData.length} товаров`,
            data: itemsData
          };
        } else {
          checks[checks.length - 1] = {
            service: 'Товары кофе',
            status: 'unhealthy',
            message: `Ошибка: ${itemsResponse.status}`
          };
        }
      } catch (error) {
        checks[checks.length - 1] = {
          service: 'Товары кофе',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Ошибка запроса'
        };
      }
      setResults([...checks]);

      // 3. Проверка Orders
      checks.push({ service: 'Заказы', status: 'checking' });
      setResults([...checks]);
      
      try {
        const ordersResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/orders`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );
        
        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          checks[checks.length - 1] = {
            service: 'Заказы',
            status: 'healthy',
            message: `Найдено ${ordersData.length} заказов`,
            data: ordersData
          };
        } else {
          checks[checks.length - 1] = {
            service: 'Заказы',
            status: 'unhealthy',
            message: `Ошибка: ${ordersResponse.status}`
          };
        }
      } catch (error) {
        checks[checks.length - 1] = {
          service: 'Заказы',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Ошибка запроса'
        };
      }
      setResults([...checks]);

      // 4. Проверка Users
      checks.push({ service: 'Пользователи', status: 'checking' });
      setResults([...checks]);
      
      try {
        const usersResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/users`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );
        
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          checks[checks.length - 1] = {
            service: 'Пользователи',
            status: 'healthy',
            message: `Найдено ${usersData.length} пользователей`,
            data: usersData
          };
        } else {
          checks[checks.length - 1] = {
            service: 'Пользователи',
            status: 'unhealthy',
            message: `Ошибка: ${usersResponse.status}`
          };
        }
      } catch (error) {
        checks[checks.length - 1] = {
          service: 'Пользователи',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Ошибка запроса'
        };
      }
      setResults([...checks]);

      // 5. Проверка Promo Codes
      checks.push({ service: 'Промокоды', status: 'checking' });
      setResults([...checks]);
      
      try {
        const promosResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/promo-codes`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );
        
        if (promosResponse.ok) {
          const promosData = await promosResponse.json();
          checks[checks.length - 1] = {
            service: 'Промокоды',
            status: 'healthy',
            message: `Найдено ${promosData.length} промокодов`,
            data: promosData
          };
        } else {
          checks[checks.length - 1] = {
            service: 'Промокоды',
            status: 'unhealthy',
            message: `Ошибка: ${promosResponse.status}`
          };
        }
      } catch (error) {
        checks[checks.length - 1] = {
          service: 'Промокоды',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Ошибка запроса'
        };
      }
      setResults([...checks]);

    } catch (error) {
      console.error('Health check error:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'checking':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusColor = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 border-green-200';
      case 'unhealthy':
        return 'bg-red-50 border-red-200';
      case 'checking':
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>О проверке базы данных</AlertTitle>
        <AlertDescription className="text-sm space-y-2">
          <p>
            Приложение использует таблицу <code className="bg-muted px-1 py-0.5 rounded">kv_store_22d84083</code> для хранения всех данных (key-value хранилище).
          </p>
          <p className="mt-2">
            <strong>Что проверяется:</strong> Курс доллара, Товары кофе, Заказы, Пользователи, Промокоды.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            💡 Если вы только что восстановили проект Supabase, подождите 5-10 минут для полной инициализации сервисов.
          </p>
        </AlertDescription>
      </Alert>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-foreground mb-1">Проверка состояния базы данных</h3>
            <p className="text-sm text-muted-foreground">
              Проверка доступности всех сервисов и данных
            </p>
          </div>
          <Button
            onClick={checkHealth}
            disabled={isChecking}
            variant="outline"
          >
            {isChecking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Проверка...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Проверить
              </>
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border transition-all ${getStatusColor(result.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {result.service}
                      </p>
                      {result.message && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !isChecking && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">
              Нажмите "Проверить" для запуска диагностики
            </p>
          </div>
        )}

        {results.length > 0 && !isChecking && (
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-2">Сводка</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {results.filter(r => r.status === 'healthy').length}
                </p>
                <p className="text-xs text-muted-foreground">Работает</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {results.filter(r => r.status === 'unhealthy').length}
                </p>
                <p className="text-xs text-muted-foreground">Ошибки</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {results.length}
                </p>
                <p className="text-xs text-muted-foreground">Всего</p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}