import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { OrderDialog } from './OrderDialog';
import { Logo } from './Logo';
import { GroupedCoffeeTable } from './GroupedCoffeeTable';
import { ThemeToggle } from './ThemeToggle';
import { Ticker } from './Ticker';
import { Badge } from './ui/badge';
import { CountryFilter } from './CountryFilter';
import { CategorySelect } from './CategorySelect';
import { PriceSort } from './PriceSort';
import { OrderCheckout } from './OrderCheckout';
import type { CoffeeItem, ExchangeRate, OrderFormData, CartItem } from '../types';
import { 
  fetchCoffeeItems, 
  fetchExchangeRate, 
  fetchUserData, 
  fetchUserOrders,
  fetchFavorites,
  addToFavorites,
  removeFromFavorites,
  createOrder,
  fetchUserLoyalty,
} from '../lib/api';
import { FadeIn } from './ui/fade-in';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { ChevronRight } from 'lucide-react';

// ─── Ступени лояльности «Нечай» ───────────────────────────────────────────────
const LOYALTY_LEVELS = [
  {
    level: 0, label: 'Случайный визит',     discount: 0,  color: '#A0A0A0',
    description: 'По умолчанию у всех новых клиентов.',
    conditions: [] as string[],
  },
  {
    level: 1, label: 'Нечайная встреча',    discount: 5,  color: '#4A90D9',
    description: null,
    conditions: ['4 заказа за 3 месяца'],
  },
  {
    level: 2, label: 'Приятная нечайность', discount: 7,  color: '#4A90D9',
    description: null,
    conditions: ['8 заказов за 6 месяцев', 'Отсутствие перерывов более 45 дней'],
  },
  {
    level: 3, label: 'Главный Нечай',       discount: 10, color: '#F47D37',
    description: null,
    conditions: ['12 заказов за 12 месяцев', 'Отсутствие перерывов более 40 дней'],
  },
];

function getLevelByDiscount(discount: number) {
  return [...LOYALTY_LEVELS].reverse().find(l => discount >= l.discount && l.discount > 0)
    ?? LOYALTY_LEVELS[0];
}

interface CatalogPageProps {
  onOrderSuccess: (orderId: string) => void;
  onNavigateToAdmin: () => void;
  onNavigateToUserLogin: () => void;
  onNavigateToMyOrders: () => void;
  onNavigateToFavorites: () => void;
  onNavigateToUserSettings: () => void;
  onNavigateToRetail: () => void;
  isUserAuthenticated: boolean;
  userCompanyName: string;
  userDiscount: number;
  userId: string;
  cart: Map<string, { kg: number; packs200: number }>;
  setCart: React.Dispatch<React.SetStateAction<Map<string, { kg: number; packs200: number }>>>;
  /** Вызывается когда сервер вернул актуальную скидку, отличную от кешированной в localStorage */
  onDiscountSync?: (discount: number) => void;
}

export function CatalogPage({ onOrderSuccess, onNavigateToAdmin, onNavigateToUserLogin, onNavigateToMyOrders, onNavigateToFavorites, onNavigateToUserSettings, onNavigateToRetail, isUserAuthenticated, userCompanyName, userDiscount, userId, cart, setCart, onDiscountSync }: CatalogPageProps) {
  const [coffeeItems, setCoffeeItems] = useState<CoffeeItem[]>([]);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState('default');
  const [showMinOrderError, setShowMinOrderError] = useState(false);
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [loyaltyData, setLoyaltyData] = useState<{
    loyaltyLevel: number;
    discount: number;
    ordersIn3Mo: number;
    ordersIn6Mo: number;
    ordersIn12Mo: number;
    nextLevel: { label: string; discount: number } | null;
    isManualOverride: boolean;
  } | null>(null);

  useEffect(() => {
    loadCoffeeItems();
  }, []);

  useEffect(() => {
    checkFirstOrder();
  }, [isUserAuthenticated, userId]);

  // Загружаем данные лояльности (totalKg, nextLevel)
  useEffect(() => {
    if (!isUserAuthenticated || !userId) return;
    fetchUserLoyalty(userId)
      .then(data => {
        setLoyaltyData({
          loyaltyLevel: data.loyaltyLevel,
          discount: data.discount,
          ordersIn3Mo: data.ordersIn3Mo ?? 0,
          ordersIn6Mo: data.ordersIn6Mo ?? 0,
          ordersIn12Mo: data.ordersIn12Mo ?? 0,
          nextLevel: data.nextLevel
            ? { label: data.nextLevel.label, discount: data.nextLevel.discount }
            : null,
          isManualOverride: data.isManualOverride ?? false,
        });

        // Синхронизируем скидку: если сервер вернул другое значение чем в localStorage — обновляем
        if (data.discount !== userDiscount) {
          console.log(`[loyalty sync] Обновляем скидку: ${userDiscount}% → ${data.discount}%`);
          // Обновляем localStorage
          try {
            const stored = localStorage.getItem('userAuth');
            if (stored) {
              const parsed = JSON.parse(stored);
              parsed.discount = data.discount;
              localStorage.setItem('userAuth', JSON.stringify(parsed));
            }
          } catch (e) { /* ignore */ }
          // Обновляем App state
          onDiscountSync?.(data.discount);
        }
      })
      .catch(() => {/* тихо игнорируем */});
  }, [isUserAuthenticated, userId]);

  const checkFirstOrder = async () => {
    if (!isUserAuthenticated || !userId) {
      setIsFirstOrder(true); // Для гостей считаем, что это первый заказ (показываем блок)
      setIsOrdersLoading(false); // ← обязательно снимаем флаг загрузки
      return;
    }

    try {
      setIsOrdersLoading(true);
      const orders = await fetchUserOrders(userId);
      setIsFirstOrder(orders.length === 0);
    } catch (error) {
      console.error('Failed to check user orders:', error);
      // В случае ошибки безопаснее не давать скидку или наоборот? 
      // Оставим true по умолчанию, если не удалось загрузить, или false?
      // учше false, чтобы не дать лишнюю скидку, если бэкенд лежит. Но для UX лучше true.
      // Но с учетом требования "если уже сделал 1 заказ, то блок больше никогда не выводим", лучше перестраховаться.
      // Но пока оставим как есть (предыдущее значение).
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const loadCoffeeItems = async () => {
    try {
      setIsLoading(true);
      const items = await fetchCoffeeItems();
      setCoffeeItems(items);
      // Загружаем избранное ПОСЛЕ загрузки товаров
      if (isUserAuthenticated && userId) {
        loadFavoritesAfterItems(items);
      }
    } catch (err) {
      console.error('Failed to load coffee items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFavoritesAfterItems = async (items: CoffeeItem[]) => {
    if (!isUserAuthenticated || !userId) return;
    try {
      const favs = await fetchFavorites(userId);
      
      // Фильтруем избранное - оставляем только существующие товары
      const existingItemIds = new Set(items.map(item => item.id));
      const validFavorites = favs.filter(favId => existingItemIds.has(favId));
      
      // Только удалям несуществующие товары если их действительно нет
      // И только если это не случай когда товары еще не загрузились
      if (items.length > 0 && validFavorites.length < favs.length) {
        const removedItems = favs.filter(favId => !existingItemIds.has(favId));
        for (const itemId of removedItems) {
          await removeFromFavorites(userId, itemId).catch(err => {
            console.error('Failed to clean up favorite:', err);
          });
        }
      }
      
      setFavoriteIds(validFavorites);
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  const loadFavorites = async () => {
    if (!isUserAuthenticated || !userId) return;
    try {
      const favs = await fetchFavorites(userId);
      setFavoriteIds(favs);
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  // Перезагружаем избранное при измеении аутентификации
  useEffect(() => {
    if (coffeeItems.length > 0 && isUserAuthenticated && userId) {
      loadFavoritesAfterItems(coffeeItems);
    } else if (!isUserAuthenticated) {
      setFavoriteIds([]);
    }
  }, [isUserAuthenticated, userId]);

  const toggleFavorite = async (item: CoffeeItem) => {
    if (!isUserAuthenticated || !userId) return;
    const isFavorite = favoriteIds.includes(item.id);
    
    // Оптимистичное обновление UI - сразу меняем состояние
    if (isFavorite) {
      setFavoriteIds(favoriteIds.filter(favId => favId !== item.id));
      toast.success('Товар удален из избранного');
    } else {
      setFavoriteIds([...favoriteIds, item.id]);
      toast.success('Товар добавлен в избранное');
    }
    
    // Запрос в фоне
    try {
      if (isFavorite) {
        await removeFromFavorites(userId, item.id);
      } else {
        await addToFavorites(userId, item.id);
      }
    } catch (err) {
      // Откатываем изменения при ошибке
      if (isFavorite) {
        setFavoriteIds([...favoriteIds, item.id]);
      } else {
        setFavoriteIds(favoriteIds.filter(favId => favId !== item.id));
      }
      console.error('Failed to toggle favorite:', err);
      toast.error('Не удлось изменить избранное');
    }
  };

  // Получаем уникальные категории (только для зерна, дрипы отображаются отдельно)
  const availableCategories = Array.from(
    new Set(
      coffeeItems
        .filter(item => !item.type || item.type === 'grain')
        .map(item => item.category)
    )
  ).sort();

  // Фильтруем товары по поисковому запросу и категории
  const filteredItems = coffeeItems.filter(item => {
    const matchesSearch = item.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCartChange = (itemId: string, kg: number, packs200: number) => {
    const newCart = new Map(cart);
    if (kg === 0 && packs200 === 0) {
      newCart.delete(itemId);
    } else {
      newCart.set(itemId, { kg, packs200 });
    }
    setCart(newCart);
    // Скрываем ошибку при изменении колчества
    if (showMinOrderError) {
      setShowMinOrderError(false);
    }
  };

  const handleRemoveFromCart = (itemId: string) => {
    const newCart = new Map(cart);
    newCart.delete(itemId);
    setCart(newCart);
  };

  const getCartItems = (): CartItem[] => {
    const items: CartItem[] = [];
    cart.forEach((quantities, id) => {
      const coffee = coffeeItems.find(c => c.id === id);
      if (coffee) {
        // Применяем персональную скидку к цене единицы товара, если она есть
        // Если у позиции no_discount=true — скидка не применяется
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
          no_discount: coffee.no_discount ?? false, // передаём флаг «не скидка» для первого заказа
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
    const volumeDiscount = getDiscount(subtotal); // порог — по всей сумме заказа
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
        userId: isUserAuthenticated ? userId : undefined
      };
      
      // Генерируем orderId сразу и переходим на страницу успеха
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const orderId = `ORD-${timestamp}-${random}`;
      
      // Сразу переходим на страницу успеха
      setCart(new Map());
      setIsOrderDialogOpen(false);
      onOrderSuccess(orderId);
      
      // Создаем заказ в фоне
      createOrder(orderData).catch(err => {
        console.error('Failed to create order:', err);
      });
    } catch (err) {
      console.error('Failed to create order:', err);
    }
  };

  const cartItems = getCartItems();
  const totalAmount = getTotalAmount();
  const hasItems = cartItems.length > 0;
  const { subtotal, discount, total } = getTotalWithDiscount();

  // Авторитетная скидка: с сервера (учитывает ручной override), пока не загрузилась — из localStorage
  const effectiveDiscount = loyaltyData?.discount ?? userDiscount;
  const currentLevelData = loyaltyData
    ? (LOYALTY_LEVELS.find(l => l.level === loyaltyData.loyaltyLevel) ?? getLevelByDiscount(effectiveDiscount))
    : getLevelByDiscount(userDiscount);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between">
          <Logo onClick={onNavigateToRetail} />
          <div className="flex items-center gap-3 sm:gap-4">
            <ThemeToggle />
            {!isUserAuthenticated && (
              <button 
                onClick={onNavigateToAdmin}
                className="text-foreground hover:opacity-70 transition-opacity text-sm font-medium"
              >
                Админ-панель
              </button>
            )}
            {isUserAuthenticated ? (
              <>
                <button 
                  onClick={onNavigateToRetail}
                  className="text-foreground hover:opacity-70 transition-opacity text-xs sm:text-sm"
                >
                  Розница
                </button>
                <button 
                  onClick={onNavigateToMyOrders}
                  className="text-foreground hover:opacity-70 transition-opacity text-xs sm:text-sm"
                >
                  Мои заказы
                </button>
                <button 
                  onClick={onNavigateToFavorites}
                  className="text-foreground hover:opacity-70 transition-opacity text-xs sm:text-sm"
                >
                  Избранное
                </button>
                <button 
                  onClick={onNavigateToUserSettings}
                  className="text-foreground hover:opacity-70 transition-opacity text-xs sm:text-sm"
                >
                  Профиль
                </button>
                <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline">
                  {userCompanyName}
                </span>
              </>
            ) : (
              <Button 
                onClick={onNavigateToUserLogin}
                size="sm"
              >
                Вход
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Ticker */}
      <Ticker />

      {/* Hero */}
      <section className="border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 sm:py-12 relative">
          <FadeIn>
            <h2 className="text-foreground mb-2 sm:mb-3 text-base sm:text-xl">Оптовый прайс на свежую обжарку</h2>
            <p className="text-muted-foreground text-xs sm:text-base mb-4">
              Выберите нужные позиции и оформите заказ за 2 минуты. Минимальный заказ 5 кг.
            </p>
            <div className={`flex flex-col sm:flex-row gap-2 sm:gap-3 ${isUserAuthenticated ? 'mb-6 sm:mb-8' : ''}`}>
              <Badge variant="secondary" className="text-sm font-medium py-1 px-3 bg-muted text-foreground border border-border w-fit">
                Актуальный прайс на {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </Badge>
              {!isUserAuthenticated && (
                <Badge variant="secondary" className="text-sm font-medium py-1 px-3 bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-800 w-fit">
                  Войдите чтобы сделать заказ
                </Badge>
              )}
            </div>
          </FadeIn>

          {/* Программа лояльности и доп скидка */}
          {isUserAuthenticated && !isOrdersLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Блок лояльности — для всех авторизованных пользователей */}
            <FadeIn delay={0.1}>
              <div
                className="rounded-2xl px-6 py-5 col-span-1 lg:col-span-2 border border-border"
                style={{ backgroundColor: '#FFFFFF' }}
              >
                {/* Верхняя строка — три колонки */}
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {/* Заказов — период зависит от текущего уровня (ПЕРВАЯ колонка) */}
                  <div>
                    {(() => {
                      const lvl = loyaltyData?.loyaltyLevel ?? currentLevelData.level;
                      const isMaxLevel = lvl >= 3;
                      let periodLabel: string;
                      let ordersCount: number | undefined;
                      if (lvl <= 1) {
                        periodLabel = 'Заказов за 3 мес.';
                        ordersCount = loyaltyData?.ordersIn3Mo;
                      } else if (lvl === 2) {
                        periodLabel = 'Заказов за 6 мес.';
                        ordersCount = loyaltyData?.ordersIn6Mo;
                      } else {
                        periodLabel = 'Заказов за 12 мес.';
                        ordersCount = loyaltyData?.ordersIn12Mo;
                      }
                      return (
                        <>
                          <p className="text-muted-foreground text-xs sm:text-sm mb-1 leading-tight">{periodLabel}</p>
                          {loyaltyData ? (
                            isMaxLevel ? (
                              <p className="text-base font-normal text-[#FF90A1]">Макс. уровень 🎉</p>
                            ) : (
                              <p className="text-base sm:text-lg font-normal text-foreground tracking-tight">
                                {ordersCount}
                              </p>
                            )
                          ) : (
                            <p className="text-2xl text-muted-foreground">—</p>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Ваша скидка */}
                  <div>
                    <p className="text-muted-foreground text-xs sm:text-sm mb-1 leading-tight">Ваша скидка</p>
                    <p className="text-base sm:text-lg font-normal tracking-tight" style={{ color: effectiveDiscount > 0 ? '#FF90A1' : '#A0A0A0' }}>
                      {effectiveDiscount > 0 ? `-${effectiveDiscount}%` : '0%'}
                    </p>
                  </div>

                  {/* Ваш уровень (ТРЕТЬЯ колонка) */}
                  <div>
                    <p className="text-muted-foreground text-xs sm:text-sm mb-1 leading-tight">Ваш уровень</p>
                    <p className="text-base sm:text-lg font-normal text-foreground leading-tight">
                      {currentLevelData.label}
                    </p>
                  </div>
                </div>

                {/* Нижняя строка */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    * Цена на которую не распространяется скидка
                  </p>

                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        className="flex-shrink-0 px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-normal transition-colors whitespace-nowrap"
                      >
                        Как прокачать уровень?
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Система лояльности</DialogTitle>
                        <DialogDescription>
                          Накопительная система скидок для постоянных клиентов
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 pt-2">
                        {LOYALTY_LEVELS.map((lvl) => {
                          return (
                            <div
                              key={lvl.level}
                              className="p-4 rounded-xl border transition-colors"
                              style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}
                            >
                              <p className="text-sm font-bold mb-1 text-foreground">
                                Уровень {lvl.level} — {lvl.label} ({lvl.discount}%)
                              </p>
                              {lvl.description && (
                                <p className="text-sm text-[#444]">{lvl.description}</p>
                              )}
                              {lvl.conditions.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {lvl.conditions.map((c, i) => (
                                    <li key={i} className="text-sm text-[#444] flex items-start gap-1.5">
                                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#444] flex-shrink-0" />
                                      {c}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                        <p className="text-sm font-bold text-foreground pt-1">
                          При невыполнении условий уровень снижается на 1.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </FadeIn>

            {/* Блок скидки на первый заказ — только для новых пользователей */}
            {isFirstOrder && (
            <FadeIn delay={0.1}>
              <div className="border border-border rounded-lg p-4 sm:p-6 h-full">
                <h3 className="text-foreground mb-4 text-base sm:text-xl">Скидка на первый заказ</h3>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 min-w-max sm:min-w-0">
                  <div className="text-left flex-shrink-0">
                    <div className="text-muted-foreground text-xs mb-1">от 50 000&#8381;</div>
                    <div className="text-foreground text-lg sm:text-xl">–5%</div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <div className="text-muted-foreground text-xs mb-1">от 60 000&#8381;</div>
                    <div className="text-foreground text-lg sm:text-xl">–6%</div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <div className="text-muted-foreground text-xs mb-1">от 70 000&#8381;</div>
                    <div className="text-foreground text-lg sm:text-xl">–7%</div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <div className="text-muted-foreground text-xs mb-1">от 80 000&#8381;</div>
                    <div className="text-foreground text-lg sm:text-xl">–8%</div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <div className="text-muted-foreground text-xs mb-1">от 90 000&#8381;</div>
                    <div className="text-foreground text-lg sm:text-xl">–9%</div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <div className="text-muted-foreground text-xs mb-1">от 100 000&#8381;</div>
                    <div className="text-foreground text-lg sm:text-xl">–10%</div>
                  </div>
                </div>
              </div>
              {/* Сноска для позиций без скидки */}
              <p className="text-xs text-muted-foreground mt-4">
                <sup>*</sup> Цена на которую не распространяется скидка
              </p>
            </div>
          </FadeIn>
          )}
          </div>
          )}
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 sm:py-8 pb-32 lg:pb-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <p className="text-muted-foreground text-sm">Загрузка прайс-листа...</p>
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
                onToggleFavorite={(itemId) => {
                  const item = coffeeItems.find(i => i.id === itemId);
                  if (item) toggleFavorite(item);
                }}
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
      {!isLoading && (
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

      {/* Order Modal */}
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