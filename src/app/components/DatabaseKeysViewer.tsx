import { useState } from 'react';
import { listAllOrderKeys, deleteOrdersByKeys } from '../lib/api';
import { eventBus, EVENTS } from '../lib/events';
import { Button } from './ui/button';

interface KeyInfo {
  key: string;
  orderId: string;
  total: number;
  date: string;
  orderType?: string;
  company?: string;
  customerName?: string;
  isRetailInWholesale?: boolean;
}

interface DatabaseKeysData {
  wholesale: KeyInfo[];
  retail: KeyInfo[];
  problematic: KeyInfo[];
  summary: {
    wholesaleCount: number;
    retailCount: number;
    problematicCount: number;
  };
}

export function DatabaseKeysViewer() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<DatabaseKeysData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<any>(null);

  const handleLoad = async () => {
    setIsLoading(true);
    setError(null);
    setData(null);
    setDeleteResult(null);

    try {
      console.log('Loading all order keys...');
      const result = await listAllOrderKeys();
      console.log('Loaded keys:', result);
      setData(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Load error:', errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProblematic = async () => {
    if (!data || data.problematic.length === 0) {
      return;
    }

    if (!confirm(`Вы уверены, что хотите удалить ${data.problematic.length} проблемных заказов?\n\nЭти розничные заказы находятся в оптовой базе и будут безвозвратно удалены.`)) {
      return;
    }

    setIsDeleting(true);
    setDeleteResult(null);

    try {
      console.log('Deleting problematic orders...');
      const keysToDelete = data.problematic.map(item => item.key);
      console.log('Keys to delete:', keysToDelete);
      
      const result = await deleteOrdersByKeys(keysToDelete);
      console.log('Delete result:', result);
      
      setDeleteResult(result);
      
      // Уведомляем другие компоненты об обновлении заказов
      eventBus.emit(EVENTS.ORDERS_UPDATED);
      eventBus.emit(EVENTS.RETAIL_ORDERS_UPDATED);
      
      // Перезагружаем данные после удаления
      await handleLoad();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Delete error:', errorMsg);
      setError(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-6xl">
      <h2 className="mb-4">🗄️ Просмотр ключей базы данных</h2>
      
      <p className="text-sm text-gray-600 mb-4">
        Этот инструмент показывает все ключи заказов в базе данных и помогает найти проблемные записи.
      </p>

      <Button
        onClick={handleLoad}
        disabled={isLoading}
        className="mb-4"
      >
        {isLoading ? 'Загрузка...' : 'Загрузить все ключи'}
      </Button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">❌ Ошибка: {error}</p>
        </div>
      )}

      {deleteResult && (
        <div className={`mt-4 p-4 rounded ${
          deleteResult.failed.length === 0
            ? 'bg-green-50 border border-green-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <p className={`mb-2 ${
            deleteResult.failed.length === 0 ? 'text-green-800' : 'text-yellow-800'
          }`}>
            <strong>
              Удалено: {deleteResult.deleted.length} из {deleteResult.deleted.length + deleteResult.failed.length}
            </strong>
          </p>
          {deleteResult.failed.length > 0 && (
            <div className="text-sm text-red-600 mt-2">
              <p>Ошибки удаления:</p>
              <ul className="list-disc list-inside">
                {deleteResult.failed.map((f: any) => (
                  <li key={f.key}>{f.key}: {f.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {data && (
        <div className="mt-6 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <h3 className="mb-1">🏢 Оптовые заказы</h3>
              <p className="text-2xl">{data.summary.wholesaleCount}</p>
            </div>
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <h3 className="mb-1">🛒 Розничные заказы</h3>
              <p className="text-2xl">{data.summary.retailCount}</p>
            </div>
            <div className="p-4 bg-orange-50 border border-orange-200 rounded">
              <h3 className="mb-1">⚠️ Проблемные</h3>
              <p className="text-2xl">{data.summary.problematicCount}</p>
            </div>
          </div>

          {/* Problematic Orders */}
          {data.problematic.length > 0 && (
            <div className="p-4 bg-orange-50 border border-orange-300 rounded">
              <div className="flex justify-between items-center mb-4">
                <h3>⚠️ Проблемные заказы (розничные в оптовой базе)</h3>
                <Button
                  onClick={handleDeleteProblematic}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting ? 'Удаление...' : `Удалить все ${data.problematic.length}`}
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-orange-100">
                    <tr>
                      <th className="text-left p-2">Ключ БД</th>
                      <th className="text-left p-2">ID заказа</th>
                      <th className="text-right p-2">Сумма</th>
                      <th className="text-left p-2">Дата</th>
                      <th className="text-left p-2">Тип</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.problematic.map((item, index) => (
                      <tr key={`problematic-${index}-${item.key}`} className="border-b border-orange-200">
                        <td className="p-2 font-mono text-xs">{item.key}</td>
                        <td className="p-2">{item.orderId}</td>
                        <td className="p-2 text-right">{item.total} ₽</td>
                        <td className="p-2">{new Date(item.date).toLocaleString('ru-RU')}</td>
                        <td className="p-2">
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                            {item.orderType || 'retail'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Wholesale Orders */}
          <details className="border border-gray-300 rounded">
            <summary className="cursor-pointer p-4 bg-gray-50 hover:bg-gray-100">
              <strong>🏢 Оптовые заказы ({data.wholesale.length})</strong>
            </summary>
            <div className="p-4">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Ключ БД</th>
                      <th className="text-left p-2">ID заказа</th>
                      <th className="text-right p-2">Сумма</th>
                      <th className="text-left p-2">Дата</th>
                      <th className="text-left p-2">Компания</th>
                      <th className="text-left p-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.wholesale.map((item, index) => (
                      <tr key={`wholesale-${index}-${item.key}`} className="border-b border-gray-200">
                        <td className="p-2 font-mono text-xs">{item.key}</td>
                        <td className="p-2">{item.orderId}</td>
                        <td className="p-2 text-right">{item.total} ₽</td>
                        <td className="p-2">{new Date(item.date).toLocaleString('ru-RU')}</td>
                        <td className="p-2">{item.company || 'N/A'}</td>
                        <td className="p-2">
                          {item.isRetailInWholesale ? (
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                              ⚠️ Проблемный
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                              ✓ OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          {/* Retail Orders */}
          <details className="border border-gray-300 rounded">
            <summary className="cursor-pointer p-4 bg-gray-50 hover:bg-gray-100">
              <strong>🛒 Розничные заказы ({data.retail.length})</strong>
            </summary>
            <div className="p-4">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Ключ БД</th>
                      <th className="text-left p-2">ID заказа</th>
                      <th className="text-right p-2">Сумма</th>
                      <th className="text-left p-2">Дата</th>
                      <th className="text-left p-2">Покупатель</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.retail.map((item, index) => (
                      <tr key={`retail-${index}-${item.key}`} className="border-b border-gray-200">
                        <td className="p-2 font-mono text-xs">{item.key}</td>
                        <td className="p-2">{item.orderId}</td>
                        <td className="p-2 text-right">{item.total} ₽</td>
                        <td className="p-2">{new Date(item.date).toLocaleString('ru-RU')}</td>
                        <td className="p-2">{item.customerName || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
