import { CoffeeItem } from '../types';
import { Minus, Plus, Heart } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { motion } from "motion/react";

interface CoffeeTableProps {
  items: CoffeeItem[];
  cart: Map<string, { kg: number; packs200: number }>;
  onQuantityChange: (id: string, kg: number, packs200: number) => void;
  type?: 'grain' | 'drip' | 'coldbrew'; // Тип таблицы
  userDiscount?: number;
  /** Оптовик без заказов — пометка * у названий с no_discount */
  showFirstOrderNoDiscountMark?: boolean;
  favoriteIds?: string[];
  onToggleFavorite?: (itemId: string) => void;
  onRemoveFromFavorites?: (itemId: string) => void;
  showRemoveButton?: boolean;
  userId?: string;
}

export function CoffeeTable({ items, cart, onQuantityChange, type = 'grain', userDiscount = 0, showFirstOrderNoDiscountMark = false, favoriteIds = [], onToggleFavorite, onRemoveFromFavorites, showRemoveButton, userId }: CoffeeTableProps) {
  const getQuantities = (id: string) => {
    return cart.get(id) || { kg: 0, packs200: 0 };
  };

  const calculatePrice = (price: number, noDiscount?: boolean) => {
    if (!userDiscount || noDiscount) return price;
    return Math.round(price * (1 - userDiscount / 100));
  };

  const renderNoDiscountMark = (item: CoffeeItem) => {
    if (!showFirstOrderNoDiscountMark || !item.no_discount) return null;
    return (
      <sup className="ml-0.5 text-[10px] leading-none text-muted-foreground" aria-hidden>
        *
      </sup>
    );
  };

  const renderPrice = (basePrice: number, noDiscount?: boolean) => {
    if (userDiscount > 0 && !noDiscount) {
      return (
        <div className="flex flex-col items-end">
          <span className="text-xs line-through text-muted-foreground whitespace-nowrap">
            {basePrice.toLocaleString('ru-RU')} ₽
          </span>
          <span className="whitespace-nowrap">
            {calculatePrice(basePrice, noDiscount).toLocaleString('ru-RU')} ₽
          </span>
        </div>
      );
    }
    return (
      <span className="whitespace-nowrap">
        {basePrice.toLocaleString('ru-RU')} ₽
        {!showFirstOrderNoDiscountMark && userDiscount > 0 && noDiscount ? (
          <sup className="text-muted-foreground ml-0.5">*</sup>
        ) : null}
      </span>
    );
  };

  const renderMobilePrice = (basePrice: number, noDiscount?: boolean) => {
    if (userDiscount > 0 && !noDiscount) {
      return (
        <span className="flex gap-2">
          <span className="line-through text-muted-foreground">{basePrice.toLocaleString('ru-RU')}</span>
          <span>{calculatePrice(basePrice, noDiscount).toLocaleString('ru-RU')} ₽</span>
        </span>
      );
    }
    return (
      <span>
        {basePrice.toLocaleString('ru-RU')} ₽
        {!showFirstOrderNoDiscountMark && userDiscount > 0 && noDiscount ? (
          <sup className="text-muted-foreground ml-0.5">*</sup>
        ) : null}
      </span>
    );
  };

  const getBadgeStyles = (badge?: 'new' | 'hit' | 'rare' | 'favorite' | 'soldout' | 'comingsoon') => {
    if (!badge) return null;
    
    const styles = {
      new: { 
        className: 'bg-blue-100/80 text-blue-700 dark:text-blue-400 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800', 
        text: 'Новинка' 
      },
      hit: { 
        className: 'bg-[#FFB800]/10 text-[#FFB800] dark:text-[#FFD700] border border-[#FFB800]/20', 
        text: 'Хит' 
      },
      rare: { 
        className: 'bg-[#93ADDA]/10 text-[#5A74A0] dark:text-[#93ADDA] border border-[#93ADDA]/20', 
        text: 'Редкий' 
      },
      favorite: { 
        className: 'bg-[#F47D37]/10 text-[#C45D17] dark:text-[#F47D37] border border-[#F47D37]/20', 
        text: 'Любимый' 
      },
      soldout: { 
        className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20', 
        text: 'Sold out' 
      },
      comingsoon: { 
        className: 'bg-purple-100/80 text-purple-700 dark:text-purple-400 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800', 
        text: 'Скоро' 
      },
    };
    
    return styles[badge];
  };

  const handleKgChange = (id: string, newKg: number) => {
    const quantities = getQuantities(id);
    onQuantityChange(id, Math.max(0, newKg), quantities.packs200);
  };

  const handlePacks200Change = (id: string, newPacks: number) => {
    const quantities = getQuantities(id);
    onQuantityChange(id, quantities.kg, Math.max(0, newPacks));
  };

  const isItemInCart = (id: string) => {
    const quantities = getQuantities(id);
    return quantities.kg > 0 || quantities.packs200 > 0;
  };

  // Получить названия колонок в зависимости от типа
  const getPrice1Label = () => type === 'drip' ? 'Цена за упаковку (10 шт)' : type === 'coldbrew' ? 'Цена за 5 л' : 'Цена за кг';
  const getPrice2Label = () => type === 'drip' ? 'Цена за шт.' : 'Цена за 200 г';
  const getQty1Label = () => type === 'drip' ? 'Количество (упаковки)' : type === 'coldbrew' ? 'Количество (шт.)' : 'Количество (кг)';
  const getQty2Label = () => type === 'drip' ? 'Количество (шт.)' : 'Количество (200 г)';

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden lg:block border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-4 text-foreground font-normal text-sm min-w-[160px]">Название</th>
                <th className="text-left px-4 py-4 text-foreground font-normal text-sm w-[100px]">Обработка</th>
                <th className="text-left px-4 py-4 text-foreground font-normal text-sm w-[190px]">Дескрипторы</th>
                <th className="text-center px-4 py-4 text-foreground font-normal text-sm w-[90px]">Оценка Q</th>
                <th className="text-right px-4 py-4 text-foreground font-normal text-sm w-[160px]">{getPrice1Label()}</th>
                <th className="text-center px-4 py-4 text-foreground font-normal text-sm">{getQty1Label()}</th>
                {type !== 'coldbrew' && <th className="text-right px-4 py-4 text-foreground font-normal text-sm w-[160px]">{getPrice2Label()}</th>}
                {type !== 'coldbrew' && <th className="text-center px-4 py-4 text-foreground font-normal text-sm">{getQty2Label()}</th>}
                {userId && !showRemoveButton && (
                  <th className="text-center px-4 py-4 text-foreground font-normal text-sm w-[60px]"></th>
                )}
                {userId && showRemoveButton && (
                  <th className="text-center px-4 py-4 text-foreground font-normal text-sm w-[60px]"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const quantities = getQuantities(item.id);
                const inCart = isItemInCart(item.id);
                
                return (
                  <motion.tr 
                    key={item.id} 
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-10px" }}
                    transition={{ 
                      duration: 0.3, 
                      delay: index * 0.03, // Small stagger
                      ease: "easeOut"
                    }}
                    className={`border-b border-border transition-colors ${
                      inCart ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-muted/50'
                    }`}
                  >
                    <td className="px-4 py-5">
                      <div>
                        {item.badge && (() => {
                          const badgeStyle = getBadgeStyles(item.badge);
                          return badgeStyle ? (
                            <div 
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${badgeStyle.className}`}
                            >
                              {badgeStyle.text}
                            </div>
                          ) : null;
                        })()}
                        <div className="text-foreground text-sm">
                          {item.name}
                          {renderNoDiscountMark(item)}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-foreground text-sm w-[100px]">{item.process}</td>
                    <td className="px-4 py-5 text-foreground text-sm w-[190px]">{item.descriptors || '—'}</td>
                    <td className="px-4 py-5 text-center text-foreground text-sm w-[90px]">{item.qScore || '—'}</td>
                    <td className="px-4 py-5 text-right w-[160px]">
                      <div className="text-foreground text-sm whitespace-nowrap">
                        {renderPrice(item.price_kg, item.no_discount)}
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-md"
                          onClick={() => handleKgChange(item.id, quantities.kg - 1)}
                          disabled={quantities.kg === 0 || item.badge === 'soldout' || item.badge === 'comingsoon'}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          value={quantities.kg}
                          onChange={(e) => handleKgChange(item.id, parseInt(e.target.value) || 0)}
                          className="w-16 text-center h-9"
                          min="0"
                          disabled={item.badge === 'soldout' || item.badge === 'comingsoon'}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-md"
                          onClick={() => handleKgChange(item.id, quantities.kg + 1)}
                          disabled={item.badge === 'soldout' || item.badge === 'comingsoon'}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                    {type !== 'coldbrew' && (
                      <td className="px-4 py-5 text-right w-[160px]">
                        <div className="text-foreground text-sm whitespace-nowrap">
                          {renderPrice(item.price_200, item.no_discount)}
                        </div>
                      </td>
                    )}
                    {type !== 'coldbrew' && (
                      <td className="px-4 py-5">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-md"
                            onClick={() => handlePacks200Change(item.id, quantities.packs200 - 1)}
                            disabled={quantities.packs200 === 0 || item.badge === 'soldout' || item.badge === 'comingsoon'}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            value={quantities.packs200}
                            onChange={(e) => handlePacks200Change(item.id, parseInt(e.target.value) || 0)}
                            className="w-16 text-center h-9"
                            min="0"
                            disabled={item.badge === 'soldout' || item.badge === 'comingsoon'}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-md"
                            onClick={() => handlePacks200Change(item.id, quantities.packs200 + 1)}
                            disabled={item.badge === 'soldout' || item.badge === 'comingsoon'}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                    {userId && !showRemoveButton && (
                      <td className="px-4 py-5 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => onToggleFavorite?.(item.id)}
                        >
                          <motion.div
                            whileTap={{ scale: 1.2 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                          >
                            <Heart
                              className={`h-5 w-5 transition-all duration-200 ${
                                favoriteIds.includes(item.id)
                                  ? 'fill-red-500 text-red-500'
                                  : 'text-muted-foreground hover:text-red-500'
                              }`}
                            />
                          </motion.div>
                        </Button>
                      </td>
                    )}
                    {userId && showRemoveButton && (
                      <td className="px-4 py-5 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => onRemoveFromFavorites?.(item.id)}
                        >
                          <motion.div
                            whileTap={{ scale: 1.2 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                          >
                            <Heart
                              className="h-5 w-5 fill-red-500 text-red-500 transition-all duration-200 hover:opacity-70"
                            />
                          </motion.div>
                        </Button>
                      </td>
                    )}
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {items.map((item, index) => {
          const quantities = getQuantities(item.id);
          const inCart = isItemInCart(item.id);
          
          const label1 = type === 'drip' ? 'Упаковка (10 шт.)' : type === 'coldbrew' ? '5 л' : '1 кг';
          const label2 = type === 'drip' ? 'Шт.' : '200 г';
          
          return (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10px" }}
              transition={{ 
                duration: 0.3, 
                delay: index * 0.03,
                ease: "easeOut"
              }}
              className={`border border-border rounded-lg p-4 transition-colors ${
                inCart ? 'bg-primary/10 dark:bg-primary/20' : 'bg-card'
              }`}
            >
              {/* Название и обработка */}
              <div className="mb-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {item.badge && (() => {
                      const badgeStyle = getBadgeStyles(item.badge);
                      return badgeStyle ? (
                        <div 
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${badgeStyle.className}`}
                        >
                          {badgeStyle.text}
                        </div>
                      ) : null;
                    })()}
                    <div className="text-sm font-medium text-foreground mb-1">
                      {item.name}
                      {renderNoDiscountMark(item)}
                    </div>
                  </div>
                  {userId && !showRemoveButton && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 -mt-1 -mr-1"
                      onClick={() => onToggleFavorite?.(item.id)}
                    >
                      <motion.div
                        whileTap={{ scale: 1.2 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      >
                        <Heart
                          className={`h-4 w-4 transition-all duration-200 ${
                            favoriteIds.includes(item.id)
                              ? 'fill-red-500 text-red-500'
                              : 'text-muted-foreground'
                          }`}
                        />
                      </motion.div>
                    </Button>
                  )}
                  {userId && showRemoveButton && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 -mt-1 -mr-1"
                      onClick={() => onRemoveFromFavorites?.(item.id)}
                    >
                      <motion.div
                        whileTap={{ scale: 1.2 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      >
                        <Heart
                          className="h-4 w-4 fill-red-500 text-red-500 transition-all duration-200 hover:opacity-70"
                        />
                      </motion.div>
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-xs text-muted-foreground">{item.process}</div>
                  {item.qScore && (
                    <div className="text-xs text-muted-foreground">Q: {item.qScore}</div>
                  )}
                </div>
                {item.descriptors && (
                  <div className="text-xs text-muted-foreground">{item.descriptors}</div>
                )}
              </div>

              {/* Блоки */}
              <div className={`grid ${type === 'coldbrew' ? 'grid-cols-1' : 'grid-cols-2'} gap-3 border-t border-border pt-3`}>
                {/* Первый блок (5л / кг / упак) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{label1}</span>
                    <span className="text-xs text-foreground">
                      {renderMobilePrice(item.price_kg, item.no_discount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-md flex-shrink-0"
                      onClick={() => handleKgChange(item.id, quantities.kg - 1)}
                      disabled={quantities.kg === 0 || item.badge === 'soldout' || item.badge === 'comingsoon'}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      value={quantities.kg}
                      onChange={(e) => handleKgChange(item.id, parseInt(e.target.value) || 0)}
                      className="flex-1 text-center h-7 text-xs px-1"
                      min="0"
                      disabled={item.badge === 'soldout' || item.badge === 'comingsoon'}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-md flex-shrink-0"
                      onClick={() => handleKgChange(item.id, quantities.kg + 1)}
                      disabled={item.badge === 'soldout' || item.badge === 'comingsoon'}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Второй блок — скрыт для coldbrew */}
                {type !== 'coldbrew' && <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{label2}</span>
                    <span className="text-xs text-foreground">
                      {renderMobilePrice(item.price_200, item.no_discount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-md flex-shrink-0"
                      onClick={() => handlePacks200Change(item.id, quantities.packs200 - 1)}
                      disabled={quantities.packs200 === 0 || item.badge === 'soldout' || item.badge === 'comingsoon'}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      value={quantities.packs200}
                      onChange={(e) => handlePacks200Change(item.id, parseInt(e.target.value) || 0)}
                      className="flex-1 text-center h-7 text-xs px-1"
                      min="0"
                      disabled={item.badge === 'soldout' || item.badge === 'comingsoon'}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-md flex-shrink-0"
                      onClick={() => handlePacks200Change(item.id, quantities.packs200 + 1)}
                      disabled={item.badge === 'soldout' || item.badge === 'comingsoon'}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}