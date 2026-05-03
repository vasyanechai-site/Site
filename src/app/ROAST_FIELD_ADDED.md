> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# Добавлено поле "Обжарка" в Telegram-уведомления о розничных заказах

## Проблема
В Telegram-сообщениях о новых розничных заказах не указывалась информация об обжарке (Эспрессо/Фильтр/Омни), которую пользователь выбрал при оформлении заказа. Отображались только вес и помол.

## Решение
Добавлено поле `roast` (обжарка) во все части флоу розничного заказа:

### 1. Frontend изменения

#### `/components/RetailCart.tsx`
- Добавлено поле `roast: string` в интерфейс `RetailCartItem`

#### `/components/RetailStorefront.tsx`
- Обновлена функция `handleAddToCart` для принятия параметра `roast`
- Обновлены функции `handleUpdateQuantity` и `handleRemoveItem` для учета `roast`
- Обновлены все вызовы этих функций

#### `/components/RetailProductDetail.tsx`
- Обновлены интерфейсы `onAddToCart` и `onUpdateQuantity` для передачи `roast`
- Обновлена функция `getCurrentVariantInCart` для проверки `roast` при поиске товара в корзине
- Все вызовы `onAddToCart` и `onUpdateQuantity` теперь передают `selectedRoast`

#### `/components/RetailCartPage.tsx`
- Обновлены интерфейсы пропсов для `onUpdateQuantity` и `onRemoveItem`
- Добавлено отображение badge с обжаркой в списке товаров корзины
- Обновлены все вызовы функций изменения корзины

### 2. Backend изменения

#### `/supabase/functions/server/index.tsx`
- В функции создания розничного заказа добавлено сохранение поля `roast` из входящих данных:
  ```typescript
  const formattedItems = items.map((item: any) => ({
    id: item.product.id,
    name: item.product.name,
    category: item.product.category,
    price: item.product.price,
    quantity: item.quantity,
    weight: item.weight,
    roast: item.roast,  // ← ДОБАВЛЕНО
    grind: item.grind,
    subtotal: item.product.price * item.quantity,
    imageUrl: item.product.imageUrl
  }));
  ```

- Обновлено формирование Telegram-сообщения для включения обжарки:
  ```typescript
  const itemsList = order.items.map((item: any, index: number) => {
    const weightText = item.weight ? ` (${item.weight})` : '';
    const roastText = item.roast ? ` - ${item.roast}` : '';  // ← ДОБАВЛЕНО
    const grindText = item.grind ? ` - ${item.grind}` : '';
    return `${index + 1}. ${item.name}${weightText}${roastText}${grindText} × ${item.quantity} шт. — ${item.subtotal.toLocaleString('ru-RU')} ₽`;
  }).join('\n');
  ```

#### `/supabase/functions/server/telegram_message_formatter.tsx`
- Аналогично обновлена функция `formatRetailOrderTelegramMessage` для добавления `roastText`

## Результат
Теперь в Telegram-уведомлениях о розничных заказах отображается полная информация о каждой позиции:
```
Состав заказа:
1. Бразилия Серрадо (200гр) - Эспрессо - В зернах × 1 шт. — 690 ₽
2. Эфиопия Сидамо (200гр) - Фильтр - В зернах × 1 шт. — 669 ₽
```

Вместо предыдущего формата:
```
Состав заказа:
1. Бразилия Серрадо (200гр) - В зернах × 1 шт. — 690 ₽
2. Эфиопия Сидамо (200гр) - В зернах × 1 шт. — 669 ₽
```

## Файлы изменены
1. `/components/RetailCart.tsx`
2. `/components/RetailStorefront.tsx`
3. `/components/RetailProductDetail.tsx`
4. `/components/RetailCartPage.tsx`
5. `/supabase/functions/server/index.tsx`
6. `/supabase/functions/server/telegram_message_formatter.tsx`

## Совместимость
Изменения обратно совместимы - если поле `roast` отсутствует в старых заказах, оно просто не отображается (благодаря условной проверке `item.roast ? ... : ''`).
