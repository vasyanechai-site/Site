import { useState } from 'react';
import { findOrdersByTotal, deleteOrdersByKeys } from '../lib/api';
import { eventBus, EVENTS } from '../lib/events';

interface OrderWithKey {
  orderId: string;
  total: number;
  date: string;
  _key: string;
  _reason?: string;
}

interface DeleteResult {
  deleted: number;
  total: number;
  wholesale: number;
  retail: number;
  misplaced: number;
  details: string[];
}

export function DeleteSpecificOrdersButton() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState<DeleteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetTotals = [4820, 1780, 2455];

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить заказы на суммы: 4 820 ₽, 1 780 ₽, 2 455 ₽?')) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setResult(null);
    const details: string[] = [];

    try {
      details.push('🔍 Поиск заказов во всех префиксах базы данных...');
      
      // Используем новый API для поиска заказов
      const found = await findOrdersByTotal(targetTotals);
      
      const allOrders = [
        ...found.wholesale,
        ...found.retail
      ];
      
      if (allOrders.length === 0) {
        setError('Заказы с указанными суммами не найдены');
        setIsDeleting(false);
        return;
      }
      
      details.push(`\n📋 Найдено заказов: ${allOrders.length}`);
      
      if (found.wholesale.length > 0) {
        details.push(`\n🏢 Оптовые заказы (${found.wholesale.length}):`);
        found.wholesale.forEach((order: any) => {
          const misplacedMark = order._reason ? ' ⚠️ ПРОБЛЕМНЫЙ' : '';
          details.push(`  • ${order.orderId}: ${order.total} ₽${misplacedMark}`);
          details.push(`    Ключ БД: ${order._key}`);
          if (order._reason) {
            details.push(`    Причина: ${order._reason}`);
          }
        });
      }
      
      if (found.retail.length > 0) {
        details.push(`\n🛒 Розничные заказы (${found.retail.length}):`);
        found.retail.forEach((order: any) => {
          details.push(`  • ${order.orderId}: ${order.total} ₽`);
          details.push(`    Ключ БД: ${order._key}`);
        });
      }
      
      if (found.misplaced.length > 0) {
        details.push(`\n⚠️ Проблемные заказы (${found.misplaced.length}):`);
        found.misplaced.forEach((order: any) => {
          details.push(`  • ${order.orderId}: ${order.total} ₽ - ${order._reason}`);
        });
      }
      
      details.push('\n🗑️ Удаление заказов по точным ключам БД...');
      
      // Собираем все ключи для удаления
      const keysToDelete = allOrders.map((order: any) => order._key);
      
      // Удаляем все заказы одним запросом
      const deleteResult = await deleteOrdersByKeys(keysToDelete);
      
      deleteResult.deleted.forEach(key => {
        const order = allOrders.find((o: any) => o._key === key);
        details.push(`✅ Удалён: ${order?.orderId || key}`);
      });
      
      deleteResult.failed.forEach(({ key, error }) => {
        const order = allOrders.find((o: any) => o._key === key);
        details.push(`❌ Ошибка удаления ${order?.orderId || key}: ${error}`);
      });
      
      const totalDeleted = deleteResult.deleted.length;
      details.push(`\n✅ Успешно удалено: ${totalDeleted} из ${allOrders.length} заказов`);
      details.push(`   • Оптовых: ${found.wholesale.filter((o: any) => deleteResult.deleted.includes(o._key)).length}`);
      details.push(`   • Розничных: ${found.retail.filter((o: any) => deleteResult.deleted.includes(o._key)).length}`);
      details.push(`   • Проблемных: ${found.misplaced.length}`);
      
      setResult({
        deleted: totalDeleted,
        total: allOrders.length,
        wholesale: found.wholesale.filter((o: any) => deleteResult.deleted.includes(o._key)).length,
        retail: found.retail.filter((o: any) => deleteResult.deleted.includes(o._key)).length,
        misplaced: found.misplaced.length,
        details
      });
      
      // Уведомляем другие компоненты об обновлении заказов
      if (totalDeleted > 0) {
        eventBus.emit(EVENTS.ORDERS_UPDATED);
        eventBus.emit(EVENTS.RETAIL_ORDERS_UPDATED);
      }
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : String(err)}`);
      details.push(`\n❌ Критическая ошибка: ${err}`);
      setResult({ deleted: 0, total: 0, wholesale: 0, retail: 0, misplaced: 0, details });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
      <h2 className="mb-4">Удаление проблемных заказов</h2>
      
      <div className="mb-4">
        <p className="mb-2">Заказы на удаление:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>4 820 ₽</li>
          <li>1 780 ₽</li>
          <li>2 455 ₽</li>
        </ul>
      </div>

      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className={`px-6 py-3 rounded-lg transition-colors ${
          isDeleting
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {isDeleting ? 'Удаление...' : 'Удалить заказы'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {result && (
        <div className={`mt-4 p-4 rounded-lg ${
          result.deleted === result.total 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <p className={`mb-2 ${
            result.deleted === result.total ? 'text-green-800' : 'text-yellow-800'
          }`}>
            <strong>
              Удалено: {result.deleted} из {result.total} заказов
            </strong>
          </p>
          <div className="space-y-1 text-sm">
            <p>Оптовых: {result.wholesale}</p>
            <p>Розничных: {result.retail}</p>
            {result.misplaced > 0 && (
              <p className="text-orange-600">⚠️ Проблемных: {result.misplaced}</p>
            )}
          </div>
          
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium mb-2">
              Подробный лог
            </summary>
            <div className="bg-white p-3 rounded border text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
              {result.details.join('\n')}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
