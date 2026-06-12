import { CartItem } from '../types';
import { formatWholesaleItemQuantity } from '../lib/wholesaleUnits';
import { Button } from './ui/button';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useState } from 'react';

interface OrderCheckoutProps {
  items: CartItem[];
  total: number;
  onCheckout: () => void;
  disabled: boolean;
  isMobile?: boolean;
  totalKg?: number;
  minOrderError?: boolean;
  discountPercent?: number;
  finalTotal?: number;
  onRemoveItem?: (itemId: string) => void;
}

export function OrderCheckout({ 
  items, 
  total, 
  onCheckout, 
  disabled, 
  isMobile, 
  totalKg = 0, 
  minOrderError = false,
  discountPercent = 0,
  finalTotal = 0,
  onRemoveItem
}: OrderCheckoutProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDiscount = discountPercent > 0;
  const discountAmount = Math.round(total * discountPercent / 100);
  const displayTotal = hasDiscount ? finalTotal : total;

  if (isMobile) {
    return (
      <div className="px-6 pt-4 pb-8">
        {/* Заголовок с итого - кликабельный для раскрытия */}
        <button 
          onClick={() => items.length > 0 && setIsExpanded(!isExpanded)}
          className={`flex items-center justify-between mb-3 w-full ${items.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-foreground">Итого:</span>
            {items.length > 0 && (
              <span className="text-muted-foreground text-xs">
                ({items.length} {items.length === 1 ? 'позиция' : items.length < 5 ? 'позиции' : 'позиций'})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-foreground">{displayTotal.toLocaleString('ru-RU')} ₽</span>
            {items.length > 0 && (
              isExpanded ? <ChevronUp className="w-4 h-4 text-foreground" /> : <ChevronDown className="w-4 h-4 text-foreground" />
            )}
          </div>
        </button>

        {/* Раскрывающийся список позиций */}
        {isExpanded && items.length > 0 && (
          <div className="mb-3 border-t border-border pt-3">
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="border-b border-border pb-3 last:border-b-0 relative">
                  <div className="text-foreground text-sm mb-1 pr-6">
                    {item.name}
                    {item.category && <span className="text-muted-foreground text-xs ml-2">({item.category})</span>}
                  </div>
                  <div className="flex justify-between text-xs pr-6">
                    <span className="text-muted-foreground">
                      {formatWholesaleItemQuantity(item)}
                    </span>
                    <span className="text-foreground">{item.subtotal.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  {onRemoveItem && (
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="absolute top-0 right-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                      title="Удалить из корзины"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {hasDiscount && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Сумма:</span>
                  <span className="text-muted-foreground">{total.toLocaleString('ru-RU')} ₽</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Скидка {discountPercent}%:</span>
                  <span className="text-muted-foreground">–{discountAmount.toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>
            )}
          </div>
        )}

        {minOrderError && (
          <div className="mb-3 text-destructive text-sm text-center">
            Минимальный заказ от 5 кг
          </div>
        )}
        <Button 
          onClick={onCheckout} 
          disabled={disabled}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          Оформить заказ
        </Button>
      </div>
    );
  }

  return (
    <div className="sticky top-8 border border-border rounded-lg p-6">
      <h3 className="text-foreground mb-6">Ваш заказ</h3>
      
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center">
          <img 
            src="https://optim.tildacdn.com/tild3266-6237-4839-b232-653738353439/-/resize/400x/-/format/webp/photo.png.webp" 
            alt="Пустая корзина"
            className="w-[150px] h-[150px] object-contain"
          />
          <span className="text-muted-foreground">Корзина пуста</span>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {items.map((item) => (
            <div key={item.id} className="border-b border-border pb-4 relative">
              <div className="text-foreground mb-2 pr-6">
                {item.name}
                {item.category && <span className="text-muted-foreground text-sm ml-2">({item.category})</span>}
              </div>
              <div className="flex justify-between text-sm pr-6">
                <span className="text-muted-foreground">
                  {formatWholesaleItemQuantity(item)}
                </span>
                <span className="text-foreground">{item.subtotal.toLocaleString('ru-RU')} ₽</span>
              </div>
              {onRemoveItem && (
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="absolute top-0 right-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="Удалить из корзины"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pt-4 mb-6">
        {hasDiscount && (
          <div className="mb-3 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Сумма:</span>
              <span className="text-muted-foreground">{total.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Скидка {discountPercent}%:</span>
              <span className="text-muted-foreground">–{discountAmount.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="border-t border-border pt-3"></div>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-foreground">Итого:</span>
          <span className="text-foreground text-2xl">{displayTotal.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

      {minOrderError && (
        <div className="mb-4 text-destructive text-sm text-center">
          Минимальный заказ от 5 кг
        </div>
      )}

      <Button 
        onClick={onCheckout} 
        disabled={disabled}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
      >
        Оформить заказ
      </Button>
    </div>
  );
}