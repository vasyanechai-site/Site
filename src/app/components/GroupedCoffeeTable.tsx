import { CoffeeItem } from '../types';
import { CoffeeTable } from './CoffeeTable';
import { FadeIn } from './ui/fade-in';
import { cn } from './ui/utils';

interface GroupedCoffeeTableProps {
  items: CoffeeItem[];
  cart: Map<string, { kg: number; packs200: number }>;
  onQuantityChange: (id: string, kg: number, packs200: number) => void;
  sortOrder: string;
  userDiscount?: number;
  favoriteIds?: string[];
  onToggleFavorite?: (itemId: string) => void;
  onRemoveFromFavorites?: (itemId: string) => void;
  showRemoveButton?: boolean;
  userId?: string;
}

// Colors based on Badges:
// Favorite (Orange): #F47D37
// Rare (Blue): #93ADDA
// Hit (Purple): #B6ABD4
// New (Pink): #F597A1

const CATEGORY_STYLES: Record<string, { 
  color: string; 
  bg: string; 
  border: string;
}> = {
  'Эспрессо': {
    color: 'text-[#C45D17] dark:text-[#F47D37]',
    bg: 'bg-[#F47D37]/10',
    border: 'border-[#F47D37]',
  },
  'Фильтр': {
    color: 'text-[#5A74A0] dark:text-[#93ADDA]',
    bg: 'bg-[#93ADDA]/10',
    border: 'border-[#93ADDA]',
  },
  'Дрип': {
    color: 'text-[#7D729C] dark:text-[#B6ABD4]',
    bg: 'bg-[#B6ABD4]/10',
    border: 'border-[#B6ABD4]',
  },
  'Молоко': {
    color: 'text-[#C46B75] dark:text-[#F597A1]',
    bg: 'bg-[#F597A1]/10',
    border: 'border-[#F597A1]',
  },
  'Колд брю': {
    color: 'text-[#0E7490] dark:text-[#22D3EE]',
    bg: 'bg-[#22D3EE]/10',
    border: 'border-[#22D3EE]',
  },
};

const DEFAULT_STYLE = {
  color: 'text-slate-600 dark:text-slate-400',
  bg: 'bg-slate-200/30 dark:bg-slate-800/30',
  border: 'border-slate-300 dark:border-slate-700',
};

export function GroupedCoffeeTable({ items, cart, onQuantityChange, sortOrder, userDiscount = 0, favoriteIds = [], onToggleFavorite, onRemoveFromFavorites, showRemoveButton, userId }: GroupedCoffeeTableProps) {
  // Функция сортировки
  const sortItems = (items: CoffeeItem[]) => {
    if (sortOrder === 'asc') {
      return [...items].sort((a, b) => a.price_kg - b.price_kg);
    } else if (sortOrder === 'desc') {
      return [...items].sort((a, b) => b.price_kg - a.price_kg);
    }
    return items;
  };

  // Группируем товары по типу и категориям
  const grainItems = items.filter(item => !item.type || item.type === 'grain');
  const dripItems = items.filter(item => item.type === 'drip');
  const coldBrewItems = items.filter(item => item.type === 'coldbrew');

  // Группируем зерновые товары по категориям
  const groupedGrainItems = grainItems.reduce((acc, item) => {
    const category = item.category || 'Без категории';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, CoffeeItem[]>);

  // Сохраняем порядок категорий из массива (не алфавитный)
  const seenCats = new Set<string>();
  const grainCategories: string[] = [];
  grainItems.forEach(item => {
    const cat = item.category || 'Без категории';
    if (!seenCats.has(cat)) { seenCats.add(cat); grainCategories.push(cat); }
  });

  if (grainCategories.length === 0 && dripItems.length === 0 && coldBrewItems.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Товары не найдены
      </div>
    );
  }

  const renderCategoryHeader = (category: string, itemCount: number) => {
    const style = CATEGORY_STYLES[category] || DEFAULT_STYLE;

    return (
      <div className={cn(
        "flex items-center gap-3 mb-4 p-3 rounded-lg border transition-colors",
        style.bg,
        style.border
      )}>
        <div className="flex items-baseline gap-3">
          <h3 className={cn("text-base sm:text-xl", style.color)}>
            {category}
          </h3>
          <span className={cn("text-xs opacity-80", style.color)}>
            {itemCount} {itemCount === 1 ? 'позиция' : itemCount < 5 ? 'позиции' : 'позиций'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12">
      {/* Зерновой кофе по категориям */}
      {grainCategories.map((category, index) => {
        // Подсчитываем только товары без бейджа "soldout"
        const availableItemsCount = groupedGrainItems[category].filter(item => item.badge !== 'soldout').length;
        
        return (
          <FadeIn key={category} delay={0.1 + (index * 0.05)}>
            <section className="relative">
              {renderCategoryHeader(category, availableItemsCount)}
              <div className="pl-1">
                <CoffeeTable
                  items={sortItems(groupedGrainItems[category])}
                  cart={cart}
                  onQuantityChange={onQuantityChange}
                  type="grain"
                  userDiscount={userDiscount}
                  favoriteIds={favoriteIds}
                  onToggleFavorite={onToggleFavorite}
                  onRemoveFromFavorites={onRemoveFromFavorites}
                  showRemoveButton={showRemoveButton}
                  userId={userId}
                />
              </div>
            </section>
          </FadeIn>
        );
      })}

      {/* Дрипы отдельно */}
      {dripItems.length > 0 && (() => {
        // Подсчитываем только товары без бейджа "soldout"
        const availableDripItemsCount = dripItems.filter(item => item.badge !== 'soldout').length;
        
        return (
          <FadeIn delay={0.1 + (grainCategories.length * 0.05)}>
            <section className="relative">
              {renderCategoryHeader("Дрип", availableDripItemsCount)}
              <div className="pl-1">
                <CoffeeTable
                  items={sortItems(dripItems)}
                  cart={cart}
                  onQuantityChange={onQuantityChange}
                  type="drip"
                  userDiscount={userDiscount}
                  favoriteIds={favoriteIds}
                  onToggleFavorite={onToggleFavorite}
                  onRemoveFromFavorites={onRemoveFromFavorites}
                  showRemoveButton={showRemoveButton}
                  userId={userId}
                />
              </div>
            </section>
          </FadeIn>
        );
      })()}

      {/* Колд брю отдельно */}
      {coldBrewItems.length > 0 && (() => {
        const availableColdBrewCount = coldBrewItems.filter(item => item.badge !== 'soldout').length;
        return (
          <FadeIn delay={0.1 + ((grainCategories.length + (dripItems.length > 0 ? 1 : 0)) * 0.05)}>
            <section className="relative">
              {renderCategoryHeader('Колд брю', availableColdBrewCount)}
              <div className="pl-1">
                <CoffeeTable
                  items={sortItems(coldBrewItems)}
                  cart={cart}
                  onQuantityChange={onQuantityChange}
                  type="coldbrew"
                  userDiscount={userDiscount}
                  favoriteIds={favoriteIds}
                  onToggleFavorite={onToggleFavorite}
                  onRemoveFromFavorites={onRemoveFromFavorites}
                  showRemoveButton={showRemoveButton}
                  userId={userId}
                />
              </div>
            </section>
          </FadeIn>
        );
      })()}
    </div>
  );
}