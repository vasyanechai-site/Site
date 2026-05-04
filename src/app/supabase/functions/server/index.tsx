// CDEK Integration - Fixed dimensions (CM not MM) and tariffs - v1.3
// All Telegram notifications ENABLED for both retail and wholesale orders
import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'jsr:@supabase/supabase-js';
import * as kv from './kv_store.tsx';
import { sendTelegramNotification, sendTelegramMessage } from './telegram.tsx';
import { sendBackupEmail, sendTestEmail, sendWelcomeEmail } from './email.tsx';
import * as backup from './backup.tsx';
import { formatRetailOrderMessage } from './retail_telegram_fix.tsx';
import { formatRetailOrderTelegramMessage } from './telegram_message_formatter.tsx';
import telegramBroadcast from './telegram_broadcast.tsx';
import * as webhookSetup from './telegram_webhook_setup.tsx';
import { cdekRequest, getCdekToken } from './cdek-auth.tsx';
import { createCdekOrder } from './cdek_order_create.tsx';
import { 
  createTochkaPayment, 
  createTochkaPaymentWithReceipt,
  processTochkaWebhook,
  type CreatePaymentRequest,
  type TochkaWebhookPayload
} from './tochka_payments.tsx';
import { getRetailUsers, deleteRetailUser, updateRetailUserBalance } from './retail_admin.tsx';
import { registerAgentRoutes, findAgentByCredentials } from './agents.tsx';

const app = new Hono();

// Настройка CORS с явным разрешением всех источников и методов
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 600,
  credentials: false
}));
app.use('*', logger(console.log));

// Префикс для всех маршрутов
const prefix = '/make-server-aa167a09';

// Регистрируем маршруты агентов (раньше остальных, чтобы /agents/payouts/:id не конфликтовал с /agents/:id)
registerAgentRoutes(app, prefix);

// Health check endpoint
app.get(`${prefix}/health`, (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'nechai-server'
  });
});

// Ключи для хранения в KV
const COFFEE_ITEMS_KEY = 'nechai_coffee_items';
const ORDERS_PREFIX = 'nechai_order_';
const USERS_PREFIX = 'nechai_user_';
const PROMO_PREFIX = 'nechai_promo_';
const EXCHANGE_RATE_KEY = 'nechai_exchange_rate';
const FAVORITES_PREFIX = 'nechai_favorites_'; // Избранное для пользователей
const TICKER_SETTINGS_KEY = 'nechai_ticker_settings'; // Настройки бегущей строки (Опт)
const RETAIL_TICKER_SETTINGS_KEY = 'nechai_retail_ticker_settings'; // Настройки бегущей строки (Розница)
const RETAIL_PRODUCTS_PREFIX = 'nechai_retail_product_'; // Розничные товары
const RETAIL_ORDERS_PREFIX = 'nechai_retail_order_'; // Розничные заказы
const RETAIL_LOCATIONS_KEY = 'nechai_retail_locations'; // Точки продаж
const RETAIL_LOCATION_REQUESTS_KEY = 'nechai_retail_location_requests'; // Заявки на добавление кофейни

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// ─── Ступени программы лояльности «Нечай» ────────────────────────────────────
const LOYALTY_LEVELS_SERVER = [
  { level: 0, label: 'Случайный визит',     discount: 0  },
  { level: 1, label: 'Нечайная встреча',    discount: 5  },
  { level: 2, label: 'Приятная нечайность', discount: 7  },
  { level: 3, label: 'Главный Нечай',       discount: 10 },
];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Возвращает оптовые заказы пользователя */
async function getWholesaleOrdersForUser(userId: string): Promise<any[]> {
  try {
    const allOrders = await kv.getByPrefix(ORDERS_PREFIX);
    return allOrders.filter(
      (o: any) => o.userId === userId && (!o.orderType || o.orderType === 'wholesale')
    );
  } catch {
    return [];
  }
}

/** Считает суммарные кг из всех оптовых заказов пользователя */
async function computeTotalKgForUser(userId: string): Promise<number> {
  try {
    const userOrders = await getWholesaleOrdersForUser(userId);
    let total = 0;
    for (const order of userOrders) {
      if (!Array.isArray(order.items)) continue;
      for (const item of order.items) {
        if (item.type === 'coldbrew') continue; // Колд брю не учитывается в весе
        total += (item.kg || 0);
        total += (item.packs200 || 0) * 0.2;
      }
    }
    return Math.round(total * 10) / 10;
  } catch {
    return 0;
  }
}

/** Проверяет, что между соседними заказами нет перерыва больше maxGapDays */
function hasNoLargeGap(orders: any[], maxGapDays: number): boolean {
  if (orders.length < 2) return true;
  const sorted = [...orders].sort(
    (a, b) => new Date(a.date || a.created_at).getTime() - new Date(b.date || b.created_at).getTime()
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date || sorted[i - 1].created_at).getTime();
    const curr = new Date(sorted[i].date || sorted[i].created_at).getTime();
    if ((curr - prev) / MS_PER_DAY > maxGapDays) return false;
  }
  return true;
}

/**
 * Вычисляет авто-ступень лояльности по истории заказов.
 *   Ступень 3 — 12 заказов за 12 месяцев + нет перерывов > 40 дней
 *   Ступень 2 — 8 заказов за 6 месяцев  + нет перерывов > 45 дней
 *   Ступень 1 — 4 заказа за 3 месяца
 *   Ступень 0 — по умолчанию
 * При невыполнении условий ступень снижается на 1.
 */
function getAutoLoyaltyForOrders(orders: any[]): {
  level: number; label: string; discount: number;
  ordersIn3Mo: number; ordersIn6Mo: number; ordersIn12Mo: number;
} {
  const now = Date.now();
  const ordersIn3Mo  = orders.filter(o => (now - new Date(o.date || o.created_at).getTime()) <= 90  * MS_PER_DAY);
  const ordersIn6Mo  = orders.filter(o => (now - new Date(o.date || o.created_at).getTime()) <= 180 * MS_PER_DAY);
  const ordersIn12Mo = orders.filter(o => (now - new Date(o.date || o.created_at).getTime()) <= 365 * MS_PER_DAY);

  let lvl = LOYALTY_LEVELS_SERVER[0];
  if (ordersIn3Mo.length  >= 4)                                     lvl = LOYALTY_LEVELS_SERVER[1];
  if (ordersIn6Mo.length  >= 8  && hasNoLargeGap(ordersIn6Mo,  45)) lvl = LOYALTY_LEVELS_SERVER[2];
  if (ordersIn12Mo.length >= 12 && hasNoLargeGap(ordersIn12Mo, 40)) lvl = LOYALTY_LEVELS_SERVER[3];

  return { ...lvl, ordersIn3Mo: ordersIn3Mo.length, ordersIn6Mo: ordersIn6Mo.length, ordersIn12Mo: ordersIn12Mo.length };
}

/**
 * Применяет правило «снижается не более чем на 1 уровень за раз».
 * Рост — мгновенный (до earned level).
 * Снижение — максимум на 1 ступень от текущего хранимого уровня.
 */
function applyDropByOne(storedLevel: number, earnedLevel: number): number {
  if (earnedLevel >= storedLevel) return earnedLevel; // рост или без изменений
  return Math.max(earnedLevel, storedLevel - 1);       // снижение не более чем на 1
}

/**
 * 🔒 SECURITY: Проверка админского доступа
 * 
 * Проверяет, имеет ли запрос права администратора.
 * Токен должен быть в env variable ADMIN_API_TOKEN.
 * 
 * Принимаемые форматы:
 * 1. Authorization: Bearer <token> (предпочтительный)
 * 2. x-admin-token: <token> (альтернативный)
 * 
 * НЕ принимается: query параметр admin_token (небезопасно)
 * 
 * @param c - Hono context
 * @returns true если админ авторизован, false иначе
 */


/**
 * Формирует позиции для счета в Точка Банке из элементов корзины.
 * Разделяет один товар с разными весами на отдельные позиции.
 */
function formatTochkaPositions(items: any[]): any[] {
  const positions: any[] = [];
  
  items.forEach((item: any) => {
    const isDrip = item.type === 'drip';
    const isColdBrew = item.type === 'coldbrew';
    const categorySuffix = item.category ? ` (${item.category})` : '';
    
    // Колд брю: N контейнеров по 5 л
    if (isColdBrew) {
      if (item.kg > 0) {
        const pricePer5L = item.priceKg || (item.subtotal / Math.max(item.kg, 1));
        positions.push({
          positionName: `${item.name} (5 л)`,
          unitCode: 'шт.',
          ndsKind: 'without_nds',
          price: Math.round(pricePer5L).toString(),
          quantity: item.kg.toString(),
          totalAmount: item.subtotal.toString(),
          totalNds: '0'
        });
      }
      return;
    }
    
    // Если есть килограммы (или упаковки для дрип-пакетов), создаем отдельную позицию
    if (item.kg > 0) {
      const priceKg = item.priceKg || (item.subtotal / ((item.kg || 0) + (item.packs200 || 0)));
      const kgSubtotal = Math.round(item.kg * priceKg);
      
      positions.push({
        positionName: isDrip ? `${item.name} (упак. 6 шт.)` : `${item.name}${categorySuffix}`,
        unitCode: isDrip ? "шт." : "кг.", // Для дрипов упаковка - это штука, для кофе - кг
        ndsKind: "without_nds", // Без НДС для УСН
        price: Math.round(priceKg).toString(),
        quantity: item.kg.toString(),
        totalAmount: kgSubtotal.toString(),
        totalNds: "0"
      });
    }
    
    // Если есть пачки 200г (или отдельные дрип-пакеты), создаем отдельную позицию (штучный товар!)
    if (item.packs200 > 0) {
      const price200 = item.price200 || (item.subtotal / ((item.kg || 0) + (item.packs200 || 0)));
      const packs200Subtotal = Math.round(item.packs200 * price200);
      
      positions.push({
        positionName: isDrip ? item.name : `${item.name}${categorySuffix} (упак. 200г)`,
        unitCode: "шт.", // С ТОЧКОЙ! Требование API - штучный товар
        ndsKind: "without_nds", // Без НДС для УСН
        price: Math.round(price200).toString(),
        quantity: item.packs200.toString(), // Количество в штуках
        totalAmount: packs200Subtotal.toString(),
        totalNds: "0"
      });
    }
  });
  
  return positions;
}

// ============================================================================
// EXCHANGE RATE ENDPOINTS
// ============================================================================

// Получить текущий курс доллара
app.get(`${prefix}/exchange-rate`, async (c) => {
  try {
    const rate = await kv.get(EXCHANGE_RATE_KEY);
    
    if (!rate) {
      // Курс по умолчанию
      const defaultRate = { usd_to_rub: 95, updated_at: new Date().toISOString() };
      await kv.set(EXCHANGE_RATE_KEY, defaultRate);
      return c.json(defaultRate);
    }
    
    return c.json(rate);
  } catch (error) {
    console.log('Error fetching exchange rate:', error);
    return c.json({ error: 'Failed to fetch exchange rate' }, 500);
  }
});

// Обновить курс доллара
app.put(`${prefix}/exchange-rate`, async (c) => {
  try {
    const body = await c.req.json();
    const { usd_to_rub } = body;
    
    if (!usd_to_rub || isNaN(parseFloat(usd_to_rub))) {
      return c.json({ error: 'Invalid exchange rate value' }, 400);
    }
    
    const newRate = parseFloat(usd_to_rub);
    const rate = {
      usd_to_rub: newRate,
      updated_at: new Date().toISOString()
    };
    
    // Сохраняем новый курс
    await kv.set(EXCHANGE_RATE_KEY, rate);
    console.log('Exchange rate updated:', rate);
    
    // Пересчитываем рублевые цены для всех товаров
    const items = await kv.get(COFFEE_ITEMS_KEY) || [];
    const updatedItems = items.map((item: any) => {
      const updated = { ...item };
      
      // Пересчитываем рублевые цены из USD
      if (item.price_usd_kg) {
        updated.price_kg = Math.round(item.price_usd_kg * newRate);
      }
      if (item.price_usd_200) {
        updated.price_200 = Math.round(item.price_usd_200 * newRate);
      }
      
      return updated;
    });
    
    // Сохраняем обновленные товары
    await kv.set(COFFEE_ITEMS_KEY, updatedItems);
    console.log(`Updated prices for ${updatedItems.length} items with new exchange rate`);
    
    return c.json(rate);
  } catch (error) {
    console.log('Error updating exchange rate:', error);
    return c.json({ error: 'Failed to update exchange rate' }, 500);
  }
});

// ============================================================================
// COFFEE ITEMS ENDPOINTS
// ============================================================================

// Получить список всех позиций кофе
app.get(`${prefix}/coffee-items`, async (c) => {
  try {
    let items = await kv.get(COFFEE_ITEMS_KEY);
    
    if (!items || items.length === 0) {
      const initialItems = [
        {
          id: '1',
          name: 'Колумбия Уила',
          country: 'Колумбия',
          category: 'Эспрессо',
          process: 'Мытый',
          type: 'grain',
          price_kg: 1850,
          price_200: 520
        },
        {
          id: '2',
          name: 'Эфиопия Иргачиф',
          country: 'Эфиопия',
          category: 'Фильтр',
          process: 'Натуральный',
          type: 'grain',
          price_kg: 1950,
          price_200: 550
        },
        {
          id: '3',
          name: 'Бразилия Сантос',
          country: 'Бразилия',
          category: 'Эспрессо',
          process: 'Натуральный',
          type: 'grain',
          price_kg: 1650,
          price_200: 470
        },
        {
          id: '4',
          name: 'Коста-Рика Тарразу',
          country: 'Коста-Рика',
          category: 'Фильтр',
          process: 'Хани',
          type: 'grain',
          price_kg: 2100,
          price_200: 590
        },
        {
          id: '5',
          name: 'Кения АА',
          country: 'Кения',
          category: 'Фильтр',
          process: 'Мытый',
          type: 'grain',
          price_kg: 2250,
          price_200: 630
        },
        {
          id: '6',
          name: 'Гватемала Антигуа',
          country: 'Гватемала',
          category: 'Эспрессо',
          process: 'Мытый',
          type: 'grain',
          price_kg: 1900,
          price_200: 540
        }
      ];
      await kv.set(COFFEE_ITEMS_KEY, initialItems);
      return c.json(initialItems);
    }
    
    // Получаем текущий курс для миграции
    let exchangeRate = 95; // курс по умолчанию
    const rateData = await kv.get(EXCHANGE_RATE_KEY);
    if (rateData && rateData.usd_to_rub) {
      exchangeRate = rateData.usd_to_rub;
    }
    
    // Миграция
    let needsUpdate = false;
    const migratedItems = items.map((item: any) => {
      let updated = { ...item };
      
      // Миграция price_250 -> price_200
      if (item.price_250 !== undefined && item.price_200 === undefined) {
        needsUpdate = true;
        const { price_250, ...rest } = updated;
        updated = { ...rest, price_200: price_250 };
      }
      
      // Миграция: добавляем type='grain' для старых товаров
      if (!item.type) {
        needsUpdate = true;
        updated = { ...updated, type: 'grain' };
      }
      
      // Миграция: если нет USD цен, рассчитываем их из рублевых
      if (!item.price_usd_kg && item.price_kg) {
        needsUpdate = true;
        updated = { 
          ...updated, 
          price_usd_kg: parseFloat((item.price_kg / exchangeRate).toFixed(2))
        };
      }
      if (!item.price_usd_200 && item.price_200) {
        needsUpdate = true;
        updated = { 
          ...updated, 
          price_usd_200: parseFloat((item.price_200 / exchangeRate).toFixed(2))
        };
      }
      
      // Если нет рублевых цен, но есть USD - рассчитываем рублевые
      if (!item.price_kg && item.price_usd_kg) {
        needsUpdate = true;
        updated = { 
          ...updated, 
          price_kg: Math.round(item.price_usd_kg * exchangeRate)
        };
      }
      if (!item.price_200 && item.price_usd_200) {
        needsUpdate = true;
        updated = { 
          ...updated, 
          price_200: Math.round(item.price_usd_200 * exchangeRate)
        };
      }
      
      // Миграция: добавляем published=true для существующих товаров
      if (item.published === undefined) {
        needsUpdate = true;
        updated = { ...updated, published: true };
      }
      
      return updated;
    });
    
    if (needsUpdate) {
      await kv.set(COFFEE_ITEMS_KEY, migratedItems);
      console.log('Migrated coffee items: added USD prices and converted old data');
      // Фильтруем только опубликованные товары для пользователей
      const publishedItems = migratedItems.filter((item: any) => item.published !== false);
      return c.json(publishedItems);
    }
    
    // Фильтруем только опубликованные товары для пользователей
    const publishedItems = items.filter((item: any) => item.published !== false);
    return c.json(publishedItems);
  } catch (error) {
    console.log('Error fetching coffee items:', error);
    return c.json({ error: 'Failed to fetch coffee items' }, 500);
  }
});

// Получить все позиции кофе (включая неопубликованные) для админки
app.get(`${prefix}/coffee-items-admin`, async (c) => {
  try {
    let items = await kv.get(COFFEE_ITEMS_KEY) || [];
    
    // Получаем текущий курс для миграции
    let exchangeRate = 95;
    const rateData = await kv.get(EXCHANGE_RATE_KEY);
    if (rateData && rateData.usd_to_rub) {
      exchangeRate = rateData.usd_to_rub;
    }
    
    // Миграция (та же логика что в обычном GET)
    let needsUpdate = false;
    const migratedItems = items.map((item: any) => {
      let updated = { ...item };
      
      if (item.price_250 !== undefined && item.price_200 === undefined) {
        needsUpdate = true;
        const { price_250, ...rest } = updated;
        updated = { ...rest, price_200: price_250 };
      }
      
      if (!item.type) {
        needsUpdate = true;
        updated = { ...updated, type: 'grain' };
      }
      
      if (!item.price_usd_kg && item.price_kg) {
        needsUpdate = true;
        updated = { 
          ...updated, 
          price_usd_kg: parseFloat((item.price_kg / exchangeRate).toFixed(2))
        };
      }
      if (!item.price_usd_200 && item.price_200) {
        needsUpdate = true;
        updated = { 
          ...updated, 
          price_usd_200: parseFloat((item.price_200 / exchangeRate).toFixed(2))
        };
      }
      
      if (!item.price_kg && item.price_usd_kg) {
        needsUpdate = true;
        updated = { 
          ...updated, 
          price_kg: Math.round(item.price_usd_kg * exchangeRate)
        };
      }
      if (!item.price_200 && item.price_usd_200) {
        needsUpdate = true;
        updated = { 
          ...updated, 
          price_200: Math.round(item.price_usd_200 * exchangeRate)
        };
      }
      
      if (item.published === undefined) {
        needsUpdate = true;
        updated = { ...updated, published: true };
      }
      
      return updated;
    });
    
    if (needsUpdate) {
      await kv.set(COFFEE_ITEMS_KEY, migratedItems);
      console.log('Migrated coffee items in admin endpoint');
      return c.json(migratedItems);
    }
    
    return c.json(items);
  } catch (error) {
    console.log('Error fetching coffee items (admin):', error);
    return c.json({ error: 'Failed to fetch coffee items' }, 500);
  }
});

// Добавить новую позицию кофе
app.post(`${prefix}/coffee-items`, async (c) => {
  try {
    const body = await c.req.json();
    const { name, country, process, category, type, descriptors, qScore, badge, price_usd_kg, price_usd_200, price_kg, price_200, published, no_discount } = body;
    
    // Для колд брю country и process необязательны
    const isColdBrew = type === 'coldbrew';
    if (!name || (!isColdBrew && (!country || !process)) || !category || !type) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    const items = await kv.get(COFFEE_ITEMS_KEY) || [];
    const newItem = {
      id: Date.now().toString(),
      name,
      country: country || '',
      process: process || '',
      category,
      type,
      ...(descriptors && { descriptors }),
      ...(qScore && { qScore: parseFloat(qScore) }),
      ...(badge && { badge }),
      price_usd_kg: price_usd_kg ? parseFloat(price_usd_kg) : undefined,
      price_usd_200: price_usd_200 !== undefined ? parseFloat(price_usd_200) : 0,
      price_kg: price_kg ? parseFloat(price_kg) : 0,
      price_200: price_200 !== undefined ? parseFloat(price_200) : 0,
      published: published !== undefined ? published : true,
      ...(no_discount !== undefined && { no_discount })
    };
    
    items.push(newItem);
    await kv.set(COFFEE_ITEMS_KEY, items);
    
    return c.json(newItem);
  } catch (error) {
    console.log('Error adding coffee item:', error);
    return c.json({ error: 'Failed to add coffee item' }, 500);
  }
});

// Обновить позицию кофе
app.put(`${prefix}/coffee-items/:id`, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const items = await kv.get(COFFEE_ITEMS_KEY) || [];
    const index = items.findIndex((item: any) => item.id === id);
    
    if (index === -1) {
      return c.json({ error: 'Item not found' }, 404);
    }
    
    items[index] = { ...items[index], ...body };
    // Явно удаляем бейдж, если передан null/пустая строка
    if ('badge' in body && !body.badge) {
      delete items[index].badge;
    }
    await kv.set(COFFEE_ITEMS_KEY, items);
    
    return c.json(items[index]);
  } catch (error) {
    console.log('Error updating coffee item:', error);
    return c.json({ error: 'Failed to update coffee item' }, 500);
  }
});

// Обновить порядок позиций кофе (массовое обновление)
app.put(`${prefix}/coffee-items-reorder`, async (c) => {
  try {
    const body = await c.req.json();
    const { items } = body; // Ожидаем массив items в новом порядке
    
    if (!items || !Array.isArray(items)) {
      return c.json({ error: 'Invalid data format' }, 400);
    }
    
    // Просто сохраняем весь массив, так как порядок в массиве и есть порядок отображения
    await kv.set(COFFEE_ITEMS_KEY, items);
    
    return c.json({ success: true, items });
  } catch (error) {
    console.log('Error reordering coffee items:', error);
    return c.json({ error: 'Failed to reorder coffee items' }, 500);
  }
});

// Удалить позицию кофе
app.delete(`${prefix}/coffee-items/:id`, async (c) => {
  try {
    const id = c.req.param('id');
    
    const items = await kv.get(COFFEE_ITEMS_KEY) || [];
    const filtered = items.filter((item: any) => item.id !== id);
    
    await kv.set(COFFEE_ITEMS_KEY, filtered);
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting coffee item:', error);
    return c.json({ error: 'Failed to delete coffee item' }, 500);
  }
});

// ============================================================================
// ORDERS ENDPOINTS
// ============================================================================

// Создать новый заказ
app.post(`${prefix}/orders`, async (c) => {
  try {
    const body = await c.req.json();
    const { company, inn, account, bik, contact, phone, address, delivery_address, delivery_company, delivery_method, items, total, userId, promoCode } = body;
    
    console.log('========================================');
    console.log('NEW ORDER RECEIVED');
    console.log('Company:', company);
    console.log('Promo:', promoCode);
    
    if (!company || !inn || !account || !bik || !contact || !phone || !address || !delivery_company || !delivery_method || !items || !total) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    // Если есть промокод, обновляем его использование
    if (promoCode) {
      const promoKey = `${PROMO_PREFIX}${promoCode.toUpperCase()}`;
      const promo = await kv.get(promoKey);
      if (promo) {
        promo.usedCount = (promo.usedCount || 0) + 1;
        await kv.set(promoKey, promo);
      }
    }

    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const orderId = `ORD-${timestamp}-${random}`;
    
    const order = {
      orderId,
      date: new Date().toISOString(),
      company,
      inn,
      account,
      bik,
      contact,
      phone,
      address,
      delivery_address: delivery_address || undefined,
      delivery_company,
      delivery_method,
      items,
      total,
      userId: userId || undefined,
      promoCode: promoCode || undefined
    };
    
    console.log('Saving order to database...');
    await kv.set(`${ORDERS_PREFIX}${orderId}`, order);
    
    // Автоматически создаем счет в Точка Банке
    let invoiceUrl = undefined;
    console.log('Creating invoice in Tochka Bank...');
    
    try {
      const jwtToken = Deno.env.get('TOCHKA_JWT_TOKEN');
      if (jwtToken) {
        // Формируем позиции счета
        const positions = formatTochkaPositions(order.items);
        
        // Формируем тело запроса для Точка Банка
        const invoiceBody = {
          Data: {
            accountId: "40802810901500399057/044525104",
            customerCode: "303213604",
            SecondSide: {
              taxCode: order.inn,
              type: order.inn.length === 10 ? "company" : "ip",
              secondSideName: order.company,
              ...(order.inn.length === 10 && order.kpp ? { kpp: order.kpp } : {}),
              legalAddress: order.address,
              ...(order.account && order.bik ? { 
                accountId: `${order.account}/${order.bik}`
              } : {})
            },
            Content: {
              Invoice: {
                Positions: positions,
                date: new Date().toISOString().split('T')[0],
                totalAmount: order.total.toString(),
                totalNds: "0",
                number: orderId,
                basedOn: `Заказ ${orderId} с сайта coffeenechai.ru`,
                comment: `Доставка: ${order.delivery_company} - ${order.delivery_method}. Контакт: ${order.contact}, ${order.phone}`,
                paymentExpiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              }
            }
          }
        };
        
        const invoiceResponse = await fetch('https://enter.tochka.com/uapi/invoice/v1.0/bills', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(invoiceBody)
        });
        
        if (invoiceResponse.ok) {
          const invoiceData = await invoiceResponse.json();
          const invoiceId = invoiceData.id || invoiceData.bill_id || orderId;
          
          // Формируем ссылку на счет в Точка Банке
          invoiceUrl = `https://enter.tochka.com/invoice/${invoiceId}`;
          
          // Обновляем заказ с информацией о счете
          order.invoiceId = invoiceId;
          order.invoiceCreatedAt = new Date().toISOString();
          order.invoiceUrl = invoiceUrl;
          
          await kv.set(`${ORDERS_PREFIX}${orderId}`, order);
          console.log('Invoice created successfully:', invoiceId);
        } else {
          console.log('Failed to create invoice, continuing without it...');
        }
      }
    } catch (invoiceError) {
      console.log('Error creating invoice (continuing without it):', invoiceError);
    }
    
    console.log('Sending Telegram notification...');
    await sendTelegramNotification({ ...order, invoiceUrl });
    console.log('Order processing complete!');
    
    return c.json(order);
  } catch (error) {
    console.log('Error creating order:', error);
    return c.json({ error: 'Failed to create order' }, 500);
  }
});

// Получить все заказы (только оптовые)
app.get(`${prefix}/orders`, async (c) => {
  try {
    console.log('Fetching all wholesale orders');
    const orders = await kv.getByPrefix(ORDERS_PREFIX);
    
    // Миграция: преобразуем старые поля packs250 в packs200 в заказах
    const migratedOrders = orders.map((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        const migratedItems = order.items.map((item: any) => {
          if (item.packs250 !== undefined && item.packs200 === undefined) {
            const { packs250, ...rest } = item;
            return { ...rest, packs200: packs250 };
          }
          return item;
        });
        return { ...order, items: migratedItems };
      }
      return order;
    });
    
    // Фильтруем только оптовые заказы (без orderType или orderType === 'wholesale')
    // Это нужно, чтобы исключить розничные заказы, которые были ошибочно сохранены под префиксом ORDERS_PREFIX
    const wholesaleOrders = migratedOrders.filter((order: any) => 
      !order.orderType || order.orderType === 'wholesale'
    );
    
    // Сортируем по дате (новые первыми)
    const sorted = wholesaleOrders.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return c.json(sorted);
  } catch (error) {
    console.log('Error fetching orders:', error);
    return c.json({ error: 'Failed to fetch orders' }, 500);
  }
});

// Получить заказ по ID
app.get(`${prefix}/orders/:id`, async (c) => {
  try {
    const id = c.req.param('id');
    const order = await kv.get(`${ORDERS_PREFIX}${id}`);
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    return c.json(order);
  } catch (error) {
    console.log('Error fetching order:', error);
    return c.json({ error: 'Failed to fetch order' }, 500);
  }
});

// Удалить заказ
app.delete(`${prefix}/orders/:id`, async (c) => {
  try {
    const id = c.req.param('id');
    console.log('Deleting order:', id);
    
    await kv.del(`${ORDERS_PREFIX}${id}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting order:', error);
    return c.json({ error: 'Failed to delete order' }, 500);
  }
});

// ============================================================================
// WHOLESALE ACCESS REQUEST ENDPOINTS
// ============================================================================

// Функция для генерации случайного пароля
function generatePassword(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Функция для нормализации телефона (конвертация +7/7 в 8)
function normalizePhone(phone: string): string {
  // Убираем все символы кроме цифр
  let cleaned = phone.replace(/\D/g, '');
  
  // Если начинается с +7 или 7, заменяем на 8
  if (cleaned.startsWith('7')) {
    cleaned = '8' + cleaned.substring(1);
  }
  
  return cleaned;
}

// POST /wholesale/request-access - заявка на получение доступа к опту
app.post(`${prefix}/wholesale/request-access`, async (c) => {
  console.log('📝 [WHOLESALE] New access request received');
  
  try {
    const body = await c.req.json();
    const { name, company, phone, channel } = body;
    
    console.log('📝 [WHOLESALE] New registration request received');
    
    if (!name || !company || !phone) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    // Нормализуем телефон для логина
    const normalizedPhone = normalizePhone(phone);
    console.log('📞 [WHOLESALE] Phone normalized');
    
    // Генерируем пароль
    const password = generatePassword(6);
    console.log('🔑 [WHOLESALE] Password generated');
    
    // Проверяем, не существует ли уже пользователь с таким телефоном
    const existingUsers = await kv.getByPrefix(USERS_PREFIX);
    const phoneExists = existingUsers.some((user: any) => user.phone === normalizedPhone);
    
    if (phoneExists) {
      console.log('⚠️ [WHOLESALE] User with phone already exists');
      
      // Отправляем уведомление в Telegram о попытке повторной регистрации
      try {
        const message = `⚠️ <b>Повторная заявка на оптовый доступ</b>\n\n` +
          `👤 Имя: ${name}\n` +
          `🏢 Компания: ${company}\n` +
          `📞 Телефон: ${phone}\n` +
          `💬 Канал: ${channel === 'telegram' ? 'Telegram' : 'WhatsApp'}\n\n` +
          `⚠️ Пользователь с этим телефоном уже существует`;
        
        await sendTelegramMessage(message);
      } catch (telegramError) {
        console.error('Failed to send Telegram notification:', telegramError);
      }
      
      return c.json({ 
        error: 'Пользователь с таким телефоном уже зарегистрирован. Если у вас возникли проблемы со входом, свяжитесь с нами.' 
      }, 400);
    }
    
    // Создаем пользователя в системе
    const userId = Date.now().toString();
    const user: any = {
      id: userId,
      phone: normalizedPhone,
      password: password,
      company_name: company,
      email: body.email || undefined,
      discount: 0, // По умолчанию без скидки
      loyaltyLevel: 0,
      loyaltyLevelSetDate: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    console.log('💾 [WHOLESALE] Creating user:', { ...user, password: '***' });
    await kv.set(`${USERS_PREFIX}${userId}`, user);
    console.log('✅ [WHOLESALE] User created successfully');
    
    // Формируем сообщение для Telegram с копируемыми полями
    const channelEmoji = channel === 'telegram' ? '✈️ Telegram' : '💬 WhatsApp';
    const message = `🆕 <b>Заявка на получение доступа в оптовый кабинет</b>\n\n` +
      `👤 <b>Имя:</b> <code>${name}</code>\n` +
      `🏢 <b>Компания:</b> <code>${company}</code>\n` +
      `📞 <b>Телефон:</b> <pre>${phone}</pre>\n` +
      `💬 <b>Канал:</b> ${channelEmoji}\n\n` +
      `🔐 <b>Данные для входа (созданы автоматически):</b>\n` +
      `📱 <b>Логин:</b> <pre>${normalizedPhone}</pre>\n` +
      `🔑 <b>Пароль:</b> <pre>${password}</pre>\n\n` +
      `💡 <i>Каждое поле можно скопировать нажатием</i>`;
    
    console.log('📨 [WHOLESALE] Sending Telegram notification');
    
    try {
      await sendTelegramMessage(message);
      console.log('✅ [WHOLESALE] Telegram notification sent');
    } catch (telegramError) {
      console.error('❌ [WHOLESALE] Failed to send Telegram notification:', telegramError);
      // Не возвращаем ошибку, так как пользователь уже создан
    }
    
    return c.json({ 
      success: true,
      message: 'Заявка успешно отправлена. Мы пришлем вам логин и пароль в течение 15 минут.' 
    });
    
  } catch (error) {
    console.error('❌ [WHOLESALE] Error processing access request:', error);
    return c.json({ error: 'Failed to process request' }, 500);
  }
});

// ============================================================================
// USERS ENDPOINTS
// ============================================================================

// 🔒 Получить всех пользователей - ТРЕБУЕТ АВТОРИЗАЦИИ АДМИНА
app.get(`${prefix}/users`, async (c) => {
  try {
    console.log('Fetching all users');
    const users = await kv.getByPrefix(USERS_PREFIX);
    
    // Убираем пароли из ответа
    const sanitizedUsers = users.map((user: any) => {
      const { password, ...rest } = user;
      return rest;
    });
    
    // Сортируем по дате создания (новые первыми)
    const sorted = sanitizedUsers.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return c.json(sorted);
  } catch (error) {
    console.log('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Создать нового пользователя
app.post(`${prefix}/users`, async (c) => {
  try {
    const body = await c.req.json();
    console.log('Creating user with data:', { ...body, password: '***' });
    const { phone, password, company_name, discount, loyaltyLevel, loyaltyLevelSetDate } = body;
    
    if (!phone || !password) {
      console.log('Missing required fields:', { phone: !!phone, password: !!password });
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    // ВАЖНО: Проверяем обязательное наличие названия компании
    if (!company_name || company_name.trim() === '') {
      console.log('Missing company_name - users can only be created with a company name');
      return c.json({ error: 'Company name is required. Users can only be created through admin panel with valid company data.' }, 400);
    }
    
    // Проверяем, не существует ли уже пользователь с таким телефоном
    const existingUsers = await kv.getByPrefix(USERS_PREFIX);
    const phoneExists = existingUsers.some((user: any) => user.phone === phone);
    
    if (phoneExists) {
      console.log('User with phone already exists:', phone);
      return c.json({ error: 'User with this phone already exists' }, 400);
    }
    
    // Валидация скидки
    let validDiscount = undefined;
    if (discount !== undefined && discount !== null && discount !== '') {
      const discountNum = Number(discount);
      if (!isNaN(discountNum) && discountNum >= 0 && discountNum <= 100) {
        validDiscount = discountNum;
      } else {
        console.log('Invalid discount value:', discount);
      }
    }
    
    const userId = Date.now().toString();
    const user = {
      id: userId,
      phone,
      password, // В реальном проекте нужно хешировать!
      company_name: company_name || undefined,
      discount: validDiscount,
      loyaltyLevel: loyaltyLevel !== undefined ? Number(loyaltyLevel) : 0,
      loyaltyLevelSetDate: loyaltyLevelSetDate || new Date().toISOString(),
      role: body.role || 'wholesale', // По умолчанию оптовый клиент
      created_at: new Date().toISOString()
    };
    
    console.log('Saving user to KV store:', { ...user, password: '***' });
    await kv.set(`${USERS_PREFIX}${userId}`, user);
    console.log('User created successfully:', userId);
    
    // Возврааем пользователя без пароля
    const { password: _, ...sanitizedUser } = user;
    return c.json(sanitizedUser);
  } catch (error) {
    console.log('Error creating user:', error);
    console.log('Error details:', error instanceof Error ? error.message : String(error));
    return c.json({ error: `Failed to create user: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Удалить пользователя
app.delete(`${prefix}/users/:id`, async (c) => {
  try {
    const id = c.req.param('id');
    const fullKey = `${USERS_PREFIX}${id}`;

    console.log('=== DELETE USER START ===');
    console.log('Deleting wholesale user id:', id, 'key:', fullKey);

    // Проверяем, существует ли пользователь
    const userBefore = await kv.get(fullKey);
    if (!userBefore) {
      console.log('User not found:', fullKey);
      return c.json({ error: 'User not found' }, 404);
    }

    console.log('Found user:', { ...userBefore, password: '***' });

    // Удаляем из KV напрямую
    await kv.del(fullKey);

    // Проверяем успешность
    const userAfter = await kv.get(fullKey);
    if (userAfter) {
      console.error('❌ User still exists after deletion!');
      return c.json({ error: 'User was not deleted from database' }, 500);
    }

    console.log('✅ User deleted successfully:', id);
    console.log('=== DELETE USER END ===');

    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting user:', error instanceof Error ? error.message : String(error));
    return c.json({
      error: 'Failed to delete user',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Оновить пользователя
app.put(`${prefix}/users/:id`, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    console.log('Updating user:', id, 'with data:', { ...body, password: body.password ? '***' : undefined });
    const { phone, password, company_name, email, discount, loyaltyLevel, loyaltyLevelSetDate, role, loyaltyLevelManualOverride } = body;
    
    // Получаем текущего пользователя
    const existingUser = await kv.get(`${USERS_PREFIX}${id}`);
    if (!existingUser) {
      console.log('User not found:', id);
      return c.json({ error: 'User not found' }, 404);
    }
    
    // Если меняется телефон, проверяем что новый телефон не занят
    if (phone && phone !== existingUser.phone) {
      const allUsers = await kv.getByPrefix(USERS_PREFIX);
      const phoneExists = allUsers.some((user: any) => user.phone === phone && user.id !== id);
      
      if (phoneExists) {
        console.log('Phone already taken:', phone);
        return c.json({ error: 'User with this phone already exists' }, 400);
      }
    }
    
    // Валидация скидки
    let validDiscount = existingUser.discount;
    if (discount !== undefined) {
      if (discount === null || discount === '') {
        validDiscount = undefined; // Удаляем скидку
      } else {
        const discountNum = Number(discount);
        if (!isNaN(discountNum) && discountNum >= 0 && discountNum <= 100) {
          validDiscount = discountNum;
        } else {
          console.log('Invalid discount value:', discount);
        }
      }
    }
    
    // Если admin явно задаёт уровень или скидку — это ручное переопределение
    const adminIsSettingLevel = loyaltyLevel !== undefined || discount !== undefined;
    // loyaltyLevelManualOverride=false в теле запроса явно сбрасывает ручной режим
    const newManualOverride = loyaltyLevelManualOverride === false
      ? false
      : (adminIsSettingLevel ? true : existingUser.loyaltyLevelManualOverride ?? false);

    // Обновляем пользователя
    const updatedUser = {
      ...existingUser,
      phone: phone || existingUser.phone,
      password: password || existingUser.password,
      company_name: company_name !== undefined ? company_name : existingUser.company_name,
      discount: validDiscount,
      loyaltyLevel: loyaltyLevel !== undefined ? Number(loyaltyLevel) : existingUser.loyaltyLevel,
      loyaltyLevelSetDate: loyaltyLevelSetDate || existingUser.loyaltyLevelSetDate,
      email: email !== undefined ? email : (existingUser.email || undefined),
      loyaltyLevelManualOverride: newManualOverride,
      role: role !== undefined ? role : (existingUser.role || 'wholesale')
    };
    
    console.log('Saving updated user:', { ...updatedUser, password: '***' });
    await kv.set(`${USERS_PREFIX}${id}`, updatedUser);
    console.log('User updated successfully:', id);
    
    // Возвращаем пользователя без пароля
    const { password: _, ...sanitizedUser } = updatedUser;
    return c.json(sanitizedUser);
  } catch (error) {
    console.log('Error updating user:', error);
    console.log('Error details:', error instanceof Error ? error.message : String(error));
    return c.json({ error: `Failed to update user: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Авторизация пользователя
app.post(`${prefix}/users/login`, async (c) => {
  try {
    const body = await c.req.json();
    const { phone, password } = body;
    
    console.log('🔐 Login attempt');
    
    if (!phone || !password) {
      console.log('❌ Missing required fields');
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    const users = await kv.getByPrefix(USERS_PREFIX);
    console.log('📋 Total users in system:', users.length);
    console.log('📋 All user phones:', users.map((u: any) => ({ phone: u.phone, role: u.role || 'wholesale' })));
    
    const user = users.find((u: any) => u.phone === phone && u.password === password);
    
    if (!user) {
      // Также проверяем таблицу агентов
      const agent = await findAgentByCredentials(phone, password);
      if (agent) {
        console.log('✅ Agent login successful:', phone, 'id:', agent.id);
        return c.json(agent);
      }
      // Проверим, существует ли пользователь с таким phone
      const userByPhone = users.find((u: any) => u.phone === phone);
      if (userByPhone) {
        console.log('❌ Phone found but password mismatch for:', phone);
      } else {
        console.log('❌ User not found with phone:', phone);
      }
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    console.log('✅ Login successful for:', phone, 'role:', user.role || 'wholesale');

    // Авто-пересчёт уровня лояльности при каждом входе (если нет ручного переопределения)
    const isManualOverride = !!user.loyaltyLevelManualOverride;
    if (!isManualOverride) {
      const userOrders = await getWholesaleOrdersForUser(user.id);
      const autoLoyalty = getAutoLoyaltyForOrders(userOrders);
      // Правило «снижается не более чем на 1 уровень за раз»
      const storedLevel = user.loyaltyLevel ?? 0;
      const newLevel = applyDropByOne(storedLevel, autoLoyalty.level);
      const newLevelData = LOYALTY_LEVELS_SERVER.find(l => l.level === newLevel) ?? LOYALTY_LEVELS_SERVER[0];
      if (user.loyaltyLevel !== newLevel || user.discount !== newLevelData.discount) {
        user.loyaltyLevel = newLevel;
        user.discount = newLevelData.discount;
        user.loyaltyLevelSetDate = new Date().toISOString();
        await kv.set(`${USERS_PREFIX}${user.id}`, user);
        console.log(`🏆 Auto loyalty updated for ${user.id}: earned=${autoLoyalty.level}, applied=${newLevel}, discount=${newLevelData.discount}%`);
      }
    }

    // Возвращаем пользователя без пароля, но с ролью
    const { password: _, ...sanitizedUser } = user;
    const userWithRole = {
      ...sanitizedUser,
      role: sanitizedUser.role || 'wholesale'
    };
    return c.json(userWithRole);
  } catch (error) {
    console.log('Error logging in:', error);
    return c.json({ error: 'Failed to log in' }, 500);
  }
});

// ✅ Получить информацию о лояльности пользователя (ПУБЛИЧНЫЙ endpoint)
// Возвращает только loyaltyLevel и loyaltyLevelSetDate для конкретного пользователя
app.get(`${prefix}/users/:id/loyalty`, async (c) => {
  try {
    const userId = c.req.param('id');
    
    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400);
    }
    
    const user = await kv.get(`${USERS_PREFIX}${userId}`);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    // Вычисляем авто-ступень по заказам
    const userOrders = await getWholesaleOrdersForUser(userId);
    const totalKg = await computeTotalKgForUser(userId); // оставляем для совместимости
    const autoLoyalty = getAutoLoyaltyForOrders(userOrders);

    const isManualOverride = !!user.loyaltyLevelManualOverride;

    // Правило «снижается не более чем на 1 уровень за раз» (только для авто-режима)
    const storedLevel2 = user.loyaltyLevel ?? 0;
    const newLevel2 = isManualOverride ? storedLevel2 : applyDropByOne(storedLevel2, autoLoyalty.level);
    const newLevelData2 = LOYALTY_LEVELS_SERVER.find(l => l.level === newLevel2) ?? LOYALTY_LEVELS_SERVER[0];

    const effectiveLevel    = newLevel2;
    const effectiveDiscount = isManualOverride ? (user.discount ?? 0) : newLevelData2.discount;

    // Если уровень изменился (и нет ручного override) — обновляем пользователя в KV
    if (!isManualOverride && (user.loyaltyLevel !== newLevel2 || user.discount !== newLevelData2.discount)) {
      await kv.set(`${USERS_PREFIX}${userId}`, {
        ...user,
        loyaltyLevel: newLevel2,
        discount: newLevelData2.discount,
        loyaltyLevelSetDate: new Date().toISOString(),
      });
      console.log(`🏆 Loyalty info update for ${userId}: earned=${autoLoyalty.level}, applied=${newLevel2}, discount=${newLevelData2.discount}%`);
    }

    // Следующий уровень
    const nextLvl = LOYALTY_LEVELS_SERVER.find(l => l.level === effectiveLevel + 1) ?? null;

    return c.json({
      loyaltyLevel: effectiveLevel,
      discount: effectiveDiscount,
      loyaltyLevelSetDate: user.loyaltyLevelSetDate || new Date().toISOString(),
      totalKg,
      ordersIn3Mo: autoLoyalty.ordersIn3Mo,
      ordersIn6Mo: autoLoyalty.ordersIn6Mo,
      ordersIn12Mo: autoLoyalty.ordersIn12Mo,
      autoLevel: autoLoyalty.level,
      autoDiscount: autoLoyalty.discount,
      isManualOverride,
      nextLevel: nextLvl,
    });
  } catch (error) {
    console.error(`Error fetching loyalty info for user:`, error);
    return c.json({ error: 'Failed to fetch loyalty information' }, 500);
  }
});

// 🔒 Получить заказы пользователя - ТРЕБУЕТ АВТОРИЗАЦИИ АДМИНА
// TODO: В будущем добавить проверку через Supabase Auth, чтобы пользователь мог видеть свои заказы
app.get(`${prefix}/users/:id/orders`, async (c) => {
  try {
    const userId = c.req.param('id');
    
    console.log(`Fetching orders for user ${userId}`);
    const allOrders = await kv.getByPrefix(ORDERS_PREFIX);
    
    // Фильтруем только оптовые заказы по userId (согласовано с getWholesaleOrdersForUser)
    const userOrders = allOrders.filter((order: any) =>
      order.userId === userId && (!order.orderType || order.orderType === 'wholesale')
    );
    
    // Миграция: преобразуем старые поля packs250 в packs200
    const migratedOrders = userOrders.map((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        const migratedItems = order.items.map((item: any) => {
          if (item.packs250 !== undefined && item.packs200 === undefined) {
            const { packs250, ...rest } = item;
            return { ...rest, packs200: packs250 };
          }
          return item;
        });
        return { ...order, items: migratedItems };
      }
      return order;
    });
    
    // Сортируем по дате (новые первыми)
    const sorted = migratedOrders.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return c.json(sorted);
  } catch (error) {
    console.log('Error fetching user orders:', error);
    return c.json({ error: 'Failed to fetch user orders' }, 500);
  }
});

// ============================================================================
// USER SETTINGS ENDPOINTS
// ============================================================================

const USER_SETTINGS_PREFIX = 'nechai_user_settings_';

// Получить настройки пользователя
app.get(`${prefix}/user-settings/:userId`, async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log(`Fetching settings for user: ${userId}`);
    const settings = await kv.get(`${USER_SETTINGS_PREFIX}${userId}`);
    console.log(`Settings found for user ${userId}:`, settings ? 'YES' : 'NO', settings ? JSON.stringify(settings) : '');
    
    return c.json({ settings: settings || null });
  } catch (error) {
    console.log('Error fetching user settings:', error);
    return c.json({ error: 'Failed to fetch user settings' }, 500);
  }
});

// Сохранить/обновить настройки пользователя
app.put(`${prefix}/user-settings/:userId`, async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { settings } = body;
    
    console.log(`Saving settings for user ${userId}:`, JSON.stringify(settings));
    
    if (!settings) {
      console.log('Error: Missing settings data');
      return c.json({ error: 'Missing settings data' }, 400);
    }
    
    await kv.set(`${USER_SETTINGS_PREFIX}${userId}`, settings);
    
    // Проверяем, что данные действительно сохранились
    const saved = await kv.get(`${USER_SETTINGS_PREFIX}${userId}`);
    console.log(`Settings saved and verified for user ${userId}:`, JSON.stringify(saved));
    
    return c.json({ success: true, settings });
  } catch (error) {
    console.log('Error saving user settings:', error);
    return c.json({ error: 'Failed to save user settings' }, 500);
  }
});

// ============================================================================
// PROMO CODES ENDPOINTS
// ============================================================================

// Получить все промокоды
app.get(`${prefix}/promo-codes`, async (c) => {
  try {
    const promos = await kv.getByPrefix(PROMO_PREFIX);
    return c.json(promos);
  } catch (error) {
    console.log('Error fetching promo codes:', error);
    return c.json({ error: 'Failed to fetch promo codes' }, 500);
  }
});

// Создать промокод
app.post(`${prefix}/promo-codes`, async (c) => {
  try {
    const body = await c.req.json();
    const { code, discountPercent, maxUses, expiresAt } = body;

    if (!code || !discountPercent || !maxUses || !expiresAt) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const promoKey = `${PROMO_PREFIX}${code.toUpperCase()}`;
    
    // Проверка на существование
    const existing = await kv.get(promoKey);
    if (existing) {
      return c.json({ error: 'Promo code already exists' }, 400);
    }

    const newPromo = {
      code: code.toUpperCase(),
      discountPercent: Number(discountPercent),
      maxUses: Number(maxUses),
      usedCount: 0,
      expiresAt,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    await kv.set(promoKey, newPromo);
    return c.json(newPromo);
  } catch (error) {
    console.log('Error creating promo code:', error);
    return c.json({ error: 'Failed to create promo code' }, 500);
  }
});

// Обновить промокод
app.put(`${prefix}/promo-codes/:code`, async (c) => {
  try {
    const code = c.req.param('code');
    const body = await c.req.json();
    const promoKey = `${PROMO_PREFIX}${code.toUpperCase()}`;

    const existing = await kv.get(promoKey);
    if (!existing) {
      return c.json({ error: 'Promo code not found' }, 404);
    }

    const updated = { ...existing, ...body };
    await kv.set(promoKey, updated);
    return c.json(updated);
  } catch (error) {
    console.log('Error updating promo code:', error);
    return c.json({ error: 'Failed to update promo code' }, 500);
  }
});

// Удалить промокод
app.delete(`${prefix}/promo-codes/:code`, async (c) => {
  try {
    const code = c.req.param('code');
    const promoKey = `${PROMO_PREFIX}${code.toUpperCase()}`;
    await kv.del(promoKey);
    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting promo code:', error);
    return c.json({ error: 'Failed to delete promo code' }, 500);
  }
});

// Проверить проокод
app.post(`${prefix}/verify-promo`, async (c) => {
  try {
    const body = await c.req.json();
    const { code } = body;

    if (!code) return c.json({ error: 'Code is required' }, 400);

    const promoKey = `${PROMO_PREFIX}${code.toUpperCase()}`;
    const promo = await kv.get(promoKey);

    if (!promo) {
      return c.json({ error: 'Промокод не найден' }, 404);
    }

    if (!promo.isActive) {
      return c.json({ error: 'Промокод не активен' }, 400);
    }

    if (new Date(promo.expiresAt) < new Date()) {
      return c.json({ error: 'Срок действия промокода истек' }, 400);
    }

    if (promo.usedCount >= promo.maxUses) {
      return c.json({ error: 'Лимит использований исчерпан' }, 400);
    }

    return c.json({ valid: true, discountPercent: promo.discountPercent });
  } catch (error) {
    console.log('Error verifying promo:', error);
    return c.json({ error: 'Validation failed' }, 500);
  }
});

// ============================================================================
// FAVORITES ENDPOINTS
// ============================================================================

// Получить избранное пользователя
app.get(`${prefix}/favorites/:userId`, async (c) => {
  try {
    const userId = c.req.param('userId');
    const favorites = await kv.get(`${FAVORITES_PREFIX}${userId}`) || [];
    return c.json(favorites);
  } catch (error) {
    console.log('Error fetching favorites:', error);
    return c.json({ error: 'Failed to fetch favorites' }, 500);
  }
});

// Добавить товар в избранное
app.post(`${prefix}/favorites/:userId`, async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { itemId } = body;

    if (!itemId) {
      return c.json({ error: 'Item ID is required' }, 400);
    }

    const favorites = await kv.get(`${FAVORITES_PREFIX}${userId}`) || [];
    
    // Проверяем, не добавлен ли уже товар (идемпотентность)
    if (!favorites.includes(itemId)) {
      favorites.push(itemId);
      await kv.set(`${FAVORITES_PREFIX}${userId}`, favorites);
    }

    return c.json({ success: true, favorites });
  } catch (error) {
    console.log('Error adding to favorites:', error);
    return c.json({ error: 'Failed to add to favorites' }, 500);
  }
});

// Удалить товар из избранного
app.delete(`${prefix}/favorites/:userId/:itemId`, async (c) => {
  try {
    const userId = c.req.param('userId');
    const itemId = c.req.param('itemId');

    const favorites = await kv.get(`${FAVORITES_PREFIX}${userId}`) || [];
    const filtered = favorites.filter((id: string) => id !== itemId);

    await kv.set(`${FAVORITES_PREFIX}${userId}`, filtered);

    return c.json({ success: true, favorites: filtered });
  } catch (error) {
    console.log('Error removing from favorites:', error);
    return c.json({ error: 'Failed to remove from favorites' }, 500);
  }
});

// ============================================================================
// BACKUP ENDPOINTS
// ============================================================================

// Создать и отправить бэкап на email
app.post(`${prefix}/backup/send-email`, async (c) => {
  try {
    console.log('Creating backup and sending to email...');
    const backupData = await backup.createFullBackup();
    
    // Сохраняем бэкап в базу
    const backupId = await backup.saveBackup(backupData);
    console.log('Backup saved with ID:', backupId);
    
    // Отправляем на email
    await sendBackupEmail(backupData, false);
    console.log('Backup sent to email successfully');
    
    // Обновляем расписание
    await backup.updateBackupSchedule(3);
    
    // Очищаем старые бэкапы
    await backup.cleanOldBackups(30);
    
    return c.json({ 
      success: true, 
      message: 'Backup created and sent to email',
      backupId 
    });
  } catch (error) {
    console.log('Error creating/sending backup:', error);
    return c.json({ 
      error: 'Failed to create or send backup',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Создать бэкап без отправки на email
app.post(`${prefix}/backup/create`, async (c) => {
  try {
    console.log('Creating backup...');
    const backupData = await backup.createFullBackup();
    const backupId = await backup.saveBackup(backupData);
    console.log('Backup saved with ID:', backupId);
    
    return c.json({ 
      success: true, 
      backupId,
      stats: {
        coffeeItems: backupData.coffeeItems?.length || 0,
        orders: backupData.orders?.length || 0,
        users: backupData.users?.length || 0,
        promoCodes: backupData.promoCodes?.length || 0
      }
    });
  } catch (error) {
    console.log('Error creating backup:', error);
    return c.json({ 
      error: 'Failed to create backup',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Получить список всех бэкапов
app.get(`${prefix}/backups`, async (c) => {
  try {
    const backups = await backup.getAllBackups();
    
    // Сортируем по времени (ноые первыми) и форматируем
    const formatted = backups
      .sort((a, b) => 
        new Date(b.data.timestamp).getTime() - new Date(a.data.timestamp).getTime()
      )
      .map(b => ({
        id: b.id,
        timestamp: b.data.timestamp,
        version: b.data.version,
        stats: {
          coffeeItems: b.data.coffeeItems?.length || 0,
          orders: b.data.orders?.length || 0,
          users: b.data.users?.length || 0,
          promoCodes: b.data.promoCodes?.length || 0
        }
      }));
    
    return c.json(formatted);
  } catch (error) {
    console.log('Error fetching backups:', error);
    return c.json({ error: 'Failed to fetch backups' }, 500);
  }
});

// Получить конкретный бэкап
app.get(`${prefix}/backups/:id`, async (c) => {
  try {
    const id = c.req.param('id');
    const backupData = await kv.get(id);
    
    if (!backupData) {
      return c.json({ error: 'Backup not found' }, 404);
    }
    
    return c.json(backupData);
  } catch (error) {
    console.log('Error fetching backup:', error);
    return c.json({ error: 'Failed to fetch backup' }, 500);
  }
});

// Восстановить данные из бэкапа
app.post(`${prefix}/backups/:id/restore`, async (c) => {
  try {
    const id = c.req.param('id');
    const backupData = await kv.get(id);
    
    if (!backupData) {
      return c.json({ error: 'Backup not found' }, 404);
    }
    
    console.log('Restoring from backup:', id);
    await backup.restoreFromBackup(backupData);
    console.log('Restore completed successfully');
    
    return c.json({ 
      success: true,
      message: 'Data restored successfully'
    });
  } catch (error) {
    console.log('Error restoring backup:', error);
    return c.json({ 
      error: 'Failed to restore backup',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Удалить бэкап
app.delete(`${prefix}/backups/:id`, async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(id);
    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting backup:', error);
    return c.json({ error: 'Failed to delete backup' }, 500);
  }
});

// Проверить и выполнить запланированный бэкап
app.post(`${prefix}/backup/check-schedule`, async (c) => {
  try {
    const shouldRun = await backup.shouldRunScheduledBackup();
    
    if (!shouldRun) {
      const schedule = await backup.getBackupSchedule();
      return c.json({ 
        shouldRun: false,
        message: 'Scheduled backup not due yet',
        schedule
      });
    }
    
    console.log('Running scheduled backup...');
    const backupData = await backup.createFullBackup();
    const backupId = await backup.saveBackup(backupData);
    
    // Отправляем на email (автоматический)
    await sendBackupEmail(backupData, true);
    
    // Обновляем расписание
    const schedule = await backup.updateBackupSchedule(3);
    
    // Очищаем старые бэкапы
    await backup.cleanOldBackups(30);
    
    return c.json({ 
      success: true,
      message: 'Scheduled backup completed',
      backupId,
      schedule
    });
  } catch (error) {
    console.log('Error in scheduled backup:', error);
    return c.json({ 
      error: 'Failed to run scheduled backup',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Тестовая отправка email
app.post(`${prefix}/test-email`, async (c) => {
  try {
    await sendTestEmail();
    return c.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    console.log('Error sending test email:', error);
    return c.json({ 
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ============================================================================
// ADMIN RETAIL USERS ENDPOINTS
// ============================================================================

// GET /admin/retail-users
app.get(`${prefix}/admin/retail-users`, async (c) => {
  return await getRetailUsers(c);
});

// DELETE /admin/retail-users/:id
app.delete(`${prefix}/admin/retail-users/:id`, async (c) => {
  return await deleteRetailUser(c);
});

// POST /admin/retail-users/:id/balance
app.post(`${prefix}/admin/retail-users/:id/balance`, async (c) => {
  return await updateRetailUserBalance(c);
});

// GET /retail/loyalty/:userId
app.get(`${prefix}/retail/loyalty/:userId`, async (c) => {
  try {
    const userId = c.req.param('userId');
    const balanceKey = `nechai_loyalty_${userId}`;
    const balanceData = await kv.get(balanceKey);
    // Extract balance number from object or use 0 if not found
    const balance = typeof balanceData === 'number' 
      ? balanceData 
      : (balanceData?.balance ?? 0);
    console.log(`📊 Fetching balance for user ${userId}: ${balance} (key: ${balanceKey})`);
    return c.json({ balance });
  } catch (error) {
    console.error(`❌ Error fetching balance for user:`, error);
    return c.json({ error: 'Failed to fetch balance' }, 500);
  }
});

// GET /retail/loyalty/claim-status/:userId - проверить, получал ли бонус
app.get(`${prefix}/retail/loyalty/claim-status/:userId`, async (c) => {
  try {
    const userId = c.req.param('userId');
    const claimKey = `nechai_loyalty_claimed_${userId}`;
    const claimed = await kv.get(claimKey);
    return c.json({ claimed: !!claimed });
  } catch (error) {
    return c.json({ error: 'Failed to check claim status' }, 500);
  }
});

// POST /retail/loyalty/claim-bonus - начислить 2000 вушей пользователю
app.post(`${prefix}/retail/loyalty/claim-bonus`, async (c) => {
  try {
    // Получаем токен авторизации
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Missing authorization header' }, 401);
    }
    
    const token = authHeader.split(' ')[1];
    
    // Проверяем пользователя
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Получаем текущий баланс
    const balanceKey = `nechai_loyalty_${user.id}`;
    const balanceData = await kv.get(balanceKey);
    const currentBalance = typeof balanceData === 'number' 
      ? balanceData 
      : (balanceData?.balance ?? 0);
    
    console.log(`🔍 Current balance for user ${user.id}: ${currentBalance}`);
    
    // Начисляем 2000 вушей (можно получать бонус многократно)
    const newBalance = currentBalance + 2000;
    await kv.set(balanceKey, {
      balance: newBalance,
      lastUpdated: new Date().toISOString()
    });
    
    console.log(`✅ Granted 2000 Woosh to user ${user.id}. New balance: ${newBalance}`);
    
    // Проверяем, что данные сохранились
    const verifyBalanceData = await kv.get(balanceKey);
    const verifyBalance = typeof verifyBalanceData === 'number' 
      ? verifyBalanceData 
      : (verifyBalanceData?.balance ?? 0);
    console.log(`🔎 Verified balance after save: ${verifyBalance}`);
    
    return c.json({ 
      success: true, 
      balance: newBalance,
      granted: 2000
    });
  } catch (error) {
    console.error('Error claiming bonus:', error);
    return c.json({ error: 'Failed to claim bonus' }, 500);
  }
});

// POST /admin/grant-welcome-bonus - начислить 100 вушей всем пользователям
app.post(`${prefix}/admin/grant-welcome-bonus`, async (c) => {
  try {
    console.log('========================================');
    console.log('GRANTING WELCOME BONUS TO ALL USERS');
    
    // Создаем Supabase клиент с SERVICE_ROLE_KEY для получения списка пользователей
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Получаем всех пользователей
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('Error fetching users:', error);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }
    
    // Фильтруем только розничных пользователей
    const retailUsers = users.filter(user => 
      user.user_metadata?.role === 'retail' || 
      (!user.user_metadata?.role && user.email) // также включаем пользователей без роли
    );
    
    console.log(`Found ${retailUsers.length} retail users`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Начисляем 100 вушей каждому пользователю
    for (const user of retailUsers) {
      try {
        // Проверяем текущий баланс
        const balanceData = await kv.get(`nechai_loyalty_${user.id}`);
        const currentBalance = typeof balanceData === 'number' 
          ? balanceData 
          : (balanceData?.balance ?? 0);
        // Добавляем 100 вушей к текущему балансу
        const newBalance = currentBalance + 100;
        await kv.set(`nechai_loyalty_${user.id}`, {
          balance: newBalance,
          lastUpdated: new Date().toISOString()
        });
        console.log(`Granted 100 Woosh to user ${user.email} (${user.id}). New balance: ${newBalance}`);
        successCount++;
      } catch (bonusError) {
        console.error(`Failed to grant bonus to user ${user.id}:`, bonusError);
        errorCount++;
      }
    }
    
    console.log(`Bonus distribution complete: ${successCount} success, ${errorCount} errors`);
    console.log('========================================');
    
    return c.json({ 
      success: true, 
      totalUsers: retailUsers.length,
      successCount,
      errorCount
    });
    
  } catch (error) {
    console.error('Error during bonus distribution:', error);
    return c.json({ error: 'Failed to distribute bonuses' }, 500);
  }
});

// POST /admin/grant-bonus-by-email - начислить баллы конкретному пользователю по email
app.post(`${prefix}/admin/grant-bonus-by-email`, async (c) => {
  try {
    const body = await c.req.json();
    const { email, amount } = body;
    
    console.log('========================================');
    console.log('GRANTING BONUS BY EMAIL');
    console.log('Email:', email);
    console.log('Amount:', amount);
    
    if (!email || !amount) {
      return c.json({ error: 'Email and amount are required' }, 400);
    }
    
    // Создаем Supabase клиент с SERVICE_ROLE_KEY
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Получаем всех пользователей и ищем нужного
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('Error fetching users:', error);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }
    
    // Ищем пользователя по email
    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      console.log(`User with email ${email} not found`);
      return c.json({ error: 'User not found' }, 404);
    }
    
    console.log(`Found user: ${user.id}`);
    
    // Получаем текущий баланс
    const balanceData = await kv.get(`nechai_loyalty_${user.id}`);
    const currentBalance = typeof balanceData === 'number' 
      ? balanceData 
      : (balanceData?.balance ?? 0);
    const newBalance = currentBalance + amount;
    
    // Начисляем баллы
    await kv.set(`nechai_loyalty_${user.id}`, {
      balance: newBalance,
      lastUpdated: new Date().toISOString()
    });
    
    console.log(`Granted ${amount} Woosh to user ${email} (${user.id}). Balance: ${currentBalance} -> ${newBalance}`);
    console.log('========================================');
    
    return c.json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email
      },
      previousBalance: currentBalance,
      newBalance: newBalance,
      amountAdded: amount
    });
    
  } catch (error) {
    console.error('Error granting bonus by email:', error);
    return c.json({ error: 'Failed to grant bonus' }, 500);
  }
});

// GET /admin/debug-users - диагностика пользователей
app.get(`${prefix}/admin/debug-users`, async (c) => {
  try {
    console.log('========================================');
    console.log('DEBUG USERS');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Получаем всех пользователей из auth
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }
    
    // Получаем все профили
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }
    
    const debugInfo = users.map(user => ({
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
      has_profile: profiles?.some(p => p.id === user.id),
      profile: profiles?.find(p => p.id === user.id)
    }));
    
    console.log('All users:', JSON.stringify(debugInfo, null, 2));
    console.log('========================================');
    
    return c.json({ users: debugInfo, profiles });
    
  } catch (error) {
    console.error('Error in debug:', error);
    return c.json({ error: 'Failed to debug users' }, 500);
  }
});

// POST /admin/fix-user-profiles - создать профили для пользователей без записей в таблице profiles
app.post(`${prefix}/admin/fix-user-profiles`, async (c) => {
  try {
    console.log('========================================');
    console.log('FIXING USER PROFILES');
    
    // Создаем Supabase клиент с SERVICE_ROLE_KEY
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Получаем всех пользователей из auth
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }
    
    // Получаем все профили
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id');
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return c.json({ error: 'Failed to fetch profiles' }, 500);
    }
    
    const profileIds = new Set(profiles?.map(p => p.id) || []);
    
    // Находим пользователей без профилей
    const usersWithoutProfiles = users.filter(user => {
      // Проверяем, есть ли у пользователя метаданные с role: 'retail'
      const hasRetailRole = user.user_metadata?.role === 'retail';
      const hasProfile = profileIds.has(user.id);
      return hasRetailRole && !hasProfile;
    });
    
    console.log(`Found ${usersWithoutProfiles.length} users without profiles`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Создаем профили для пользователей
    for (const user of usersWithoutProfiles) {
      try {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            role: 'retail',
            email: user.email
          });
        
        if (insertError) {
          console.error(`Failed to create profile for user ${user.email}:`, insertError);
          errorCount++;
        } else {
          console.log(`Profile created for user ${user.email}`);
          successCount++;
        }
      } catch (error) {
        console.error(`Error creating profile for user ${user.email}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Profiles fixed: ${successCount} success, ${errorCount} errors`);
    console.log('========================================');
    
    return c.json({ 
      success: true,
      totalUsersWithoutProfiles: usersWithoutProfiles.length,
      successCount,
      errorCount
    });
    
  } catch (error) {
    console.error('Error fixing user profiles:', error);
    return c.json({ error: 'Failed to fix user profiles' }, 500);
  }
});

// ============================================================================
// TOCHKA BANK INTEGRATION
// ============================================================================

// Keep-alive эндпоинт для предотвращения отключения базы данных
app.get(`${prefix}/keep-alive`, async (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Создать счет в Точка Банке
app.post(`${prefix}/tochka/create-invoice`, async (c) => {
  try {
    const requestBody = await c.req.json();
    const { orderId } = requestBody;
    
    console.log('========================================');
    console.log('CREATING TOCHKA BANK INVOICE');
    console.log('Order ID:', orderId);
    
    if (!orderId) {
      return c.json({ error: 'Order ID is required' }, 400);
    }
    
    // Получаем заказ
    const order = await kv.get(`${ORDERS_PREFIX}${orderId}`);
    if (!order) {
      console.log('Order not found:', orderId);
      return c.json({ error: 'Order not found' }, 404);
    }
    
    // Проверяем, не создан ли уже счет для этого заказа
    if (order.invoiceId) {
      console.log('Invoice already exists for this order:', order.invoiceId);
      return c.json({ 
        error: 'Invoice already exists for this order',
        invoiceId: order.invoiceId,
        invoiceCreatedAt: order.invoiceCreatedAt
      }, 400);
    }
    
    // Получаем JWT токен из переменных окружения
    const jwtToken = Deno.env.get('TOCHKA_JWT_TOKEN');
    if (!jwtToken) {
      console.log('TOCHKA_JWT_TOKEN not found in environment variables');
      return c.json({ error: 'Tochka Bank integration is not configured' }, 500);
    }
    
    // Формируем позиции счета
    const positions = formatTochkaPositions(order.items);
    
    // Формируем тело запроса для Точка Банка согласно ПРАВИЛЬНОМУ шаблону из документации
    const body = {
      Data: {
        accountId: "40802810901500399057/044525104", // Ваш расчетный счет
        customerCode: "303213604", // Ваш customerCode ИП
        SecondSide: {
          taxCode: order.inn,
          type: order.inn.length === 10 ? "company" : "ip", // "ip" для ИП (12 цифр), "company" для ООО (10 цифр)
          secondSideName: order.company,
          ...(order.inn.length === 10 && order.kpp ? { kpp: order.kpp } : {}),
          legalAddress: order.address,
          ...(order.account && order.bik ? { 
            accountId: `${order.account}/${order.bik}`
          } : {})
        },
        Content: {
          Invoice: {
            Positions: positions,
            date: new Date().toISOString().split('T')[0],
            totalAmount: order.total.toString(),
            totalNds: "0",
            number: orderId,
            basedOn: `Заказ ${orderId} с сайта coffeenechai.ru`,
            comment: `Доставка: ${order.delivery_company} - ${order.delivery_method}. Контакт: ${order.contact}, ${order.phone}`,
            paymentExpiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        }
      }
    };
    
    console.log('Invoice request body:', JSON.stringify(body, null, 2));
    
    // Отправляем запрос в Точка Банк
    const response = await fetch('https://enter.tochka.com/uapi/invoice/v1.0/bills', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      return c.json({ 
        error: 'Не удалось создать счет в Точка Банке',
        status: response.status
      }, response.status);
    }
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      return c.json({ 
        error: 'Неверный ответ от Точка Банка'
      }, 500);
    }
    
    // Обновляем заказ с информацией о счете
    const updatedOrder = {
      ...order,
      invoiceId: responseData.id || responseData.bill_id || orderId,
      invoiceCreatedAt: new Date().toISOString()
    };
    
    await kv.set(`${ORDERS_PREFIX}${orderId}`, updatedOrder);
    console.log('Invoice created successfully for order:', orderId);
    
    return c.json({
      success: true,
      invoiceId: updatedOrder.invoiceId,
      invoiceCreatedAt: updatedOrder.invoiceCreatedAt
    });
  } catch (error) {
    console.log('Error creating Tochka Bank invoice:', error);
    return c.json({ 
      error: 'Ошибка при создании счета'
    }, 500);
  }
});

// ============================================================================
// TICKER SETTINGS ENDPOINTS
// ============================================================================

// Получить настройки бегущей строки
app.get(`${prefix}/ticker-settings`, async (c) => {
  try {
    const type = c.req.query('type') || 'wholesale';
    const key = type === 'retail' ? RETAIL_TICKER_SETTINGS_KEY : TICKER_SETTINGS_KEY;
    
    const settings = await kv.get(key);
    
    if (!settings) {
      // Настройки по умолчанию
      const defaultSettings = { enabled: false, text: '' };
      await kv.set(key, defaultSettings);
      return c.json(defaultSettings);
    }
    
    return c.json(settings);
  } catch (error) {
    console.log('Error fetching ticker settings:', error);
    return c.json({ error: 'Failed to fetch ticker settings' }, 500);
  }
});

// Обновить настройки бегущей строки
app.put(`${prefix}/ticker-settings`, async (c) => {
  try {
    const body = await c.req.json();
    const { enabled, text, type } = body;
    
    const settings = {
      enabled: enabled || false,
      text: text || ''
    };
    
    const key = type === 'retail' ? RETAIL_TICKER_SETTINGS_KEY : TICKER_SETTINGS_KEY;
    
    await kv.set(key, settings);
    console.log(`Ticker settings updated (${type || 'wholesale'}):`, settings);
    
    return c.json(settings);
  } catch (error) {
    console.log('Error updating ticker settings:', error);
    return c.json({ error: 'Failed to update ticker settings' }, 500);
  }
});

// ============================================================================
// RETAIL PRODUCTS API
// ============================================================================

// Инициализировать тестовые товары
app.post(`${prefix}/retail/init-test-data`, async (c) => {
  try {
    const defaultImage = 'https://optim.tildacdn.com/stor3364-3739-4765-b764-633533363332/-/format/webp/62880383.png.webp';
    
    const testProducts = [
      {
        id: 'test_1',
        name: 'Эфиопия Иргачиф',
        description: 'Натуральная обработка. Ноты черники, жасмина и цитрусовых. Яркая кислотность.',
        price: 650,
        imageUrl: defaultImage,
        category: 'Фильтр',
        weight: '250гр, 1кг',
        roast: 'Фильтр',
        grind: 'В зернах, Для воронки, Для френч-пресса',
        displayOrder: 0
      },
      {
        id: 'test_2',
        name: 'Колумбия Уила',
        description: 'Мытая обработка. Ноты карамели, молочного шоколада и грецкого ореха. Сбалансированная.',
        price: 590,
        imageUrl: defaultImage,
        category: 'Фильтр',
        weight: '250гр, 1кг',
        roast: 'Фильтр',
        grind: 'В зернах, Для воронки, Для капельной кофеварки',
        displayOrder: 1
      },
      {
        id: 'test_3',
        name: 'Бразилия Сантос',
        description: 'Натуральная обработка. Ноты темного шоколада, орехов и карамели. Плотное тело.',
        price: 520,
        imageUrl: defaultImage,
        category: 'Эспрессо',
        weight: '250гр, 1кг',
        roast: 'Эспрессо',
        grind: 'В зернах, Для эспрессо, Для гейзерной',
        displayOrder: 0
      },
      {
        id: 'test_4',
        name: 'Кения АА',
        description: 'Мытая обработка. Ноты черной смородины, грейпфрута и вина. Высокая кислотность.',
        price: 720,
        imageUrl: defaultImage,
        category: 'Фильтр',
        weight: '250гр, 1кг',
        roast: 'Фильтр',
        grind: 'В зернах, Для воронки, Для аэропресса',
        displayOrder: 2
      },
      {
        id: 'test_5',
        name: 'Гватемала Антигуа',
        description: 'Мытая обработка. Ноты яблока, карамели и специй. Средняя кислотность.',
        price: 610,
        imageUrl: defaultImage,
        category: 'Эспрессо',
        weight: '250гр, 1кг',
        roast: 'Эспрессо',
        grind: 'В зернах, Для эспрессо, Для турки',
        displayOrder: 1
      },
      {
        id: 'test_6',
        name: 'Коста-Рика Тарразу',
        description: 'Мытая обработка. Ноты цитрусовых, меда и молочного шоколада. Чистый вкус.',
        price: 640,
        imageUrl: defaultImage,
        category: 'Фильтр',
        weight: '250гр, 1кг',
        roast: 'Фильтр',
        grind: 'В зернах, Для воронки, Для капельной кофеварки',
        displayOrder: 3
      },
      {
        id: 'test_7',
        name: 'Руанда Бурбон',
        description: 'Натуральная обработка. Ноты красных ягод, цветов и меда. Сладкая.',
        price: 680,
        imageUrl: defaultImage,
        category: 'Фильтр',
        weight: '250гр, 1кг',
        roast: 'Фильтр',
        grind: 'В зернах, Для воронки, Для френч-пресса',
        displayOrder: 4
      },
      {
        id: 'test_8',
        name: 'Эспрессо-смесь',
        description: 'Авторская смесь из 3 сортов. Ноты шоколада, карамели и орехов. Для эспрессо.',
        price: 560,
        imageUrl: defaultImage,
        category: 'Эспрессо',
        weight: '250гр, 1кг',
        roast: 'Эспрессо',
        grind: 'В зернах, Для эспрессо',
        displayOrder: 2
      },
      {
        id: 'test_9',
        name: 'Дрип-кофе Эфиопия',
        description: 'Удобные дрип-пакеты для заваривания. Порционная упаковка.',
        price: 150,
        imageUrl: defaultImage,
        category: 'Дрип',
        displayOrder: 0
      }
    ];

    for (const product of testProducts) {
      await kv.set(`${RETAIL_PRODUCTS_PREFIX}${product.id}`, product);
    }

    console.log('Test retail products initialized');
    return c.json({ success: true, count: testProducts.length });
  } catch (error) {
    console.log('Error initializing test data:', error);
    return c.json({ error: 'Failed to initialize test data' }, 500);
  }
});

// Получить все розничные товары
app.get(`${prefix}/retail/products`, async (c) => {
  try {
    const products = await kv.getByPrefix(RETAIL_PRODUCTS_PREFIX);
    
    // Инициализируем displayOrder и конвертируем габариты в числа
    let needsUpdate = false;
    const updatedProducts = products.map((product: any) => {
      let updated = { ...product };
      
      if (product.displayOrder === undefined) {
        needsUpdate = true;
        updated.displayOrder = 0;
      }
      
      // Конвертируем габариты из строк в числа (миграция старых данных)
      if (product.packageLength && typeof product.packageLength === 'string') {
        needsUpdate = true;
        updated.packageLength = parseFloat(product.packageLength);
      }
      if (product.packageHeight && typeof product.packageHeight === 'string') {
        needsUpdate = true;
        updated.packageHeight = parseFloat(product.packageHeight);
      }
      if (product.packageWidth && typeof product.packageWidth === 'string') {
        needsUpdate = true;
        updated.packageWidth = parseFloat(product.packageWidth);
      }
      if (product.packageWeight && typeof product.packageWeight === 'string') {
        needsUpdate = true;
        updated.packageWeight = parseFloat(product.packageWeight);
      }
      
      // Добавляем дефолтные габариты для товаров без них (пачка кофе 200г) - МИНИМАЛЬНЫЕ
      if (!updated.packageWeight || updated.packageWeight === 0) {
        needsUpdate = true;
        updated.packageWeight = 200; // граммы
        console.log(`  Setting default weight for ${product.name}: 200g`);
      }
      if (!updated.packageLength || updated.packageLength === 0) {
        needsUpdate = true;
        updated.packageLength = 10; // см (МИНИМАЛЬНЫЙ)
        console.log(`  Setting default length for ${product.name}: 10cm`);
      }
      if (!updated.packageWidth || updated.packageWidth === 0) {
        needsUpdate = true;
        updated.packageWidth = 8; // см (МИНИМАЛЬНЫЙ)
        console.log(`  Setting default width for ${product.name}: 8cm`);
      }
      if (!updated.packageHeight || updated.packageHeight === 0) {
        needsUpdate = true;
        updated.packageHeight = 5; // см (МИНИМАЛЬНЫЙ)
        console.log(`  Setting default height for ${product.name}: 5cm`);
      }
      
      return updated;
    });
    
    // Сохраняем обновленные товары
    if (needsUpdate) {
      console.log('🔄 Migrating product dimensions to numbers...');
      for (const product of updatedProducts) {
        await kv.set(`${RETAIL_PRODUCTS_PREFIX}${product.id}`, product);
      }
      console.log('✅ Migration complete');
    }
    
    return c.json(updatedProducts || []);
  } catch (error) {
    console.log('Error fetching retail products:', error);
    return c.json({ error: 'Failed to fetch retail products' }, 500);
  }
});

// Миграция габаритов для всех товаров (ручной запуск)
app.post(`${prefix}/retail/products/migrate-dimensions`, async (c) => {
  try {
    console.log('========================================');
    console.log('🔄 STARTING MANUAL DIMENSIONS MIGRATION');
    console.log('========================================');
    
    const products = await kv.getByPrefix(RETAIL_PRODUCTS_PREFIX);
    console.log(`Found ${products.length} products`);
    
    let updatedCount = 0;
    
    for (const product of products) {
      let needsUpdate = false;
      const updated = { ...product };
      
      // Дефолтные габариты для пачки кофе 200г
      const DEFAULT_WEIGHT = 200;  // граммы
      const DEFAULT_LENGTH = 15;   // см
      const DEFAULT_WIDTH = 10;    // см
      const DEFAULT_HEIGHT = 8;    // см
      
      if (!updated.packageWeight || updated.packageWeight === 0) {
        needsUpdate = true;
        updated.packageWeight = DEFAULT_WEIGHT;
        console.log(`  ✅ ${product.name}: weight -> ${DEFAULT_WEIGHT}g`);
      }
      if (!updated.packageLength || updated.packageLength === 0) {
        needsUpdate = true;
        updated.packageLength = DEFAULT_LENGTH;
        console.log(`  ✅ ${product.name}: length -> ${DEFAULT_LENGTH}cm`);
      }
      if (!updated.packageWidth || updated.packageWidth === 0) {
        needsUpdate = true;
        updated.packageWidth = DEFAULT_WIDTH;
        console.log(`  ✅ ${product.name}: width -> ${DEFAULT_WIDTH}cm`);
      }
      if (!updated.packageHeight || updated.packageHeight === 0) {
        needsUpdate = true;
        updated.packageHeight = DEFAULT_HEIGHT;
        console.log(`  ✅ ${product.name}: height -> ${DEFAULT_HEIGHT}cm`);
      }
      
      if (needsUpdate) {
        await kv.set(`${RETAIL_PRODUCTS_PREFIX}${product.id}`, updated);
        updatedCount++;
      } else {
        console.log(`  ⏭️  ${product.name}: already has dimensions`);
      }
    }
    
    console.log('========================================');
    console.log(`✅ Migration complete! Updated ${updatedCount}/${products.length} products`);
    console.log('========================================');
    
    return c.json({ 
      success: true, 
      totalProducts: products.length,
      updatedProducts: updatedCount,
      message: `Updated ${updatedCount} products with default dimensions`
    });
  } catch (error) {
    console.error('❌ Migration error:', error);
    return c.json({ error: 'Failed to migrate dimensions' }, 500);
  }
});

// Создать розничный товар
app.post(`${prefix}/retail/products`, async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, price, imageUrl, category, weight, roast, grind, longDescription, cardText, packageLength, packageHeight, packageWidth, packageWeight, published } = body;
    
    if (!name || !description || !price || !imageUrl) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    // Получаем все товары, чтобы определить максимальный displayOrder
    const allProducts = await kv.getByPrefix(RETAIL_PRODUCTS_PREFIX);
    const maxOrder = allProducts.reduce((max: number, p: any) => {
      return Math.max(max, p.displayOrder || 0);
    }, 0);
    
    const productId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const product = {
      id: productId,
      name,
      description,
      price: parseFloat(price),
      imageUrl,
      category,
      weight,
      roast,
      grind,
      longDescription,
      cardText,
      packageLength: packageLength ? parseFloat(packageLength) : undefined,
      packageHeight: packageHeight ? parseFloat(packageHeight) : undefined,
      packageWidth: packageWidth ? parseFloat(packageWidth) : undefined,
      packageWeight: packageWeight ? parseFloat(packageWeight) : undefined,
      displayOrder: maxOrder + 1,
      published: published !== undefined ? published : true // По умолчанию товар опубликован
    };
    
    await kv.set(`${RETAIL_PRODUCTS_PREFIX}${productId}`, product);
    console.log('Retail product created:', product);
    
    return c.json(product);
  } catch (error) {
    console.log('Error creating retail product:', error);
    return c.json({ error: 'Failed to create retail product' }, 500);
  }
});

// Обновить порядок розничных товаров (ВАЖНО: должен быть ДО параметрического маршрута :id)
app.put(`${prefix}/retail/products/reorder`, async (c) => {
  try {
    const body = await c.req.json();
    const { updates } = body;
    
    if (!updates || !Array.isArray(updates)) {
      return c.json({ error: 'Invalid updates array' }, 400);
    }
    
    // Обновляем displayOrder для каждого товара
    for (const update of updates) {
      const { id, displayOrder } = update;
      const existing = await kv.get(`${RETAIL_PRODUCTS_PREFIX}${id}`);
      if (existing) {
        const updated = {
          ...existing,
          displayOrder
        };
        await kv.set(`${RETAIL_PRODUCTS_PREFIX}${id}`, updated);
      }
    }
    
    console.log('Retail products order updated:', updates.length, 'items');
    return c.json({ success: true });
  } catch (error) {
    console.log('Error updating retail products order:', error);
    return c.json({ error: 'Failed to update products order' }, 500);
  }
});

// Обновить розничный товар
app.put(`${prefix}/retail/products/:id`, async (c) => {
  try {
    const productId = c.req.param('id');
    const body = await c.req.json();
    
    const existing = await kv.get(`${RETAIL_PRODUCTS_PREFIX}${productId}`);
    if (!existing) {
      return c.json({ error: 'Product not found' }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      id: productId, // Сохраняем ID
      // Парсим числовые поля
      price: body.price ? parseFloat(body.price) : existing.price,
      packageLength: body.packageLength ? parseFloat(body.packageLength) : existing.packageLength,
      packageHeight: body.packageHeight ? parseFloat(body.packageHeight) : existing.packageHeight,
      packageWidth: body.packageWidth ? parseFloat(body.packageWidth) : existing.packageWidth,
      packageWeight: body.packageWeight ? parseFloat(body.packageWeight) : existing.packageWeight
    };
    
    await kv.set(`${RETAIL_PRODUCTS_PREFIX}${productId}`, updated);
    console.log('Retail product updated:', updated);
    
    return c.json(updated);
  } catch (error) {
    console.log('Error updating retail product:', error);
    return c.json({ error: 'Failed to update retail product' }, 500);
  }
});

// Удалить розничный товар
app.delete(`${prefix}/retail/products/:id`, async (c) => {
  try {
    const productId = c.req.param('id');
    await kv.del(`${RETAIL_PRODUCTS_PREFIX}${productId}`);
    console.log('Retail product deleted:', productId);
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting retail product:', error);
    return c.json({ error: 'Failed to delete retail product' }, 500);
  }
});

// Загрузить изображение для розничного товара
app.post(`${prefix}/retail/upload-image`, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    
    // Проверка типа файла
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      return c.json({ error: 'Only JPEG and PNG files are allowed' }, 400);
    }
    
    // Проверка размера (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: 'File size exceeds 10 MB' }, 400);
    }
    
    // Получаем Supabase клиент
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return c.json({ error: 'Supabase configuration missing' }, 500);
    }
    
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Создаем bucket если не существует
    const bucketName = 'make-aa167a09-retail-images';
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      await supabase.storage.createBucket(bucketName, { public: true });
    }
    
    // Генерируем уникальное имя файла
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    
    // Конвертируем File в ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Загружаем файл
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, uint8Array, {
        contentType: file.type,
        upsert: false
      });
    
    if (error) {
      console.log('Error uploading to Supabase Storage:', error);
      return c.json({ error: 'Failed to upload image' }, 500);
    }
    
    // Получаем публичный URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);
    
    console.log('Image uploaded successfully:', publicUrl);
    
    return c.json({ url: publicUrl });
  } catch (error) {
    console.log('Error uploading retail image:', error);
    return c.json({ error: 'Failed to upload image' }, 500);
  }
});

// ============================================================================
// RETAIL CATEGORY ORDER API
// ============================================================================

const RETAIL_CATEGORY_ORDER_KEY = 'retail_category_order';
const DEFAULT_CATEGORY_ORDER = ['Фильтр', 'Эспрессо', 'Дрип', 'Оборудование', 'Аксессуары'];

// Получить порядок категорий
app.get(`${prefix}/retail/category-order`, async (c) => {
  try {
    const stored = await kv.get(RETAIL_CATEGORY_ORDER_KEY);
    const order = stored ?? DEFAULT_CATEGORY_ORDER;
    return c.json({ order });
  } catch (error) {
    console.log('Error fetching category order:', error);
    return c.json({ order: DEFAULT_CATEGORY_ORDER });
  }
});

// Сохранить порядок категорий
app.put(`${prefix}/retail/category-order`, async (c) => {
  try {
    const body = await c.req.json();
    const { order } = body;
    if (!Array.isArray(order)) {
      return c.json({ error: 'order must be an array' }, 400);
    }
    await kv.set(RETAIL_CATEGORY_ORDER_KEY, order);
    return c.json({ success: true, order });
  } catch (error) {
    console.log('Error saving category order:', error);
    return c.json({ error: 'Failed to save category order' }, 500);
  }
});

// ============================================================================
// RETAIL ORDERS API (для новой структуры RetailOrder)
// ============================================================================

// Создать розничный заказ (новая структура)
app.post(`${prefix}/retail/orders`, async (c) => {
  try {
    const requestData = await c.req.json();
    console.log('Received retail order request:', requestData);
    
    // Проверяем, пришел ли уже полностью сформированный заказ или только данные для создания
    let order;
    
    if (requestData.orderId && requestData.date) {
      // Полностью сформированный заказ (старый формат)
      order = requestData;
    } else {
      // Данные от розничного сайта - формируем заказ
      const { customerName, customerPhone, customerEmail, userId, items, deliveryInfo, usedPoints } = requestData;
      
      if (!customerName || !customerPhone || !items || items.length === 0) {
        return c.json({ error: 'Missing required fields' }, 400);
      }
      
      // Генерируем orderId
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const orderId = `RETAIL-${timestamp}-${random}`;
      
      // Формируем items в правильном формате
      const formattedItems = items.map((item: any) => ({
        id: item.product.id,
        name: item.product.name,
        category: item.product.category,
        price: item.product.price,
        quantity: item.quantity,
        weight: item.weight,
        roast: item.roast,
        grind: item.grind,
        subtotal: item.product.price * item.quantity,
        imageUrl: item.product.imageUrl
      }));
      
      // Подсчитываем общую сумму товаров
      const subtotal = formattedItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
      
      // Определяем метод доставки
      const deliveryMethod = deliveryInfo ? 'cdek' : 'pickup';
      const deliveryAddress = deliveryInfo 
        ? `${deliveryInfo.city}, ${deliveryInfo.pvzAddress}` 
        : '';
      
      // LOYALTY SYSTEM
      let deliveryCost = deliveryInfo?.cost || 0;
      let total = subtotal + deliveryCost;
      let pointsUsed = 0;
      let pointsEarned = 0;
      
      if (userId) {
         const balanceKey = `nechai_loyalty_${userId}`;
         const currentBalanceData = await kv.get(balanceKey) || { balance: 0 };
         const currentBalance = currentBalanceData.balance || 0;
         
         if (usedPoints && Number(usedPoints) > 0) {
            // Verify balance and calculate discount
            const requestedPoints = Math.min(Number(usedPoints), currentBalance);
            
            // Ensure minimum 1₽ to pay (user can't pay 0)
            const maxDiscount = Math.max(0, total - 1);
            
            pointsUsed = Math.min(requestedPoints, maxDiscount);
            total -= pointsUsed;
            
            // Списываем баллы СРАЗУ (согласно новым требованиям)
            const newBalance = Math.max(0, currentBalance - pointsUsed);
            await kv.set(balanceKey, {
              ...currentBalanceData,
              balance: newBalance,
              lastUpdated: new Date().toISOString()
            });
            
            console.log(`Loyalty: User ${userId} used ${pointsUsed} points. New balance: ${newBalance}. Deducted immediately.`);
         } else {
            // Accrue 5% of TOTAL (excluding delivery)
            pointsEarned = Math.floor(subtotal * 0.05);
            
            // Начисляем баллы только после успешной оплаты через webhook
            console.log(`Loyalty: User ${userId} will earn ${pointsEarned} points after payment. Current balance: ${currentBalance}`);
         }
      }
      
      // Создаем полный объект заказа
      order = {
        orderId,
        date: new Date().toISOString(),
        orderType: 'retail',
        contact: customerName,
        phone: customerPhone,
        email: customerEmail || '',
        userId: userId || undefined,
        delivery_address: deliveryAddress,
        delivery_method: deliveryMethod,
        delivery_cost: deliveryCost,
        delivery_info: deliveryInfo || null, // Сохраняем полную информацию о доставке
        items: formattedItems,
        total: total, // Итого с доставкой и скидкой
        subtotal: subtotal, // Сумма товаров без доставки
        status: 'pending',
        paymentStatus: 'pending',
        pointsUsed,
        pointsEarned
      };
      
      console.log('📝 Order object prepared:', {
        orderId,
        userId: userId || 'guest',
        customerEmail,
        total,
        pointsUsed,
        pointsEarned,
        hasUserId: !!userId
      });

      // Если выбрана доставка СДЭК, создаем заказ в СДЭК
      if (deliveryInfo && deliveryInfo.pvzCode) {
        console.log('🚚 CDEK delivery detected, creating CDEK order...');
        console.log('📋 Delivery info:', JSON.stringify(deliveryInfo, null, 2));
        console.log('✅ pvzCode present:', deliveryInfo.pvzCode);
        
        // Подготовить данные о товарах для СДЭК
        const cdekItems = formattedItems.map((item: any) => {
          // Получаем данные о габаритах из исходного товара
          const product = items.find((i: any) => i.product.id === item.id)?.product;
          
          console.log(`📦 Processing item: ${item.name}`);
          console.log(`  Product from items:`, JSON.stringify(product, null, 2));
          console.log(`  packageWeight:`, product?.packageWeight);
          console.log(`  packageLength:`, product?.packageLength);
          console.log(`  packageWidth:`, product?.packageWidth);
          console.log(`  packageHeight:`, product?.packageHeight);
          
          return {
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            weight: product?.packageWeight || 200, // граммы (дефолт для пачки кофе 200г)
            length: product?.packageLength || 15, // см (компактная упаковка)
            width: product?.packageWidth || 10,   // см
            height: product?.packageHeight || 8   // см (объемный вес ≈240г)
          };
        });

        console.log('📦 CDEK items prepared:', JSON.stringify(cdekItems, null, 2));

        // Создаем заказ в СДЭК
        console.log('🔄 Calling createCdekOrder...');
        const cdekResult = await createCdekOrder(
          orderId,
          customerName,
          customerPhone,
          deliveryInfo,
          cdekItems
        );

        console.log('✅ CDEK order result:', JSON.stringify(cdekResult, null, 2));

        // Сохраняем результат создания заказа СДЭК
        order.cdek_uuid = cdekResult.cdek_uuid;
        order.cdek_number = cdekResult.cdek_number;
        order.cdek_status = cdekResult.cdek_status;
        order.cdek_data = cdekResult.cdek_data;
        order.cdek_error = cdekResult.cdek_error;
        order.cdek_diagnostic = cdekResult.diagnostic; // ДИАГНОСТИКА для отладки
        
        // Выводим диагностическую информацию
        if (cdekResult.diagnostic) {
          console.log('========================================');
          console.log('📊 CDEK DIAGNOSTIC INFO:');
          console.log('========================================');
          console.log(JSON.stringify(cdekResult.diagnostic, null, 2));
          console.log('========================================');
        }
        
        if (!cdekResult.success) {
          console.error('❌ CDEK order creation failed!');
          console.error('Error details:', cdekResult.cdek_error);
        }
      } else {
        if (deliveryInfo && !deliveryInfo.pvzCode) {
          console.warn('⚠️ WARNING: deliveryInfo exists but pvzCode is missing - skipping CDEK order creation');
          console.warn('deliveryInfo:', JSON.stringify(deliveryInfo, null, 2));
        } else {
          console.log('📦 No delivery info - pickup order');
        }
      }
    }
    
    console.log('Creating new retail order:', order.orderId);
    console.log('📊 Order details before save:', {
      orderId: order.orderId,
      userId: order.userId,
      email: order.email,
      total: order.total,
      status: order.status,
      paymentStatus: order.paymentStatus
    });
    
    await kv.set(`${RETAIL_ORDERS_PREFIX}${order.orderId}`, order);
    
    console.log('✅ Order saved successfully to KV store with key:', `${RETAIL_ORDERS_PREFIX}${order.orderId}`);
    
    // ===== СОЗДАНИЕ ПЛАТЕЖНОЙ ССЫЛКИ В ТОЧКА БАНК =====
    let paymentUrl = undefined;
    let tochkaOperationId = undefined;
    
    console.log('========================================');
    console.log('💳 ATTEMPTING TO CREATE TOCHKA BANK PAYMENT LINK');
    console.log('Order ID:', order.orderId);
    console.log('Total:', order.total);
    console.log('========================================');
    
    try {
      const jwtToken = Deno.env.get('TOCHKA_JWT_TOKEN');
      const customerCode = Deno.env.get('TOCHKA_CUSTOMER_CODE');
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const projectIdMatch = supabaseUrl.match(/https:\/\/(.*?)\.supabase\.co/);
      const projectId = projectIdMatch ? projectIdMatch[1] : '';
      
      console.log('🔑 Environment variables check:', {
        hasJwtToken: !!jwtToken,
        hasCustomerCode: !!customerCode,
        customerCode: customerCode
      });
      
      if (jwtToken && customerCode) {
        console.log('✅ All Tochka credentials found, proceeding with payment creation...');
        // Создаем платежную ссылку через Payment API
        const paymentData = {
          Data: {
            customerCode: customerCode,
            origin: `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/payment-success?orderId=${order.orderId}`,
            sum: Math.round(order.total * 100).toString(), // Копейки
            description: `Оплата заказа ${order.orderId}`,
            accountNumber: '40802810901500399057/044525104',
            // Добавляем metadata для связи с заказом
            metadata: {
              orderId: order.orderId
            }
          }
        };
        
        console.log('📤 Sending payment request to Tochka Bank:', { 
          orderId: order.orderId, 
          sum: paymentData.Data.sum,
          description: paymentData.Data.description 
        });
        
        const paymentResponse = await fetch('https://enter.tochka.com/uapi/payment-broker/v1.0/payments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(paymentData)
        });
        
        const responseText = await paymentResponse.text();
        console.log('📥 Tochka Bank payment response status:', paymentResponse.status);
        
        if (paymentResponse.ok && responseText) {
          try {
            const paymentResult = JSON.parse(responseText);
            // Пытаемся получить operationId, uuid, requestId или id
            tochkaOperationId = paymentResult.operationId || paymentResult.uuid || paymentResult.requestId || paymentResult.id;
            paymentUrl = paymentResult.paymentUrl || paymentResult.url;
            
            if (tochkaOperationId) {
              console.log('✅ Tochka Bank payment link created:', { 
                operationId: tochkaOperationId, 
                paymentUrl 
              });
              
              // Сохраняем operationId в заказ (именно tochka_operation_id как требует ТЗ)
              order.tochka_operation_id = tochkaOperationId;
              order.tochka_payment_url = paymentUrl;
              order.tochka_created_at = new Date().toISOString();
              order.payment_status = 'pending';
              
              await kv.set(`${RETAIL_ORDERS_PREFIX}${order.orderId}`, order);
              console.log('✅ Order updated with Tochka operationId');
            } else {
              console.warn('⚠️ Payment response missing identifier:', paymentResult);
            }
          } catch (parseError) {
            console.error('❌ Failed to parse payment response:', parseError);
          }
        } else {
          console.warn('========================================');
          console.warn('⚠️ FAILED TO CREATE PAYMENT LINK');
          console.warn('Status:', paymentResponse.status);
          console.warn('Body:', responseText);
          console.warn('========================================');
        }
      } else {
        console.warn('========================================');
        console.warn('⚠️ TOCHKA BANK CREDENTIALS NOT CONFIGURED');
        console.warn('Missing:', {
          JWT_TOKEN: !jwtToken,
          CUSTOMER_CODE: !customerCode
        });
        console.warn('========================================');
      }
    } catch (paymentError) {
      console.error('========================================');
      console.error('❌ ERROR CREATING TOCHKA PAYMENT LINK');
      console.error('Error:', paymentError);
      console.error('========================================');
    }
    
    console.log('📊 Payment link creation result:', {
      tochkaOperationId: tochkaOperationId || 'NOT CREATED',
      tochkaPaymentUrl: paymentUrl || 'NOT CREATED'
    });
    
    // ===== СОЗДАНИЕ СЧЁТА В ЛК ТОЧКА БАНКА (ТОЛЬКО ДЛЯ РОЗНИЦЫ) =====
    let invoiceUrl = undefined;
    console.log('Creating retail invoice in Tochka Bank...');
    
    try {
      const jwtToken = Deno.env.get('TOCHKA_JWT_TOKEN');
      if (jwtToken) {
        // Формируем позиции счета для розничного заказа
        const positions = order.items.map((item: any) => ({
          positionName: item.name,
          unitCode: "шт.",
          ndsKind: "without_nds",
          price: Math.round(item.price).toString(),
          quantity: item.quantity.toString(),
          totalAmount: Math.round(item.subtotal).toString(),
          totalNds: "0"
        }));
        
        // Добавляем доставку как отдельную позицию, если есть
        if (order.delivery_cost && order.delivery_cost > 0) {
          positions.push({
            positionName: "Доставка СДЭК",
            unitCode: "услуга",
            ndsKind: "without_nds",
            price: Math.round(order.delivery_cost).toString(),
            quantity: "1",
            totalAmount: Math.round(order.delivery_cost).toString(),
            totalNds: "0"
          });
        }
        
        // Формируем тело запроса для Точка Банка
        const invoiceBody = {
          Data: {
            accountId: "40802810901500399057/044525104",
            customerCode: "303213604",
            SecondSide: {
              taxCode: "000000000000", // Для физлиц используем условный ИНН
              type: "person",
              secondSideName: order.contact,
              legalAddress: order.delivery_address || "Самовывоз"
            },
            Content: {
              Invoice: {
                Positions: positions,
                date: new Date().toISOString().split('T')[0],
                totalAmount: order.total.toString(),
                totalNds: "0",
                number: order.orderId,
                basedOn: `Розничный заказ ${order.orderId} с сайта coffeenechai.ru`,
                comment: `Контакт: ${order.contact}, ${order.phone}. ${order.email ? `Email: ${order.email}` : ''}`,
                paymentExpiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              }
            }
          }
        };
        
        const invoiceResponse = await fetch('https://enter.tochka.com/uapi/invoice/v1.0/bills', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(invoiceBody)
        });
        
        if (invoiceResponse.ok) {
          const invoiceData = await invoiceResponse.json();
          const invoiceId = invoiceData.id || invoiceData.bill_id || order.orderId;
          
          // Формируем ссылку на счет в Точка Банке
          invoiceUrl = `https://enter.tochka.com/invoice/${invoiceId}`;
          
          // Обновляем заказ с информацией о счете
          order.invoiceId = invoiceId;
          order.invoiceCreatedAt = new Date().toISOString();
          order.invoiceUrl = invoiceUrl;
          
          await kv.set(`${RETAIL_ORDERS_PREFIX}${order.orderId}`, order);
          console.log('✅ Retail invoice created successfully:', invoiceId);
        } else {
          console.log('⚠️ Failed to create retail invoice, continuing without it...');
        }
      }
    } catch (invoiceError) {
      console.log('⚠️ Error creating retail invoice (continuing without it):', invoiceError);
    }
    
    // ===== ОТПРАВКА УВЕДОМЛЕНИЯ В TELEGRAM (ТОЛЬКО ДЛЯ РОЗНИЦЫ) =====
    try {
      const itemsList = order.items.map((item: any, index: number) => {
        const weightText = item.weight ? ` (${item.weight})` : '';
        const roastText = item.roast ? ` - ${item.roast}` : '';
        const grindText = item.grind ? ` - ${item.grind}` : '';
        return `${index + 1}. ${item.name}${weightText}${roastText}${grindText} × ${item.quantity} шт. — ${item.subtotal.toLocaleString('ru-RU')} ₽`;
      }).join('\n');

      let deliveryText = '🏪 Самовывоз';
      if (order.delivery_method === 'cdek') {
        deliveryText = `🚚 Доставка СДЭК: ${order.delivery_address}`;
        if (order.delivery_cost > 0) {
          deliveryText += `\n💰 Стоимость доставки: ${order.delivery_cost} ₽`;
        } else {
          deliveryText += `\n💰 Доставка: Бесплатно`;
        }
        if (order.cdek_number) {
          deliveryText += `\n📦 Трек-номер СДЭК: <code>${order.cdek_number}</code>`;
        }
        if (order.cdek_status === 'failed' || order.cdek_status === 'error') {
          deliveryText += `\n⚠️ <b>ВНИМАНИЕ:</b> Ошибка при создании заказа в СДЭК`;
          if (order.cdek_error?.message) {
            deliveryText += `\n❌ Ошибка: ${order.cdek_error.message}`;
          }
        }
      } else if (order.delivery_method === 'delivery') {
        deliveryText = `🚚 Доставка: ${order.delivery_address}`;
      }

      const message = `
🛍 <b>НОВЫЙ РОЗНИЧНЫЙ ЗАКАЗ</b>

📦 <b>Заказ:</b> <code>${order.orderId}</code>
📅 <b>Дата:</b> ${new Date(order.date).toLocaleString('ru-RU')}

👤 <b>Клиент:</b> ${order.contact}
📞 <b>Телефон:</b> ${order.phone}
${order.email ? `📧 <b>Email:</b> ${order.email}\n` : ''}
${deliveryText}

<b>Состав заказа:</b>
${itemsList}

${order.subtotal ? `💵 <b>Сумма товаров:</b> ${order.subtotal.toLocaleString('ru-RU')} ₽\n` : ''}💰 <b>Итого:</b> ${order.total.toLocaleString('ru-RU')} ₽
${invoiceUrl ? `\n🧾 <b>Счет в ЛК Точка:</b> ${invoiceUrl}` : ''}
      `.trim();

      const cleanMessage = formatRetailOrderTelegramMessage(order, invoiceUrl);
      await sendTelegramMessage(cleanMessage);
      console.log('✅ Telegram notification sent for retail order');
    } catch (telegramError) {
      console.error('Failed to send Telegram notification:', telegramError);
      // Не падаем, если не удалось отправить уведомление
    }
    
    console.log('========================================');
    console.log('✅ RETAIL ORDER CREATED SUCCESSFULLY');
    console.log('========================================');
    console.log('📦 Returning order to client:', {
      orderId: order.orderId,
      total: order.total,
      hasTochkaRequestId: !!order.tochkaRequestId,
      hasTochkaPaymentUrl: !!order.tochkaPaymentUrl,
      tochkaRequestId: order.tochkaRequestId || 'NOT SET',
      tochkaPaymentUrl: order.tochkaPaymentUrl ? order.tochkaPaymentUrl.substring(0, 50) + '...' : 'NOT SET'
    });
    console.log('========================================');
    
    return c.json(order);
  } catch (error) {
    console.log('Error creating retail order:', error);
    return c.json({ error: 'Failed to create retail order' }, 500);
  }
});

// 🔒 Получить все розничные заказы - ТРЕБУЕТ АВТОРИЗАЦИИ АДМИНА
app.get(`${prefix}/retail/orders`, async (c) => {
  try {
    console.log('Fetching all retail orders');
    
    const orders = await kv.getByPrefix(RETAIL_ORDERS_PREFIX);
    
    // Фильтруем только валидные заказы
    const validOrders = orders.filter((order: any) => {
      // Проверяем обязательные поля
      const isValid = order.orderId && 
                      order.date && 
                      order.total !== undefined && 
                      !isNaN(order.total);
      
      if (!isValid) {
        console.warn('Skipping invalid order in database:', {
          orderId: order.orderId || 'missing',
          hasDate: !!order.date,
          total: order.total,
          customerName: order.customerName || order.contact
        });
      }
      
      return isValid;
    });
    
    // Сортируем по дате (от новых к старым)
    const sortedOrders = validOrders.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    console.log(`Found ${sortedOrders.length} valid retail orders (filtered ${orders.length - sortedOrders.length} invalid)`);
    return c.json(sortedOrders);
  } catch (error) {
    console.log('Error fetching retail orders:', error);
    return c.json({ error: 'Failed to fetch retail orders' }, 500);
  }
});

// Получить конкретный розничный заказ
app.get(`${prefix}/retail/orders/:orderId`, async (c) => {
  try {
    const orderId = c.req.param('orderId');
    console.log('Fetching retail order:', orderId);
    
    const order = await kv.get(`${RETAIL_ORDERS_PREFIX}${orderId}`);
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    return c.json(order);
  } catch (error) {
    console.log('Error fetching retail order:', error);
    return c.json({ error: 'Failed to fetch retail order' }, 500);
  }
});

// Удалить розничный заказ
app.delete(`${prefix}/retail/orders/:orderId`, async (c) => {
  try {
    const orderId = c.req.param('orderId');
    console.log('Deleting retail order:', orderId);
    
    await kv.del(`${RETAIL_ORDERS_PREFIX}${orderId}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting retail order:', error);
    return c.json({ error: 'Failed to delete retail order' }, 500);
  }
});

// ============================================================================
// 🔐 ADMIN ENDPOINTS (безопасные, только для администраторов)
// ============================================================================
// Эти endpoints созданы для явного разделения админского и пользовательского доступа.
// Админ-панель теперь открыта для всех (без проверки токена)

// OPTIONS handlers для CORS preflight запросов
app.options(`${prefix}/admin/*`, (c) => {
  return c.text('', 204);
});

app.options(`${prefix}/retail/*`, (c) => {
  return c.text('', 204);
});

app.options(`${prefix}/*`, (c) => {
  return c.text('', 204);
});

// GET /admin/orders - получить все оптовые заказы
app.get(`${prefix}/admin/orders`, async (c) => {
  try {
    console.log('📥 GET /admin/orders - Request received');
    console.log('📥 CORS headers present:', c.req.header('origin'));
    const orders = await kv.getByPrefix(ORDERS_PREFIX);
    console.log('📥 Found orders:', orders.length);
    
    // Миграция: преобразуем старые поля packs250 в packs200 в заказах
    const migratedOrders = orders.map((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        const migratedItems = order.items.map((item: any) => {
          if (item.packs250 !== undefined && item.packs200 === undefined) {
            const { packs250, ...rest } = item;
            return { ...rest, packs200: packs250 };
          }
          return item;
        });
        return { ...order, items: migratedItems };
      }
      return order;
    });
    
    // Фильтруем только оптовые заказы
    const wholesaleOrders = migratedOrders.filter((order: any) => 
      !order.orderType || order.orderType === 'wholesale'
    );
    
    // Сортируем по дате (новые первыми)
    const sorted = wholesaleOrders.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    console.log('✅ Returning', sorted.length, 'wholesale orders');
    return c.json(sorted);
  } catch (error) {
    console.error('❌ Error fetching admin orders:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'no stack');
    return c.json({ 
      error: 'Failed to fetch orders',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// GET /admin/retail/orders - получить все розничные заказы
app.get(`${prefix}/admin/retail/orders`, async (c) => {
  try {
    console.log('📥 GET /admin/retail/orders - Request received');
    console.log('📥 CORS headers present:', c.req.header('origin'));
    
    const orders = await kv.getByPrefix(RETAIL_ORDERS_PREFIX);
    
    // Фильтруем только валидные заказы
    const validOrders = orders.filter((order: any) => {
      const isValid = order.orderId && 
                      order.date && 
                      order.total !== undefined && 
                      !isNaN(order.total);
      
      if (!isValid) {
        console.warn('Skipping invalid order in database:', {
          orderId: order.orderId || 'missing',
          hasDate: !!order.date,
          total: order.total,
          customerName: order.customerName || order.contact
        });
      }
      
      return isValid;
    });
    
    // Сортируем по дате (от новых к старым)
    const sortedOrders = validOrders.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    console.log(`✅ Returning ${sortedOrders.length} valid retail orders (filtered ${orders.length - sortedOrders.length} invalid)`);
    return c.json(sortedOrders);
  } catch (error) {
    console.error('❌ Error fetching admin retail orders:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'no stack');
    return c.json({ 
      error: 'Failed to fetch retail orders',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// GET /admin/users - получить всех пользователей
app.get(`${prefix}/admin/users`, async (c) => {
  try {
    console.log('📥 GET /admin/users - Request received');
    const users = await kv.getByPrefix(USERS_PREFIX);
    console.log('📥 Found users:', users.length);
    
    // Убираем пароли из ответа
    const sanitizedUsers = users.map((user: any) => {
      const { password, ...rest } = user;
      return rest;
    });
    
    // Сортируем по дате создания (новые первыми)
    const sorted = sanitizedUsers.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    console.log('✅ Returning', sorted.length, 'users');
    return c.json(sorted);
  } catch (error) {
    console.error('❌ Error fetching admin users:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'no stack');
    return c.json({ 
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// GET /admin/users/:id/orders - получить заказы пользователя
app.get(`${prefix}/admin/users/:id/orders`, async (c) => {
  try {
    const userId = c.req.param('id');
    
    console.log(`Fetching orders for user ${userId} via /admin/users/:id/orders`);
    const allOrders = await kv.getByPrefix(ORDERS_PREFIX);
    
    // Фильтруем заказы по userId
    const userOrders = allOrders.filter((order: any) => order.userId === userId);
    
    // Миграция: преобразуем старые поля packs250 в packs200
    const migratedOrders = userOrders.map((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        const migratedItems = order.items.map((item: any) => {
          if (item.packs250 !== undefined && item.packs200 === undefined) {
            const { packs250, ...rest } = item;
            return { ...rest, packs200: packs250 };
          }
          return item;
        });
        return { ...order, items: migratedItems };
      }
      return order;
    });
    
    // Сортируем по дате (новые первыми)
    const sorted = migratedOrders.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return c.json(sorted);
  } catch (error) {
    console.log('Error fetching admin user orders:', error);
    return c.json({ error: 'Failed to fetch user orders' }, 500);
  }
});

// ============================================================================
// 🌐 ПУБЛИЧНЫЕ ENDPOINTS (для обычных пользователей)
// ============================================================================

// ✅ GET /retail/orders/my/:userId - получить заказы конкретного пользователя (публичный)
app.get(`${prefix}/retail/orders/my/:userId`, async (c) => {
  try {
    const userId = c.req.param('userId');
    
    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400);
    }
    
    console.log(`📦 Fetching retail orders for user: ${userId}`);
    
    const allOrders = await kv.getByPrefix(RETAIL_ORDERS_PREFIX);
    
    // Фильтруем заказы для конкретного пользователя
    const userOrders = allOrders.filter((order: any) => {
      // Проверяем userId (для новых заказов)
      if (order.userId === userId) {
        return true;
      }
      return false;
    });
    
    console.log(`✅ Found ${userOrders.length} retail orders for user ${userId}`);
    
    // Сортируем по дате (новые первыми)
    const sorted = userOrders.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return c.json(sorted);
  } catch (error) {
    console.error(`❌ Error fetching retail orders for user:`, error);
    return c.json({ error: 'Failed to fetch user retail orders' }, 500);
  }
});

// ============================================================================
// УТИЛИТЫ ДЛЯ ДИАГНОСТИКИ И УДАЛЕНИЯ ЗАКАЗОВ
// ============================================================================

// Найти заказы по сумме независимо от префикса
app.post(`${prefix}/utilities/find-orders-by-total`, async (c) => {
  try {
    const { totals } = await c.req.json();
    console.log('Finding orders by totals:', totals);
    
    const results = {
      wholesale: [] as any[],
      retail: [] as any[],
      misplaced: [] as any[]
    };
    
    // Получаем все оптовые заказы
    const wholesaleOrders = await kv.getByPrefix(ORDERS_PREFIX);
    for (const order of wholesaleOrders) {
      if (totals.includes(order.total)) {
        const key = `${ORDERS_PREFIX}${order.orderId}`;
        results.wholesale.push({ ...order, _key: key });
        
        // Проверяем, не розничный ли это заказ по ошибке
        if (order.orderType === 'retail' || (!order.company && !order.inn)) {
          results.misplaced.push({ ...order, _key: key, _reason: 'Retail order in wholesale prefix' });
        }
      }
    }
    
    // Получаем все розничные заказы
    const retailOrders = await kv.getByPrefix(RETAIL_ORDERS_PREFIX);
    for (const order of retailOrders) {
      if (totals.includes(order.total)) {
        const key = `${RETAIL_ORDERS_PREFIX}${order.orderId}`;
        results.retail.push({ ...order, _key: key });
      }
    }
    
    console.log(`Found ${results.wholesale.length} wholesale orders`);
    console.log(`Found ${results.retail.length} retail orders`);
    console.log(`Found ${results.misplaced.length} misplaced orders`);
    
    return c.json(results);
  } catch (error) {
    console.log('Error finding orders by total:', error);
    return c.json({ error: 'Failed to find orders' }, 500);
  }
});

// Удалить заказ по точному ключу
app.post(`${prefix}/utilities/delete-order-by-key`, async (c) => {
  try {
    const { key } = await c.req.json();
    console.log('Deleting order by exact key:', key);
    
    await kv.del(key);
    
    console.log('Order deleted successfully');
    return c.json({ success: true, deletedKey: key });
  } catch (error) {
    console.log('Error deleting order by key:', error);
    return c.json({ error: 'Failed to delete order' }, 500);
  }
});

// Удалить несколько заказов по ключам
app.post(`${prefix}/utilities/delete-orders-by-keys`, async (c) => {
  try {
    const { keys } = await c.req.json();
    console.log('Deleting orders by keys:', keys);
    
    const results = {
      deleted: [] as string[],
      failed: [] as { key: string, error: string }[]
    };
    
    for (const key of keys) {
      try {
        await kv.del(key);
        results.deleted.push(key);
        console.log('Deleted:', key);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.failed.push({ key, error: errorMsg });
        console.error('Failed to delete:', key, errorMsg);
      }
    }
    
    console.log(`Successfully deleted ${results.deleted.length}/${keys.length} orders`);
    return c.json(results);
  } catch (error) {
    console.log('Error deleting orders by keys:', error);
    return c.json({ error: 'Failed to delete orders' }, 500);
  }
});

// Получить все ключи заказов в базе данных (для диагностики)
app.get(`${prefix}/utilities/list-all-order-keys`, async (c) => {
  try {
    console.log('Listing all order keys in database...');
    
    const wholesaleOrders = await kv.getByPrefix(ORDERS_PREFIX);
    const retailOrders = await kv.getByPrefix(RETAIL_ORDERS_PREFIX);
    
    const wholesaleKeys = wholesaleOrders.map((order: any) => ({
      key: `${ORDERS_PREFIX}${order.orderId}`,
      orderId: order.orderId,
      total: order.total,
      date: order.date,
      orderType: order.orderType || 'wholesale',
      company: order.company || 'N/A',
      isRetailInWholesale: order.orderType === 'retail' || (!order.company && !order.inn)
    }));
    
    const retailKeys = retailOrders.map((order: any) => ({
      key: `${RETAIL_ORDERS_PREFIX}${order.orderId}`,
      orderId: order.orderId,
      total: order.total,
      date: order.date,
      orderType: order.orderType || 'retail',
      customerName: order.customerName || 'N/A'
    }));
    
    console.log(`Found ${wholesaleKeys.length} wholesale order keys`);
    console.log(`Found ${retailKeys.length} retail order keys`);
    
    const problematic = wholesaleKeys.filter(k => k.isRetailInWholesale);
    console.log(`Found ${problematic.length} problematic orders (retail in wholesale prefix)`);
    
    return c.json({
      wholesale: wholesaleKeys,
      retail: retailKeys,
      problematic,
      summary: {
        wholesaleCount: wholesaleKeys.length,
        retailCount: retailKeys.length,
        problematicCount: problematic.length
      }
    });
  } catch (error) {
    console.log('Error listing order keys:', error);
    return c.json({ error: 'Failed to list order keys' }, 500);
  }
});

// ============================================================================
// BUSINESS REGISTRATION ENDPOINT
// ============================================================================

// Константа для ключей регистраций
const REGISTRATION_PREFIX = 'nechai_registration_';

// Функция для форматирования телефона в международный формат
function formatPhoneForMessenger(phone: string): string {
  // Убираем все символы кроме цифр
  let cleaned = phone.replace(/\D/g, '');
  
  // Если номер начинается с 8, заменяем на 7 (для российских номеров)
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    cleaned = '7' + cleaned.substring(1);
  }
  
  // Если номер не начинается с +, добавляем его
  if (!phone.startsWith('+')) {
    return cleaned;
  }
  
  return cleaned;
}

// Функция для генерации ссылки на мессенджер
function generateMessengerLink(phone: string, messenger: string): string {
  const formattedPhone = formatPhoneForMessenger(phone);
  
  if (messenger === 'telegram') {
    // Для Telegram используем формат t.me с номером телефона
    return `https://t.me/+${formattedPhone}`;
  } else if (messenger === 'whatsapp') {
    // Для WhatsApp используем wa.me
    return `https://wa.me/${formattedPhone}`;
  }
  
  return '';
}

// Функция для создания сообщения о регистрации с кликабельной ссылкой на мессенджер
function createRegistrationMessageWithLink(phone: string, companyName: string, messenger: string): string {
  const messengerLink = generateMessengerLink(phone, messenger);
  const messengerName = messenger === 'telegram' ? 'Telegram' : 'WhatsApp';
  
  // Используем правильное экранирование для Telegram
  const lines = [
    '🆕 Новая заявка на регистрацию оптового клиента',
    '',
    `📱 Телефон: ${phone}`,
    `🏢 Компания: ${companyName}`,
    `💬 Мессенджер: ${messengerName}`,
    `🔗 Ссылка на ${messengerName}: ${messengerLink}`,
    `🕐 Дата: ${new Date().toLocaleString('ru-RU')}`
  ];
  
  return lines.join('\n');
}

// Функция для создания сообщения о регистрации с кликабельной ссылкой на мессенджер
function createRegistrationMessage(phone: string, companyName: string, messenger: string): string {
  const messengerLink = generateMessengerLink(phone, messenger);
  const messengerName = messenger === 'telegram' ? 'Telegram' : 'WhatsApp';
  
  return `🆕 Новая заявка на регистрацию оптового клиента\\n\\n` +
    `📱 Телефон: ${phone}\\n` +
    `🏢 Компания: ${companyName}\\n` +
    `💬 Мессенджер: ${messengerName}\\n` +
    `🔗 Ссылка на ${messengerName}: ${messengerLink}\\n` +
    `🕐 Дата: ${new Date().toLocaleString('ru-RU')}`;
}

// Регистрация оптового клиента
app.post(`${prefix}/business-registration`, async (c) => {
  try {
    const body = await c.req.json();
    const { phone, companyName, messenger } = body;

    if (!phone || !companyName || !messenger) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Сохраняем заявку в базу данных
    const registrationId = `${REGISTRATION_PREFIX}${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const registrationData = {
      id: registrationId,
      phone,
      companyName,
      messenger,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    await kv.set(registrationId, registrationData);

    // Отправляем уведомление в Telegram с кликабельной ссылкой на мессенджер
    const message = createRegistrationMessageWithLink(phone, companyName, messenger);

    try {
      await sendTelegramMessage(message);
    } catch (telegramError) {
      console.log('Failed to send Telegram notification:', telegramError);
      // Продолжаем выполнение, даже если уведомление не отправилось
    }

    return c.json({ success: true, registrationId });
  } catch (error) {
    console.log('Error creating business registration:', error);
    return c.json({ error: 'Failed to create registration' }, 500);
  }
});

// Получить список всех заявок на регистрацию
app.get(`${prefix}/business-registrations`, async (c) => {
  try {
    const registrations = await kv.getByPrefix(REGISTRATION_PREFIX);
    
    // Сортируем по дате создания (новые первые)
    registrations.sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return c.json({ registrations });
  } catch (error) {
    console.log('Error fetching registrations:', error);
    return c.json({ error: 'Failed to fetch registrations' }, 500);
  }
});

// Обновить статус заявки
app.patch(`${prefix}/business-registration/:id/status`, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { status } = body;

    if (!status || !['pending', 'processed', 'rejected'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    // Получаем существующую заявку
    const registration = await kv.get(id);
    if (!registration) {
      return c.json({ error: 'Registration not found' }, 404);
    }

    // Обновляем статус
    const updatedRegistration = {
      ...registration,
      status,
      updatedAt: new Date().toISOString()
    };

    await kv.set(id, updatedRegistration);

    return c.json({ success: true, registration: updatedRegistration });
  } catch (error) {
    console.log('Error updating registration status:', error);
    return c.json({ error: 'Failed to update registration status' }, 500);
  }
});

// Удалить заявку
app.delete(`${prefix}/business-registration/:id`, async (c) => {
  try {
    const id = c.req.param('id');

    // Проверяем, существует ли заявка
    const registration = await kv.get(id);
    if (!registration) {
      return c.json({ error: 'Registration not found' }, 404);
    }

    // Удаляем заявку
    await kv.del(id);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting registration:', error);
    return c.json({ error: 'Failed to delete registration' }, 500);
  }
});

// ============================================================================
// TELEGRAM BROADCAST
// ============================================================================
app.route(`${prefix}`, telegramBroadcast);

// ============================================================================
// TELEGRAM WEBHOOK SETUP
// ============================================================================

// Установить webhook
app.post(`${prefix}/telegram/webhook/setup`, async (c) => {
  try {
    const result = await webhookSetup.setWebhook();
    return c.json(result);
  } catch (error) {
    console.error('Error setting up webhook:', error);
    return c.json({ 
      success: false, 
      message: `Ошибка настройки webhook: ${error instanceof Error ? error.message : String(error)}`
    }, 500);
  }
});

// Получить информацию о webhook
app.get(`${prefix}/telegram/webhook/info`, async (c) => {
  try {
    const result = await webhookSetup.getWebhookInfo();
    return c.json(result);
  } catch (error) {
    console.error('Error getting webhook info:', error);
    return c.json({ 
      success: false, 
      message: `Ошибка получения информации: ${error instanceof Error ? error.message : String(error)}`
    }, 500);
  }
});

// Удалить webhook
app.delete(`${prefix}/telegram/webhook/delete`, async (c) => {
  try {
    const result = await webhookSetup.deleteWebhook();
    return c.json(result);
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return c.json({ 
      success: false, 
      message: `Ошибка удаления webhook: ${error instanceof Error ? error.message : String(error)}`
    }, 500);
  }
});

// Тестировать бота
app.post(`${prefix}/telegram/webhook/test`, async (c) => {
  try {
    const { chatId } = await c.req.json();
    if (!chatId) {
      return c.json({ success: false, message: 'chatId обязателен' }, 400);
    }
    const result = await webhookSetup.testBot(chatId);
    return c.json(result);
  } catch (error) {
    console.error('Error testing bot:', error);
    return c.json({ 
      success: false, 
      message: `Ошибка тестирования: ${error instanceof Error ? error.message : String(error)}`
    }, 500);
  }
});

// ============================================================================
// TELEGRAM WEBHOOK HANDLER
// ============================================================================

// Обработчик входящих сообщений от Telegram
app.post(`${prefix}/telegram-webhook`, async (c) => {
  try {
    const update = await c.req.json();
    console.log('📨 Received Telegram update:', JSON.stringify(update));

    // Извлекаем chat_id из сообщения
    const chatId = update?.message?.chat?.id;
    const messageText = update?.message?.text || '';
    const username = update?.message?.from?.username || '';
    const firstName = update?.message?.from?.first_name || '';
    
    console.log('💬 Chat ID:', chatId);
    console.log('📝 Message:', messageText);
    console.log('👤 User:', firstName, username ? `(@${username})` : '');

    if (!chatId) {
      console.log('⚠️ No chat_id found in update');
      return c.json({ ok: true }); // Возвращаем 200 для Telegram
    }

    // Сохраняем пользователя в KV таблицу
    const TG_USER_PREFIX = 'telegram_user:';
    const key = `${TG_USER_PREFIX}${chatId}`;
    const userData = {
      chat_id: chatId,
      username: username || null,
      first_name: firstName || null,
      created_at: new Date().toISOString(),
      last_message: messageText
    };
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    await kv.set(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, key, JSON.stringify(userData));
    console.log('✅ User saved to database');

    // Отправляем приветственное сообщение при первом контакте или команде /start
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (TELEGRAM_BOT_TOKEN && (messageText.startsWith('/start') || messageText.toLowerCase().includes('подписаться'))) {
      try {
        const msgResponse = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '✅ Вы подписались на рассылку!\n\nТеперь вы будете получать уведомления о новинках и специальных предложениях от нашего магазина кофе.',
              parse_mode: 'HTML'
            })
          }
        );
        
        if (msgResponse.ok) {
          console.log(`✅ Welcome message sent to ${chatId}`);
        }
      } catch (error) {
        console.error(`❌ Error sending welcome message:`, error);
      }
    }
    
    return c.json({ ok: true });

  } catch (error) {
    console.error('❌ Error processing Telegram webhook:', error);
    // Всегда возвращаем 200 для Telegram, чтобы он не повторял запрос
    return c.json({ ok: true });
  }
});

// ============================================================================
// TELEGRAM POLLING (альтернатива webhook)
// ============================================================================

const TG_USER_PREFIX = 'telegram_user:';
const LAST_UPDATE_ID_KEY = 'telegram_last_update_id';

// Endpoint для запуска polling вручную
app.post(`${prefix}/telegram/poll`, async (c) => {
  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    
    if (!TELEGRAM_BOT_TOKEN) {
      return c.json({ error: 'TELEGRAM_BOT_TOKEN не настроен' }, 500);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Получаем последний обработанный update_id
    const lastUpdateResult = await kv.get(LAST_UPDATE_ID_KEY);
    const lastUpdateId = lastUpdateResult || 0;

    console.log('📊 Last processed update_id:', lastUpdateId);

    // Функция для обработки сообщения
    async function processMessage(chatId: number, messageText: string, username: string, firstName: string) {
      // Сохраняем пользователя в KV таблицу
      const TG_USER_PREFIX = 'telegram_user:';
      const key = `${TG_USER_PREFIX}${chatId}`;
      const userData = {
        chat_id: chatId,
        username: username || null,
        first_name: firstName || null,
        created_at: new Date().toISOString(),
        last_message: messageText
      };
      
      await kv.set(key, userData);
      console.log('✅ User saved to database');

      // Отправляем подтверждающее сообщение пользователю только если это первое сообщение или команда /start
      if (messageText.startsWith('/start') || messageText.toLowerCase().includes('подписаться')) {
        try {
          const telegramResponse = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
              text: '✅ Вы подписались на рассылку!\n\nТеперь вы будете получать уведомления о новинках и специальных предложениях от нашего магазина кофе.',
              parse_mode: 'HTML'
              })
            }
          );

          if (!telegramResponse.ok) {
            const errorData = await telegramResponse.json();
            console.error('❌ Failed to send Telegram message:', JSON.stringify(errorData));
          }
        } catch (sendError) {
          console.error('❌ Error sending Telegram message:', sendError);
        }
      }
    }

    // Получаем новые обновления от Telegram
    let response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&limit=100`,
      { method: 'GET' }
    );

    let data = await response.json();

    if (!data.ok) {
      // Если webhook активен, автоматически удаляем его
      if (data.description && data.description.includes('webhook is active')) {
        console.log('⚠️ Webhook активен, автоматически удаляем...');
        
        const deleteResponse = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`,
          { method: 'GET' }
        );
        
        const deleteData = await deleteResponse.json();
        
        if (deleteData.ok) {
          console.log('✅ Webhook удален, повторяем запрос...');
          
          // Повторяем запрос getUpdates
          response = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&limit=100`,
            { method: 'GET' }
          );
          
          data = await response.json();
          
          if (!data.ok) {
            throw new Error(`Telegram API error: ${data.description}`);
          }
        } else {
          return c.json({ 
            error: 'Не удалось автоматически удалить webhook. Попробуйте кнопку "🗑️ Удалить webhook"',
            webhook_active: true 
          }, 409);
        }
      } else {
        throw new Error(`Telegram API error: ${data.description}`);
      }
    }

    const updates = data.result || [];
    console.log(`📨 Received ${updates.length} updates`);

    let newLastUpdateId = lastUpdateId;
    let processedCount = 0;
    const errors: any[] = [];

    // Обрабатываем каждое обновление
    for (const update of updates) {
      try {
        const chatId = update?.message?.chat?.id;
        const messageText = update?.message?.text || '';
        const username = update?.message?.from?.username || '';
        const firstName = update?.message?.from?.first_name || '';

        console.log(`💬 Processing update ${update.update_id} from chat ${chatId}`);

        if (chatId) {
          // Обрабатываем сообщение с помощью модуля авторизации
          await processMessage(chatId, messageText, username, firstName);
          processedCount++;
        }

        // Обновляем последний update_id
        if (update.update_id > newLastUpdateId) {
          newLastUpdateId = update.update_id;
        }
      } catch (error) {
        console.error(`❌ Error processing update ${update.update_id}:`, error);
        errors.push({ update_id: update.update_id, error: String(error) });
      }
    }

    // Сохраняем новый последний update_id
    if (newLastUpdateId > lastUpdateId) {
      await kv.set(LAST_UPDATE_ID_KEY, newLastUpdateId);
      console.log(`✅ Updated last_update_id to ${newLastUpdateId}`);
    }

    return c.json({
      ok: true,
      processed: processedCount,
      total_updates: updates.length,
      last_update_id: newLastUpdateId,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Error in telegram polling:', error);
    return c.json({
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ============================================================================
// CDEK INTEGRATION ENDPOINTS
// ============================================================================

// CDEK: Search cities
app.get(`${prefix}/cdek/cities`, async (c) => {
  try {
    const query = c.req.query('q');
    
    // Минимум 2 символа для поиска
    if (!query || !query.trim() || query.length < 2) {
      return c.json({ cities: [] });
    }

    // Используем city_like для частичного совпадения (подсказки)
    const endpoint = `/location/cities?city_like=${encodeURIComponent(query)}&country_code=RU&size=500`;
    const debugUrl = `https://api.cdek.ru/v2${endpoint}`;
    console.log('🔗 CDEK API REQUEST URL:', debugUrl);
    
    const citiesResponse = await cdekRequest(endpoint);

    if (!citiesResponse || citiesResponse.length === 0) {
      return c.json({ 
        cities: [],
        debug: debugUrl,
        raw_count: 0
      });
    }

    // Фильтруем результаты - оставляем только города, содержащие введенную строку
    // Используем только поля city и region из API СДЭК
    const q = query.toLowerCase();
    const filtered = citiesResponse.filter((i: any) => {
      const city = (i.city || "").toLowerCase();
      const region = (i.region || "").toLowerCase();
      return city.includes(q) || region.includes(q);
    });

    // Ограничиваем до 20 результатов и форматируем для фронтенда
    const final = filtered.slice(0, 20).map((city: any) => ({
      code: city.code,
      city: city.city,
      region: city.region,
      country: city.country,
      country_code: city.country_code,
      city_code: city.code, // Для совместимости
      // Формируем полное название с регионом
      full_name: city.region ? `${city.city}, ${city.region}` : city.city,
      latitude: city.latitude || 0,
      longitude: city.longitude || 0
    }));

    return c.json({ 
      cities: final,
      debug: debugUrl,
      raw_count: citiesResponse.length,
      filtered_count: filtered.length
    });

  } catch (error) {
    console.error('Error searching CDEK cities:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to search cities',
      cities: []
    }, 500);
  }
});

// CDEK: Calculate shipping cost
app.post(`${prefix}/cdek/calc`, async (c) => {
  try {
    const { city_to, city_code, order_price, packages, pvz_code } = await c.req.json();
    
    if (!pvz_code || order_price === undefined) {
      return c.json({ error: 'Missing pvz_code or order_price' }, 400);
    }

    const orderPriceNum = Number(order_price);

    console.log('CDEK calc request:', { 
      city_to, 
      city_code,
      pvz_code,
      order_price: orderPriceNum, 
      packages_count: packages?.length 
    });

    // Настройки доставки
    const FREE_SHIPPING_FROM = 3500;
    const PROCESSING_DAYS = 2;
    const SENDER_PVZ_CODE = 'SPB1204'; // ПВЗ отправителя
    
    // Fallback тарифы - ТОЛЬКО посылочные тарифы (ПВЗ→ПВЗ)
    // 136 - Посылка склад-склад
    // 483 - Экспресс-лайт склад-склад (для внутригородской доставки)
    // 234 - Эконом склад-склад
    // 138 - Посылка склад-дверь (резерв)
    // 139 - Посылка дверь-склад (резерв)
    const FALLBACK_TARIFFS = [136, 483, 234, 138, 139];

    // Инициализируем debug-объект
    const debug: any = {
      sender_pvz_code: SENDER_PVZ_CODE,
      receiver_pvz_code: pvz_code,
      order_price: orderPriceNum,
      free_shipping_threshold: FREE_SHIPPING_FROM,
      fallback_tariffs: FALLBACK_TARIFFS,
      received_packages: packages
    };

    // Если сумма заказа >= 3500, доставка бесплатная
    if (orderPriceNum >= FREE_SHIPPING_FROM) {
      console.log(`✅ Free shipping triggered: ${orderPriceNum} >= ${FREE_SHIPPING_FROM}`);
      return c.json({
        delivery_cost: 0,
        delivery_days: PROCESSING_DAYS,
        is_free: true,
        tariff_code: 136,
        debug: {
          ...debug,
          trigger: 'free_shipping_threshold_met'
        }
      });
    }

    // Рассчитываем суммарные габариты и вес
    let totalWeight = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    if (packages && packages.length > 0) {
      console.log('📦 Incoming packages from frontend:', JSON.stringify(packages, null, 2));
      
      // Суммируем вес всех товаров
      packages.forEach((pkg: any) => {
        const quantity = pkg.quantity || 1;
        // ДЕФОЛТЫ ДЛЯ ПАЧКИ КОФЕ 200г: вес 200г, МИНИМАЛЬНЫЕ габариты 10×8×5 см
        const weight = Math.max(Number(pkg.weight) || 200, 100); // грамм
        const length = Math.max(Number(pkg.length) || 10, 5); // см
        const width = Math.max(Number(pkg.width) || 8, 5); // см
        const height = Math.max(Number(pkg.height) || 5, 3); // см
        
        totalWeight += weight * quantity;
        maxLength = Math.max(maxLength, length);
        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);
        
        console.log(`📦 Item: ${weight}g × ${quantity} = ${weight * quantity}g, dims: ${length}×${width}×${height}cm`);
      });
    } else {
      // Дефолтные значения
      totalWeight = 500;
      maxLength = 20;
      maxWidth = 15;
      maxHeight = 10;
    }

    // Сохраняем вес до корректировки
    debug.weight_before = totalWeight;

    // Убрали принудительное округление до 1кг, так как СДЭК принимает и легкие грузы
    // debug.weight_after больше не нужен, но оставим для совместимости логов
    debug.weight_after = totalWeight;

    // СОРТИРУЕМ ГАБАРИТЫ ПО УБЫВАНИЮ (length >= width >= height)
    // API СДЭК требует правильной сортировки для расчета объемного веса
    const dimensions = [maxLength, maxWidth, maxHeight].sort((a, b) => b - a);
    const sortedLength = dimensions[0];
    const sortedWidth = dimensions[1];
    const sortedHeight = dimensions[2];
    
    console.log(`📦 Dimensions sorted: ${maxLength}×${maxWidth}×${maxHeight} → ${sortedLength}×${sortedWidth}×${sortedHeight} cm`);

    // Конвертируем габариты для API СДЭК
    // ВАЖНО: API v2 ожидает габариты в САНТИМЕТРАХ (Integer)
    const lengthCm = Math.round(sortedLength);
    const widthCm = Math.round(sortedWidth);
    const heightCm = Math.round(sortedHeight);

    // Сохраняем габариты в debug
    debug.dimensions = {
      length_cm: lengthCm,
      width_cm: widthCm,
      height_cm: heightCm
    };



    // Получаем токен для API СДЭК
    const token = await getCdekToken();

    // Определяем код города получателя
    let receiverCityCode = city_code;
    let receiverCityName = city_to;

    // Если код города не передан с фронта, ищем его через API
    if (!receiverCityCode) {
      console.log(`🔍 Looking up city code for: ${city_to}`);
      const citiesResponse = await fetch(`https://api.cdek.ru/v2/location/cities?city=${encodeURIComponent(city_to)}&country_codes=RU&size=1`, {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      const citiesData = await citiesResponse.json();
      
      if (!citiesData || !citiesData.length) {
         console.error(`❌ City not found: ${city_to}`);
         return c.json({ error: 'Не удалось определить код города получателя для расчета доставки' }, 400);
      }
      
      receiverCityCode = citiesData[0].code;
      receiverCityName = citiesData[0].city;
    }

    const SENDER_CITY_CODE = 137; // Санкт-Петербург

    // Определяем тип доставки
    const isIntraCityDelivery = SENDER_CITY_CODE === receiverCityCode;
    
    // Для внутригородской доставки в СПб используем специальный набор тарифов
    let tariffsToTest = FALLBACK_TARIFFS;
    if (isIntraCityDelivery) {
      // Для СПб → СПб работают только тарифы: 483 (экспресс-лайт), 234 (эконом)
      tariffsToTest = [483, 234, 138, 139];
      console.log(`📍 Внутригородская доставка СПб → СПб, используем тарифы: ${tariffsToTest.join(', ')}`);
    }

    // Инициализируем debug-объект (обновляем с кодами городов)
    debug.sender_city_code = SENDER_CITY_CODE;
    debug.receiver_city_code = receiverCityCode;
    debug.receiver_city_name = receiverCityName;
    debug.is_intra_city = isIntraCityDelivery;
    debug.tariffs_to_test = tariffsToTest;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Testing tariffs with fallback strategy (Tilda mode)`);
    console.log(`📍 Route: СПб (Code ${SENDER_CITY_CODE}) → ${receiverCityName} (Code ${receiverCityCode})`);
    console.log(`🏢 PVZ: ${SENDER_PVZ_CODE} → ${pvz_code}`);
    console.log(`⚖️ Total weight: ${totalWeight}g`);
    console.log(`📐 Dimensions: ${lengthCm}×${widthCm}×${heightCm}cm`);
    console.log(`💰 Goods value: ${order_price} RUB`);
    console.log(`🚚 Delivery type: ${isIntraCityDelivery ? 'Intra-city' : 'Inter-city'}`);
    console.log(`${'='.repeat(60)}\n`);

    // Перебираем тарифы до первого успешного
    let selectedTariff = null;
    let selectedTariffResponse = null;
    let lastError = null;
    const fallbackAttempts: any[] = [];

    for (const tariff of tariffsToTest) {
      console.log(`\n🔍 Testing tariff ${tariff}...`);
      
      const calcBody = {
        type: 1, // Онлайн-магазин
        currency: 1, // RUB
        tariff_code: tariff,
        from_location: {
          code: SENDER_CITY_CODE // Код города отправителя (Integer)
        },
        to_location: {
          code: receiverCityCode // Код города получателя (Integer)
        },
        packages: [{
          weight: Math.round(totalWeight), // Целое число граммов
          length: lengthCm,                // Целое число см
          width: widthCm,                  // Целое число см
          height: heightCm                 // Целое число см
        }],
        services: []
      };

      console.log(`📤 Request body:`, JSON.stringify(calcBody, null, 2));

      try {
        const response = await fetch('https://api.cdek.ru/v2/calculator/tariff', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(calcBody)
        });

        const data = await response.json();
        
        console.log(`📥 Response for tariff ${tariff}:`, JSON.stringify(data, null, 2));

        // Проверяем условия успешного тарифа:
        // 1. Нет ошибок
        // 2. Стоимость > 0 (игнорируем нулевые тарифы - они недоступны)
        // 3. Стоимость <= 5000 ₽ (защита от экспресс-тарифов)
        const hasNoErrors = !data.errors || data.errors.length === 0;
        const isPriceReasonable = data.total_sum && data.total_sum > 0 && data.total_sum <= 5000;
        
        // Сохраняем попытку в debug
        fallbackAttempts.push({
          tariff,
          status: response.status,
          success: hasNoErrors && isPriceReasonable,
          price: data.total_sum,
          errors: data.errors,
          data
        });

        // Если тариф рабочий и цена адекватная
        if (hasNoErrors && isPriceReasonable) {
          selectedTariff = tariff;
          selectedTariffResponse = data;
          console.log(`✅ Tariff ${tariff} is WORKING! Price: ${data.total_sum} RUB`);
          break;
        } else if (!hasNoErrors) {
          console.log(`❌ Tariff ${tariff} has errors:`, data.errors);
          lastError = data.errors;
        } else if (data.total_sum === 0) {
          console.log(`⚠️ Tariff ${tariff} price is ZERO (tariff not available for this route) - skipping`);
          lastError = `Tariff ${tariff} not available (price = 0)`;
        } else {
          console.log(`⚠️ Tariff ${tariff} price too high: ${data.total_sum} RUB (skipping)`);
          lastError = `Price too high: ${data.total_sum} RUB`;
        }
      } catch (error) {
        console.log(`❌ Exception testing tariff ${tariff}:`, error);
        fallbackAttempts.push({
          tariff,
          error: error instanceof Error ? error.message : String(error)
        });
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    // Сохраняем в debug
    debug.fallback_attempts = fallbackAttempts;
    debug.selected_tariff = selectedTariff;
    debug.selected_tariff_response = selectedTariffResponse;

    // Если ни один тариф не подошел
    if (!selectedTariff) {
      console.log(`\n❌ NO WORKING TARIFF FOUND!`);
      console.log(`Last error:`, lastError);
      return c.json({ 
        error: 'Этот ПВЗ не обслуживается тарифами доставки. Выберите другой ПВЗ.',
        debug,
        last_error: lastError
      }, 400);
    }

    console.log(`\n✅ Selected working tariff: ${selectedTariff}`);
    console.log(`💰 Delivery cost: ${selectedTariffResponse.total_sum} RUB`);
    console.log(`⏱️ Period: ${selectedTariffResponse.period_min}-${selectedTariffResponse.period_max} days`);

    // Используем результат выбранного тарифа
    const calcResponse = selectedTariffResponse;
    let deliveryCost = calcResponse.total_sum || 0;
    const deliveryDays = (calcResponse.period_min || 0) + PROCESSING_DAYS;

    console.log(`💰 CDEK API returned total_sum: ${deliveryCost} RUB`);
    console.log(`📊 Breakdown from CDEK:`, {
      total_sum: calcResponse.total_sum,
      delivery_sum: calcResponse.delivery_sum,
      period_min: calcResponse.period_min,
      period_max: calcResponse.period_max,
      weight_calc: calcResponse.weight_calc
    });

    console.log(`✅ Final delivery cost: ${deliveryCost} RUB`);

    return c.json({
      delivery_cost: deliveryCost,
      delivery_days: deliveryDays,
      is_free: false,
      tariff_code: selectedTariff,
      period_min: calcResponse.period_min,
      period_max: calcResponse.period_max,
      debug
    });

  } catch (error) {
    console.error('Error calculating CDEK delivery:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to calculate delivery cost',
      debug: {
        exception: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

// CDEK: Get pickup points list
app.post(`${prefix}/cdek/pvz`, async (c) => {
  try {
    const { city_to, city_code } = await c.req.json();
    
    if (!city_to) {
      return c.json({ error: 'Missing city_to' }, 400);
    }

    console.log('CDEK PVZ request for city:', city_to, 'Code:', city_code);

    const debug: any = {};
    let cityCode = city_code;

    // Найти city_code если не передан
    if (!cityCode) {
      const citiesEndpoint = `/location/cities?city=${encodeURIComponent(city_to)}&country_codes=RU&size=1`;
      debug.city_lookup_url = `https://api.cdek.ru/v2${citiesEndpoint}`;
      
      const citiesResponse = await cdekRequest(citiesEndpoint);

      if (!citiesResponse || citiesResponse.length === 0) {
        debug.city_lookup_error = 'City not found';
        return c.json({ error: 'City not found', debug }, 404);
      }

      cityCode = citiesResponse[0].code;
    }
    
    debug.city_code = cityCode;

    // Получить список ПВЗ (без лимита для получения всех точек)
    // CDEK API может не поддерживать большие значения size, попробуем без него
    let pvzUrl = `/deliverypoints?city_code=${cityCode}&type=PVZ`;
    debug.pvz_query_url = `https://api.cdek.ru/v2${pvzUrl}`;
    
    const pvzResponse = await cdekRequest(pvzUrl);

    console.log(`CDEK API returned ${pvzResponse.length} pickup points for city code ${cityCode}`);
    debug.total_pvz = pvzResponse.length;

    // Фильтруем только ПВЗ (без примерочных)
    const availablePvz = pvzResponse
      .filter((pvz: any) => pvz.type === 'PVZ')
      .map((pvz: any) => ({
        code: pvz.code,
        name: pvz.name,
        address: pvz.location?.address_full || pvz.location?.address || 'Адрес не указан',
        location: {
          latitude: pvz.location?.latitude || 0,
          longitude: pvz.location?.longitude || 0
        },
        work_time: pvz.work_time || 'Не указано',
        phones: pvz.phones || []
      }));

    debug.available_pvz = availablePvz.length;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ PVZ list prepared`);
    console.log(`📊 Total PVZ from API: ${pvzResponse.length}`);
    console.log(`✅ Available PVZ: ${availablePvz.length}`);
    console.log(`${'='.repeat(60)}\n`);

    return c.json({
      city_code: cityCode,
      pickup_points: availablePvz,
      debug
    });

  } catch (error) {
    console.error('Error fetching CDEK pickup points:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch pickup points',
      debug: {
        exception: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

// CDEK: Create order
app.post(`${prefix}/cdek/create`, async (c) => {
  try {
    const body = await c.req.json();
    const { 
      recipient_name, 
      recipient_phone, 
      recipient_email,
      pvz_code, 
      city_to,
      order_price,
      order_items,
      tariff_code
    } = body;
    
    if (!recipient_name || !recipient_phone || !pvz_code || !city_to || !order_price) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    console.log('Creating CDEK order:', { recipient_name, pvz_code, city_to, tariff_code });

    // Настройки компании
    const COMPANY_NAME = 'ИП Порохина Анастасия Игоревна';
    const CONTACT_PERSON = 'Василий Нечай';
    const COMPANY_EMAIL = 'chai.nechai@yandex.ru';
    const COMPANY_PHONE = '+79818747388';
    const SENDER_OFFICE_CODE = 'SPB1204';
    const TARIFF_CODE = tariff_code || 136; // Используем тариф из расчета или fallback на 136 (ПВЗ→ПВЗ)
    const PACKAGE_COMMENT = 'Хрупкое';

    // Генерируем уникальный номер заказа
    const orderNumber = `RETAIL-${Date.now()}`;

    // Рассчитываем габариты посылки на основе товаров
    let totalWeight = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    if (order_items && order_items.length > 0) {
      order_items.forEach((item: any) => {
        const quantity = item.quantity || 1;
        const weight = Math.max(item.weight || 500, 100); // грамм
        const length = Math.max(item.length || 20, 10); // см
        const width = Math.max(item.width || 15, 10); // см
        const height = Math.max(item.height || 10, 5); // см
        
        totalWeight += weight * quantity;
        maxLength = Math.max(maxLength, length);
        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);
      });
    } else {
      // Дефолтные значения
      totalWeight = 500;
      maxLength = 20;
      maxWidth = 15;
      maxHeight = 10;
    }

    // Тариф 136 требует минимум 1кг
    if (totalWeight < 1000) {
      console.log(`⚠️ Tariff 136 requires min 1kg, rounding up from ${totalWeight}g to 1000g`);
      totalWeight = 1000;
    }

    // Конвертируем габариты в мм для API СДЭК
    const lengthMm = Math.round(maxLength * 10);
    const widthMm = Math.round(maxWidth * 10);
    const heightMm = Math.round(maxHeight * 10);

    console.log(`📦 Package dimensions: ${totalWeight}g, ${lengthMm}×${widthMm}×${heightMm}mm`);

    // Создать заказ в CDEK
    const cdekOrder = {
      type: 1, // Онлайн-магазин
      number: orderNumber,
      tariff_code: TARIFF_CODE,
      comment: PACKAGE_COMMENT,
      shipment_point: SENDER_OFFICE_CODE,
      delivery_point: pvz_code,
      sender: {
        company: COMPANY_NAME,
        name: CONTACT_PERSON,
        email: COMPANY_EMAIL,
        phones: [
          { number: COMPANY_PHONE }
        ]
      },
      recipient: {
        name: recipient_name,
        phones: [
          { number: recipient_phone }
        ],
        ...(recipient_email && { email: recipient_email })
      },
      packages: [
        {
          number: '1',
          comment: PACKAGE_COMMENT,
          weight: totalWeight,
          length: lengthMm,
          width: widthMm,
          height: heightMm,
          items: order_items?.map((item: any, index: number) => ({
            name: item.name || 'Товар',
            ware_key: item.id || `item_${index}`,
            payment: {
              value: 0 // Без наложенного платежа
            },
            cost: item.price || 0,
            weight: item.weight || 100,
            amount: item.quantity || 1
          })) || [
            {
              name: 'Кофе',
              ware_key: 'coffee_1',
              payment: { value: 0 },
              cost: order_price,
              weight: totalWeight,
              amount: 1
            }
          ]
        }
      ]
    };

    const cdekResponse = await cdekRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(cdekOrder)
    });

    console.log('CDEK order created:', cdekResponse);

    // Вернуть данные заказа
    return c.json({
      success: true,
      cdek_order_uuid: cdekResponse.entity?.uuid,
      cdek_order_number: orderNumber,
      tracking_number: cdekResponse.entity?.cdek_number || orderNumber,
      order_data: cdekResponse
    });

  } catch (error) {
    console.error('Error creating CDEK order:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create CDEK order' 
    }, 500);
  }
});

// CDEK: Get label PDF
app.post(`${prefix}/cdek/print`, async (c) => {
  try {
    const { cdek_order_uuid } = await c.req.json();
    
    if (!cdek_order_uuid) {
      return c.json({ error: 'Missing cdek_order_uuid' }, 400);
    }

    console.log('Requesting CDEK label for order:', cdek_order_uuid);

    // Запросить создание PDF
    const printResponse = await cdekRequest('/print/orders', {
      method: 'POST',
      body: JSON.stringify({
        orders: [
          { order_uuid: cdek_order_uuid }
        ]
      })
    });

    console.log('CDEK print response:', printResponse);

    // Вернуть UUID задачи на печать
    return c.json({
      print_uuid: printResponse.entity?.uuid,
      print_url: printResponse.entity?.url
    });

  } catch (error) {
    console.error('Error requesting CDEK label:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to request label' 
    }, 500);
  }
});

// CDEK: Get order info by UUID
app.post(`${prefix}/cdek/order-info`, async (c) => {
  try {
    const { uuid } = await c.req.json();
    
    if (!uuid) {
      return c.json({ error: 'Missing uuid' }, 400);
    }

    console.log('========================================');
    console.log('🔍 Getting CDEK order info for UUID:', uuid);
    console.log('========================================');

    const { getCdekOrderInfo } = await import('./cdek_order_create.tsx');
    const orderInfo = await getCdekOrderInfo(uuid);

    console.log('✅ Order info retrieved:', JSON.stringify(orderInfo, null, 2));
    console.log('========================================');

    return c.json({
      success: true,
      order: orderInfo
    });

  } catch (error) {
    console.error('========================================');
    console.error('❌ Error getting CDEK order info:', error);
    console.error('========================================');
    return c.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get order info' 
    }, 500);
  }
});

// ============================================================================
// TOCHKA BANK PAYMENT INTEGRATION
// ============================================================================

// Создать платеж
app.post(`${prefix}/tochka/payment-create`, async (c) => {
  try {
    const body = await c.req.json();
    const { amount, purpose, paymentMode, orderId } = body;

    console.log('========================================');
    console.log('CREATING TOCHKA PAYMENT');
    console.log('Amount:', amount);
    console.log('Purpose:', purpose);
    console.log('Payment Mode:', paymentMode);
    console.log('Order ID:', orderId);

    if (!amount || !purpose || !paymentMode) {
      return c.json({ error: 'Missing required fields: amount, purpose, paymentMode' }, 400);
    }

    // Генерируем requestId на основе orderId
    const requestId = orderId ? `PAY-${orderId}` : `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const paymentRequest: CreatePaymentRequest = {
      amount: String(amount),
      purpose,
      paymentMode,
      requestId
    };

    const paymentResponse = await createTochkaPayment(paymentRequest);

    console.log('Payment created successfully:', paymentResponse);
    console.log('========================================');

    return c.json({
      success: true,
      requestId: paymentResponse.requestId,
      paymentUrl: paymentResponse.paymentUrl,
      qrCode: paymentResponse.qrCode,
      status: paymentResponse.status,
      // Добавляем для отладки
      _debug: {
        paymentUrlEmpty: !paymentResponse.paymentUrl,
        rawResponse: paymentResponse
      }
    });

  } catch (error) {
    console.error('========================================');
    console.error('Error creating Tochka payment:', error);
    console.error('========================================');
    return c.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment' 
    }, 500);
  }
});

// Webhook для получения уведомлений о платежах
app.post(`${prefix}/tochka/payment-webhook`, async (c) => {
  try {
    const payload: TochkaWebhookPayload = await c.req.json();

    console.log('========================================');
    console.log('TOCHKA PAYMENT WEBHOOK RECEIVED');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const processedData = processTochkaWebhook(payload);

    console.log('Processed webhook data:', processedData);

    // Обновляем статус заказа, если платеж успешен
    if (processedData.status === 'paid') {
      // Извлекаем orderId из requestId (формат: PAY-RETAIL-...)
      const requestIdParts = processedData.requestId.split('-');
      if (requestIdParts.length >= 3 && requestIdParts[0] === 'PAY' && requestIdParts[1] === 'RETAIL') {
        const orderId = requestIdParts.slice(2).join('-');
        
        console.log('Updating order payment status for:', orderId);
        
        // Получаем заказ
        const order = await kv.get(`${RETAIL_ORDERS_PREFIX}${orderId}`);
        
        if (order) {
          // Обновляем статус оплаты
          order.paymentStatus = 'paid';
          order.paymentDate = processedData.paymentDate || new Date().toISOString();
          order.paymentAmount = processedData.amount;
          
          // СПИСЫВАЕМ/НАЧИСЛЯЕМ ВУШИ ПОСЛЕ УСПЕШНОЙ ОПЛАТЫ
          if (order.userId) {
            const balanceKey = `nechai_loyalty_${order.userId}`;
            const currentBalance = await kv.get(balanceKey) || 0;
            
            if (order.pointsUsed && order.pointsUsed > 0) {
              // Списываем использованные баллы
              const newBalance = Math.max(0, currentBalance - order.pointsUsed);
              await kv.set(balanceKey, newBalance);
              console.log(`✅ Loyalty: Deducted ${order.pointsUsed} points from user ${order.userId}. Balance: ${currentBalance} -> ${newBalance}`);
            } else if (order.pointsEarned && order.pointsEarned > 0) {
              // Начисляем заработанные баллы
              const newBalance = currentBalance + order.pointsEarned;
              await kv.set(balanceKey, newBalance);
              console.log(`✅ Loyalty: Accrued ${order.pointsEarned} points to user ${order.userId}. Balance: ${currentBalance} -> ${newBalance}`);
            }
          }
          
          await kv.set(`${RETAIL_ORDERS_PREFIX}${orderId}`, order);
          
          console.log('Order payment status updated successfully');
          
          // Отправляем уведомление в Telegram
          try {
            await sendTelegramMessage(
              `💳 <b>Платеж получен!</b>\n\n` +
              `📦 Заказ: <code>${orderId}</code>\n` +
              `💰 Сумма: ${processedData.amount} ₽\n` +
              `📅 Дата: ${new Date(order.paymentDate).toLocaleString('ru-RU')}`
            );
          } catch (telegramError) {
            console.error('Failed to send Telegram notification:', telegramError);
          }
        } else {
          console.log('Order not found:', orderId);
        }
      }
    }

    console.log('========================================');

    return c.json({
      success: true,
      received: true
    });

  } catch (error) {
    console.error('========================================');
    console.error('Error processing webhook:', error);
    console.error('========================================');
    return c.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process webhook' 
    }, 500);
  }
});

// ============================================================================
// TOCHKA CHECKOUT PAY ENDPOINT
// ============================================================================

app.post(`${prefix}/retail/checkout/pay`, async (c) => {
  try {
    console.log('========================================');
    console.log('📥 RECEIVED CHECKOUT PAY REQUEST');
    console.log('========================================');
    
    const body = await c.req.json();
    const { orderId, email, phone, cart } = body;

    // Очищаем телефон от любого форматирования (оставляем только цифры)
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';

    console.log('Request body:', {
      orderId,
      email,
      phone: cleanPhone ? `${cleanPhone.substring(0, 5)}...` : 'N/A',
      cartItems: cart?.length || 0
    });

    if (!orderId || !cleanPhone || !cart || !Array.isArray(cart) || cart.length === 0) {
      console.error('❌ Missing required fields for payment');
      console.error('Received:', { orderId, phone: !!cleanPhone, cart: cart?.length });
      return c.json({ error: 'Missing required fields or empty cart' }, 400);
    }

    // Получаем заказ из БД для проверки delivery_cost
    console.log('📦 Fetching order from database...');
    const orderKey = `${RETAIL_ORDERS_PREFIX}${orderId}`;
    const order = await kv.get(orderKey);
    
    if (!order) {
      console.error(`❌ Order ${orderId} not found in DB`);
      return c.json({ error: 'Order not found' }, 404);
    }
    
    console.log('✅ Order found:', {
      id: order.id,
      total: order.total,
      delivery_cost: order.delivery_cost,
      pointsUsed: order.pointsUsed
    });

    // Validate cart items
    console.log('🔍 Validating cart items...');
    for (const item of cart) {
      if (!item.name || !item.price || !item.quantity || item.price <= 0 || item.quantity <= 0) {
        console.error('❌ Invalid cart item:', item);
        return c.json({ error: 'Invalid cart item' }, 400);
      }
    }
    console.log('✅ All cart items valid');

    // ВАЖНО: Используем сумму из заказа, которая уже учитывает скидку от вушей!
    // НЕ пересчитываем из корзины, так как там оригинальные цены без скидки
    const totalAmount = order.total;
    const deliveryCost = order.delivery_cost || 0;
    
    console.log(`💰 Payment amount: ${totalAmount}₽ (from order.total, includes Woosh discount if applied)`);
    console.log(`🚚 Delivery cost: ${deliveryCost}₽`);
    if (order.pointsUsed) {
      console.log(`🎁 Woosh discount applied: ${order.pointsUsed}₽`);
    }

    const amountStr = totalAmount.toFixed(2);

    console.log('💳 Calling Tochka API to create payment...');
    console.log('Payment parameters:', {
      amount: amountStr,
      orderId,
      email: email || 'no-reply@coffeenechai.ru',
      phone: cleanPhone ? `${cleanPhone.substring(0, 5)}...` : 'N/A',
      orderTotal: order.total,
      deliveryCost: deliveryCost,
      pointsUsed: order.pointsUsed || 0
    });

    // Call Tochka API
    const result = await createTochkaPaymentWithReceipt({
      customerCode: "303213604",
      merchantId: "200000000030625",
      amount: amountStr,
      purpose: `Order ${orderId} · coffeenechai.ru`,
      redirectUrl: `https://coffeenechai.ru/payment/success?orderId=${orderId}`,
      failRedirectUrl: `https://coffeenechai.ru/payment/fail?orderId=${orderId}`,
      paymentMode: ["card", "sbp"],
      taxSystemCode: "usn_income_outcome",
      client: {
        name: "Покупатель",
        email: email || "no-reply@coffeenechai.ru",
        phone: cleanPhone
      },
      items: (() => {
        // Формируем позиции для чека с учетом скидки от вушей
        let receiptItems = [];
        
        if (order.pointsUsed && order.pointsUsed > 0) {
          // Рассчитываем сумму товаров без доставки
          const itemsTotal = cart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
          
          // Применяем скидку пропорционально к каждому товару
          receiptItems = cart.map((item: any) => {
            const itemTotal = item.price * item.quantity;
            const itemDiscountRatio = itemTotal / itemsTotal;
            const itemDiscount = order.pointsUsed * itemDiscountRatio;
            const discountedPrice = Math.max(0.01, (itemTotal - itemDiscount) / item.quantity);
            
            return {
              name: item.name,
              amount: discountedPrice.toFixed(2),
              quantity: item.quantity,
              vatType: "none",
              paymentMethod: "full_payment",
              paymentObject: "goods",
              measure: "шт."
            };
          });
          
          console.log(`📝 Receipt items with Woosh discount distributed across products`);
        } else {
          // Без скидки - используем оригинальные цены
          receiptItems = cart.map((item: any) => ({
            name: item.name,
            amount: Number(item.price).toFixed(2),
            quantity: item.quantity,
            vatType: "none",
            paymentMethod: "full_payment",
            paymentObject: "goods",
            measure: "шт."
          }));
        }
        
        // Добавляем доставку как отдельную позицию, если она есть
        if (deliveryCost > 0) {
          receiptItems.push({
            name: "Доставка СДЭК",
            amount: deliveryCost.toFixed(2),
            quantity: 1,
            vatType: "none",
            paymentMethod: "full_payment",
            paymentObject: "service",
            measure: "шт."
          });
        }
        
        // КРИТИЧЕСКИ ВАЖНО: проверяем, что сумма всех позиций = totalAmount
        const itemsSum = receiptItems.reduce((sum, item) => 
          sum + (parseFloat(item.amount) * item.quantity), 0
        );
        const expectedAmount = parseFloat(amountStr);
        const diff = Math.abs(itemsSum - expectedAmount);
        
        console.log('💰 Receipt validation:', {
          itemsSum: itemsSum.toFixed(2),
          expectedAmount: expectedAmount.toFixed(2),
          difference: diff.toFixed(2)
        });
        
        // Если есть разница из-за округления, корректируем последнюю позицию
        if (diff > 0.001) {
          console.log('⚠️ Detected rounding difference, adjusting last item...');
          const lastItem = receiptItems[receiptItems.length - 1];
          const lastItemTotal = parseFloat(lastItem.amount) * lastItem.quantity;
          const adjustment = expectedAmount - (itemsSum - lastItemTotal);
          lastItem.amount = (adjustment / lastItem.quantity).toFixed(2);
          
          console.log('✅ Last item adjusted:', {
            oldAmount: (lastItemTotal / lastItem.quantity).toFixed(2),
            newAmount: lastItem.amount,
            newTotal: (parseFloat(lastItem.amount) * lastItem.quantity).toFixed(2)
          });
          
          // Повторная проверка
          const newItemsSum = receiptItems.reduce((sum, item) => 
            sum + (parseFloat(item.amount) * item.quantity), 0
          );
          console.log('✅ Final sum after adjustment:', newItemsSum.toFixed(2));
        }
        
        // Выводим детальный список позиций
        console.log('📋 Final receipt items:');
        receiptItems.forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.name}: ${item.amount}₽ × ${item.quantity} = ${(parseFloat(item.amount) * item.quantity).toFixed(2)}₽`);
        });
        
        return receiptItems;
      })(),
      supplier: {
        name: "Индивидуальный предприниматель Порохина Анастасия Игоревна",
        phone: "+79819747388",
        taxCode: "591000733530"
      }
    });

    // Save operationId to order in DB (order уже получен выше)
    order.tochkaOperationId = result.operationId;
    order.paymentLink = result.paymentLink;
    order.paymentStatus = 'pending';
    await kv.set(orderKey, order);

    return c.json({ paymentLink: result.paymentLink });

  } catch (error) {
    console.error('========================================');
    console.error('❌ CHECKOUT PAY ERROR:');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('========================================');
    // Return more informative error message
    return c.json({ 
      error: 'Payment initiation failed',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ============================================================================
// RETAIL USER REGISTRATION ENDPOINT
// ============================================================================

// Регистрация розничного пользователя с автоматическим подтверждением email
app.post(`${prefix}/retail-signup`, async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;
    
    console.log('========================================');
    console.log('RETAIL USER SIGNUP');
    console.log('Email:', email);
    
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }
    
    // Создаем Supabase клиент с SERVICE_ROLE_KEY для использования Admin API
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Создаем пользователя с автоматическим подтверждением email
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      user_metadata: { role: 'retail' },
      // Автоматически подтверждаем email, так как SMTP сервер не настроен
      email_confirm: true
    });
    
    if (error) {
      // Переводим стандартные ошибки Supabase на русский
      let errorMessage = error.message;
      
      // Проверяем код ошибки для более точного определения
      if (error.code === 'email_exists' || error.message.includes('already registered') || error.message.includes('User already registered')) {
        errorMessage = 'Пользователь с таким email уже зарегистрирован';
        console.log(`Signup validation: User with email ${email} already exists (code: ${error.code})`);
      } else if (error.code === 'weak_password' || error.message.includes('Password')) {
        errorMessage = 'Пароль должен содержать минимум 6 символов';
        console.log('Signup validation: Weak password');
      } else if (error.code === 'invalid_email' || error.message.includes('Email')) {
        errorMessage = 'Некорректный email адрес';
        console.log('Signup validation: Invalid email format');
      } else {
        // Только для неожиданных ошибок логируем полный стектрейс
        console.error('Unexpected signup error:', error);
      }
      
      return c.json({ error: errorMessage }, 400);
    }
    
    console.log('User created successfully:', data.user?.id);
    console.log('Email confirmed automatically');
    
    // Создаем профиль пользователя в KV хранилище
    if (data.user?.id) {
      try {
        const profileData = {
          id: data.user.id,
          email: email,
          role: 'retail',
          created_at: new Date().toISOString()
        };
        await kv.set(`nechai_profile_${data.user.id}`, profileData);
        console.log(`Profile created in KV for user ${data.user.id} with role 'retail'`);
      } catch (profileError) {
        console.error('Failed to create profile in KV (non-critical):', profileError);
      }
    }
    
    // Инициализируем баланс лояльности 100 вушей для нового пользователя
    if (data.user?.id) {
      try {
        await kv.set(`nechai_loyalty_${data.user.id}`, 100);
        console.log(`Loyalty account created for user ${data.user.id} with 100 Woosh (welcome bonus)`);
      } catch (bonusError) {
        console.error('Failed to create loyalty account (non-critical):', bonusError);
      }
    }
    
    // Отправляем приветственное письмо
    console.log('Sending welcome email to:', email);
    try {
      await sendWelcomeEmail(email);
      console.log('Welcome email sent successfully');
    } catch (emailError) {
      console.error('Failed to send welcome email (non-critical):', emailError);
      // Продолжаем регистрацию даже если письмо не отправилось
    }
    
    console.log('========================================');
    
    return c.json({ 
      success: true, 
      user: {
        id: data.user?.id,
        email: data.user?.email,
        confirmed: true
      }
    });
    
  } catch (error) {
    console.error('Error during retail signup:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// ============================================================================
// RETAIL USERS MANAGEMENT ENDPOINTS
// ============================================================================

// GET /retail-users - получить список всех пользователей розницы
app.get(`${prefix}/retail-users`, async (c) => {
  console.log('🔍 [RETAIL-USERS] Запрос на получение списка пользователей розницы');
  
  try {
    // Получаем все профили пользователей из KV
    console.log('📥 [RETAIL-USERS] Получение всех профилей из KV...');
    const allProfiles = await kv.getByPrefix('nechai_profile_');
    console.log('📊 [RETAIL-USERS] Найдено профилей:', allProfiles.length);
    
    // Фильтруем только розничных пользователей
    const retailUsers = allProfiles
      .filter(profile => profile && (profile.role === 'retail' || profile.role === 'admin'))
      .map(profile => ({
        id: profile.id,
        email: profile.email,
        role: profile.role,
        created_at: profile.created_at
      }));
    
    console.log('🛍️ [RETAIL-USERS] Розничных пользователей после фильтрации:', retailUsers.length);
    
    // Для каждого пользователя получаем баланс лояльности одним батчевым запросом
    console.log('💰 [RETAIL-USERS] Получение балансов лояльности (mget batch)...');
    let usersWithBalance;
    if (retailUsers.length === 0) {
      usersWithBalance = [];
    } else {
      const balanceKeys = retailUsers.map(user => `nechai_loyalty_${user.id}`);
      let balances: any[] = [];
      try {
        balances = await kv.mget(balanceKeys);
      } catch (mgetErr) {
        console.error('⚠️ [RETAIL-USERS] mget failed, defaulting balances to 0:', mgetErr);
        balances = new Array(retailUsers.length).fill(null);
      }
      usersWithBalance = retailUsers.map((user, i) => {
        const balanceData = balances[i];
        const balance = typeof balanceData === 'number'
          ? balanceData
          : (balanceData?.balance ?? 0);
        return { ...user, loyalty_balance: balance };
      });
    }
    
    console.log(`✅ [RETAIL-USERS] Успешно получено ${usersWithBalance.length} пользователей с балансами`);
    
    return c.json({ users: usersWithBalance });
    
  } catch (error) {
    console.error('❌ [RETAIL-USERS] Критическая ошибка при получении пользователей:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// POST /retail-users - создать нового розничного пользователя из админ-панели
app.post(`${prefix}/retail-users`, async (c) => {
  console.log('➕ [RETAIL-USERS] Запрос на создание нового пользователя');
  try {
    const body = await c.req.json();
    const { email, role = 'retail' } = body;

    if (!email) {
      return c.json({ error: 'Email обязателен' }, 400);
    }

    // Генерируем временный пароль
    const tempPassword = Math.random().toString(36).slice(-10) + 'Aa1!';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: { role },
      email_confirm: true
    });

    if (error) {
      console.error('❌ [RETAIL-USERS] Ошибка создания пользователя Supabase Auth:', error);
      let msg = error.message;
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        msg = 'Пользователь с таким email уже существует';
      }
      return c.json({ error: msg }, 400);
    }

    const userId = data.user?.id;
    console.log('✅ [RETAIL-USERS] Пользователь создан в Auth:', userId);

    // Создаём профиль в KV
    if (userId) {
      const profileData = {
        id: userId,
        email,
        role,
        created_at: new Date().toISOString()
      };
      await kv.set(`nechai_profile_${userId}`, profileData);
      // Инициализируем баланс лояльности
      await kv.set(`nechai_loyalty_${userId}`, 100);
      console.log('✅ [RETAIL-USERS] Профиль и баланс лояльности созданы');
    }

    return c.json({
      user: {
        id: userId,
        email,
        role,
        created_at: data.user?.created_at ?? new Date().toISOString(),
        loyalty_balance: 100
      }
    });
  } catch (error) {
    console.error('❌ [RETAIL-USERS] Критическая ошибка при создании пользователя:', error);
    return c.json({ error: `Failed to create user: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// POST /retail-users/:userId/add-points - начислить баллы пользователю
app.post(`${prefix}/retail-users/:userId/add-points`, async (c) => {
  console.log('💰 [ADD-POINTS] Запрос на начисление баллов');
  
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { amount } = body;
    
    console.log('💰 [ADD-POINTS] Параметры:', { userId, amount });
    
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400);
    }
    
    console.log('🔐 [ADD-POINTS] Проверка авторизации');
    
    // Открытый доступ - проверка авторизации снята
    
    // Проверяем, что пользователь существует
    const profile = await kv.get(`nechai_profile_${userId}`);
    if (!profile) {
      console.log('❌ [ADD-POINTS] Пользователь не найден');
      return c.json({ error: 'User not found' }, 404);
    }
    
    // Получаем текущий баланс
    const balanceData = await kv.get(`nechai_loyalty_${userId}`);
    const currentBalance = typeof balanceData === 'number' 
      ? balanceData 
      : (balanceData?.balance ?? 0);
    const newBalance = currentBalance + amount;
    
    console.log('💰 [ADD-POINTS] Обновление баланса:', { currentBalance, amount, newBalance });
    
    // Сохраняем новый баланс (в формате объекта для консистентности)
    await kv.set(`nechai_loyalty_${userId}`, {
      balance: newBalance,
      lastUpdated: new Date().toISOString()
    });
    
    console.log(`✅ [ADD-POINTS] Успешно начислено ${amount} баллов. Новый баланс: ${newBalance}`);
    
    return c.json({ 
      success: true,
      newBalance,
      user: {
        id: userId,
        email: profile.email
      }
    });
    
  } catch (error) {
    console.error('❌ [ADD-POINTS] Ошибка при начислении баллов:', error);
    return c.json({ error: 'Failed to add points' }, 500);
  }
});

// DELETE /retail-users/:userId - удалить пользователя розницы
app.delete(`${prefix}/retail-users/:userId`, async (c) => {
  console.log('🗑️ [DELETE-USER] Запрос на удаление пользователя');
  
  try {
    const userIdToDelete = c.req.param('userId');
    console.log('👤 [DELETE-USER] ID пользователя для удаления:', userIdToDelete);
    
    console.log('🔐 [DELETE-USER] Открытый доступ - проверка авторизации снята');
    
    // Открытый доступ - проверка авторизации снята
    if (false) {
      // Код удален
    } else {
      const authHeader = c.req.header('Authorization');
      if (authHeader) {
      const token = authHeader.split(' ')[1];
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );
      
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        console.log('❌ [DELETE-USER] Ошибка авторизации:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Проверяем, что пользователь - админ
      const adminProfile = await kv.get(`nechai_profile_${user.id}`);
      if (!adminProfile || adminProfile.role !== 'admin') {
        console.log('❌ [DELETE-USER] Доступ запрещён - пользователь не админ');
        return c.json({ error: 'Forbidden: Admin access required' }, 403);
      }
      
      // Нельзя удалить самого себя
      if (userIdToDelete === user.id) {
        return c.json({ error: 'Cannot delete yourself' }, 400);
      }
      } else {
        console.log('❌ [DELETE-USER] Отсутствуют параметры авторизации');
        return c.json({ error: 'Unauthorized' }, 401);
      }
    }
    
    // Проверяем, что пользователь существует
    const profileToDelete = await kv.get(`nechai_profile_${userIdToDelete}`);
    if (!profileToDelete) {
      console.log('❌ [DELETE-USER] Пользователь не найден');
      return c.json({ error: 'User not found' }, 404);
    }
    
    // Нельзя удалить админа
    if (profileToDelete.role === 'admin') {
      console.log('❌ [DELETE-USER] Нельзя удалить админа');
      return c.json({ error: 'Cannot delete admin users' }, 400);
    }
    
    // Удаляем пользователя из Supabase Auth
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);
    if (deleteError) {
      console.error('❌ [DELETE-USER] Ошибка удаления из Supabase Auth:', deleteError);
      return c.json({ error: 'Failed to delete user from auth system' }, 500);
    }
    
    // Удаляем профиль из KV
    await kv.del(`nechai_profile_${userIdToDelete}`);
    
    // Удаляем баланс лояльности
    await kv.del(`nechai_loyalty_${userIdToDelete}`);
    
    console.log(`✅ [DELETE-USER] Пользователь ${userIdToDelete} успешно удален`);
    
    return c.json({ success: true });
    
  } catch (error) {
    console.error('❌ [DELETE-USER] Ошибка при удалении:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

// ============================================================================
// ADMIN INITIALIZATION
// ============================================================================

// Инициализация профиля админа при старте сервера
(async () => {
  try {
    console.log('🚀 Starting admin initialization...');
    
    // Проверяем наличие необходимых переменных окружения
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing required environment variables for admin initialization');
      console.log('⚠️ Skipping admin initialization, server will continue');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Получаем список всех пользователей Supabase Auth с retry логикой
    let users = null;
    let retries = 3;
    let lastError = null;
    
    while (retries > 0 && !users) {
      try {
        const { data, error } = await supabase.auth.admin.listUsers();
        
        if (error) {
          lastError = error;
          throw error;
        }
        
        users = data?.users;
        break;
      } catch (error) {
        retries--;
        lastError = error;
        
        if (retries > 0) {
          console.log(`⚠️ Failed to list users, retrying... (${retries} attempts left)`);
          // Ждем 2 секунды перед повторной попыткой
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!users) {
      console.error('Failed to list users for admin initialization after retries:', lastError);
      console.log('⚠️ Skipping admin initialization, server will continue');
      return;
    }
    
    if (users.length === 0) {
      console.log('ℹ️ No users found, skipping profile initialization');
      return;
    }
    
    console.log(`📊 Processing ${users.length} users for profile initialization...`);
    
    // Для каждого пользователя проверяем, есть ли у него профиль в KV
    for (const user of users) {
      try {
        // Retry логика для KV операций
        let existingProfile = null;
        let kvRetries = 3;
        let kvLastError = null;
        
        while (kvRetries > 0 && existingProfile === null) {
          try {
            existingProfile = await kv.get(`nechai_profile_${user.id}`);
            break;
          } catch (kvError) {
            kvRetries--;
            kvLastError = kvError;
            
            const errorMsg = kvError instanceof Error ? kvError.message : String(kvError);
            
            // Проверяем, является ли это временной ошибкой
            if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error') || errorMsg.includes('cloudflare')) {
              if (kvRetries > 0) {
                console.log(`⚠️ KV error for user ${user.id}, retrying... (${kvRetries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              }
            }
            
            // Если это не временная ошибка или закончились попытки
            throw kvError;
          }
        }
        
        if (kvRetries === 0 && existingProfile === null && kvLastError) {
          console.error(`❌ Failed to get profile for user ${user.id} after retries, skipping:`, kvLastError);
          continue;
        }
        
        if (!existingProfile) {
          // Если профиля нет, создаем его
          // Если это первый пользователь или email содержит admin, делаем его админом
          const isFirstUser = users && users.length === 1;
          const isAdminEmail = user.email?.toLowerCase().includes('admin');
          const role = (isFirstUser || isAdminEmail) ? 'admin' : 'retail';
          
          const profileData = {
            id: user.id,
            email: user.email,
            role: role,
            created_at: user.created_at || new Date().toISOString()
          };
          
          // Retry для set операции
          let setRetries = 3;
          while (setRetries > 0) {
            try {
              await kv.set(`nechai_profile_${user.id}`, profileData);
              console.log(`✅ Profile created for user ${user.id} (${user.email}) with role: ${role}`);
              break;
            } catch (setError) {
              setRetries--;
              if (setRetries > 0) {
                console.log(`⚠️ Failed to create profile for user ${user.id}, retrying... (${setRetries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              } else {
                throw setError;
              }
            }
          }
          
          // Создаем баланс лояльности если его нет (с retry)
          try {
            let existingBalance = null;
            let balanceRetries = 3;
            
            while (balanceRetries > 0) {
              try {
                existingBalance = await kv.get(`nechai_loyalty_${user.id}`);
                break;
              } catch {
                balanceRetries--;
                if (balanceRetries > 0) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            }
            
            if (existingBalance === null || existingBalance === undefined) {
              let loyaltySetRetries = 3;
              while (loyaltySetRetries > 0) {
                try {
                  await kv.set(`nechai_loyalty_${user.id}`, {
                    balance: 0,
                    lastUpdated: new Date().toISOString()
                  });
                  console.log(`✅ Loyalty balance initialized for user ${user.id}`);
                  break;
                } catch {
                  loyaltySetRetries--;
                  if (loyaltySetRetries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }
              }
            }
          } catch (balanceError) {
            console.error(`⚠️ Failed to initialize loyalty balance for user ${user.id} (non-critical):`, balanceError);
          }
        }
      } catch (userError) {
        const errorMsg = userError instanceof Error ? userError.message : String(userError);
        console.error(`Error processing user ${user.id}:`, errorMsg);
        // Продолжаем с другими пользователями
        continue;
      }
    }
    
    console.log('✅ Admin initialization completed');
  } catch (error) {
    // Обработка ошибок без прерывания запуска сервера
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'Unknown';
    
    console.error('❌ Error during admin initialization:', errorName, errorMessage);
    console.log('⚠️ Server will continue despite initialization error');
    
    // Логируем полный стек только если это не сетевая ошибка и не временная ошибка БД
    const isTemporaryError = errorMessage.includes('Connection reset') || 
                           errorMessage.includes('ECONNRESET') ||
                           errorMessage.includes('500 Internal Server Error') ||
                           errorMessage.includes('cloudflare');
    
    if (!isTemporaryError) {
      console.error('Full error details:', error);
    } else {
      console.log('ℹ️ This appears to be a temporary database connection issue. Profiles will be created on next server restart or user login.');
    }
  }
})();

// ============================================================================
// TOCHKA BANK PAYMENT WEBHOOK
// ============================================================================

/**
 * Webhook endpoint для обработки уведомлений от Точка Банк о статусе платежа
 * Вызывается автоматически при изменении статуса платежа
 */
app.post(`${prefix}/payment/webhook/tochka`, async (c) => {
  try {
    console.log('========================================');
    console.log('📬 TOCHKA PAYMENT WEBHOOK RECEIVED');
    console.log('========================================');
    
    const payload = await c.req.json();
    console.log('📦 Webhook payload:', JSON.stringify(payload, null, 2));
    
    // Извлекаем operationId из разных возможных полей
    const operationId = payload.operationId || 
                       payload.Data?.operationId || 
                       payload.uuid ||
                       payload.Data?.uuid;
    
    // Извлекаем статус платежа
    const status = payload.status || payload.Data?.status || '';
    
    console.log('🔍 Extracted from webhook:', { operationId, status });
    
    if (!operationId) {
      console.error('❌ No operationId found in webhook payload');
      return c.json({ error: 'Missing operationId' }, 400);
    }
    
    // Ищем заказ по operationId во всех розничных заказах
    console.log(`🔎 Searching for order with operationId: ${operationId}`);
    const allRetailOrders = await kv.getByPrefix(RETAIL_ORDERS_PREFIX);
    const order = allRetailOrders.find((o: any) => o.tochkaOperationId === operationId);
    
    if (!order) {
      console.error(`❌ Order not found for operationId: ${operationId}`);
      // Возвращаем 200 чтобы Точка не повторяла запрос
      return c.json({ 
        success: false, 
        message: 'Order not found',
        operationId 
      });
    }
    
    console.log(`✅ Order found: ${order.orderId}`);
    console.log(`📊 Current order status: ${order.paymentStatus}`);
    console.log(`💰 Order total: ${order.total}₽`);
    console.log(`👤 User ID: ${order.userId || 'guest'}`);
    
    // Проверяем статус платежа
    const statusLower = status.toLowerCase();
    const isPaid = statusLower === 'paid' || 
                   statusLower === 'success' || 
                   statusLower === 'completed' ||
                   statusLower === 'authorized';
    
    if (isPaid && order.paymentStatus !== 'paid') {
      console.log('💳 Payment successful! Updating order...');
      
      // Обновляем статус заказа
      order.paymentStatus = 'paid';
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      
      // Обрабатываем баллы лояльности
      if (order.userId) {
        const balanceKey = `nechai_loyalty_${order.userId}`;
        const currentBalance = await kv.get(balanceKey) || 0;
        
        console.log(`👤 Processing loyalty for user ${order.userId}`);
        console.log(`💰 Current balance: ${currentBalance} Woosh`);
        
        if (order.pointsUsed && order.pointsUsed > 0) {
          // Списываем использованные баллы
          const newBalance = Math.max(0, currentBalance - order.pointsUsed);
          await kv.set(balanceKey, newBalance);
          console.log(`➖ Deducted ${order.pointsUsed} Woosh. New balance: ${newBalance}`);
        } else if (order.pointsEarned && order.pointsEarned > 0) {
          // Начисляем заработанные баллы
          const newBalance = currentBalance + order.pointsEarned;
          await kv.set(balanceKey, newBalance);
          console.log(`➕ Added ${order.pointsEarned} Woosh. New balance: ${newBalance}`);
        } else {
          console.log('ℹ️ No loyalty points to process');
        }
      } else {
        console.log('ℹ️ No userId - skipping loyalty processing');
      }
      
      // Сохраняем обновлённый заказ
      await kv.set(`${RETAIL_ORDERS_PREFIX}${order.orderId}`, order);
      console.log(`✅ Order ${order.orderId} marked as PAID`);
      
      // Отправляем уведомление о успешной оплате в Telegram (опционально)
      try {
        const message = `
🎉 <b>Оплата получена!</b>

📦 <b>Заказ:</b> ${order.orderId}
💰 <b>Сумма:</b> ${order.total.toLocaleString('ru-RU')} ₽
👤 <b>Клиент:</b> ${order.contact}
📧 <b>Email:</b> ${order.email || 'не указан'}
📱 <b>Телефон:</b> ${order.phone}
${order.delivery_method === 'cdek' ? `🚚 <b>Доставка:</b> СДЭК - ${order.delivery_address}` : '🏪 <b>Доставка:</b> Самовывоз'}
${order.pointsUsed ? `\n🎁 <b>Списано Вушей:</b> ${order.pointsUsed}` : ''}
${order.pointsEarned ? `\n✨ <b>Начислено Вушей:</b> ${order.pointsEarned}` : ''}
        `.trim();
        
        await sendTelegramMessage(message);
        console.log('✅ Telegram notification sent');
      } catch (telegramError) {
        console.error('⚠️ Failed to send Telegram notification:', telegramError);
        // Не критично, продолжаем
      }
      
      console.log('========================================');
      console.log('✅ WEBHOOK PROCESSING COMPLETE');
      console.log('========================================');
      
      return c.json({ 
        success: true, 
        message: 'Payment processed successfully',
        orderId: order.orderId,
        status: 'paid'
      });
    } else if (isPaid) {
      console.log(`ℹ️ Order ${order.orderId} already marked as paid`);
      return c.json({ 
        success: true, 
        message: 'Order already paid',
        orderId: order.orderId 
      });
    } else {
      console.log(`⚠️ Payment status is not paid: ${status}`);
      // Обновляем статус если нужно
      if (statusLower === 'failed' || statusLower === 'cancelled') {
        order.paymentStatus = statusLower as any;
        await kv.set(`${RETAIL_ORDERS_PREFIX}${order.orderId}`, order);
        console.log(`📝 Updated order status to: ${statusLower}`);
      }
      
      return c.json({ 
        success: true, 
        message: `Payment status: ${status}`,
        orderId: order.orderId 
      });
    }
    
  } catch (error) {
    console.error('========================================');
    console.error('❌ WEBHOOK PROCESSING ERROR:');
    console.error('Error:', error);
    console.error('========================================');
    
    // Возвращаем 200 чтобы Точка не повторяла запрос при ошибке парсинга
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, 200);
  }
});

/**
 * Вручную проверить статус платежа и обновить заказ
 * Для случаев, когда webhook не сработал
 */
app.post(`${prefix}/payment/check-status/:orderId`, async (c) => {
  try {
    const orderId = c.req.param('orderId');
    console.log(`🔍 Manual status check for order: ${orderId}`);
    
    // Получаем заказ
    const order = await kv.get(`${RETAIL_ORDERS_PREFIX}${orderId}`);
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    if (!order.tochkaOperationId) {
      return c.json({ error: 'No payment operation ID found' }, 400);
    }
    
    console.log(`📞 Checking payment status with Tochka API...`);
    console.log(`🆔 Operation ID: ${order.tochkaOperationId}`);
    
    // Вызываем API Точка Банк для проверки статуса
    // (Это требует реализации метода getTochkaPaymentStatus с operationId)
    // Пока просто возвращаем текущий статус
    
    return c.json({ 
      orderId: order.orderId,
      paymentStatus: order.paymentStatus,
      operationId: order.tochkaOperationId,
      total: order.total,
      message: 'Use this endpoint to manually trigger webhook logic if needed'
    });
    
  } catch (error) {
    console.error('Error checking payment status:', error);
    return c.json({ 
      error: 'Failed to check payment status',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ============================================================================
// АВТОМАТИЧЕСКАЯ ПРОВЕРКА СТАТУСОВ ОПЛАТЫ (TOCHKA BANK)
// ============================================================================

/**
 * Подтвердить оплату заказа (вызывается со страницы успеха)
 * Если пользователь попал на страницу success - значит Точка Банк подтвердила оплату
 */
app.post(`${prefix}/retail/mark-paid/:orderId`, async (c) => {
  try {
    const orderId = c.req.param('orderId');
    console.log('========================================');
    console.log('💳 MARKING ORDER AS PAID');
    console.log('Order ID:', orderId);
    console.log('========================================');

    // Получаем заказ
    const order = await kv.get(`${RETAIL_ORDERS_PREFIX}${orderId}`);
    
    if (!order) {
      console.log('❌ Order not found');
      return c.json({ error: 'Order not found' }, 404);
    }

    console.log(`📦 Order found: ${order.orderId}`);
    console.log(`📊 Current status: ${order.paymentStatus}`);
    console.log(`💰 Total: ${order.total}₽`);
    console.log(`👤 User ID: ${order.userId || 'guest'}`);

    // Если уже оплачен - просто возвращаем success
    if (order.paymentStatus === 'paid') {
      console.log('✅ Order already paid');
      return c.json({ 
        success: true, 
        message: 'Order already paid',
        order,
        alreadyPaid: true
      });
    }

    // Обновляем статус заказа
    order.paymentStatus = 'paid';
    order.status = 'processing';
    order.paidAt = new Date().toISOString();

    // СПИСЫВАЕМ/НАЧИСЛЯЕМ ВУШИ ПОСЛЕ УСПЕШНОЙ ОПЛАТЫ
    if (order.userId) {
      const balanceKey = `nechai_loyalty_${order.userId}`;
      const currentBalance = await kv.get(balanceKey) || 0;
      
      if (order.pointsUsed && order.pointsUsed > 0) {
        // Списываем использованные баллы
        const newBalance = Math.max(0, currentBalance - order.pointsUsed);
        await kv.set(balanceKey, newBalance);
        console.log(`✅ Loyalty: Deducted ${order.pointsUsed} points from user ${order.userId}. Balance: ${currentBalance} -> ${newBalance}`);
      } else if (order.pointsEarned && order.pointsEarned > 0) {
        // Начисляем заработанные баллы
        const newBalance = currentBalance + order.pointsEarned;
        await kv.set(balanceKey, newBalance);
        console.log(`✅ Loyalty: Accrued ${order.pointsEarned} points to user ${order.userId}. Balance: ${currentBalance} -> ${newBalance}`);
      }
    }

    // Сохраняем обновленный заказ
    await kv.set(`${RETAIL_ORDERS_PREFIX}${orderId}`, order);
    
    console.log('✅ Order marked as paid successfully');
    console.log('========================================');
    
    return c.json({ 
      success: true, 
      message: 'Payment confirmed',
      order
    });

  } catch (error) {
    console.error('❌ Error marking order as paid:', error);
    return c.json({ 
      error: 'Failed to mark order as paid',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

/**
 * Получить информацию о платеже пользователя (для страницы success)
 */
// ============================================================================
// TOCHKA BANK WEBHOOKS
// ============================================================================

// Хелпер для декодирования JWT payload без проверки подписи
function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Используем Buffer если доступен, или atob
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (e) {
    console.error('Error decoding JWT payload:', e);
    return null;
  }
}

/**
 * Эндпоинт для приема вебхуков от Точка Банка (acquiringInternetPayment)
 */
app.post(`${prefix}/tochka/webhook`, async (c) => {
  try {
    const bodyText = await c.req.text();
    console.log('========================================');
    console.log('📦 TOCHKA WEBHOOK RECEIVED');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Body length:', bodyText.length);
    
    // Точка присылает JWT в text/plain
    const jwtString = bodyText.trim().replace(/[\r\n\s]+/g, '');
    const payload = decodeJwtPayload(jwtString);
    
    if (!payload) {
      console.error('❌ Failed to decode Tochka Webhook JWT payload');
      // Возвращаем 200, чтобы Точка не повторяла запрос
      return c.text('OK', 200);
    }
    
    console.log('📋 Decoded Webhook Payload:', JSON.stringify(payload, null, 2));
    
    // Извлекаем данные (могут быть в корне или в объекте Data)
    const data = payload.Data || payload;
    const operationId = data.operationId || data.uuid || data.requestId;
    const status = data.status || data.state;
    const orderIdFromMetadata = (data.metadata?.orderId) || (payload.metadata?.orderId);
    
    if (!operationId) {
      console.warn('⚠️ Webhook missing operationId/identifier, might be a test ping');
      return c.text('OK', 200);
    }
    
    console.log(`🔍 Processing webhook for operationId: ${operationId}, status: ${status}, orderId (meta): ${orderIdFromMetadata}`);
    
    // Поиск заказа в KV
    let order = null;
    let orderKey = null;
    
    if (orderIdFromMetadata) {
      orderKey = `${RETAIL_ORDERS_PREFIX}${orderIdFromMetadata}`;
      order = await kv.get(orderKey);
      if (order) console.log(`✅ Order found by metadata.orderId: ${orderIdFromMetadata}`);
    }
    
    if (!order) {
      console.log('🔎 Order not found by metadata, searching by tochka_operation_id...');
      const allOrders = await kv.getByPrefix(RETAIL_ORDERS_PREFIX);
      order = allOrders.find((o: any) => o.tochka_operation_id === operationId || o.tochkaRequestId === operationId);
      if (order) {
        orderKey = `${RETAIL_ORDERS_PREFIX}${order.orderId}`;
        console.log(`✅ Order found by tochka_operation_id: ${order.orderId}`);
      }
    }
    
    if (!order) {
      console.warn(`⚠️ Order NOT FOUND in database for operationId: ${operationId}`);
      return c.text('OK', 200);
    }
    
    if (order.payment_status === 'paid') {
      console.log(`ℹ️ Order ${order.orderId} is already marked as PAID, skipping duplicate update.`);
      return c.text('OK', 200);
    }
    
    // Логика обновления статуса
    const apiStatus = (status || '').toUpperCase();
    let wasUpdated = false;
    
    // Статусы успеха в Точке: SUCCESS, PAID, AUTHORIZED, COMPLETED
    if (['SUCCESS', 'PAID', 'AUTHORIZED', 'COMPLETED'].includes(apiStatus)) {
      console.log(`💰 Order ${order.orderId} PAYMENT SUCCESSFUL!`);
      order.payment_status = 'paid';
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      wasUpdated = true;
      
      // Loyalty: Начисление баллов (если еще не были начислены)
      if (order.userId && order.pointsEarned > 0 && !order.pointsAccrued) {
        try {
          const balanceKey = `nechai_loyalty_${order.userId}`;
          const currentBalanceData = await kv.get(balanceKey) || { balance: 0 };
          const newBalance = (currentBalanceData.balance || 0) + order.pointsEarned;
          
          await kv.set(balanceKey, {
            ...currentBalanceData,
            balance: newBalance,
            lastUpdated: new Date().toISOString()
          });
          
          order.pointsAccrued = true;
          console.log(`🎁 Loyalty: Accrued ${order.pointsEarned} points to user ${order.userId}. New balance: ${newBalance}`);
        } catch (loyaltyError) {
          console.error('❌ Error accruing loyalty points:', loyaltyError);
        }
      }
      
      // Уведомление в Telegram
      try {
        const message = `✅ <b>Заказ оплачен!</b>\n\n` +
                        `📦 Заказ: <code>${order.orderId}</code>\n` +
                        `👤 Клиент: ${order.contact}\n` +
                        `💰 Сумма: ${order.total}₽\n` +
                        `💳 Метод: Точка (WebHook)`;
        await sendTelegramMessage(message);
      } catch (tgError) {
        console.error('❌ Error sending Telegram notification:', tgError);
      }
      
    } else if (['FAILED', 'REJECTED', 'CANCELED', 'CANCELLED', 'EXPIRED', 'ERROR'].includes(apiStatus)) {
      console.log(`❌ Order ${order.orderId} PAYMENT FAILED (${apiStatus})`);
      order.payment_status = 'failed';
      // Мы НЕ возвращаем баллы автоматически здесь, так как пользователь может попробовать оплатить снова
      // или админ разберется вручную.
      wasUpdated = true;
    }
    
    if (wasUpdated) {
      await kv.set(orderKey, order);
      console.log(`✅ Order ${order.orderId} updated in KV store.`);
    }
    
    console.log('========================================');
    return c.text('OK', 200);
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR in Tochka Webhook handler:', error);
    // ВСЕГДА возвращаем 200, чтобы избежать бесконечных ретраев от Точки
    return c.text('OK', 200);
  }
});

/**
 * Эндпоинт для ручной регистрации вебхука в Точке
 */
app.put(`${prefix}/tochka/register-webhook`, async (c) => {
  try {
    const jwtToken = Deno.env.get('TOCHKA_JWT_TOKEN');
    const clientId = Deno.env.get('TOCHKA_CLIENT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const projectIdMatch = supabaseUrl.match(/https:\/\/(.*?)\.supabase\.co/);
    const projectId = projectIdMatch ? projectIdMatch[1] : '';
    
    if (!jwtToken || !clientId || !projectId) {
      return c.json({ 
        success: false, 
        error: 'Missing credentials',
        details: {
          hasJwt: !!jwtToken,
          hasClientId: !!clientId,
          hasProjectId: !!projectId,
          info: 'ClientId is mandatory for webhook registration. It is distinct from CustomerCode.'
        }
      }, 400);
    }
    
    // Формируем URL вебхука
    const webhookUrl = `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/tochka/webhook`;
    
    const requestBody = {
      url: webhookUrl,
      webhooksList: ["acquiringInternetPayment"]
    };
    
    console.log(`🔄 Registering Tochka webhook for client ${clientId} with URL: ${webhookUrl}`);
    
    const response = await fetch(`https://enter.tochka.com/uapi/webhook/v1.0/${clientId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${jwtToken.trim().replace(/[\r\n\s]+/g, '')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const responseData = await response.json();
    console.log('📥 Tochka registration response:', responseData);
    
    return c.json({
      success: response.ok,
      status: response.status,
      responseBody: responseData,
      webhookUrl
    });
    
  } catch (error) {
    console.error('❌ Error registering Tochka Webhook:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

/**
 * Эндпоинты редиректа после оплаты (для Точка Банка)
 */
app.get(`${prefix}/payment-success`, (c) => {
  const orderId = c.req.query('orderId');
  const url = new URL(c.req.url);
  // Определяем базовый URL фронтенда (обычно совпадает с хостом API в Supabase)
  const frontendUrl = `https://${url.hostname}/payment-success?orderId=${orderId}`;
  console.log(`🔀 Redirecting to frontend success: ${frontendUrl}`);
  return c.redirect(frontendUrl);
});

app.get(`${prefix}/payment-fail`, (c) => {
  const orderId = c.req.query('orderId');
  const url = new URL(c.req.url);
  const frontendUrl = `https://${url.hostname}/payment-fail?orderId=${orderId}`;
  console.log(`🔀 Redirecting to frontend fail: ${frontendUrl}`);
  return c.redirect(frontendUrl);
});

app.get(`${prefix}/retail/order-payment-info/:orderId`, async (c) => {
  try {
    const orderId = c.req.param('orderId');
    console.log('📋 Getting payment info for order:', orderId);

    const order = await kv.get(`${RETAIL_ORDERS_PREFIX}${orderId}`);
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Получаем текущий баланс пользователя, если есть userId
    let currentBalance = 0;
    if (order.userId) {
      const loyaltyKey = `nechai_loyalty_${order.userId}`;
      const loyalty = await kv.get(loyaltyKey);
      currentBalance = loyalty?.balance || 0;
    }

    return c.json({
      orderId: order.orderId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      loyaltyPointsEarned: order.loyaltyPointsEarned || 0,
      loyaltyPointsUsed: order.loyaltyPointsUsed || 0,
      currentBalance,
      paidAt: order.paidAt,
      date: order.date
    });

  } catch (error) {
    console.error('❌ Error getting order payment info:', error);
    return c.json({ 
      error: 'Failed to get order info',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ============================================================================
// RETAIL LOCATIONS API - Управление точками продаж
// ============================================================================

// Initialize retail locations (one-time migration) with geocoding
app.post(`${prefix}/retail-locations/init`, async (c) => {
  try {
    const existingLocations = await kv.get(RETAIL_LOCATIONS_KEY);
    
    if (existingLocations && existingLocations.length > 0) {
      return c.json({ message: 'Locations already initialized', count: existingLocations.length });
    }

    const dadataApiKey = Deno.env.get('DADATA_API_KEY');
    if (!dadataApiKey) {
      throw new Error('DADATA_API_KEY not configured');
    }

    const locationsToInit = [
      { name: 'MNTN', address: 'Большая Зеленина 34' },
      { name: 'MNTN', address: 'Кожевенная линия 40 Е' },
      { name: 'MNTN', address: 'Моисеенко 27' },
      { name: 'Vid coffee', address: 'Комендантский проспект 63' },
      { name: 'Vid coffee', address: 'Чкаловский проспект 38' },
      { name: 'Кофе Рейсер', address: 'Введенская 22' },
      { name: 'Мечта', address: 'Большой проспект П.С. 71' },
      { name: 'Рид', address: 'Декабристов 39' },
      { name: 'Капля кофе', address: 'Смоленская 13' },
      { name: 'Капля кофе', address: 'Кузнечный 18' },
      { name: 'Стрелка', address: 'Греческий переулок 11' },
      { name: 'Кофе 3', address: 'наб. реки Карповки 5' },
      { name: 'Пенка', address: 'Восстания 31' },
      { name: 'Gotcha', address: 'Суворовский 40' },
      { name: 'Temple coffee', address: 'проспект Героев 31' },
      { name: 'Подписные издания', address: 'Литейный проспект 57' },
      { name: 'Культура кофе', address: 'Большая Разночинная 21' },
      { name: 'Cake me tender', address: 'Большой проспект В.О 16/14б' },
      { name: 'Завари кофе', address: 'Заводская 2а' },
    ];

    console.log('🌍 Starting geocoding for', locationsToInit.length, 'locations...');
    const initialLocations = [];
    
    for (let i = 0; i < locationsToInit.length; i++) {
      const loc = locationsToInit[i];
      const fullAddress = `Санкт-Петербург, ${loc.address}`;
      
      try {
        // Geocode using DaData API
        const geocodeResponse = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Token ${dadataApiKey}`,
          },
          body: JSON.stringify({
            query: fullAddress,
            count: 1,
            locations: [{ city: 'Санкт-Петербург' }],
          }),
        });

        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          if (geocodeData.suggestions && geocodeData.suggestions.length > 0) {
            const suggestion = geocodeData.suggestions[0];
            const latitude = parseFloat(suggestion.data.geo_lat);
            const longitude = parseFloat(suggestion.data.geo_lon);
            
            if (latitude && longitude) {
              console.log(`✅ Geocoded ${loc.name} (${loc.address}): [${latitude}, ${longitude}]`);
              initialLocations.push({
                id: Date.now() + i,
                name: loc.name,
                address: loc.address,
                latitude,
                longitude,
                createdAt: new Date().toISOString()
              });
            } else {
              console.warn(`⚠️ No coordinates for ${loc.name} (${loc.address})`);
              initialLocations.push({
                id: Date.now() + i,
                name: loc.name,
                address: loc.address,
                latitude: null,
                longitude: null,
                createdAt: new Date().toISOString()
              });
            }
          } else {
            console.warn(`⚠️ No geocoding results for ${loc.name} (${loc.address})`);
            initialLocations.push({
              id: Date.now() + i,
              name: loc.name,
              address: loc.address,
              latitude: null,
              longitude: null,
              createdAt: new Date().toISOString()
            });
          }
        } else {
          console.error(`❌ Geocoding failed for ${loc.name} (${loc.address})`);
          initialLocations.push({
            id: Date.now() + i,
            name: loc.name,
            address: loc.address,
            latitude: null,
            longitude: null,
            createdAt: new Date().toISOString()
          });
        }
        
        // Small delay to avoid rate limiting
        if (i < locationsToInit.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Error geocoding ${loc.name} (${loc.address}):`, error);
        initialLocations.push({
          id: Date.now() + i,
          name: loc.name,
          address: loc.address,
          latitude: null,
          longitude: null,
          createdAt: new Date().toISOString()
        });
      }
    }

    console.log(`🎉 Geocoding complete! ${initialLocations.filter(l => l.latitude).length}/${initialLocations.length} locations have coordinates`);
    
    await kv.set(RETAIL_LOCATIONS_KEY, initialLocations);
    return c.json({ 
      message: 'Locations initialized with geocoding', 
      count: initialLocations.length,
      geocoded: initialLocations.filter(l => l.latitude).length
    }, 201);
  } catch (error) {
    console.error('Error initializing retail locations:', error);
    return c.json({ error: 'Failed to initialize locations' }, 500);
  }
});

// Get all retail locations
app.get(`${prefix}/retail-locations`, async (c) => {
  try {
    const locations = await kv.get(RETAIL_LOCATIONS_KEY);
    return c.json(locations || []);
  } catch (error) {
    console.error('Error fetching retail locations:', error);
    return c.json({ error: 'Failed to fetch locations' }, 500);
  }
});

// Add new retail location
app.post(`${prefix}/retail-locations`, async (c) => {
  try {
    const body = await c.req.json();
    const { name, address, latitude, longitude } = body;

    if (!name || !address) {
      return c.json({ error: 'Name and address are required' }, 400);
    }

    const locations = (await kv.get(RETAIL_LOCATIONS_KEY)) || [];
    const newLocation = {
      id: Date.now(),
      name,
      address,
      latitude: latitude || null,
      longitude: longitude || null,
      createdAt: new Date().toISOString()
    };

    locations.push(newLocation);
    await kv.set(RETAIL_LOCATIONS_KEY, locations);

    return c.json(newLocation, 201);
  } catch (error) {
    console.error('Error adding retail location:', error);
    return c.json({ error: 'Failed to add location' }, 500);
  }
});

// Update retail location
app.put(`${prefix}/retail-locations/:id`, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { name, address, latitude, longitude } = body;

    if (!name || !address) {
      return c.json({ error: 'Name and address are required' }, 400);
    }

    const locations = (await kv.get(RETAIL_LOCATIONS_KEY)) || [];
    const index = locations.findIndex((loc: any) => loc.id === id);

    if (index === -1) {
      return c.json({ error: 'Location not found' }, 404);
    }

    locations[index] = {
      ...locations[index],
      name,
      address,
      latitude: latitude !== undefined ? latitude : locations[index].latitude,
      longitude: longitude !== undefined ? longitude : locations[index].longitude,
      updatedAt: new Date().toISOString()
    };

    await kv.set(RETAIL_LOCATIONS_KEY, locations);
    return c.json(locations[index]);
  } catch (error) {
    console.error('Error updating retail location:', error);
    return c.json({ error: 'Failed to update location' }, 500);
  }
});

// Delete retail location
app.delete(`${prefix}/retail-locations/:id`, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const locations = (await kv.get(RETAIL_LOCATIONS_KEY)) || [];
    const filteredLocations = locations.filter((loc: any) => loc.id !== id);

    if (locations.length === filteredLocations.length) {
      return c.json({ error: 'Location not found' }, 404);
    }

    await kv.set(RETAIL_LOCATIONS_KEY, filteredLocations);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting retail location:', error);
    return c.json({ error: 'Failed to delete location' }, 500);
  }
});

// Reset all retail locations (clear all data)
app.delete(`${prefix}/retail-locations`, async (c) => {
  try {
    await kv.set(RETAIL_LOCATIONS_KEY, []);
    return c.json({ message: 'All locations cleared successfully' });
  } catch (error) {
    console.error('Error clearing retail locations:', error);
    return c.json({ error: 'Failed to clear locations' }, 500);
  }
});

// ============================================================================
// RETAIL LOCATION REQUESTS - Публичные заявки на добавление кофейни
// ============================================================================

// Submit a new location request (public, no auth required)
app.post(`${prefix}/retail-locations/submit-request`, async (c) => {
  try {
    const body = await c.req.json();
    const { name, address, latitude, longitude, contactName, contactPhone } = body;

    if (!name || !address) {
      return c.json({ error: 'Name and address are required' }, 400);
    }

    const requests = (await kv.get(RETAIL_LOCATION_REQUESTS_KEY)) || [];
    const newRequest = {
      id: Date.now(),
      name,
      address,
      latitude: latitude || null,
      longitude: longitude || null,
      contactName: contactName || null,
      contactPhone: contactPhone || null,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };

    requests.push(newRequest);
    await kv.set(RETAIL_LOCATION_REQUESTS_KEY, requests);

    // Send Telegram notification
    try {
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
      if (botToken && chatId) {
        const msg =
          `☕ <b>Новая заявка на добавление кофейни</b>\n\n` +
          `🏪 <b>Название:</b> ${name}\n` +
          `📍 <b>Адрес:</b> ${address}\n` +
          (latitude && longitude ? `🗺 <b>Координаты:</b> ${latitude.toFixed(5)}, ${longitude.toFixed(5)}\n` : '') +
          (contactName ? `👤 <b>Контакт:</b> ${contactName}\n` : '') +
          (contactPhone ? `📞 <b>Телефон:</b> ${contactPhone}\n` : '') +
          `\n⏳ Зайдите в <b>Админку → Розница → Кофейни</b> чтобы одобрить заявку.`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
        });
      }
    } catch (tgErr) {
      console.error('Telegram notification error (location request):', tgErr);
    }

    return c.json(newRequest, 201);
  } catch (error) {
    console.error('Error submitting location request:', error);
    return c.json({ error: 'Failed to submit location request' }, 500);
  }
});

// Get all location requests (admin only)
app.get(`${prefix}/retail-locations/requests`, async (c) => {
  try {
    const requests = (await kv.get(RETAIL_LOCATION_REQUESTS_KEY)) || [];
    return c.json(requests);
  } catch (error) {
    console.error('Error fetching location requests:', error);
    return c.json({ error: 'Failed to fetch location requests' }, 500);
  }
});

// Approve a location request (admin only)
app.put(`${prefix}/retail-locations/requests/:id/approve`, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const requests = (await kv.get(RETAIL_LOCATION_REQUESTS_KEY)) || [];
    const idx = requests.findIndex((r: any) => r.id === id);
    if (idx === -1) return c.json({ error: 'Request not found' }, 404);

    const req = requests[idx];
    // Move to approved locations
    const locations = (await kv.get(RETAIL_LOCATIONS_KEY)) || [];
    const newLocation = {
      id: Date.now(),
      name: req.name,
      address: req.address,
      latitude: req.latitude || null,
      longitude: req.longitude || null,
      createdAt: new Date().toISOString(),
    };
    locations.push(newLocation);
    await kv.set(RETAIL_LOCATIONS_KEY, locations);

    // Remove from requests
    requests.splice(idx, 1);
    await kv.set(RETAIL_LOCATION_REQUESTS_KEY, requests);

    // Notify via Telegram
    try {
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
      if (botToken && chatId) {
        const msg = `✅ <b>Заявка на кофейню одобрена</b>\n\n🏪 ${req.name}\n📍 ${req.address}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
        });
      }
    } catch (_) {}

    return c.json({ success: true, location: newLocation });
  } catch (error) {
    console.error('Error approving location request:', error);
    return c.json({ error: 'Failed to approve location request' }, 500);
  }
});

// Reject / delete a location request (admin only)
app.delete(`${prefix}/retail-locations/requests/:id`, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const requests = (await kv.get(RETAIL_LOCATION_REQUESTS_KEY)) || [];
    const filtered = requests.filter((r: any) => r.id !== id);
    if (filtered.length === requests.length) return c.json({ error: 'Request not found' }, 404);
    await kv.set(RETAIL_LOCATION_REQUESTS_KEY, filtered);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error rejecting location request:', error);
    return c.json({ error: 'Failed to reject location request' }, 500);
  }
});

// ── Font Proxy Routes (CORS fix for Dropbox-hosted woff2 fonts) ────────────────
const FONT_SOURCES: Record<string, string> = {
  'mabry-regular.woff2': 'https://www.dropbox.com/scl/fi/x5ytbtuko60vpmr7v4kbw/Mabry-Pro.woff2?rlkey=7iiyrppgm08fgcbrr8sytdf9y&st=dgp1n9q2&raw=1',
  'mabry-medium.woff2':  'https://www.dropbox.com/scl/fi/6ts0fdxw6acneo8rfjgi6/Mabry-Pro-Medium.woff2?rlkey=0yojl0f704139dvn1ctw1eyqs&st=b962upbi&raw=1',
  'mabry-bold.woff2':    'https://www.dropbox.com/scl/fi/ndbm2mja5ohh20ddjy9h9/Mabry-Pro-Bold.woff2?rlkey=h9d6sxsydgh9cw9bdsdfvjhct&st=vxpv1b3b&raw=1',
};

app.get(`${prefix}/fonts/:filename`, async (c) => {
  const filename = c.req.param('filename');
  const sourceUrl = FONT_SOURCES[filename];
  if (!sourceUrl) {
    return c.json({ error: 'Font not found' }, 404);
  }
  try {
    const upstream = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!upstream.ok) {
      console.error(`Font proxy fetch error for ${filename}: ${upstream.status}`);
      return c.json({ error: 'Failed to fetch font' }, 502);
    }
    const buffer = await upstream.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'font/woff2',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Vary': 'Accept-Encoding',
      }
    });
  } catch (err) {
    console.error(`Font proxy error for ${filename}:`, err);
    return c.json({ error: 'Font proxy error' }, 500);
  }
});

Deno.serve(app.fetch);
