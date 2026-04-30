import type { RetailProduct } from '../lib/api';

export interface RetailCartItem {
  product: RetailProduct;
  weight: string;
  roast: string;
  grind: string;
  quantity: number;
}
