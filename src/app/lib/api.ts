import { CoffeeItem, Order, OrderFormData, User, AuthUser, ExchangeRate, RetailOrder } from '../types';
import { API_BASE_URL } from './backendConfig';

const API_URL = API_BASE_URL;
const headers = {
  'Content-Type': 'application/json'
};

// Вспомогательная функция для формирования понятного сообщения об ошибке подключения
function getServerUnavailableMessage(originalError: string): string {
  return `Сервер недоступен (${originalError}).

🔧 СКОРЕЕ ВСЕГО: backend API недоступен

✅ КАК ИСПРАВИТЬ:
1. Проверьте, что backend запущен на VPS
2. Проверьте Nginx reverse proxy на /api
3. Проверьте переменную VITE_API_BASE_URL в GitHub Secrets
4. Перезапустите деплой frontend и backend
5. Обновите страницу

📖 Или используйте встроенную диагностику ниже`;
}

// Fallback к localStorage если сервер недоступен
const USE_FALLBACK = false; // Сервер работает, используем его

// LocalStorage ключи
const COFFEE_ITEMS_KEY = 'nechai_coffee_items';
const ORDERS_KEY = 'nechai_orders';
const RETAIL_ORDERS_KEY = 'nechai_retail_orders';

// Начальные данные
const initialCoffeeItems: CoffeeItem[] = [
  {
    id: '1',
    name: 'Колумбия Уила',
    country: 'Колумбия',
    process: 'Мытый',
    category: 'Эспрессо',
    type: 'grain',
    price_kg: 1850,
    price_200: 520
  },
  {
    id: '2',
    name: 'Эфиопия Иргачиф',
    country: 'Эфиопия',
    process: 'Натуральный',
    category: 'Фильтр',
    type: 'grain',
    price_kg: 1950,
    price_200: 550
  },
  {
    id: '3',
    name: 'Бразилия Сантос',
    country: 'Бразилия',
    process: 'Натуральны',
    category: 'Эспрессо',
    type: 'grain',
    price_kg: 1650,
    price_200: 470
  },
  {
    id: '4',
    name: 'Коста-Рика Тарразу',
    country: 'Коста-Рика',
    process: 'Хани',
    category: 'Фильтр',
    type: 'grain',
    price_kg: 2100,
    price_200: 590
  },
  {
    id: '5',
    name: 'Кения АА',
    country: 'Кения',
    process: 'Мытый',
    category: 'Фильтр',
    type: 'grain',
    price_kg: 2250,
    price_200: 630
  },
  {
    id: '6',
    name: 'Гватемала Антигуа',
    country: 'Гватемала',
    process: 'Мытый',
    category: 'Эспрессо',
    type: 'grain',
    price_kg: 1900,
    price_200: 540
  }
];

// ============================================================================
// FALLBACK FUNCTIONS (localStorage)
// ============================================================================

const getLocalCoffeeItems = (): CoffeeItem[] => {
  const stored = localStorage.getItem(COFFEE_ITEMS_KEY);
  if (stored) {
    try {
      // Проверяем на битые символы перед парсингом
      if (stored.includes('\uFFFD')) {
        console.warn('⚠️ Найдены битые символы в coffee items, очистка...');
        localStorage.removeItem(COFFEE_ITEMS_KEY);
        localStorage.setItem(COFFEE_ITEMS_KEY, JSON.stringify(initialCoffeeItems));
        return initialCoffeeItems;
      }
      
      const parsed = JSON.parse(stored);
      
      // Проверяем, что данные валидны
      if (!Array.isArray(parsed)) {
        console.warn('⚠️ Невалидный формат coffee items в localStorage, сброс...');
        localStorage.setItem(COFFEE_ITEMS_KEY, JSON.stringify(initialCoffeeItems));
        return initialCoffeeItems;
      }
      
      return parsed;
    } catch (error) {
      console.error('❌ Ошибка парсинга coffee items из localStorage:', error);
      localStorage.removeItem(COFFEE_ITEMS_KEY);
      localStorage.setItem(COFFEE_ITEMS_KEY, JSON.stringify(initialCoffeeItems));
      return initialCoffeeItems;
    }
  }
  localStorage.setItem(COFFEE_ITEMS_KEY, JSON.stringify(initialCoffeeItems));
  return initialCoffeeItems;
};

const saveLocalCoffeeItems = (items: CoffeeItem[]): void => {
  try {
    // Валидация данных перед сохранением
    if (!Array.isArray(items)) {
      console.error('❌ Попытка сохранить невалидные данные в coffee items');
      return;
    }
    
    const jsonString = JSON.stringify(items);
    
    // Проверяем, что JSON не содержит битых символов
    if (jsonString.includes('\uFFFD')) {
      console.error('❌ Обнаружены битые символы в данных для сохранения');
      return;
    }
    
    localStorage.setItem(COFFEE_ITEMS_KEY, jsonString);
  } catch (error) {
    console.error('❌ Ошибка сохранения coffee items в localStorage:', error);
  }
};

const getLocalOrders = (): Order[] => {
  const stored = localStorage.getItem(ORDERS_KEY);
  if (stored) {
    try {
      // Проверяем на битые символы
      if (stored.includes('\uFFFD')) {
        console.warn('⚠️ Найдены битые символы в orders, очистка...');
        localStorage.removeItem(ORDERS_KEY);
        return [];
      }
      
      const parsed = JSON.parse(stored);
      
      // Проверяем валидность
      if (!Array.isArray(parsed)) {
        console.warn('⚠️ Невалидный формат orders в localStorage, сброс...');
        localStorage.removeItem(ORDERS_KEY);
        return [];
      }
      
      return parsed;
    } catch (error) {
      console.error('❌ Ошибка парсинга orders из localStorage:', error);
      localStorage.removeItem(ORDERS_KEY);
      return [];
    }
  }
  return [];
};

const saveLocalOrder = (order: Order): void => {
  try {
    const orders = getLocalOrders();
    orders.push(order);
    
    const jsonString = JSON.stringify(orders);
    
    // Проверяем на битые символы
    if (jsonString.includes('\uFFFD')) {
      console.error('❌ Обнаружены битые символы в данных заказа');
      return;
    }
    
    localStorage.setItem(ORDERS_KEY, jsonString);
  } catch (error) {
    console.error('❌ Ошибка сохранения заказа в localStorage:', error);
  }
};

// ============================================================================
// COFFEE ITEMS API
// ============================================================================

export const fetchCoffeeItems = async (): Promise<CoffeeItem[]> => {
  if (USE_FALLBACK) {
    return getLocalCoffeeItems();
  }
  
  try {
    const response = await fetch(`${API_URL}/coffee-items`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch coffee items: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching coffee items, using localStorage fallback:', error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('❌ Server unavailable, using fallback data');
    }
    return getLocalCoffeeItems();
  }
};

export const fetchCoffeeItemsAdmin = async (): Promise<CoffeeItem[]> => {
  if (USE_FALLBACK) {
    return getLocalCoffeeItems();
  }
  
  try {
    const response = await fetch(`${API_URL}/coffee-items-admin`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch coffee items (admin): ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching coffee items (admin), using localStorage fallback:', error);
    return getLocalCoffeeItems();
  }
};

export const createCoffeeItem = async (item: Omit<CoffeeItem, 'id'>): Promise<CoffeeItem> => {
  if (USE_FALLBACK) {
    const items = getLocalCoffeeItems();
    const newItem: CoffeeItem = {
      ...item,
      id: Date.now().toString()
    };
    items.push(newItem);
    saveLocalCoffeeItems(items);
    return newItem;
  }
  
  try {
    const response = await fetch(`${API_URL}/coffee-items`, {
      method: 'POST',
      headers,
      body: JSON.stringify(item)
    });
    if (!response.ok) {
      throw new Error(`Failed to create coffee item: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating coffee item, using localStorage fallback:', error);
    const items = getLocalCoffeeItems();
    const newItem: CoffeeItem = {
      ...item,
      id: Date.now().toString()
    };
    items.push(newItem);
    saveLocalCoffeeItems(items);
    return newItem;
  }
};

export const updateCoffeeItem = async (id: string, updates: Partial<CoffeeItem>): Promise<CoffeeItem> => {
  if (USE_FALLBACK) {
    const items = getLocalCoffeeItems();
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      saveLocalCoffeeItems(items);
      return items[index];
    }
    throw new Error('Item not found');
  }
  
  try {
    const response = await fetch(`${API_URL}/coffee-items/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      throw new Error(`Failed to update coffee item: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating coffee item, using localStorage fallback:', error);
    const items = getLocalCoffeeItems();
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      saveLocalCoffeeItems(items);
      return items[index];
    }
    throw error;
  }
};

export const reorderCoffeeItems = async (items: CoffeeItem[]): Promise<void> => {
  if (USE_FALLBACK) {
    saveLocalCoffeeItems(items);
    return;
  }

  try {
    const response = await fetch(`${API_URL}/coffee-items-reorder`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ items })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to reorder coffee items: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error reordering coffee items, using localStorage fallback:', error);
    saveLocalCoffeeItems(items);
  }
};

export const deleteCoffeeItem = async (id: string): Promise<void> => {
  if (USE_FALLBACK) {
    const items = getLocalCoffeeItems();
    const filtered = items.filter(item => item.id !== id);
    saveLocalCoffeeItems(filtered);
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/coffee-items/${id}`, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) {
      throw new Error(`Failed to delete coffee item: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting coffee item, using localStorage fallback:', error);
    const items = getLocalCoffeeItems();
    const filtered = items.filter(item => item.id !== id);
    saveLocalCoffeeItems(filtered);
  }
};

// ============================================================================
// ORDERS API
// ============================================================================

export const createOrder = async (
  orderData: OrderFormData & { items: any[]; total: number; userId?: string; orderId?: string }
): Promise<Order> => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const orderId = orderData.orderId || `ORD-${timestamp}-${random}`;
  const date = new Date().toISOString();

  const order: Order = {
    orderId,
    date,
    orderType: 'wholesale', // Маркируем как оптовый заказ
    company: orderData.company,
    contact: orderData.contact,
    phone: orderData.phone,
    address: orderData.address,
    delivery_address: orderData.delivery_address,
    delivery_company: orderData.delivery_company,
    delivery_method: orderData.delivery_method,
    items: orderData.items,
    total: orderData.total
  };

  if (USE_FALLBACK) {
    saveLocalOrder(order);
    return order;
  }

  try {
    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...orderData, orderId, date })
    });
    if (!response.ok) {
      throw new Error(`Failed to create order: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating order, using localStorage fallback:', error);
    saveLocalOrder(order);
    return order;
  }
};

export const fetchOrders = async (): Promise<Order[]> => {
  if (USE_FALLBACK) {
    const orders = getLocalOrders();
    return orders.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }
  
  try {
    const response = await fetch(`${API_URL}/orders`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching orders, using localStorage fallback:', error);
    const orders = getLocalOrders();
    return orders.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }
};

export const fetchOrder = async (orderId: string): Promise<Order> => {
  if (USE_FALLBACK) {
    const orders = getLocalOrders();
    const order = orders.find(o => o.orderId === orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    return order;
  }
  
  try {
    const response = await fetch(`${API_URL}/orders/${orderId}`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch order: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching order, using localStorage fallback:', error);
    const orders = getLocalOrders();
    const order = orders.find(o => o.orderId === orderId);
    if (!order) {
      throw error;
    }
    return order;
  }
};

export const deleteOrder = async (orderId: string): Promise<void> => {
  if (USE_FALLBACK) {
    const orders = getLocalOrders();
    const filtered = orders.filter(o => o.orderId !== orderId);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(filtered));
    return;
  }

  try {
    const response = await fetch(`${API_URL}/orders/${orderId}`, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) {
      throw new Error(`Failed to delete order: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting order, using localStorage fallback:', error);
    const orders = getLocalOrders();
    const filtered = orders.filter(o => o.orderId !== orderId);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(filtered));
  }
};

// ============================================================================
// EXCHANGE RATE API
// ============================================================================

export const fetchExchangeRate = async (): Promise<number> => {
  try {
    const response = await fetch(`${API_URL}/exchange-rate`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rate: ${response.statusText}`);
    }
    const data: ExchangeRate = await response.json();
    return data.usd_to_rub;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    // Возвращаем курс по умолчанию
    return 95;
  }
};

export const updateExchangeRate = async (rate: number): Promise<ExchangeRate> => {
  try {
    const response = await fetch(`${API_URL}/exchange-rate`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ usd_to_rub: rate })
    });
    if (!response.ok) {
      throw new Error(`Failed to update exchange rate: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating exchange rate:', error);
    throw error;
  }
};

// ============================================================================
// USERS API
// ============================================================================

/**
 * ⚠️ НЕБЕЗОПАСНО: Возвращает ВСЕХ пользователей без проверки доступа
 * @deprecated Используйте fetchUsersAdmin() для админов или fetchUserLoyalty(userId) для конкретного пользователя
 */
export const fetchUsers = async (): Promise<User[]> => {
  try {
    console.log('API: Fetching users...');
    const response = await fetch(`${API_URL}/users`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    const users = await response.json();
    console.log('API: Fetched users count:', users.length);
    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const createUser = async (userData: Omit<User, 'id' | 'created_at'>): Promise<User> => {
  try {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify(userData)
    });
    if (!response.ok) {
      let errorMsg = `Failed to create user (${response.status})`;
      try {
        const errData = await response.json();
        if (errData?.error) errorMsg = errData.error;
      } catch {}
      throw new Error(errorMsg);
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const deleteUser = async (id: string): Promise<void> => {
  try {
    console.log('API: Deleting user with ID:', id);
    console.log('API: Request URL:', `${API_URL}/users/${id}`);
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers
    });
    console.log('API: Delete response status:', response.status);
    const responseText = await response.text();
    console.log('API: Delete response body:', responseText);
    if (!response.ok) {
      throw new Error(`Failed to delete user: ${response.statusText} - ${responseText}`);
    }
    console.log('API: User deleted successfully');
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

export const updateUser = async (id: string, userData: Partial<Omit<User, 'id' | 'created_at'>>): Promise<User> => {
  try {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(userData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update user: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const loginUser = async (phone: string, password: string): Promise<AuthUser | null> => {
  try {
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone, password })
    });
    if (!response.ok) {
      if (response.status === 401) {
        return null; // Invalid credentials
      }
      throw new Error(`Failed to login: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

export const fetchUserOrders = async (userId: string): Promise<Order[]> => {
  try {
    const response = await fetch(`${API_URL}/users/${userId}/orders`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch user orders: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching user orders:', error);
    throw error;
  }
};

/**
 * ✅ ПУБЛИЧНЫЙ: Получить информацию о лояльности пользователя
 * Возвращает loyaltyLevel, discount, totalKg, autoLevel, isManualOverride, nextLevel
 */
export const fetchUserLoyalty = async (userId: string): Promise<{
  loyaltyLevel: number;
  discount: number;
  loyaltyLevelSetDate: string;
  totalKg: number;
  ordersIn3Mo: number;
  ordersIn6Mo: number;
  ordersIn12Mo: number;
  autoLevel: number;
  autoDiscount: number;
  isManualOverride: boolean;
  nextLevel: { level: number; label: string; discount: number } | null;
}> => {
  try {
    const response = await fetch(`${API_URL}/users/${userId}/loyalty`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch user loyalty: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching user loyalty:', error);
    throw error;
  }
};

/**
 * ✅ ПУБЛИЧНЫЙ: Получить розничные заказы конкретного пользователя
 * Использует публичный endpoint /retail/orders/my/:userId
 */
export const fetchMyRetailOrders = async (userId: string): Promise<RetailOrder[]> => {
  try {
    const response = await fetch(`${API_URL}/retail/orders/my/${userId}`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch user retail orders: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching user retail orders:', error);
    throw error;
  }
};

// ============================================================================
// PROMO CODES API
// ============================================================================

export const fetchPromoCodes = async (): Promise<import('../types').PromoCode[]> => {
  try {
    const response = await fetch(`${API_URL}/promo-codes`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch promo codes: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    throw error;
  }
};

export const createPromoCode = async (promoCode: import('../types').PromoCode): Promise<import('../types').PromoCode> => {
  try {
    const response = await fetch(`${API_URL}/promo-codes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(promoCode)
    });
    if (!response.ok) {
      throw new Error(`Failed to create promo code: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating promo code:', error);
    throw error;
  }
};

export const updatePromoCode = async (code: string, updates: Partial<import('../types').PromoCode>): Promise<import('../types').PromoCode> => {
  try {
    const response = await fetch(`${API_URL}/promo-codes/${code}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      throw new Error(`Failed to update promo code: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating promo code:', error);
    throw error;
  }
};

export const deletePromoCode = async (code: string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/promo-codes/${code}`, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) {
      throw new Error(`Failed to delete promo code: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting promo code:', error);
    throw error;
  }
};

export const verifyPromoCode = async (code: string): Promise<{ valid: boolean; discountPercent?: number; error?: string }> => {
  try {
    const response = await fetch(`${API_URL}/verify-promo`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code })
    });
    if (!response.ok) {
      const error = await response.json();
      return { valid: false, error: error.error || 'Failed to verify promo code' };
    }
    return await response.json();
  } catch (error) {
    console.error('Error verifying promo code:', error);
    return { valid: false, error: 'Network error' };
  }
};

// ============================================================================
// TOCHKA BANK API
// ============================================================================

export const createTochkaInvoice = async (orderId: string): Promise<{
  success: boolean;
  invoiceId?: string;
  invoiceCreatedAt?: string;
  error?: string;
  details?: string;
}> => {
  try {
    const response = await fetch(`${API_URL}/tochka/create-invoice`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ orderId })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to create invoice',
        details: data.details
      };
    }
    
    return data;
  } catch (error) {
    return {
      success: false,
      error: 'Network error'
    };
  }
};

// ============================================================================
// FAVORITES API
// ============================================================================

export const fetchFavorites = async (userId: string): Promise<string[]> => {
  try {
    const response = await fetch(`${API_URL}/favorites/${userId}`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch favorites: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return [];
  }
};

export const addToFavorites = async (userId: string, itemId: string): Promise<string[]> => {
  try {
    const response = await fetch(`${API_URL}/favorites/${userId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ itemId })
    });
    if (!response.ok) {
      throw new Error(`Failed to add to favorites: ${response.statusText}`);
    }
    const data = await response.json();
    return data.favorites || data;
  } catch (error) {
    console.error('Error adding to favorites:', error);
    throw error;
  }
};

export const removeFromFavorites = async (userId: string, itemId: string): Promise<string[]> => {
  try {
    const response = await fetch(`${API_URL}/favorites/${userId}/${itemId}`, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) {
      throw new Error(`Failed to remove from favorites: ${response.statusText}`);
    }
    const data = await response.json();
    return data.favorites || data;
  } catch (error) {
    console.error('Error removing from favorites:', error);
    throw error;
  }
};

// ============================================================================
// RETAIL API
// ============================================================================

export interface RetailProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category?: string;
  weight?: string;
  roast?: string;
  grind?: string;
  longDescription?: string;
  cardText?: string;
  displayOrder?: number; // Порядок отображения
  acidity?: number;
  bitterness?: number;
  sweetness?: number;
  type?: 'bean' | 'drip' | 'equipment' | 'accessory';
  price200?: number;
  price1000?: number;
  pricePack?: number;
  published?: boolean; // Флаг публикации (по умолчанию true)
  recommended?: boolean; // Флаг «Рекомендую»
  // СДЭК параметры (только для админки)
  packageLength?: number; // Длина в см
  packageHeight?: number; // Высота в см
  packageWidth?: number; // Ширина в см
  packageWeight?: number; // Вес в граммах
  farmPhotos?: string[]; // Фотографии фермы (до 10 штук)
}

export const fetchRetailProducts = async (): Promise<RetailProduct[]> => {
  try {
    const response = await fetch(`${API_URL}/retail/products`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch retail products: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching retail products:', error);
    return [];
  }
};

export const createRetailProduct = async (product: Omit<RetailProduct, 'id'>): Promise<RetailProduct> => {
  try {
    const response = await fetch(`${API_URL}/retail/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify(product)
    });
    if (!response.ok) {
      throw new Error(`Failed to create retail product: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating retail product:', error);
    throw error;
  }
};

export const updateRetailProduct = async (id: string, updates: Partial<Omit<RetailProduct, 'id'>>): Promise<RetailProduct> => {
  try {
    const response = await fetch(`${API_URL}/retail/products/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      throw new Error(`Failed to update retail product: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating retail product:', error);
    throw error;
  }
};

export const deleteRetailProduct = async (id: string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/retail/products/${id}`, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) {
      throw new Error(`Failed to delete retail product: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting retail product:', error);
    throw error;
  }
};

export const updateRetailProductsOrder = async (updates: Array<{ id: string; displayOrder: number }>): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/retail/products/reorder`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ updates })
    });
    if (!response.ok) {
      throw new Error(`Failed to update products order: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error updating products order:', error);
    throw error;
  }
};

export const uploadRetailImage = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/retail/upload-image`, {
      method: 'POST',
      headers: {},
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload image');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error uploading retail image:', error);
    throw error;
  }
};

export const initRetailTestData = async (): Promise<{ success: boolean; count: number }> => {
  try {
    const response = await fetch(`${API_URL}/retail/init-test-data`, {
      method: 'POST',
      headers
    });
    if (!response.ok) {
      throw new Error('Failed to initialize test data');
    }
    return await response.json();
  } catch (error) {
    console.error('Error initializing test data:', error);
    throw error;
  }
};

export const DEFAULT_CATEGORY_ORDER = ['Фильтр', 'Эспрессо', 'Дрип', 'Оборудование', 'Аксессуары'];

export const fetchCategoryOrder = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_URL}/retail/category-order`, { headers });
    if (!response.ok) return DEFAULT_CATEGORY_ORDER;
    const data = await response.json();
    return Array.isArray(data.order) && data.order.length > 0 ? data.order : DEFAULT_CATEGORY_ORDER;
  } catch (error) {
    console.error('Error fetching category order:', error);
    return DEFAULT_CATEGORY_ORDER;
  }
};

export const saveCategoryOrder = async (order: string[]): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/retail/category-order`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ order })
    });
    if (!response.ok) throw new Error('Failed to save category order');
  } catch (error) {
    console.error('Error saving category order:', error);
    throw error;
  }
};

export const migrateProductDimensions = async (): Promise<{ success: boolean; totalProducts: number; updatedProducts: number; message: string }> => {
  try {
    const response = await fetch(`${API_URL}/retail/products/migrate-dimensions`, {
      method: 'POST',
      headers
    });
    if (!response.ok) {
      throw new Error('Failed to migrate dimensions');
    }
    return await response.json();
  } catch (error) {
    console.error('Error migrating dimensions:', error);
    throw error;
  }
};

// ============================================================================
// RETAIL ORDERS API
// ============================================================================

// LocalStorage helpers for retail orders
const getLocalRetailOrders = (): RetailOrder[] => {
  const stored = localStorage.getItem(RETAIL_ORDERS_KEY);
  if (stored) {
    try {
      // Проверяем на битые символы
      if (stored.includes('\uFFFD')) {
        console.warn('⚠️ Найдены битые символы в retail orders, очистка...');
        localStorage.removeItem(RETAIL_ORDERS_KEY);
        return [];
      }
      
      const parsed = JSON.parse(stored);
      
      // Проверяем валидность
      if (!Array.isArray(parsed)) {
        console.warn('⚠️ Невалидный формат retail orders в localStorage, сброс...');
        localStorage.removeItem(RETAIL_ORDERS_KEY);
        return [];
      }
      
      return parsed;
    } catch (error) {
      console.error('❌ Ошибка парсинга retail orders из localStorage:', error);
      localStorage.removeItem(RETAIL_ORDERS_KEY);
      return [];
    }
  }
  return [];
};

const saveLocalRetailOrder = (order: RetailOrder) => {
  try {
    const orders = getLocalRetailOrders();
    orders.push(order);
    
    const jsonString = JSON.stringify(orders);
    
    // Проверяем на битые символы
    if (jsonString.includes('\uFFFD')) {
      console.error('❌ Обнаружены битые символы в данных retail заказа');
      return;
    }
    
    localStorage.setItem(RETAIL_ORDERS_KEY, jsonString);
  } catch (error) {
    console.error('❌ Ошибка сохранения retail заказа в localStorage:', error);
  }
};

export const createRetailOrder = async (orderData: Omit<RetailOrder, 'orderId' | 'date' | 'orderType'>): Promise<RetailOrder> => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const orderId = `RETAIL-${timestamp}-${random}`;
  
  const order: RetailOrder = {
    orderId,
    date: new Date().toISOString(),
    orderType: 'retail',
    ...orderData,
  };
  
  if (USE_FALLBACK) {
    saveLocalRetailOrder(order);
    return order;
  }

  try {
    const response = await fetch(`${API_URL}/retail/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(order)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create retail order: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating retail order, using localStorage fallback:', error);
    saveLocalRetailOrder(order);
    return order;
  }
};

/**
 * ⚠️ НЕБЕЗОПАСНО: Возвращает ВСЕ розничные заказы без проверки доступа
 * @deprecated Используйте fetchRetailOrdersAdmin() для админов или fetchMyRetailOrders(userId) для пользователей
 */
export const fetchRetailOrders = async (): Promise<RetailOrder[]> => {
  if (USE_FALLBACK) {
    const orders = getLocalRetailOrders();
    return orders.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }
  
  try {
    const response = await fetch(`${API_URL}/retail/orders`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch retail orders: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching retail orders, using localStorage fallback:', error);
    const orders = getLocalRetailOrders();
    return orders.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }
};

export const fetchRetailOrder = async (orderId: string): Promise<RetailOrder> => {
  if (USE_FALLBACK) {
    const orders = getLocalRetailOrders();
    const order = orders.find(o => o.orderId === orderId);
    if (!order) {
      throw new Error('Retail order not found');
    }
    return order;
  }
  
  try {
    const response = await fetch(`${API_URL}/retail/orders/${orderId}`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch retail order: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching retail order, using localStorage fallback:', error);
    const orders = getLocalRetailOrders();
    const order = orders.find(o => o.orderId === orderId);
    if (!order) {
      throw error;
    }
    return order;
  }
};

export const deleteRetailOrder = async (orderId: string): Promise<void> => {
  if (USE_FALLBACK) {
    const orders = getLocalRetailOrders();
    const filtered = orders.filter(o => o.orderId !== orderId);
    localStorage.setItem(RETAIL_ORDERS_KEY, JSON.stringify(filtered));
    return;
  }

  try {
    const response = await fetch(`${API_URL}/retail/orders/${orderId}`, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) {
      throw new Error(`Failed to delete retail order: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting retail order, using localStorage fallback:', error);
    const orders = getLocalRetailOrders();
    const filtered = orders.filter(o => o.orderId !== orderId);
    localStorage.setItem(RETAIL_ORDERS_KEY, JSON.stringify(filtered));
  }
};

// ============================================================================
// UTILITIES API - Диагностика и удаление заказов
// ============================================================================

interface OrderWithKey extends Order {
  _key: string;
  _reason?: string;
}

interface RetailOrderWithKey extends RetailOrder {
  _key: string;
  _reason?: string;
}

interface FindOrdersResult {
  wholesale: OrderWithKey[];
  retail: RetailOrderWithKey[];
  misplaced: OrderWithKey[];
}

export const findOrdersByTotal = async (totals: number[]): Promise<FindOrdersResult> => {
  try {
    const response = await fetch(`${API_URL}/utilities/find-orders-by-total`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ totals })
    });
    if (!response.ok) {
      throw new Error(`Failed to find orders: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error finding orders by total:', error);
    throw error;
  }
};

export const deleteOrderByKey = async (key: string): Promise<{ success: boolean; deletedKey: string }> => {
  try {
    const response = await fetch(`${API_URL}/utilities/delete-order-by-key`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ key })
    });
    if (!response.ok) {
      throw new Error(`Failed to delete order: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting order by key:', error);
    throw error;
  }
};

export const deleteOrdersByKeys = async (keys: string[]): Promise<{
  deleted: string[];
  failed: { key: string; error: string }[];
}> => {
  try {
    const response = await fetch(`${API_URL}/utilities/delete-orders-by-keys`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ keys })
    });
    if (!response.ok) {
      throw new Error(`Failed to delete orders: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting orders by keys:', error);
    throw error;
  }
};

export const listAllOrderKeys = async (): Promise<{
  wholesale: any[];
  retail: any[];
  problematic: any[];
  summary: {
    wholesaleCount: number;
    retailCount: number;
    problematicCount: number;
  };
}> => {
  try {
    const response = await fetch(`${API_URL}/utilities/list-all-order-keys`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to list order keys: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error listing order keys:', error);
    throw error;
  }
};

// ============================================================================
// 🔒 БЕЗОПАСНЫЕ АДМИНСКИЕ ФУНКЦИИ (требуют токен из sessionStorage)
// ============================================================================

/**
 * Проверить здоровье сервера (публичный endpoint, не требует токена)
 */
export const checkServerHealth = async (): Promise<{ status: string; timestamp: string; service: string }> => {
  try {
    console.log('🏥 Checking server health...');
    const url = `${API_URL}/health`;
    console.log('🏥 Health check URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });
    
    console.log('🏥 Health check response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('🏥 Server health:', data);
    return data;
  } catch (error) {
    console.error('❌ Health check failed:', error);
    throw error;
  }
};

// Админские функции токена удалены - админ-панель теперь открыта для всех

/**
 * 🔒 БЕЗОПАСНО: Получить все заказы (только для админа с токеном)
 * Использует новый защищённый endpoint /admin/orders
 */
export const fetchOrdersAdmin = async (): Promise<Order[]> => {
  console.log('📡 Starting fetchOrdersAdmin...');
  console.log('📡 API_URL:', API_URL);
  
  try {
    const url = `${API_URL}/admin/orders`;
    console.log('📡 Fetching from:', url);
    console.log('📡 Request headers:', JSON.stringify(headers, null, 2));
    
    const response = await fetch(url, { 
      headers,
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });
    
    console.log('📬 Response received!');
    console.log('📬 Status:', response.status);
    console.log('📬 Status Text:', response.statusText);
    console.log('📬 OK:', response.ok);
    console.log('📬 Type:', response.type);
    console.log('📬 URL:', response.url);
    
    if (response.status === 403) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Unable to read error response';
      }
      console.error('❌ 403 Forbidden:', errorText);
      throw new Error('Доступ запрещён: неверный токен администратора. Проверьте, что токен установлен в Supabase Edge Functions.');
    }
    
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Unable to read error response';
      }
      console.error('❌ Response not OK. Status:', response.status);
      console.error('❌ Error text:', errorText);
      throw new Error(`Ошибка загрузки заказов: HTTP ${response.status} ${response.statusText || 'No status text'}. ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ Successfully fetched', data.length, 'orders');
    return data;
  } catch (error) {
    console.error('❌ Error in fetchOrdersAdmin:', error);
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error name:', error instanceof Error ? error.name : 'unknown');
    console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'no stack');
    
    // Улучшенное сообщение об ошибке
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('❌ TypeError: Failed to fetch - server is not reachable');
      throw new Error(getServerUnavailableMessage(error.message));
    }
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error(`Неизвестная ошибка: ${String(error)}`);
  }
};

/**
 * 🔒 БЕЗОПАСНО: Получить все розничные заказы (только для админа с токеном)
 * Использует новый защищённый endpoint /admin/retail/orders
 */
export const fetchRetailOrdersAdmin = async (): Promise<RetailOrder[]> => {
  console.log('📡 Starting fetchRetailOrdersAdmin...');
  console.log('📡 API_URL:', API_URL);
  
  try {
    const url = `${API_URL}/admin/retail/orders`;
    console.log('📡 Fetching from:', url);
    
    const response = await fetch(url, { 
      headers,
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });
    
    console.log('📬 Response received!');
    console.log('📬 Status:', response.status);
    console.log('📬 Status Text:', response.statusText);
    console.log('📬 OK:', response.ok);
    console.log('📬 Type:', response.type);
    console.log('📬 URL:', response.url);
    
    if (response.status === 403) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Unable to read error response';
      }
      console.error('❌ 403 Forbidden:', errorText);
      throw new Error('Доступ запрещён: неверный токен администратора. Проверьте, что токен установлен в Supabase Edge Functions.');
    }
    
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Unable to read error response';
      }
      console.error('❌ Response not OK. Status:', response.status);
      console.error('❌ Error text:', errorText);
      throw new Error(`Ошибка загрузки розничных заказов: HTTP ${response.status} ${response.statusText || 'No status text'}. ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ Successfully fetched', data.length, 'retail orders');
    return data;
  } catch (error) {
    console.error('❌ Error in fetchRetailOrdersAdmin:', error);
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error name:', error instanceof Error ? error.name : 'unknown');
    console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'no stack');
    
    // Улучшенное сообщение об ошибке
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('❌ TypeError: Failed to fetch - server is not reachable');
      throw new Error(getServerUnavailableMessage(error.message));
    }
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error(`Неизвестная ошибка: ${String(error)}`);
  }
};

/**
 * 🔒 БЕЗОПАСНО: Получить всех пользователей (только для админа с токеном)
 * Использует новый защищённый endpoint /admin/users
 */
export const fetchUsersAdmin = async (): Promise<User[]> => {
  try {
    const response = await fetch(`${API_URL}/admin/users`, { headers });
    
    if (response.status === 403) {
      throw new Error('Access denied: Invalid or missing admin token');
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching admin users:', error);
    throw error;
  }
};

/**
 * 🔒 БЕЗОПАСНО: Получить заказы пользователя (только для админа с ткеном)
 * Использует новый защищённый endpoint /admin/users/:id/orders
 */
export const fetchUserOrdersAdmin = async (userId: string): Promise<Order[]> => {
  try {
    const response = await fetch(`${API_URL}/admin/users/${userId}/orders`, { headers });
    
    if (response.status === 403) {
      throw new Error('Access denied: Invalid or missing admin token');
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user orders: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching admin user orders:', error);
    throw error;
  }
};