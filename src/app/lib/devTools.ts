// Development tools for testing
// Use in browser console: window.devTools.initRetailTestData()
// Delete orders by total: window.devTools.deleteOrdersByTotal([2455, 1780, 4820])
// Clean localStorage: window.cleanLocalStorage()

import { initRetailTestData, fetchOrders, deleteOrder, fetchRetailOrders, deleteRetailOrder } from './api';
import { cleanLocalStorage, printReport, scanLocalStorage } from './localStorage-cleaner';

export const devTools = {
  async initRetailTestData() {
    try {
      const result = await initRetailTestData();
      console.log('✅ Test data initialized:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to initialize test data:', error);
      throw error;
    }
  },
  
  async deleteOrdersByTotal(totals: number[]) {
    try {
      console.log('🔍 Searching for orders with totals:', totals);
      
      // Получаем оптовые заказы
      const wholesaleOrders = await fetchOrders();
      const wholesaleToDelete = wholesaleOrders.filter(order => totals.includes(order.total));
      
      // Получаем розничные заказы
      const retailOrders = await fetchRetailOrders();
      const retailToDelete = retailOrders.filter(order => totals.includes(order.total));
      
      const totalFound = wholesaleToDelete.length + retailToDelete.length;
      
      if (totalFound === 0) {
        console.log('❌ No orders found with specified totals');
        return { deleted: 0, wholesale: 0, retail: 0 };
      }
      
      console.log(`📋 Found ${totalFound} orders to delete:`);
      
      if (wholesaleToDelete.length > 0) {
        console.log(`\n🏢 Wholesale orders (${wholesaleToDelete.length}):`);
        wholesaleToDelete.forEach(order => {
          console.log(`  - Order ${order.orderId}: ${order.total} ₽ (${order.date})`);
        });
      }
      
      if (retailToDelete.length > 0) {
        console.log(`\n🛒 Retail orders (${retailToDelete.length}):`);
        retailToDelete.forEach(order => {
          console.log(`  - Order ${order.orderId}: ${order.total} ₽ (${order.date})`);
        });
      }
      
      let wholesaleDeleted = 0;
      let retailDeleted = 0;
      
      // Удаляем оптовые заказы
      for (const order of wholesaleToDelete) {
        try {
          await deleteOrder(order.orderId);
          console.log(`✅ Deleted wholesale order ${order.orderId}`);
          wholesaleDeleted++;
        } catch (error) {
          console.error(`❌ Failed to delete wholesale order ${order.orderId}:`, error);
        }
      }
      
      // Удаляем розничные заказы
      for (const order of retailToDelete) {
        try {
          await deleteRetailOrder(order.orderId);
          console.log(`✅ Deleted retail order ${order.orderId}`);
          retailDeleted++;
        } catch (error) {
          console.error(`❌ Failed to delete retail order ${order.orderId}:`, error);
        }
      }
      
      const totalDeleted = wholesaleDeleted + retailDeleted;
      console.log(`\n✅ Successfully deleted ${totalDeleted} out of ${totalFound} orders`);
      console.log(`   - Wholesale: ${wholesaleDeleted}/${wholesaleToDelete.length}`);
      console.log(`   - Retail: ${retailDeleted}/${retailToDelete.length}`);
      
      return { 
        deleted: totalDeleted, 
        total: totalFound,
        wholesale: wholesaleDeleted,
        retail: retailDeleted
      };
    } catch (error) {
      console.error('❌ Failed to delete orders:', error);
      throw error;
    }
  },
  
  // Быстрая функция для удаления конкретных заказов
  async deleteSpecificOrders() {
    return this.deleteOrdersByTotal([2455, 1780, 4820]);
  },
  
  // Удалить заказ по orderId напрямую
  async deleteOrderById(orderId: string, isRetail: boolean = false) {
    try {
      console.log(`🗑️  Deleting ${isRetail ? 'retail' : 'wholesale'} order: ${orderId}`);
      
      if (isRetail) {
        await deleteRetailOrder(orderId);
      } else {
        await deleteOrder(orderId);
      }
      
      console.log(`✅ Order ${orderId} deleted successfully`);
      return { success: true, orderId };
    } catch (error) {
      console.error(`❌ Failed to delete order ${orderId}:`, error);
      throw error;
    }
  },
  
  // Показать все заказы с неправильной структурой (розничные в оптовой базе)
  async findMisplacedRetailOrders() {
    try {
      console.log('🔍 Searching for misplaced retail orders...');
      const wholesaleOrders = await fetchOrders();
      
      // Розничные заказы должны иметь orderType: 'retail', а оптовые - 'wholesale' или undefined
      const misplacedOrders = wholesaleOrders.filter(order => 
        order.orderType === 'retail' || 
        !order.company || 
        !order.inn
      );
      
      if (misplacedOrders.length === 0) {
        console.log('✅ No misplaced retail orders found');
        return { misplaced: [] };
      }
      
      console.log(`⚠️  Found ${misplacedOrders.length} misplaced retail orders:`);
      misplacedOrders.forEach(order => {
        console.log(`  - ${order.orderId}: ${order.total} ₽ (${order.date}) - orderType: ${order.orderType || 'undefined'}`);
      });
      
      return { misplaced: misplacedOrders };
    } catch (error) {
      console.error('❌ Failed to find misplaced orders:', error);
      throw error;
    }
  }
};

// Expose to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).devTools = devTools;
  
  // Expose localStorage cleaner globally
  (window as any).cleanLocalStorage = () => {
    console.log('%c🧹 Запуск очистки localStorage...', 'color: #2196F3; font-weight: bold; font-size: 14px;');
    const report = cleanLocalStorage(true);
    printReport(report);
    
    if (report.cleanedKeys.length > 0) {
      console.log('%c💡 Совет: Обновите страницу (F5) для загрузки свежих данных', 'color: #FF9800; font-weight: bold;');
    }
    
    return report;
  };
  
  (window as any).scanLocalStorage = () => {
    console.log('%c🔍 Сканирование localStorage...', 'color: #2196F3; font-weight: bold; font-size: 14px;');
    const report = scanLocalStorage();
    printReport(report);
    return report;
  };
  
  console.log('🛠️ Dev Tools loaded! Available commands:');
  console.log('\n📦 Order Management:');
  console.log('  - window.devTools.findMisplacedRetailOrders() - Find retail orders in wholesale database');
  console.log('  - window.devTools.deleteSpecificOrders() - Delete orders with totals 2455, 1780, 4820 ₽');
  console.log('  - window.devTools.deleteOrdersByTotal([total1, total2, ...]) - Delete orders by custom totals');
  console.log('  - window.devTools.deleteOrderById(orderId, isRetail) - Delete order by ID');
  console.log('\n🧹 LocalStorage Cleaning:');
  console.log('  - window.cleanLocalStorage() - Scan and auto-clean corrupted localStorage data');
  console.log('  - window.scanLocalStorage() - Scan localStorage without cleaning');
}
