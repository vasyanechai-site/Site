import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { OrderDialog } from './OrderDialog';
import { Logo } from './Logo';
import { CoffeeTable } from './CoffeeTable';
import { ThemeToggle } from './ThemeToggle';
import { ArrowLeft } from 'lucide-react';
import { Ticker } from './Ticker';
import type { CoffeeItem, OrderFormData, CartItem } from '../types';
import { fetchCoffeeItems, fetchFavorites, removeFromFavorites, createOrder, fetchUserOrders } from '../lib/api';
import { GroupedCoffeeTable } from './GroupedCoffeeTable';
import { CountryFilter } from './CountryFilter';
import { CategorySelect } from './CategorySelect';
import { PriceSort } from './PriceSort';
import { OrderCheckout } from './OrderCheckout';
import { Badge } from './ui/badge';
import { FadeIn } from './ui/fade-in';
import { toast } from 'sonner';

interface FavoritesPageProps {
  userId: string;
  userDiscount: number;
  onBack: () => void;
  cart: Map<string, { kg: number; packs200: number }>;
  setCart: React.Dispatch<React.SetStateAction<Map<string, { kg: number; packs200: number }>>>;
  onOrderSuccess: (orderId: string) => void;
  onNavigateToRetail?: () => void;
}

export function FavoritesPage({ userId, userDiscount, onBack, cart, setCart, onOrderSuccess, onNavigateToRetail }: FavoritesPageProps) {
  const [coffeeItems, setCoffeeItems] = useState<CoffeeItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState('default');
  const [showMinOrderError, setShowMinOrderError] = useState(false);
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);

  useEffect(() => {
    loadData();
    checkFirstOrder();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [items, favorites] = await Promise.all([
        fetchCoffeeItems(),
        fetchFavorites(userId)
      ]);
      setCoffeeItems(items);
      
      // Фильтруем избранное - оставляем только существующие товары
      const existingItemIds = new Set(items.map(item => item.id));
      const validFavorites = favorites.filter(favId => existingItemIds.has(favId));
      
      // Если есть несуществующие товары, обновляем избранное на сервере
      if (validFavorites.length < favorites.length) {
        try {
          // Удаляем несуществующие товары
          const removedItems = favorites.filter(favId => !existingItemIds.has(favId));
          for (const itemId of removedItems) {
            await removeFromFavorites(userId, itemId);
          }
        } catch (error) {
          console.error('Failed to clean up favorites:', error);
        }
      }
      
      setFavoriteIds(validFavorites);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkFirstOrder = async () => {
    try {
      setIsOrdersLoading(true);
      const orders = await fetchUserOrders(userId);
      setIsFirstOrder(orders.length === 0);
    } catch (error) {
      console.error('Failed to check user orders:', error);
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const handleRemoveFromFavorites = async (itemId: string) => {
    // Оптимистичное обновление UI - сразу удаляем из списка
    const previousFavorites = [...favoriteIds];
    setFavoriteIds(favoriteIds.filter(id => id !== itemId));
    toast.success('Удалено из избранного');
    
    // Запрос в фоне
    try {
      await removeFromFavorites(userId, itemId);
    } catch (error) {
      // Откатываем изменения при ошибке
      setFavoriteIds(previousFavorites);
      console.error('Failed to remove from favorites:', error);
      toast.error('Не удалось удалить из избранного');
    }
  };

  const handleCartChange = (itemId: string, kg: number, packs200: number) => {
    const newCart = new Map(cart);
    if (kg === 0 && packs200 === 0) {
      newCart.delete(itemId);
    } else {
      newCart.set(itemId, { kg, packs200 });
    }
    setCart(newCart);
  };

  const handleRemoveFromCart = (itemId: string) => {
    const newCart = new Map(cart);
    newCart.delete(itemId);
    setCart(newCart);
  };

  // Фильтруем только избранные товары
  const favoriteItems = coffeeItems.filter(item => favoriteIds.includes(item.id));

  // Получаем уникальные категории из избранного
  const availableCategories = Array.from(
    new Set(
      favoriteItems
        .filter(item => !item.type || item.type === 'grain')
        .map(item => item.category)
    )
  ).sort();

  // Фильтруем товары по поисковому запросу и категории
  const filteredItems = favoriteItems.filter(item => {
    const matchesSearch = item.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCartItems = (): CartItem[] => {
    const items: CartItem[] = [];
    cart.forEach((quantities, id) => {
      const coffee = coffeeItems.find(c => c.id === id);
      if (coffee) {
        const personalDiscount = userDiscount || 0;
        const priceKg = personalDiscount > 0 && !coffee.no_discount
            ? Math.round(coffee.price_kg * (1 - personalDiscount / 100)) 
            : coffee.price_kg;
        const price200 = personalDiscount > 0 && !coffee.no_discount
            ? Math.round(coffee.price_200 * (1 - personalDiscount / 100)) 
            : coffee.price_200;

        const subtotal = (quantities.kg * priceKg) + (quantities.packs200 * price200);
        items.push({
          id,
          name: coffee.name,
          category: coffee.category,
          type: coffee.type,
          kg: quantities.kg,
          packs200: quantities.packs200,
          subtotal,
          priceKg,
          price200,
          no_discount: coffee.no_discount ?? false,
        });
      }
    });
    return items;
  };

  const getTotalAmount = (): number => {
    return getCartItems().reduce((sum, item) => sum + item.subtotal, 0);
  };

  const getTotalKg = (): number => {
    return getCartItems().reduce((sum, item) => {
      if (item.type === 'coldbrew') return sum; // Колд брю не учитывается в весе
      return sum + item.kg + (item.packs200 * 0.2);
    }, 0);
  };

  const getDiscount = (amount: number): number => {
    if (!isFirstOrder) return 0;
    if (amount >= 100000) return 10;
    if (amount >= 90000) return 9;
    if (amount >= 80000) return 8;
    if (amount >= 70000) return 7;
    if (amount >= 60000) return 6;
    if (amount >= 50000) return 5;
    return 0;
  };

  const getTotalWithDiscount = (): { subtotal: number; discount: number; total: number } => {
    const subtotal = getTotalAmount();
    const volumeDiscount = getDiscount(subtotal);
    if (volumeDiscount === 0) return { subtotal, discount: 0, total: subtotal };
    // Скидка применяется только к позициям без флага no_discount
    const items = getCartItems();
    const discountableAmount = items.reduce((sum, item) => sum + (item.no_discount ? 0 : item.subtotal), 0);
    const discountAmount = Math.round(discountableAmount * volumeDiscount / 100);
    const total = subtotal - discountAmount;
    return { subtotal, discount: volumeDiscount, total };
  };

  const handleCheckoutClick = () => {
    const cartItems = getCartItems();
    const hasNonColdBrew = cartItems.some(item => item.type !== 'coldbrew');
    const totalKg = getTotalKg();
    if (hasNonColdBrew && totalKg < 5) {
      setShowMinOrderError(true);
      return;
    }
    setIsOrderDialogOpen(true);
  };

  const handleSubmitOrder = async (formData: OrderFormData, promoDiscount?: number) => {
    try {
      const { discount: firstOrderDiscount, total: firstOrderTotal } = getTotalWithDiscount();
      let finalTotal = firstOrderTotal;
      if (promoDiscount) {
        finalTotal = Math.round(finalTotal * (1 - promoDiscount / 100));
      }

      // Если применяется скидка первого заказа — корректируем цены позиций,
      // чтобы в счёте Точки суммы строк совпадали с итогом (скидка уже в ценах).
      let orderItems = getCartItems();
      if (firstOrderDiscount > 0) {
        const factor = 1 - firstOrderDiscount / 100;
        orderItems = orderItems.map(item => {
          if (item.no_discount) return item;
          return {
            ...item,
            subtotal:  Math.round(item.subtotal  * factor),
            priceKg:   item.priceKg  !== undefined ? Math.round(item.priceKg  * factor) : undefined,
            price200:  item.price200 !== undefined ? Math.round(item.price200 * factor) : undefined,
          };
        });
      }

      const orderData = {
        ...formData,
        items: orderItems,
        total: finalTotal,
        userId
      };
      
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const orderId = `ORD-${timestamp}-${random}`;
      
      setCart(new Map());
      setIsOrderDialogOpen(false);
      toast.success('Заказ успешно оформлен!');
      
      createOrder(orderData).catch(err => {
        console.error('Failed to create order:', err);
      });
      onOrderSuccess(orderId);
    } catch (err) {
      console.error('Failed to create order:', err);
    }
  };

  const cartItems = getCartItems();
  const totalAmount = getTotalAmount();
  const hasItems = cartItems.length > 0;
  const { subtotal, discount, total } = getTotalWithDiscount();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Назад</span>
            </Button>
            <Logo onClick={onNavigateToRetail} />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {onNavigateToRetail && (
              <Button 
                variant="ghost"
                onClick={onNavigateToRetail}
                className="text-sm"
              >
                Розница
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Ticker */}
      <Ticker />

      {/* Hero */}
      <section className="border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 sm:py-12">
          <FadeIn>
            <h2 className="text-foreground mb-2 sm:mb-3 text-base sm:text-xl">Избранное</h2>
            <p className="text-muted-foreground text-xs sm:text-base mb-4">
              Ваши избранные товары. Корзина сохраняется при переходе между разделами.
            </p>
            {favoriteItems.length === 0 && !isLoading && (
              <Badge variant="secondary" className="text-sm font-medium py-1 px-3 bg-muted text-foreground border border-border w-fit">
                У вас пока нет избранных товаров
              </Badge>
            )}
          </FadeIn>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 sm:py-8 pb-32 lg:pb-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <p className="text-muted-foreground text-sm">Загрузка избранного...</p>
          </div>
        ) : favoriteItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-muted-foreground text-lg mb-4">Нет избранных товаров</p>
            <Button onClick={onBack}>Вернуться к каталогу</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_270px] gap-8">
            {/* Coffee Table with Filter */}
            <div>
              <FadeIn delay={0.2}>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <CountryFilter
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                  <div className="flex gap-4">
                    <CategorySelect
                      categories={availableCategories}
                      selectedCategory={selectedCategory}
                      onCategoryChange={setSelectedCategory}
                    />
                    <PriceSort
                      sortOrder={sortOrder}
                      onSortChange={setSortOrder}
                    />
                  </div>
                </div>
              </FadeIn>
              <GroupedCoffeeTable 
                items={filteredItems}
                cart={cart}
                onQuantityChange={handleCartChange}
                sortOrder={sortOrder}
                userDiscount={userDiscount}
                favoriteIds={favoriteIds}
                onToggleFavorite={(itemId) => handleRemoveFromFavorites(itemId)}
                userId={userId}
              />
            </div>

            {/* Order Checkout - Desktop */}
            <div className="hidden lg:block">
              <OrderCheckout 
                items={cartItems}
                total={totalAmount}
                onCheckout={handleCheckoutClick}
                disabled={!hasItems}
                totalKg={getTotalKg()}
                minOrderError={showMinOrderError}
                discountPercent={discount}
                finalTotal={total}
                onRemoveItem={handleRemoveFromCart}
              />
            </div>
          </div>
        )}
      </div>

      {/* Order Checkout - Mobile Fixed Bottom */}
      {!isLoading && favoriteItems.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50">
          <OrderCheckout 
            items={cartItems}
            total={totalAmount}
            onCheckout={handleCheckoutClick}
            disabled={!hasItems}
            isMobile
            totalKg={getTotalKg()}
            minOrderError={showMinOrderError}
            discountPercent={discount}
            finalTotal={total}
            onRemoveItem={handleRemoveFromCart}
          />
        </div>
      )}

      {/* Order Dialog */}
      <OrderDialog 
        open={isOrderDialogOpen}
        onOpenChange={setIsOrderDialogOpen}
        onSubmit={handleSubmitOrder}
        userId={userId}
        totalAmount={total}
      />

      {/* Min Order Error */}
      {showMinOrderError && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-3 z-50">
          Минимальный заказ 5 кг.
        </div>
      )}
    </div>
  );
}