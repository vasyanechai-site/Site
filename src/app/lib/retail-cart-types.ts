/**
 * Типы для корзины розничного магазина
 * Эти типы будут использоваться при реализации корзины и оформления заказа
 */

import type { RetailProduct } from './api';

/**
 * Элемент корзины розничного магазина
 * Содержит товар и выбранные покупателем опции
 */
export interface RetailCartItem {
  /** ID товара */
  productId: string;
  
  /** Данные товара */
  product: RetailProduct;
  
  /** Выбранный вес (например: "200гр", "1000гр") */
  selectedWeight: string;
  
  /** Выбранная обжарка (например: "Фильтр", "Эспрессо") */
  selectedRoast: string;
  
  /** Выбранный помол (например: "В зернах", "Для турки", "Для эспрессо") */
  selectedGrind: string;
  
  /** Количество единиц товара */
  quantity: number;
  
  /** Цена за единицу (может варьироваться в зависимости от веса) */
  unitPrice: number;
  
  /** Общая стоимость (unitPrice * quantity) */
  totalPrice: number;
}

/**
 * Розничный заказ
 * Сохраняется в базе данных при оформлении
 */
export interface RetailOrder {
  /** ID заказа */
  id: string;
  
  /** Email покупателя */
  email: string;
  
  /** Имя покупателя */
  name: string;
  
  /** Телефон покупателя */
  phone: string;
  
  /** Адрес доставки (опционально) */
  address?: string;
  
  /** Элементы заказа с выбранными параметрами */
  items: RetailCartItem[];
  
  /** Общая сумма заказа */
  totalAmount: number;
  
  /** Статус заказа */
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  
  /** Дата создания */
  createdAt: string;
  
  /** Дата обновления */
  updatedAt: string;
  
  /** Комментарий к заказу */
  comment?: string;
}
