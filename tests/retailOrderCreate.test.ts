import { describe, it, expect } from 'vitest';
import { createRetailOrderFromCheckout } from '../server/src/retailOrderCreate.js';

/**
 * Проверяет, что оформление розничного заказа проходит на уровне серверной
 * логики: сумма считается верно, заказ сохраняется и возвращается со статусом
 * pending. Точка/СДЭК не участвуют (нет pvzCode и креды не заданы) — отсутствие
 * платёжной ссылки не должно ломать создание заказа.
 */
describe('createRetailOrderFromCheckout', () => {
  const checkoutPayload = {
    customerName: 'Тест Тестов',
    customerPhone: '+79001234567',
    customerEmail: 'test@example.com',
    items: [
      {
        product: { id: 'p1', name: 'Кофе Эфиопия', category: 'coffee', price: 1877, imageUrl: '' },
        quantity: 4,
        weight: 250,
        roast: 'filter',
        grind: 'whole',
      },
    ],
    deliveryInfo: null,
    usedPoints: 0,
  };

  it('creates a pickup order with correct totals', async () => {
    const order = await createRetailOrderFromCheckout(checkoutPayload);

    expect(order.orderId).toBeTruthy();
    expect(order.orderType).toBe('retail');
    expect(order.status).toBe('pending');
    expect(order.paymentStatus).toBe('pending');
    expect(order.delivery_method).toBe('pickup');
    expect(order.subtotal).toBe(7508);
    expect(order.total).toBe(7508);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].subtotal).toBe(7508);
  });

  it('rejects a payload without required fields', async () => {
    await expect(
      createRetailOrderFromCheckout({ items: [], customerName: '', customerPhone: '' }),
    ).rejects.toThrow(/Missing required fields/);
  });
});
