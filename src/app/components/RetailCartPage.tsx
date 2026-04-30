import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router@7.12.0';
import { IMaskInput } from 'react-imask';
import { toast } from 'sonner@2.0.3';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { RetailHeader } from './RetailHeader';
import { Trash2, ArrowLeft, X, ShoppingCart, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { CdekDelivery } from './CdekDelivery';
import type { RetailCartItem } from './RetailCart';
import type { RetailProduct } from '../lib/api';

interface RetailCartPageProps {
  items: RetailCartItem[];
  onUpdateQuantity: (productId: string, weight: string, roast: string, grind: string, newQuantity: number) => void;
  onRemoveItem: (productId: string, weight: string, roast: string, grind: string) => void;
  onSubmitOrder: (customerName: string, customerPhone: string, customerEmail: string, deliveryInfo: any, usedPoints?: number) => Promise<void>;
  onBack: () => void;
  onNavigateToLogin: () => void;
  isUserLoggedIn?: boolean;
  currentUser?: any;
  validFavoritesCount?: number;
  onOpenFavorites?: () => void;
  onOpenCart?: () => void;
  orderLogs?: Array<{
    timestamp: string;
    level: 'info' | 'success' | 'error' | 'warn';
    message: string;
    data?: any;
  }>;
  onClearLogs?: () => void;
  authLogs?: Array<{
    timestamp: string;
    level: 'info' | 'success' | 'error' | 'warn';
    message: string;
    data?: any;
  }>;
  onClearAuthLogs?: () => void;
  allProducts?: RetailProduct[];
  onAddToCart?: (product: RetailProduct, weight: string, roast: string, grind: string, quantity: number) => void;
}

export function RetailCartPage({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onSubmitOrder,
  onBack,
  onNavigateToLogin,
  isUserLoggedIn,
  currentUser,
  validFavoritesCount = 0,
  onOpenFavorites,
  onOpenCart,
  orderLogs,
  onClearLogs,
  authLogs,
  onClearAuthLogs,
  allProducts = [],
  onAddToCart,
}: RetailCartPageProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isAuthLogsOpen, setIsAuthLogsOpen] = useState(false);
  const [agreedToCommunications, setAgreedToCommunications] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
    communications?: string;
    privacy?: string;
    terms?: string;
  }>({});
  
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const scrollSlider = (dir: 'left' | 'right') => {
    if (!sliderRef.current) return;
    const card = sliderRef.current.querySelector<HTMLElement>('[data-slide-card]');
    const step = card ? card.offsetWidth + 16 : 180;
    sliderRef.current.scrollBy({ left: dir === 'left' ? -step * 2 : step * 2, behavior: 'smooth' });
  };
  
  // Scroll to top on mount (mobile fix)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  // Вычисляем общую сумму
  const totalAmount = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  
  // Общая сумма с доставкой
  const totalWithDelivery = totalAmount + (deliveryInfo?.cost || 0);
  const finalTotal = totalWithDelivery;

  const handleSubmit = async () => {
    const newErrors: {
      name?: string;
      phone?: string;
      communications?: string;
      privacy?: string;
      terms?: string;
    } = {};

    if (!customerName.trim()) {
      newErrors.name = 'Пожалуйста, введите ваше полное ФИО';
    }

    if (!customerPhone.trim()) {
      newErrors.phone = 'Пожалуйста, введите ваш телефон';
    } else {
      const digitsOnly = customerPhone.replace(/\D/g, '');
      if (digitsOnly.length < 11) {
        newErrors.phone = 'Пожалуйста, заполните номер телефона полностью';
      }
    }

    if (!customerEmail.trim()) {
      newErrors.email = 'Пожалуйста, введите ваш email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      newErrors.email = 'Пожалуйста, введите корректный email';
    }

    if (!agreedToCommunications) {
      newErrors.communications = 'Необходимо согласие на получение сообщений';
    }

    if (!agreedToPrivacy) {
      newErrors.privacy = 'Необходимо согласие на обработку данных';
    }

    if (!agreedToTerms) {
      newErrors.terms = 'Необходимо принять условия';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      toast.error(firstError);
      
      // Scroll to first error
      const errorElement = document.querySelector('.text-red-500');
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // Очищаем телефон от форматирования перед отправкой (только цифры)
      const cleanPhone = customerPhone.replace(/\D/g, '');
      await onSubmitOrder(customerName, cleanPhone, customerEmail, deliveryInfo);
      // Reset form handled by parent on success usually, or we redirect
    } catch (error) {
      console.error('Error submitting order:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cartItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // ── Рекомендации ────────────────────────────────────────────────
  const recommendations = React.useMemo(() => {
    const cartIds = new Set(items.map(i => i.product.id));
    const published = allProducts.filter(p => p.published !== false && !cartIds.has(p.id));

    const accessories = published.filter(p => p.type === 'accessory' || p.category === 'Аксессуары');
    const drips      = published.filter(p => p.type === 'drip'      || p.category === 'Дрип');
    const beans      = published
      .filter(p => p.type !== 'accessory' && p.category !== 'Аксессуары'
                && p.type !== 'drip'      && p.category !== 'Дрип')
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

    const result: RetailProduct[] = [];
    for (const p of accessories) { if (result.length >= 8) break; result.push(p); }
    for (const p of drips)       { if (result.length >= 8) break; result.push(p); }
    for (const p of beans)       { if (result.length >= 8) break; result.push(p); }
    return result;
  }, [allProducts, items]);
  // ────────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#FFF4E5] flex flex-col">
        <RetailHeader 
          currentUser={currentUser || (isUserLoggedIn ? {} : null)}
          validFavoritesCount={validFavoritesCount}
          cartItemsCount={cartItemsCount}
          onNavigateToLogin={onNavigateToLogin}
          onOpenFavorites={() => onOpenFavorites?.()}
          onOpenCart={() => onOpenCart?.()}
        />

        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-20 h-20 bg-[#FF90A1]/20 rounded-full flex items-center justify-center mx-auto text-[#222222]">
              <ShoppingCart className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-medium text-[#222222]">Ваша корзина пуста</h2>
            <p className="text-[#222222]/60">Добавьте свежий кофе из нашего каталога</p>
            <Button onClick={onBack} className="bg-[#FF90A1] text-[#222222] hover:bg-[#FF90A1]/90 border-2 border-[#FFF4E5]">
              Перейти в каталог
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF4E5]">
      {/* Header */}
      <RetailHeader 
        currentUser={currentUser || (isUserLoggedIn ? {} : null)}
        validFavoritesCount={validFavoritesCount}
        cartItemsCount={cartItemsCount}
        onNavigateToLogin={onNavigateToLogin}
        onOpenFavorites={() => onOpenFavorites?.()}
        onOpenCart={() => onOpenCart?.()}
      />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-8 pb-28 sm:py-12">
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="flex items-center text-sm text-[#222222] hover:opacity-70 transition-opacity mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к покупкам
        </button>

        <h1 className="text-3xl sm:text-4xl text-[#222222] mb-8 sm:mb-12 font-medium">Оформление заказа</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Items + Recommendations */}
          <div className="lg:col-span-7 space-y-6">
             <div className="bg-[#FFF4E5] rounded-2xl p-4 sm:p-6 border border-[#222222]/10">
                <h2 className="text-xl font-medium mb-6 flex items-center gap-2">
                   <span>Товары в корзине</span>
                   <span className="bg-[#FF90A1]/20 text-[#222222] text-sm px-2 py-0.5 rounded-full">
                      {items.length}
                   </span>
                </h2>

                <div className="space-y-4">
                  {items.map((item) => {
                    const itemKey = `${item.product.id}-${item.weight}-${item.grind}`;
                    return (
                      <div key={itemKey} className="flex gap-4 sm:gap-6 py-4 border-b last:border-0 border-dashed border-[#222222]/10">
                        {/* Image */}
                        <div className="w-20 h-24 sm:w-24 sm:h-32 shrink-0 bg-[#FFF4E5] border border-[#222222]/5 rounded-lg overflow-hidden flex items-center justify-center p-2">
                          <ImageWithFallback
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="w-full h-full object-contain"
                          />
                        </div>

                        {/* Details */}
                        <div className="flex-1 flex flex-col justify-between">
                           <div>
                              <div className="flex justify-between items-start gap-4">
                                 <h3 className="font-medium text-[#222222] text-lg leading-tight">
                                    {item.product.name}
                                 </h3>
                                 <button
                                    onClick={() => onRemoveItem(item.product.id, item.weight, item.roast, item.grind)}
                                    className="text-[#222222]/40 hover:text-red-500 transition-colors p-1 -mr-2"
                                 >
                                    <Trash2 className="w-5 h-5" />
                                 </button>
                              </div>
                              
                              <div className="flex flex-wrap gap-2 mt-2">
                                {(item.product.type === 'bean' || !item.product.type) && (
                                  <>
                                    <Badge variant="outline" className="border-[#222222]/10 text-[#222222]/70 font-normal">
                                      {item.weight}
                                    </Badge>
                                    {item.roast && (
                                      <Badge variant="outline" className="border-[#222222]/10 text-[#222222]/70 font-normal">
                                        {item.roast}
                                      </Badge>
                                    )}
                                    {item.grind && (
                                      <Badge variant="outline" className="border-[#222222]/10 text-[#222222]/70 font-normal">
                                        {item.grind}
                                      </Badge>
                                    )}
                                  </>
                                )}
                                {item.product.type === 'drip' && (
                                  <Badge variant="outline" className="border-[#222222]/10 text-[#222222]/70 font-normal">
                                    {item.weight || 'Упаковка (6 шт.)'}
                                  </Badge>
                                )}
                              </div>
                           </div>

                           <div className="flex justify-between items-end mt-4">
                              <div className="flex items-center gap-3">
                                 <button
                                    onClick={() => onUpdateQuantity(item.product.id, item.weight, item.roast, item.grind, Math.max(1, item.quantity - 1))}
                                    className="w-8 h-8 flex items-center justify-center bg-[#FFF4E5] border border-[#222222]/10 rounded-md hover:bg-[#FF90A1]/20 text-[#222222]"
                                 >
                                    <Minus className="w-4 h-4" />
                                 </button>
                                 <span className="w-6 text-center font-medium text-[#222222]">{item.quantity}</span>
                                 <button
                                    onClick={() => onUpdateQuantity(item.product.id, item.weight, item.roast, item.grind, item.quantity + 1)}
                                    className="w-8 h-8 flex items-center justify-center bg-[#FFF4E5] border border-[#222222]/10 rounded-md hover:bg-[#FF90A1]/20 text-[#222222]"
                                 >
                                    <Plus className="w-4 h-4" />
                                 </button>
                              </div>
                              <div className="font-medium text-lg text-[#222222]">
                                 {item.product.price * item.quantity} ₽
                              </div>
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
             </div>

            {/* ── Рекомендую посмотреть — горизонтальный слайдер ── */}
            {recommendations.length > 0 && onAddToCart && (
              <div className="pt-2">
                {/* Заголовок + стрелки */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium text-[#222222]">Рекомендую посмотреть</h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => scrollSlider('left')}
                      className="w-8 h-8 flex items-center justify-center rounded-md border border-[#222222]/10 bg-[#FFF4E5] text-[#222222] hover:bg-[#FF90A1]/20 transition-colors"
                      aria-label="Назад"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => scrollSlider('right')}
                      className="w-8 h-8 flex items-center justify-center rounded-md border border-[#222222]/10 bg-[#FFF4E5] text-[#222222] hover:bg-[#FF90A1]/20 transition-colors"
                      aria-label="Вперёд"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Слайдер */}
                <div
                  ref={sliderRef}
                  className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 pb-4"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div
                    className="flex gap-4 sm:gap-6"
                    style={{ scrollSnapType: 'x mandatory' }}
                  >
                    {recommendations.map((product) => (
                      <div
                        key={product.id}
                        data-slide-card
                        className="flex-shrink-0 group flex flex-col text-center"
                        style={{
                          width: 'calc(50vw - 24px)',
                          maxWidth: 220,
                          scrollSnapAlign: 'start',
                        }}
                      >
                        {/* Изображение — точно как на главной: aspect-[4/5] */}
                        <div className="w-full mb-4 flex items-start justify-center" style={{ aspectRatio: '4/5' }}>
                          <ImageWithFallback
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>

                        {/* Инфо */}
                        <div className="flex flex-col items-center space-y-2 flex-1">
                          <h3 className="text-base font-normal text-[#222222] leading-tight line-clamp-2">
                            {product.name}
                          </h3>
                          {product.description && (
                            <p className="text-[#222222] text-xs line-clamp-1">{product.description}</p>
                          )}
                          <div className="text-base text-[#222222]">
                            {product.price} ₽
                          </div>

                          {/* Кнопка — обводка как у +/-, текст чёрный */}
                          <button
                            onClick={() => onAddToCart!(product, '', '', '', 1)}
                            className="w-full mt-auto text-sm font-medium py-2.5 rounded-xl border border-[#222222] text-[#222222] bg-transparent hover:bg-[#222222]/5 active:scale-95 transition-all"
                          >
                            В корзину
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Checkout Form — sticky */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 self-start">
             <div className="bg-[#FFF4E5] rounded-2xl p-6 border border-[#222222]/10">
                
                {/* Contact Info */}
                <section className="mb-8">
                   <h3 className="font-medium text-lg mb-4">Контактные данные</h3>
                   <div className="space-y-4">
                      <div className="space-y-1.5">
                         <label className="text-xs text-[#222222]/70">Как вас зовут</label>
                         <Input
                           placeholder="Иван Иванов"
                           value={customerName}
                           onChange={(e) => {
                              setCustomerName(e.target.value);
                              if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
                           }}
                           className={cn("bg-[#FFF4E5] border border-[#222222]/10 focus:bg-[#FFF4E5] transition-all", errors.name && "border-red-500 bg-red-50")}
                         />
                         {errors.name && (
                           <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                         )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div className="space-y-1.5">
                            <label className="text-xs text-[#222222]/70">Телефон</label>
                            <IMaskInput
                              mask="+7 (000) 000-00-00"
                              placeholder="+7 (___) ___-__-__"
                              type="tel"
                              value={customerPhone}
                              onAccept={(value) => {
                                 setCustomerPhone(value);
                                 if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
                              }}
                              className={cn(
                                 "flex h-10 w-full rounded-md border border-[#222222]/10 bg-[#FFF4E5] px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 focus:bg-[#FFF4E5] transition-all",
                                 errors.phone && "border-red-500 bg-red-50"
                              )}
                            />
                            {errors.phone && (
                              <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                            )}
                         </div>
                         
                         <div className="space-y-1.5">
                            <label className="text-xs text-[#222222]/70">Email</label>
                            <Input
                              placeholder="example@mail.ru"
                              type="email"
                              value={customerEmail}
                              onChange={(e) => {
                                 setCustomerEmail(e.target.value);
                                 if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                              }}
                              className={cn("bg-[#FFF4E5] border border-[#222222]/10 focus:bg-[#FFF4E5] transition-all", errors.email && "border-red-500 bg-red-50")}
                            />
                            {errors.email && (
                              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                            )}
                         </div>
                      </div>
                   </div>
                </section>

                {/* Delivery */}
                <section className="mb-8">
                   <CdekDelivery 
                      orderPrice={totalAmount}
                      cartItems={items}
                      onDeliveryChange={setDeliveryInfo}
                   />
                </section>

                {/* Agreements */}
                <section className="mb-8 space-y-4">
                   <div className="space-y-1">
                      <div className="flex items-start space-x-3">
                         <Checkbox
                            id="communications"
                            checked={agreedToCommunications}
                            onCheckedChange={(checked) => {
                               setAgreedToCommunications(checked as boolean);
                               if (errors.communications) setErrors(prev => ({ ...prev, communications: undefined }));
                            }}
                            className={cn(
                               "mt-0.5 shadow-none bg-[#FFF4E5] border-[#222222]/20 data-[state=checked]:bg-[#FF90A1] data-[state=checked]:text-[#222222] data-[state=checked]:border-[#FF90A1]", 
                               errors.communications && "border-red-500"
                            )}
                         />
                         <label htmlFor="communications" className="text-xs text-[#222222]/70 leading-snug cursor-pointer select-none">
                            Я согласен на получение информационных сообщений согласно <Link to="/marketing-consent" className="underline hover:text-[#222222]">согласию на маркетинг</Link>
                         </label>
                      </div>
                      {errors.communications && <p className="text-red-500 text-xs ml-7">{errors.communications}</p>}
                   </div>

                   <div className="space-y-1">
                      <div className="flex items-start space-x-3">
                         <Checkbox
                            id="privacy"
                            checked={agreedToPrivacy}
                            onCheckedChange={(checked) => {
                               setAgreedToPrivacy(checked as boolean);
                               if (errors.privacy) setErrors(prev => ({ ...prev, privacy: undefined }));
                            }}
                            className={cn(
                               "mt-0.5 shadow-none bg-[#FFF4E5] border-[#222222]/20 data-[state=checked]:bg-[#FF90A1] data-[state=checked]:text-[#222222] data-[state=checked]:border-[#FF90A1]",
                               errors.privacy && "border-red-500"
                            )}
                         />
                         <label htmlFor="privacy" className="text-xs text-[#222222]/70 leading-snug cursor-pointer select-none">
                            Я согласен с <Link to="/privacy" className="underline hover:text-[#222222]">политикой конфиденциальности</Link>
                         </label>
                      </div>
                      {errors.privacy && <p className="text-red-500 text-xs ml-7">{errors.privacy}</p>}
                   </div>

                   <div className="space-y-1">
                      <div className="flex items-start space-x-3">
                         <Checkbox
                            id="terms"
                            checked={agreedToTerms}
                            onCheckedChange={(checked) => {
                               setAgreedToTerms(checked as boolean);
                               if (errors.terms) setErrors(prev => ({ ...prev, terms: undefined }));
                            }}
                            className={cn(
                               "mt-0.5 shadow-none bg-[#FFF4E5] border-[#222222]/20 data-[state=checked]:bg-[#FF90A1] data-[state=checked]:text-[#222222] data-[state=checked]:border-[#FF90A1]",
                               errors.terms && "border-red-500"
                            )}
                         />
                         <label htmlFor="terms" className="text-xs text-[#222222]/70 leading-snug cursor-pointer select-none">
                            Я принимаю условия <Link to="/agreement" className="underline hover:text-[#222222]">пользовательского соглашения</Link>
                         </label>
                      </div>
                      {errors.terms && <p className="text-red-500 text-xs ml-7">{errors.terms}</p>}
                   </div>
                </section>

                {/* Summary & Pay */}
                <section className="border-t border-dashed border-[#222222]/10 pt-6">
                   <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-sm">
                         <span className="text-[#222222]/70">Товары ({items.length})</span>
                         <span className="font-medium">{totalAmount} ₽</span>
                      </div>
                      <div className="flex justify-between text-sm">
                         <span className="text-[#222222]/70">Доставка</span>
                         <span className="font-medium">
                            {deliveryInfo ? (deliveryInfo.cost === 0 ? <span className="text-green-600">Бесплатно</span> : `${deliveryInfo.cost} ₽`) : '---'}
                         </span>
                      </div>
                      <div className="flex justify-between text-xl font-medium pt-2 text-[#222222]">
                         <span>Итого</span>
                         <span>{finalTotal} ₽</span>
                      </div>
                   </div>

                   <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full h-14 text-lg bg-[#FF90A1] text-[#222222] hover:bg-[#FF90A1]/90 rounded-xl"
                   >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                           <div className="w-5 h-5 border-2 border-[#222222] border-r-transparent rounded-full animate-spin" />
                           <span>Оформление...</span>
                        </div>
                      ) : (
                        <span>Оформить заказ</span>
                      )}
                   </Button>
                </section>

             </div>
          </div>
        </div>
      </main>
    </div>
  );
}