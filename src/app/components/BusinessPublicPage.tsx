import { FadeIn } from './ui/fade-in';
import { wholesaleItemWeightKg } from '../lib/wholesaleUnits';
import { toast } from 'sonner';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { SEOHelmet, SEOConfig } from './SEOHelmet';

interface BusinessPublicPageProps {
  onNavigateToRetail: () => void;
  onNavigateToLogin: () => void;
}

export function BusinessPublicPage({ onNavigateToRetail, onNavigateToLogin }: BusinessPublicPageProps) {
  const [coffeeItems, setCoffeeItems] = useState<CoffeeItem[]>([]);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState('default');
  const [showMinOrderError, setShowMinOrderError] = useState(false);
  const [cart, setCart] = useState<Map<string, { kg: number; packs200: number }>>(new Map());
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState('');
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);

  useEffect(() => {
    loadCoffeeItems();
  }, []);

  const loadCoffeeItems = async () => {
    try {
      setIsLoading(true);
      const items = await fetchCoffeeItems();
      setCoffeeItems(items);
    } catch (err) {
      console.error('Failed to load coffee items:', err);
    } finally {
      setIsLoading(false);
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
    // Скрываем ошибку при изменении количества
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
        // Без скидок - используем базовые цены
        const priceKg = coffee.price_kg;
        const price200 = coffee.price_200;

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
          price200
        });
      }
    });
    return items;
  };

  const getTotalAmount = (): number => {
    return getCartItems().reduce((sum, item) => sum + item.subtotal, 0);
  };

  const getTotalKg = (): number => {
    return getCartItems().reduce((sum, item) => sum + wholesaleItemWeightKg(item), 0);
  };

  const handleCheckoutClick = () => {
    const totalKg = getTotalKg();
    if (totalKg < 5) {
      setShowMinOrderError(true);
      return;
    }
    setIsOrderDialogOpen(true);
  };

  const handleSubmitOrder = async (formData: OrderFormData, promoDiscount?: number) => {
    try {
      let finalTotal = getTotalAmount();
      if (promoDiscount) {
        finalTotal = Math.round(finalTotal * (1 - promoDiscount / 100));
      }

      const orderData = {
        ...formData,
        items: getCartItems(),
        total: finalTotal,
        userId: undefined // Гостевой заказ
      };
      
      // Генерируем orderId
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const orderId = `ORD-${timestamp}-${random}`;
      
      // Показываем страницу успеха
      setCart(new Map());
      setIsOrderDialogOpen(false);
      setSuccessOrderId(orderId);
      setOrderSuccess(true);
      
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

  // Показываем страницу успеха после заказа
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <FadeIn>
            <div className="bg-card border border-border rounded-lg p-8">
              {/* Картинка */}
              <div className="flex justify-center mb-6">
                <ImageWithFallback
                  src="https://optim.tildacdn.com/tild3266-6237-4839-b232-653738353439/-/resize/400x/-/format/webp/photo.png.webp"
                  alt="Заказ оформлен"
                  className="w-64 h-auto rounded-lg"
                />
              </div>

              <h1 className="text-2xl mb-4">Заказ оформлен!</h1>
              <p className="text-muted-foreground mb-2">
                Номер заказа: <strong>{successOrderId}</strong>
              </p>
              <p className="text-muted-foreground mb-6">
                Мы свяжемся с вами в ближайшее время для подтверждения.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    setOrderSuccess(false);
                    setSuccessOrderId('');
                  }}
                  className="w-full"
                >
                  Вернуться к прайсу
                </Button>
                <p className="text-sm text-muted-foreground">
                  <button 
                    onClick={onNavigateToLogin}
                    className="text-primary hover:underline"
                  >
                    Войдите в систему
                  </button>
                  {' '}для доступа к программе лояльности и персональным скидкам
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* SEO Meta Tags */}
      <SEOHelmet {...SEOConfig.business} />
      
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between">
          <Logo onClick={onNavigateToRetail} />
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={onNavigateToRetail}
              className="text-foreground hover:opacity-70 transition-opacity text-sm font-medium"
            >
              Розница
            </button>
            <Button 
              onClick={() => setIsRegistrationOpen(true)}
              variant="outline"
              size="sm"
            >
              Регистрация
            </Button>
            <Button 
              onClick={onNavigateToLogin}
              size="sm"
            >
              Вход
            </Button>
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
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Badge variant="secondary" className="text-sm font-medium py-1 px-3 bg-muted text-foreground border border-border w-fit">
                Актуальный прайс на {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </Badge>
              <Badge variant="secondary" className="text-sm font-medium py-1 px-3 bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800 w-fit">
                Войдите для доступа к программе лояльности
              </Badge>
            </div>
          </FadeIn>
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
                userDiscount={0} // Без персональной скидки
                favoriteIds={[]} // Без избранного
                onToggleFavorite={() => {}} // Без избранного
                userId="" // Гостевой режим
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
                discountPercent={0} // Без скидки за первый заказ
                finalTotal={totalAmount}
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
            discountPercent={0}
            finalTotal={totalAmount}
            onRemoveItem={handleRemoveFromCart}
          />
        </div>
      )}

      {/* Order Modal */}
      <OrderDialog 
        open={isOrderDialogOpen}
        onOpenChange={setIsOrderDialogOpen}
        onSubmit={handleSubmitOrder}
        userId="" // Гостевой режим
        totalAmount={totalAmount}
      />

      {/* Registration Modal */}
      <BusinessRegistration 
        isOpen={isRegistrationOpen}
        onClose={() => setIsRegistrationOpen(false)}
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