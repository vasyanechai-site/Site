export interface CoffeeItem {
  id: string;
  name: string;
  country: string;
  process: string;
  category: string;
  type: 'grain' | 'drip' | 'coldbrew'; // Тип товара: зерно, дрипы или колд брю
  descriptors?: string;
  qScore?: number;
  badge?: 'new' | 'hit' | 'rare' | 'favorite' | 'soldout' | 'comingsoon';
  price_usd_kg: number; // Цена в долларах за кг/упаковку/5л
  price_usd_200: number; // Цена в долларах за 200г/шт (0 для coldbrew)
  price_kg: number; // Рассчитанная цена в рублях (за кг / упак. / 5л)
  price_200: number; // Рассчитанная цена в рублях (за 200г / шт, 0 для coldbrew)
  published?: boolean;
  no_discount?: boolean;
}

export interface CartItem {
  id: string;
  name: string;
  category?: string;
  type?: 'grain' | 'drip' | 'coldbrew'; // Тип товара
  kg: number;      // кг для зерна, упаковки для дрипов, контейнеры 5л для колд брю
  packs200: number; // 200г пачки для зерна, штуки для дрипов; 0 для колд брю
  subtotal: number;
  priceKg?: number;  // цена за кг / упак / 5л
  price200?: number; // цена за 200г / шт; 0 для колд брю
  no_discount?: boolean; // не применять скидку к этой позиции
}

export interface Order {
  orderId: string;
  orderNumber?: string;
  date: string;
  orderType?: 'wholesale' | 'retail'; // Тип заказа: опт или розница
  company: string;
  inn: string;
  account: string;
  bik: string;
  contact: string;
  phone: string;
  address: string; // Юридический адрес (для обратной совместимости)
  legal_address?: string; // Юридический адрес (новое поле)
  delivery_address?: string; // Адрес доставки (новое поле)
  delivery_company: string;
  delivery_method: string;
  items: CartItem[];
  total: number;
  userId?: string; // ID пользователя, который сделал заказ
  invoiceId?: string;
  invoiceCreatedAt?: string;
  invoiceUrl?: string; // Ссылка на счет в Точка Банке
  invoiceNumber?: string; // Порядковый номер счёта, например "01-1", "01-2", ...
}

export interface OrderFormData {
  company: string;
  inn: string;
  account: string;
  bik: string;
  contact: string;
  phone: string;
  address: string; // Юридический адрес (для обратной совместимости, будет заполняться автоматически из DaData)
  delivery_address: string; // Адрес доставки
  delivery_company: string;
  delivery_method: string;
  promoCode?: string;
}

// Интерфейс для розничных заказов
export interface RetailOrder {
  orderId: string;
  orderNumber?: string;
  date: string;
  orderType: 'retail';
  contact: string;
  phone: string;
  email?: string;
  delivery_address: string;
  delivery_method: string; // 'delivery' | 'pickup'
  items: RetailCartItem[];
  total: number;
  status?: 'pending' | 'processing' | 'completed' | 'cancelled';
  paymentStatus?: 'pending' | 'paid' | 'failed';
  notes?: string;
  userId?: string; // ID пользователя (если авторизован)
  tochkaRequestId?: string; // ID платежного запроса в Точка Банк
  tochkaPaymentUrl?: string; // Ссылка на оплату в Точка Банк
  tochkaCreatedAt?: string; // Когда была создана платежная ссылка
  loyaltyPointsUsed?: number; // Сколько баллов использовано
  loyaltyPointsEarned?: number; // Сколько баллов начислено
  loyaltyPointsAwarded?: boolean; // Были ли начислены баллы
  loyaltyPointsDeducted?: boolean; // Были ли списаны баллы
  paidAt?: string; // Когда был оплачен
}

// Интерфейс для товаров розничной корзины
export interface RetailCartItem {
  id: string;
  name: string;
  category?: string;
  price: number;
  quantity: number;
  weight?: string; // Например: "200гр", "1000гр"
  grind?: string; // Например: "В зернах", "Под эспрессо"
  subtotal: number;
  imageUrl?: string;
}

export interface User {
  id: string;
  phone: string;
  password: string;
  email?: string; // Email пользователя (для уведомлений и связи)
  company_name?: string; // Имя организации
  discount?: number; // Персональная скидка пользователя в процентах (1-100)
  loyaltyLevel?: number; // 0, 1, 2, 3
  loyaltyLevelSetDate?: string; // ISO Date string when the level was set
  loyaltyLevelManualOverride?: boolean; // true = уровень задан вручную админом, false = авто по кг
  created_at?: string;
  role?: string;
  agent_id?: string; // ID агента, который создал этого пользователя (если создан агентом)
}

export interface ExchangeRate {
  usd_to_rub: number; // Курс доллара к рублю
  updated_at?: string;
}

export interface AuthUser {
  id: string;
  phone: string;
  company_name?: string;
  discount?: number;
  role?: string;
}

export interface PromoCode {
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
  createdAt?: string;
}