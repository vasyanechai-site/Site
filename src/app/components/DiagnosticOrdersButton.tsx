import { useState } from 'react';
import { findOrdersByTotal } from '../lib/api';

export function DiagnosticOrdersButton() {
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const targetTotals = [4820, 1780, 2455];

  const handleSearch = async () => {
    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      console.log('Searching for orders with totals:', targetTotals);
      const found = await findOrdersByTotal(targetTotals);
      console.log('Search results:', found);
      setResult(found);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Search error:', errorMsg);
      setError(errorMsg);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg p-6 bg-white">
      <h3 className="mb-4">🔍 Диагностика заказов</h3>
      
      <p className="text-sm text-gray-600 mb-4">
        Поиск заказов на суммы: {targetTotals.join(', ')} ₽
      </p>

      <button
        onClick={handleSearch}
        disabled={isSearching}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isSearching ? 'Поиск...' : 'Найти заказы'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">
            ❌ Ошибка: {error}
          </p>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <h4 className="mb-2">📊 Результаты поиска:</h4>
            <div className="space-y-2 text-sm">
              <p>🏢 Оптовых заказов: {result.wholesale?.length || 0}</p>
              <p>🛒 Розничных заказов: {result.retail?.length || 0}</p>
              <p className="text-orange-600">⚠️ Проблемных заказов: {result.misplaced?.length || 0}</p>
            </div>
          </div>

          {result.wholesale && result.wholesale.length > 0 && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded">
              <h4 className="mb-2">🏢 Оптовые заказы:</h4>
              <div className="space-y-2 text-sm font-mono">
                {result.wholesale.map((order: any) => (
                  <div key={order.orderId} className="p-2 bg-white border border-gray-200 rounded">
                    <p>ID: {order.orderId}</p>
                    <p>Сумма: {order.total} ₽</p>
                    <p className="text-blue-600">Ключ БД: {order._key}</p>
                    {order._reason && (
                      <p className="text-orange-600">⚠️ {order._reason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.retail && result.retail.length > 0 && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded">
              <h4 className="mb-2">🛒 Розничные заказы:</h4>
              <div className="space-y-2 text-sm font-mono">
                {result.retail.map((order: any) => (
                  <div key={order.orderId} className="p-2 bg-white border border-gray-200 rounded">
                    <p>ID: {order.orderId}</p>
                    <p>Сумма: {order.total} ₽</p>
                    <p className="text-blue-600">Ключ БД: {order._key}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.misplaced && result.misplaced.length > 0 && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded">
              <h4 className="mb-2">⚠️ Проблемные заказы:</h4>
              <div className="space-y-2 text-sm font-mono">
                {result.misplaced.map((order: any) => (
                  <div key={order.orderId} className="p-2 bg-white border border-orange-300 rounded">
                    <p>ID: {order.orderId}</p>
                    <p>Сумма: {order.total} ₽</p>
                    <p className="text-blue-600">Ключ БД: {order._key}</p>
                    <p className="text-orange-600">Причина: {order._reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
