import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './ui/utils';
import { RetailProduct, RetailCartItem } from '../types';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { transliterate } from '../lib/transliterate';
import { RetailHeader } from './RetailHeader';
import { SEOHelmet } from './SEOHelmet';
import { 
  ArrowLeft, 
  Heart, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Check,
  X,
  User
} from 'lucide-react';

import { FarmGallery } from './FarmGallery';

interface RetailProductDetailProps {
  productId: string;
  products: RetailProduct[];
  onBack: () => void;
  onNavigateToLogin: () => void;
  onAddToCart: (product: RetailProduct, weight: string, roast: string, grind: string, quantity: number) => void;
  cartItemsCount: number;
  onOpenCart: () => void;
  cartItems: RetailCartItem[];
  onUpdateQuantity: (productId: string, weight: string, roast: string, grind: string, newQuantity: number) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  currentUser?: any;
  favoritesCount?: number;
  onOpenFavorites?: () => void;
}

export function RetailProductDetail({ 
  productId, 
  products, 
  onBack, 
  onNavigateToLogin, 
  onAddToCart, 
  cartItemsCount, 
  onOpenCart,
  cartItems,
  onUpdateQuantity,
  isFavorite,
  onToggleFavorite,
  currentUser,
  favoritesCount = 0,
  onOpenFavorites
}: RetailProductDetailProps) {
  const navigate = useNavigate();
  const [product, setProduct] = useState<RetailProduct | null>(null);
  const [selectedWeight, setSelectedWeight] = useState('');
  const [selectedRoast, setSelectedRoast] = useState('');
  const [selectedGrind, setSelectedGrind] = useState('');
  
  const imageRef = useRef<HTMLDivElement>(null);
  const cartButtonRef = useRef<HTMLButtonElement>(null);
  const [flyingImage, setFlyingImage] = useState<{
    src: string;
    rect: DOMRect;
  } | null>(null);

  // Helper to determine type
  const getProductType = (p: RetailProduct) => {
    if (p.type) return p.type;
    if (p.category === 'Дрип') return 'drip';
    if (p.category === 'Оборудование') return 'equipment';
    if (p.category === 'Аксессуары') return 'accessory';
    return 'bean';
  };

  // Helper to calculate current price
  const getCurrentPrice = () => {
    if (!product) return 0;
    
    const type = getProductType(product);
    
    if (type === 'bean') {
      if (selectedWeight === '200гр' && product.price200) return product.price200;
      if (selectedWeight === '1кг' && product.price1000) return product.price1000;
      return product.price;
    }
    
    if (type === 'drip') {
      return product.pricePack || product.price;
    }
    
    // equipment, accessory
    return product.price;
  };

  const currentPrice = getCurrentPrice();

  const getCurrentVariantInCart = () => {
    if (!product) return null;
    const type = getProductType(product);
    
    let targetWeight = '';
    let targetGrind = '';
    
    if (type === 'bean') {
        targetWeight = selectedWeight;
        targetGrind = selectedGrind;
    } else if (type === 'drip') {
        targetWeight = 'Упаковка (6 шт.)';
    }
    // accessory / equipment: empty strings
    return cartItems.find(item => 
        item.product.id === product.id && 
        item.weight === targetWeight && 
        item.roast === selectedRoast &&
        item.grind === targetGrind
    );
  };

  const cartItem = getCurrentVariantInCart();
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  const handleBuy = () => {
    if (product && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      setFlyingImage({
        src: product.imageUrl || "https://optim.tildacdn.com/stor6333-3237-4037-a331-366562356133/-/format/webp/97818023.png.webp",
        rect
      });
      
      const type = getProductType(product);
      
      let weightToAdd = '';
      let grindToAdd = '';
      
      if (type === 'bean') {
        weightToAdd = selectedWeight;
        grindToAdd = selectedGrind;
      } else if (type === 'drip') {
        weightToAdd = 'Упаковка (6 шт.)';
      }
      // accessory / equipment: no weight needed
      
      // Create a copy of product with the specific price for this selection
      const productWithCorrectPrice = {
        ...product,
        price: currentPrice
      };
      
      // Delay adding to cart slightly so the animation starts first
      setTimeout(() => {
        onAddToCart(productWithCorrectPrice, weightToAdd, selectedRoast, grindToAdd, 1);
      }, 100);
    } else if (product) {
      const type = getProductType(product);
      let weightToAdd = '';
      let grindToAdd = '';
      
      if (type === 'bean') {
        weightToAdd = selectedWeight;
        grindToAdd = selectedGrind;
      } else if (type === 'drip') {
        weightToAdd = 'Упаковка (6 шт.)';
      }
      // accessory / equipment: no weight needed

      const productWithCorrectPrice = {
        ...product,
        price: currentPrice
      };

      onAddToCart(productWithCorrectPrice, weightToAdd, selectedRoast, grindToAdd, 1);
    }
  };
  
  const handleIncrement = () => {
    if (!product) return;
    const type = getProductType(product);
    let targetWeight = '';
    let targetGrind = '';
    
    if (type === 'bean') {
        targetWeight = selectedWeight;
        targetGrind = selectedGrind;
    } else if (type === 'drip') {
        targetWeight = 'Упаковка (6 шт.)';
    }
    // accessory / equipment: empty strings
    
    onUpdateQuantity(product.id, targetWeight, selectedRoast, targetGrind, quantityInCart + 1);
  };

  const handleDecrement = () => {
    if (!product) return;
    const type = getProductType(product);
    let targetWeight = '';
    let targetGrind = '';
    
    if (type === 'bean') {
        targetWeight = selectedWeight;
        targetGrind = selectedGrind;
    } else if (type === 'drip') {
        targetWeight = 'Упаковка (6 шт.)';
    }
    // accessory / equipment: empty strings
    
    onUpdateQuantity(product.id, targetWeight, selectedRoast, targetGrind, quantityInCart - 1);
  };

  useEffect(() => {
    // Find product by ID or slug
    const foundProduct = products.find(p => {
      const slug = transliterate(p.name);
      return p.id === productId || slug === productId;
    });
    setProduct(foundProduct || null);
    
    if (foundProduct) {
      const type = getProductType(foundProduct);
      
      let initialWeight = '';
      let initialRoast = '';
      let initialGrind = '';

      if (type === 'bean') {
        // Determine available weights based on prices
        const availableWeights = [];
        if (foundProduct.price200) availableWeights.push('200гр');
        if (foundProduct.price1000) availableWeights.push('1кг');
        
        // If no specific prices, use legacy weight field or defaults
        if (availableWeights.length === 0) {
          const legacyWeights = foundProduct.weight 
            ? foundProduct.weight.split(',').map(s => s.trim()) 
            : ['200гр', '500гр', '1кг'];
          availableWeights.push(...legacyWeights);
        }

        initialWeight = availableWeights[0] || '';
        
        const roasts = foundProduct.roast 
          ? foundProduct.roast.split(',').map(s => s.trim()) 
          : ['Фильтр', 'Эспрессо', 'Омни'];
        initialRoast = roasts[0] || '';
        
        const grinds = foundProduct.grind 
          ? foundProduct.grind.split(',').map(s => s.trim()) 
          : ['В зернах', 'Под эспрессо', 'Под турку', 'Под капельную', 'Под аэропресс'];
        initialGrind = grinds[0] || '';
      } else if (type === 'drip') {
        // drip: no weight/roast/grind needed
      }
      // equipment and accessory: no selectors needed
      
      setSelectedWeight(initialWeight);
      setSelectedRoast(initialRoast);
      setSelectedGrind(initialGrind);
    }
  }, [productId, products]);

  // Scroll to top when product page opens
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [productId]);

  // Derived state for rendering
  const productType = product ? getProductType(product) : 'bean';
  
  const availableWeights = (() => {
    if (!product) return [];
    if (productType !== 'bean') return [];
    
    const weights = [];
    if (product.price200) weights.push('200гр');
    if (product.price1000) weights.push('1кг');
    
    if (weights.length === 0) {
       return product.weight 
        ? product.weight.split(',').map(s => s.trim()) 
        : ['200гр', '500гр', '1кг'];
    }
    return weights;
  })();

  const roasts = product?.roast 
    ? product.roast.split(',').map(s => s.trim()) 
    : ['Фильтр', 'Эспрессо', 'Омни'];
  
  const grinds = product?.grind 
    ? product.grind.split(',').map(s => s.trim()) 
    : ['В зернах', 'Под эспрессо', 'Под турку', 'Под капельную', 'Под аэропресс'];

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FFF4E5]">
        {/* Header */}
        <RetailHeader 
          currentUser={currentUser}
          validFavoritesCount={favoritesCount}
          cartItemsCount={cartItemsCount}
          onNavigateToLogin={onNavigateToLogin}
          onOpenFavorites={() => onOpenFavorites?.()}
          onOpenCart={onOpenCart}
        />

        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12">
          <div className="text-center text-[#222222] py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#FF90A1] border-r-transparent"></div>
            <p className="mt-4">Загрузка...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF4E5]">
      {/* SEO Meta Tags - автогенерация из названия товара */}
      <SEOHelmet 
        title={`${product.name} - Кофе Нечай`}
        description={`${product.description || product.name} - Свежеобжаренный кофе в зернах от Кофе Нечай. ${product.cardText ? product.cardText.substring(0, 150) : 'Specialty coffee с доставкой по России.'}`}
        keywords={`${product.name}, кофе ${product.country || ''}, ${product.category || 'кофе в зернах'}, specialty coffee, свежая обжарка, кофе нечай`}
      />
      
      {/* Product Schema.org JSON-LD */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          "name": product.name,
          "description": product.description || product.cardText || product.name,
          "image": product.imageUrl,
          "brand": {
            "@type": "Brand",
            "name": "Кофе Нечай"
          },
          "offers": {
            "@type": "Offer",
            "price": product.price,
            "priceCurrency": "RUB",
            "availability": product.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
            "url": `https://coffeenechai.ru/product/${product.id}`,
            "seller": {
              "@type": "Organization",
              "name": "Кофе Нечай"
            }
          },
          "category": product.category || "Кофе в зернах",
          "productID": product.id
        })}
      </script>
      
      {/* BreadcrumbList Schema.org */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Главная",
              "item": "https://coffeenechai.ru/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Каталог",
              "item": "https://coffeenechai.ru/catalog"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": product.name,
              "item": `https://coffeenechai.ru/product/${product.id}`
            }
          ]
        })}
      </script>
      
      {/* Header */}
      <RetailHeader 
        currentUser={currentUser}
        validFavoritesCount={favoritesCount}
        cartItemsCount={cartItemsCount}
        onNavigateToLogin={onNavigateToLogin}
        onOpenFavorites={() => onOpenFavorites?.()}
        onOpenCart={onOpenCart}
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12">
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="flex items-center text-sm text-[#222222] hover:opacity-70 transition-opacity mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к каталогу
        </button>

        {/* Product Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 sm:gap-12 lg:gap-24 items-start">
          
          {/* Left Column - Image */}
          <div className="relative lg:sticky lg:top-24 lg:self-start">
            <div ref={imageRef} className="aspect-[4/5] bg-[#FFF4E5] flex items-start justify-center relative">
              <ImageWithFallback
                src={product.imageUrl || "https://optim.tildacdn.com/stor6333-3237-4037-a331-366562356133/-/format/webp/97818023.png.webp"}
                alt={product.name}
                className="max-h-full w-auto object-contain"
              />
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-8 lg:max-w-xl">
            <div>
              <h1 className="text-3xl sm:text-4xl text-[#222222] mb-4">
                {product.name}
              </h1>
              {product.description && (
                <p className="text-lg text-[#222222] mb-4">
                  {product.description}
                </p>
              )}
            </div>

            {/* Вкусовой профиль - только если есть значения и НЕ оборудование/аксессуар */}
            {productType !== 'equipment' && productType !== 'accessory' && (product.acidity || product.bitterness || product.sweetness) && (
              <div className="grid grid-cols-3 gap-4 py-4">
                {product.acidity && (
                  <div className="space-y-2">
                    <div className="text-sm text-[#222222]">Кислотность</div>
                    <div className="h-2 w-full bg-[#FF90A1]/20 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(product.acidity) * 10}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-[#FF90A1] rounded-r-full"
                      />
                    </div>
                  </div>
                )}
                {product.bitterness && (
                  <div className="space-y-2">
                    <div className="text-sm text-[#222222]">Горечь</div>
                    <div className="h-2 w-full bg-[#FF90A1]/20 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(product.bitterness) * 10}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
                        className="h-full bg-[#FF90A1] rounded-r-full"
                      />
                    </div>
                  </div>
                )}
                {product.sweetness && (
                  <div className="space-y-2">
                    <div className="text-sm text-[#222222]">Сладость</div>
                    <div className="h-2 w-full bg-[#FF90A1]/20 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(product.sweetness) * 10}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                        className="h-full bg-[#FF90A1] rounded-r-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-6">
              
              {/* Type-Specific Selectors */}
              
              {/* BEAN: Weight, Roast, Grind */}
              {productType === 'bean' && (
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Weight Select */}
                  <div className="space-y-2 flex-1">
                    <label className="text-sm text-[#222222]">Вес</label>
                    <Select value={selectedWeight} onValueChange={setSelectedWeight}>
                      <SelectTrigger className="w-full bg-[#FFF4E5] border border-[#222222]/20 rounded-lg h-10 px-3 text-[#222222]">
                        <SelectValue placeholder="Выбрите вес" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableWeights.map(w => (
                          <SelectItem key={w} value={w}>{w}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Roast Select */}
                  <div className="space-y-2 flex-1">
                    <label className="text-sm text-[#222222]">Обжарка</label>
                    <Select value={selectedRoast} onValueChange={setSelectedRoast}>
                      <SelectTrigger className="w-full bg-[#FFF4E5] border border-[#222222]/20 rounded-lg h-10 px-3 text-[#222222]">
                        <SelectValue placeholder="Выберите обжарку" />
                      </SelectTrigger>
                      <SelectContent>
                        {roasts.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Grind Select */}
                  <div className="space-y-2 flex-1">
                    <label className="text-sm text-[#222222]">Помол</label>
                    <Select value={selectedGrind} onValueChange={setSelectedGrind}>
                      <SelectTrigger className="w-full bg-[#FFF4E5] border border-[#222222]/20 rounded-lg h-10 px-3 text-[#222222]">
                        <SelectValue placeholder="Выберите помол" />
                      </SelectTrigger>
                      <SelectContent>
                        {grinds.map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* DRIP: Quantity Display */}
              {productType === 'drip' && (
                <div className="space-y-2">
                  <label className="text-sm text-[#222222]">Количество</label>
                  <div className="w-full bg-[#FFF4E5] border border-[#222222]/20 rounded-lg h-10 px-3 text-[#222222] flex items-center">
                    Упаковка (6 шт.)
                  </div>
                </div>
              )}
              
              {/* EQUIPMENT: Quantity Display */}
              {productType === 'equipment' && (
                <div className="space-y-2">
                  <label className="text-sm text-[#222222]">Единица измерения</label>
                  <div className="w-full bg-[#FFF4E5] border border-[#222222]/20 rounded-lg h-10 px-3 text-[#222222] flex items-center">
                    шт.
                  </div>
                </div>
              )}

              {/* ACCESSORY: Quantity Display */}
              {productType === 'accessory' && (
                <div className="space-y-2">
                  <label className="text-sm text-[#222222]">Единица измерения</label>
                  <div className="w-full bg-[#FFF4E5] border border-[#222222]/20 rounded-lg h-10 px-3 text-[#222222] flex items-center">
                    шт.
                  </div>
                </div>
              )}
              
              {/* Buy Button */}
              <div className="hidden sm:flex flex-col gap-4 pt-6 mt-2">
                <div className="flex items-center gap-4">
                  {/* Price */}
                  <div className="text-4xl text-[#222222] font-medium whitespace-nowrap tracking-tight">
                    {currentPrice * (quantityInCart > 0 ? quantityInCart : 1)} ₽
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 max-w-[400px]">
                    {quantityInCart > 0 ? (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={handleDecrement}
                            className="w-12 h-12 flex items-center justify-center bg-[#FFF4E5] border border-[#222222]/10 rounded-md hover:bg-[#FF90A1]/20 text-[#222222]"
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          <span className="min-w-[2rem] text-center font-medium text-xl text-[#222222] select-none">{quantityInCart}</span>
                          <button 
                            onClick={handleIncrement}
                            className="w-12 h-12 flex items-center justify-center bg-[#FFF4E5] border border-[#222222]/10 rounded-md hover:bg-[#FF90A1]/20 text-[#222222]"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        <Button 
                          onClick={onOpenCart}
                          className="flex-1 bg-[#FF90A1] text-[#222222] hover:bg-[#FF90A1]/90 h-12 text-lg shadow-none rounded-lg"
                        >
                          Купить
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="lg"
                        className="w-full bg-[#FF90A1] text-[#222222] hover:bg-[#FF90A1]/90 h-12 text-lg shadow-none items-center justify-center"
                        onClick={handleBuy}
                      >
                        Добавить в корзину
                      </Button>
                    )}
                  </div>
                  
                  {/* Favorite Button */}
                  <motion.button
                    onClick={onToggleFavorite}
                    whileTap={{ scale: 0.8 }}
                    className="p-3 hover:bg-[#222222]/5 rounded-full transition-colors group"
                  >
                    <motion.div
                       initial={false}
                       animate={{ scale: isFavorite ? [1, 1.2, 1] : 1 }}
                       transition={{ duration: 0.3 }}
                    >
                        <Heart 
                          className={`w-8 h-8 transition-colors ${
                            isFavorite 
                              ? "fill-[#FF90A1] text-[#FF90A1]" 
                              : "text-[#222222] group-hover:text-[#FF90A1]"
                          }`} 
                        />
                    </motion.div>
                  </motion.button>
                </div>
              </div>

              {/* Mobile Price & Actions - shown below description */}
              <div className="sm:hidden flex flex-col gap-4 pt-6 mt-2">
                <div className="flex items-center gap-4">
                  {/* Price */}
                  <div className="text-3xl text-[#222222] font-medium whitespace-nowrap tracking-tight">
                    {currentPrice * (quantityInCart > 0 ? quantityInCart : 1)} ₽
                  </div>
                </div>

                {/* Favorite Button */}
                <div className="flex items-center">
                  <motion.button
                    onClick={onToggleFavorite}
                    whileTap={{ scale: 0.9 }}
                    className="w-12 h-12 flex items-center justify-center bg-[#FFF4E5] border border-[#222222]/10 rounded-lg hover:bg-[#FF90A1]/20 text-[#222222]"
                  >
                    <motion.div
                       initial={false}
                       animate={{ scale: isFavorite ? [1, 1.2, 1] : 1 }}
                       transition={{ duration: 0.3 }}
                    >
                        <Heart 
                          className={`w-6 h-6 transition-colors ${
                            isFavorite 
                              ? "fill-[#FF90A1] text-[#FF90A1]" 
                              : "text-[#222222]"
                          }`} 
                        />
                    </motion.div>
                  </motion.button>
                </div>
              </div>
            </div>

            <div className="space-y-6 text-[#222222] leading-relaxed pt-4 pb-24 sm:pb-4">
              {/* Card Text - характеристики */}
              {product.cardText && (
                <p className="text-base whitespace-pre-wrap">
                  {product.cardText}
                </p>
              )}

              {/* Long description */}
              {product.longDescription && (
                <div className="pt-4 border-t border-[#222222]/10 text-base whitespace-pre-wrap">
                  {product.longDescription}
                </div>
              )}

              {/* Farm gallery */}
              {product.farmPhotos && product.farmPhotos.length > 0 && (
                <FarmGallery photos={product.farmPhotos} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Buy Button - Mobile */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#FFF4E5]/95 backdrop-blur-md border-t border-[#222222]/10 p-4 z-50 safe-area-bottom">
        <div className="flex items-center gap-3">
          {/* Price & Woosh */}
          <div className="flex items-center gap-2">
            <div className="text-2xl text-[#222222] font-medium whitespace-nowrap tracking-tight">
              {currentPrice * (quantityInCart > 0 ? quantityInCart : 1)} ₽
            </div>
          </div>

          {/* Buttons */}
          <div className="flex-1">
            {quantityInCart > 0 ? (
              <div className="flex items-center gap-2 w-full">
                <button 
                  onClick={handleDecrement}
                  className="w-10 h-10 flex items-center justify-center bg-[#FFF4E5] border border-[#222222]/10 rounded-md hover:bg-[#FF90A1]/20 text-[#222222]"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="min-w-[1.5rem] text-center font-medium text-base text-[#222222] select-none">{quantityInCart}</span>
                <button 
                  onClick={handleIncrement}
                  className="w-10 h-10 flex items-center justify-center bg-[#FFF4E5] border border-[#222222]/10 rounded-md hover:bg-[#FF90A1]/20 text-[#222222]"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <Button 
                  onClick={onOpenCart}
                  className="flex-1 bg-[#FF90A1] text-[#222222] hover:bg-[#FF90A1]/90 h-10 text-sm shadow-none rounded-lg"
                >
                  Купить
                </Button>
              </div>
            ) : (
              <Button 
                className="w-full bg-[#FF90A1] text-[#222222] hover:bg-[#FF90A1]/90 h-10 text-sm shadow-none items-center justify-center"
                onClick={handleBuy}
              >
                Добавить в корзину
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Flying Image Animation */}
      <AnimatePresence>
        {flyingImage && (
          <motion.img
            initial={{
              position: "fixed",
              top: flyingImage.rect.top,
              left: flyingImage.rect.left,
              width: flyingImage.rect.width,
              height: flyingImage.rect.height,
              opacity: 1,
              zIndex: 100,
              objectFit: "contain",
              pointerEvents: "none"
            }}
            animate={{
              top: cartButtonRef.current?.getBoundingClientRect().top ? cartButtonRef.current.getBoundingClientRect().top + 10 : 20,
              left: cartButtonRef.current?.getBoundingClientRect().left ? cartButtonRef.current.getBoundingClientRect().left + 10 : (typeof window !== 'undefined' ? window.innerWidth - 50 : 0),
              width: 20,
              height: 20,
              opacity: 0.5
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            onAnimationComplete={() => setFlyingImage(null)}
            src={flyingImage.src}
            key="flying-product"
          />
        )}
      </AnimatePresence>
    </div>
  );
}