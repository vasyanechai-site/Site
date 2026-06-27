import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ShoppingCart, User, Heart, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Ticker } from './Ticker';
import { fetchRetailProducts, type RetailProduct, fetchFavorites, addToFavorites, removeFromFavorites } from '../lib/api';
import { fetchCategoryOrder, DEFAULT_CATEGORY_ORDER } from '../lib/api';
import { RetailProductDetail } from './RetailProductDetail';
import { RetailCartItem } from './RetailCart';
import { RetailCartPage } from './RetailCartPage';
import { RetailFavoritesPage } from './RetailFavoritesPage';
import { RetailHeader } from './RetailHeader';
import { FadeIn } from './ui/fade-in';
import { toast } from 'sonner';
import { transliterate } from '../lib/transliterate';
import { Footer } from './Footer';
import { getRetailSessionUser } from '../lib/retailAuth';
import { API_BASE_URL, API_AUTH_HEADER } from '../lib/backendConfig';
import { SEOHelmet, SEOConfig } from './SEOHelmet';
import { RetailMobileTabBar, type TabId } from './RetailMobileTabBar';
import svgPaths from '../imports/svg-39dxhf3pmz';
import recommendedStickerSrc from 'figma:asset/a2fc853b075f8b77543327aa0e2eedb50e131ffe.png';
import { isDripCategory } from '../lib/dripRoulette';
import { DripRouletteTrigger } from './drip-roulette/DripRouletteTrigger';

// ── QuickAddButton ─────────────────────────────────────────────────────────────
interface QuickAddButtonProps {
  product: RetailProduct;
  cartItems: RetailCartItem[];
  onAddToCart: (product: RetailProduct, weight: string, roast: string, grind: string, quantity: number, skipToast?: boolean) => void;
  onUpdateQuantity: (productId: string, weight: string, roast: string, grind: string, newQuantity: number) => void;
  onRemoveItem: (productId: string, weight: string, roast: string, grind: string, skipToast?: boolean) => void;
}

function QuickAddButton({ product, cartItems, onAddToCart, onUpdateQuantity, onRemoveItem }: QuickAddButtonProps) {
  if (product.outOfStock) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center justify-center px-5 py-2.5 rounded-full bg-[#222222]/10 text-[#222222]/60 font-normal cursor-not-allowed border border-[#222222]/10"
      >
        <span className="text-base leading-tight">Скоро появится</span>
      </button>
    );
  }

  const getProductType = (p: RetailProduct) => {
    if (p.type) return p.type;
    if (p.category === 'Дрип') return 'drip';
    if (p.category === 'Оборудование') return 'equipment';
    if (p.category === 'Аксессуары') return 'accessory';
    return 'bean';
  };

  const type = getProductType(product);

  const defaultWeight = type === 'bean'
    ? (product.price200 ? '200гр' : (product.weight?.split(',')[0].trim() || '200гр'))
    : type === 'drip' ? 'Упаковка (10 шт.)' : '';

  const defaultRoast = type === 'bean'
    ? (product.roast?.split(',')[0].trim() || 'Фильтр')
    : '';

  const defaultGrind = '';

  const displayPrice = type === 'bean'
    ? (product.price200 || product.price)
    : type === 'drip' ? (product.pricePack || product.price)
    : product.price;

  // Total quantity across ALL variants of this product (syncs with product detail page)
  const quantity = cartItems
    .filter(item => item.product.id === product.id)
    .reduce((sum, item) => sum + item.quantity, 0);
  const isExpanded = quantity > 0;

  const btnRef = useRef<HTMLButtonElement>(null);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success('Добавлено в корзину', { duration: 2000 });
    const productWithPrice = { ...product, price: displayPrice };
    onAddToCart(productWithPrice, defaultWeight, defaultRoast, defaultGrind, 1, true /* skipToast */);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateQuantity(product.id, defaultWeight, defaultRoast, defaultGrind, quantity + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Find the specific variant to decrement: prefer defaultWeight, fall back to any existing variant
    const targetItem = cartItems.find(item =>
      item.product.id === product.id &&
      item.weight === defaultWeight &&
      item.roast === defaultRoast &&
      item.grind === defaultGrind
    ) || cartItems.find(item => item.product.id === product.id);
    if (!targetItem) return;
    if (targetItem.quantity <= 1) {
      onRemoveItem(product.id, targetItem.weight, targetItem.roast, targetItem.grind, true /* skipToast */);
    } else {
      onUpdateQuantity(product.id, targetItem.weight, targetItem.roast, targetItem.grind, targetItem.quantity - 1);
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.button
            key="add-btn"
            ref={btnRef}
            onClick={handleAdd}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
            whileTap={{ scale: 0.93 }}
            className="flex items-center gap-2.5 pl-5 pr-[10px] py-2.5 rounded-full bg-[#FFD166] text-[#222222] font-normal hover:bg-[#FFC94D] transition-colors"
          >
            <span className="text-base font-normal leading-tight">{displayPrice} р.</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d={svgPaths.p77ba800} />
            </svg>
          </motion.button>
        ) : (
          <motion.div
            key="qty-selector"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex items-center rounded-full bg-[#FF90A1] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleDecrement}
              className="w-10 h-10 flex items-center justify-center text-[#222222] hover:bg-[#ff7a93] active:bg-[#ff6685] transition-colors font-bold text-xl"
            >
              −
            </button>
            <motion.span
              key={quantity}
              initial={{ scale: 1.35, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="w-8 text-center text-[#222222] font-semibold text-base select-none"
            >
              {quantity}
            </motion.span>
            <button
              onClick={handleIncrement}
              className="w-10 h-10 flex items-center justify-center text-[#222222] hover:bg-[#ff7a93] active:bg-[#ff6685] transition-colors font-bold text-xl"
            >
              +
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── RetailStorefront ───────────────────────────────────────────────────────────
interface RetailStorefrontProps {
  onNavigateToLogin: () => void;
  onNavigateToProduct: (productSlug: string) => void;
  showProductId?: string;
  onBackToRetail?: () => void;
}

const iconUrls = [
  'https://static.tildacdn.com/tild6161-3739-4564-a536-653631626230/photo.svg',
  'https://static.tildacdn.com/tild3833-6439-4238-a463-353034643033/photo.svg',
  'https://static.tildacdn.com/tild6234-3563-4362-b536-363631663262/photo.svg',
  'https://static.tildacdn.com/tild3435-6333-4566-a139-653361626465/photo.svg',
  'https://static.tildacdn.com/tild6134-3031-4535-b566-343230643264/photo.svg',
  'https://static.tildacdn.com/tild3834-6131-4532-a637-383135616264/photo.svg',
  'https://static.tildacdn.com/tild3032-6664-4334-a665-626561313433/photo.svg',
  'https://static.tildacdn.com/tild3964-3335-4261-a166-313039383732/photo.svg',
  'https://static.tildacdn.com/tild3935-6337-4331-a462-396562363736/photo.svg',
  'https://static.tildacdn.com/tild6232-3334-4936-a635-383864383466/photo.svg',
  'https://static.tildacdn.com/tild3762-3162-4930-a363-346232623538/photo.svg',
  'https://static.tildacdn.com/tild3831-6463-4262-b931-383762326231/photo.svg',
  'https://static.tildacdn.com/tild3135-6537-4632-a332-353163666531/photo.svg',
];

export function RetailStorefront({ onNavigateToLogin, onNavigateToProduct, showProductId, onBackToRetail }: RetailStorefrontProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [categoryOrderFromServer, setCategoryOrderFromServer] = useState<string[]>(DEFAULT_CATEGORY_ORDER);
  
  // 🔍 Debug Logs для отслеживания процесса оформления заказа
  const [orderLogs, setOrderLogs] = useState<Array<{
    timestamp: string;
    level: 'info' | 'success' | 'error' | 'warn';
    message: string;
    data?: any;
  }>>([]);

  // 🔍 Debug Logs для отслеживания авторизации
  const [authLogs, setAuthLogs] = useState<Array<{
    timestamp: string;
    level: 'info' | 'success' | 'error' | 'warn';
    message: string;
    data?: any;
  }>>([]);

  const addLog = (level: 'info' | 'success' | 'error' | 'warn', message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setOrderLogs(prev => [...prev, { timestamp, level, message, data }]);
  };

  const addAuthLog = (level: 'info' | 'success' | 'error' | 'warn', message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAuthLogs(prev => [...prev, { timestamp, level, message, data }]);
    console.log(`[${timestamp}] ${message}`, data || '');
  };

  const clearLogs = () => setOrderLogs([]);
  const clearAuthLogs = () => setAuthLogs([]);

  // Сессия розницы (свой сервер, localStorage)
  useEffect(() => {
    const apply = () => {
      addAuthLog('info', '🔐 Checking retail session...');
      const user = getRetailSessionUser();
      addAuthLog(user ? 'success' : 'warn', '🔐 Retail session', { userId: user?.id, email: user?.email });
      setCurrentUser(user);
      setIsCheckingAuth(false);
    };
    apply();
    window.addEventListener('nechai-retail-auth-changed', apply);
    window.addEventListener('storage', apply);
    return () => {
      window.removeEventListener('nechai-retail-auth-changed', apply);
      window.removeEventListener('storage', apply);
    };
  }, []);
  
  // Force light theme for retail storefront
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
  }, []);
  
  // Handle deep linking to cart or favorites
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'cart') {
      setIsCartOpen(true);
      setIsFavoritesOpen(false);
    } else if (action === 'favorites') {
      setIsFavoritesOpen(true);
      setIsCartOpen(false);
    }
  }, [searchParams]);

  // Load cart from localStorage on mount
  const [cartItems, setCartItems] = useState<RetailCartItem[]>(() => {
    try {
      const savedCart = localStorage.getItem('retailCart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      return [];
    }
  });
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  
  // Вычисляем количесво валидных избранных товаров (существующих в каталоге)
  const validFavoritesCount = useMemo(() => {
    // Если продукты еще не загружены, показываем сырое количество
    if (isLoading && products.length === 0) {
      return favoriteIds.length;
    }
    // Иначе фильтруем только существующие товары
    return favoriteIds.filter(id => products.some(p => p.id === id)).length;
  }, [favoriteIds, products, isLoading]);
  
  // Find product if showing details
  const foundProduct = useMemo(() => {
    if (!showProductId) return null;
    return products.find(p => p.id === showProductId || transliterate(p.name) === showProductId);
  }, [products, showProductId]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('retailCart', JSON.stringify(cartItems));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }, [cartItems]);

  // Load favorites
  useEffect(() => {
    if (currentUser) {
      fetchFavorites(currentUser.id).then(setFavoriteIds).catch(console.error);
    } else {
      setFavoriteIds([]);
    }
  }, [currentUser]);

  const handleToggleFavorite = async (productId: string) => {
    if (!currentUser) {
      toast.custom((t) => (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 flex items-start gap-3 w-full max-w-[356px] relative pointer-events-auto">
           <div className="text-[#FF90A1] mt-0.5 shrink-0">
              <AlertCircle size={20} />
           </div>
           <div className="flex-1 min-w-0">
              <h3 className="font-medium text-[14px] text-gray-900 mb-1 leading-snug">Войдите, чтобы добавить в избранное</h3>
              <p className="text-[13px] text-gray-500 mb-3 leading-relaxed">Для сохранения избранных товаров необходимо зарегистрироваться или войти в аккаунт</p>
              <Button 
                onClick={() => {
                  toast.dismiss(t);
                  onNavigateToLogin();
                }}
                className="bg-black hover:bg-gray-800 text-white h-8 text-xs font-medium px-4 rounded-md w-fit"
              >
                Войти
              </Button>
           </div>
           <button 
             onClick={() => toast.dismiss(t)}
             className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1"
             aria-label="Закрыть"
           >
             <X size={16} />
           </button>
        </div>
      ), { duration: 5000 });
      return;
    }

    // Optimistic update
    const isFavorite = favoriteIds.includes(productId);
    const newIds = isFavorite 
      ? favoriteIds.filter(id => id !== productId)
      : [...favoriteIds, productId];
    
    setFavoriteIds(newIds);
    
    // Show toast immediately
    toast.success(isFavorite ? 'Удалено из избранного' : 'Добавлено в избранное');

    try {
      if (isFavorite) {
        await removeFromFavorites(currentUser.id, productId);
      } else {
        await addToFavorites(currentUser.id, productId);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      // Revert on error
      setFavoriteIds(favoriteIds);
      toast.error('Не удалось обновить избранное');
    }
  };

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const [items, catOrder] = await Promise.all([
        fetchRetailProducts(),
        fetchCategoryOrder(),
      ]);

      setCategoryOrderFromServer(catOrder);

      // Нормализуем старое название "Дрип кофе" → "Дрип"
      const normalized = items.map(p =>
        p.category === 'Дрип кофе' ? { ...p, category: 'Дрип' } : p
      );

      // Фильтруем только опубликованные товары
      const publishedItems = normalized.filter(item => item.published !== false);

      // Сортируем по catOrder, затем по displayOrder
      const catOrderMap: Record<string, number> = {};
      catOrder.forEach((c, i) => { catOrderMap[c] = i + 1; });
      catOrderMap['Прочее'] = 999;

      const sorted = publishedItems.sort((a, b) => {
        const catA = a.category || 'Прочее';
        const catB = b.category || 'Прочее';
        const orderA = catOrderMap[catA] ?? 998;
        const orderB = catOrderMap[catB] ?? 998;
        if (orderA !== orderB) return orderA - orderB;
        // «Скоро в продаже» (outOfStock) — в конец категории; при снятии флага порядок снова по displayOrder
        const tailA = a.outOfStock === true ? 1 : 0;
        const tailB = b.outOfStock === true ? 1 : 0;
        if (tailA !== tailB) return tailA - tailB;
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      });

      setProducts(sorted);
    } catch (err) {
      console.error('Failed to load retail products:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Scroll to top when returning from product detail
  useEffect(() => {
    if (!showProductId) {
      window.scrollTo(0, 0);
    }
  }, [showProductId]);

  // Animation refs - use lazy initialization to prevent recreation on every render
  const containerRef = useRef<HTMLDivElement>(null);
  const containerSizeRef = useRef({ width: 0, height: 0, itemSize: 64 });
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const requestRef = useRef<number>();
  const isAnimatingRef = useRef<boolean>(false);
  const iconsStateRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    vr: number;
    initialized: boolean;
  }> | null>(null);

  // Category tabs state
  const [activeCategory, setActiveCategory] = useState<string>('');
  const categoryRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Sticky tabs visibility on mobile
  const [isTabsStuck, setIsTabsStuck] = useState(false);
  const [tabsSentinelEl, setTabsSentinelEl] = useState<HTMLDivElement | null>(null);
  // Видимость шапки (прячется при скролле вниз на мобайле)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  useEffect(() => {
    if (!tabsSentinelEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsTabsStuck(!entry.isIntersecting),
      { rootMargin: '-58px 0px 0px 0px', threshold: 0 }
    );
    observer.observe(tabsSentinelEl);
    return () => observer.disconnect();
  }, [tabsSentinelEl]);

  // Group products by category (memoized)
  const productsByCategory = useMemo(() => {
    const map: { [key: string]: RetailProduct[] } = {};
    products.forEach(product => {
      const category = product.category || 'Прочее';
      if (!map[category]) map[category] = [];
      map[category].push(product);
    });
    return map;
  }, [products]);

  const sortedCategories = useMemo(() => {
    const catOrderMap: Record<string, number> = {};
    categoryOrderFromServer.forEach((c, i) => { catOrderMap[c] = i + 1; });

    return Object.keys(productsByCategory).sort((a, b) => {
      return (catOrderMap[a] ?? 99) - (catOrderMap[b] ?? 99);
    });
  }, [productsByCategory, categoryOrderFromServer]);

  // Scroll tracking for active category tab
  useEffect(() => {
    if (sortedCategories.length === 0) return;

    const handleScroll = () => {
      const offset = 140; // header + tabs height
      let current = sortedCategories[0] || '';
      for (const cat of sortedCategories) {
        const ref = categoryRefs.current.get(cat);
        if (ref && ref.getBoundingClientRect().top <= offset) {
          current = cat;
        }
      }
      setActiveCategory(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // set initial value
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sortedCategories]);

  const scrollToCategory = (category: string) => {
    const ref = categoryRefs.current.get(category);
    if (ref) {
      const offset = 130;
      const top = ref.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  // Initialize icons state once
  useEffect(() => {
    if (!iconsStateRef.current) {
      iconsStateRef.current = iconUrls.map(() => ({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rotation: 0,
        vr: 0,
        initialized: false
      }));
    }
  }, []);

  // Resize Observer to cache dimensions without layout thrashing
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        
        // Determine item size based on breakpoints (matching Tailwind classes)
        // w-16 (64px) -> sm:w-24 (96px) -> md:w-32 (128px)
        let itemSize = 64;
        if (window.innerWidth >= 768) itemSize = 128; // md
        else if (window.innerWidth >= 640) itemSize = 96;  // sm
        
        containerSizeRef.current = { width, height, itemSize };
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Animation effect
  useEffect(() => {
    // Don't run animation if showing product detail or cart is open
    if (showProductId || isCartOpen || isFavoritesOpen) {
      isAnimatingRef.current = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
      return;
    }

    // Reset icons initialization when re-mounting or showing again
    if (iconsStateRef.current) {
      iconsStateRef.current.forEach(icon => {
        icon.initialized = false;
      });
    }

    let lastTime = performance.now();
    isAnimatingRef.current = true;

    const animate = (time: number) => {
      if (!isAnimatingRef.current) return;

      // Calculate smooth dt
      // Target 60fps (16.67ms)
      // If time diff is 16.67ms, dt = 1
      const delta = time - lastTime;
      lastTime = time;
      
      // Cap dt to avoid huge jumps (e.g. after tab switching)
      // 4 frames max
      const dt = Math.min(delta / 16.67, 4);

      const { width: offsetWidth, height: offsetHeight, itemSize } = containerSizeRef.current;
      
      // Wait for container to have dimensions
      if (offsetWidth === 0 || offsetHeight === 0) {
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      if (!iconsStateRef.current) return;
      
      iconsStateRef.current.forEach((icon, i) => {
        const img = imageRefs.current[i];
        if (!img) return;

        // Initialize on first frame when dimensions are available
        if (!icon.initialized) {
          // Start in random positions within the visible area
          icon.x = Math.random() * (offsetWidth - itemSize);
          icon.y = Math.random() * (offsetHeight - itemSize);
          
          // Random direction and speed
          const angle = Math.random() * Math.PI * 2;
          const speed = (0.8 + Math.random() * 1.2) * 0.6; // Keep original speed logic
          
          icon.vx = Math.cos(angle) * speed;
          icon.vy = Math.sin(angle) * speed;
          
          icon.rotation = Math.random() * 360;
          icon.vr = (Math.random() - 0.5) * 1.0;
          
          icon.initialized = true;
        }

        // Update position
        icon.x += icon.vx * dt;
        icon.y += icon.vy * dt;
        icon.rotation += icon.vr * dt;

        // Bounce off walls
        const bounceForce = 1.0;
        
        // Left/Right boundaries
        if (icon.x < 0) {
          icon.x = 0;
          icon.vx = Math.abs(icon.vx) * bounceForce;
        } else if (icon.x > offsetWidth - itemSize) {
          icon.x = offsetWidth - itemSize;
          icon.vx = -Math.abs(icon.vx) * bounceForce;
        }

        // Top/Bottom boundaries
        if (icon.y < 0) {
          icon.y = 0;
          icon.vy = Math.abs(icon.vy) * bounceForce;
        } else if (icon.y > offsetHeight - itemSize) {
          icon.y = offsetHeight - itemSize;
          icon.vy = -Math.abs(icon.vy) * bounceForce;
        }

        // Apply transform using translate3d for GPU acceleration
        img.style.transform = `translate3d(${icon.x}px, ${icon.y}px, 0) rotate(${icon.rotation}deg)`;
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      isAnimatingRef.current = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
    };
  }, [showProductId, isCartOpen, isFavoritesOpen]);

  // Cart functions
  const handleAddToCart = (product: RetailProduct, weight: string, roast: string, grind: string, quantity: number = 1, skipToast = false) => {
    setCartItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(
        item => item.product.id === product.id && item.weight === weight && item.roast === roast && item.grind === grind
      );

      if (existingItemIndex >= 0) {
        // Update quantity of existing item
        const newItems = [...prevItems];
        newItems[existingItemIndex].quantity += quantity;
        return newItems;
      } else {
        // Add new item
        return [...prevItems, { product, weight, roast, grind, quantity }];
      }
    });
    
    if (!skipToast) {
      toast.success('Товар добавлен в корзину');
    }
  };

  const handleUpdateQuantity = (productId: string, weight: string, roast: string, grind: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.product.id === productId && item.weight === weight && item.roast === roast && item.grind === grind
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const handleRemoveItem = (productId: string, weight: string, roast: string, grind: string, skipToast = false) => {
    setCartItems(prevItems =>
      prevItems.filter(item => 
        !(item.product.id === productId && item.weight === weight && item.roast === roast && item.grind === grind)
      )
    );
    if (!skipToast) {
      toast.success('Товар удален из корзины');
    }
  };

  const handleSubmitOrder = async (customerName: string, customerPhone: string, customerEmail: string, deliveryInfo: any, usedPoints?: number) => {
    try {
      addLog('info', '🔍 Начало оформления заказа', {
        customerName,
        customerPhone,
        customerEmail,
        deliveryInfo,
        itemsCount: cartItems.length,
        usedPoints
      });
      
      // ДИАГНОСТИКА: логируем структуру данных без персональной информации
      console.log('🔍 Frontend: Submitting order');
      console.log('  Items count:', cartItems.length);
      console.log('  Has delivery info:', !!deliveryInfo);
      console.log('  Used Points:', usedPoints);
      
      if (deliveryInfo && !deliveryInfo.pvzCode) {
        console.error('❌ CRITICAL: pvzCode is missing in deliveryInfo before sending!');
        addLog('error', '❌ Отсутствует код ПВЗ в данных доставки');
      } else if (deliveryInfo) {
        console.log('✅ pvzCode is present:', deliveryInfo.pvzCode);
        addLog('success', '✅ Код ПВЗ найден: ' + deliveryInfo.pvzCode);
      }
      
      addLog('info', '📤 Отправка заказа на сервер...');
      
      const response = await fetch(
        `${API_BASE_URL}/retail/orders`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...API_AUTH_HEADER
          },
          body: JSON.stringify({
            customerName,
            customerPhone,
            customerEmail,
            userId: currentUser?.id,
            items: cartItems,
            deliveryInfo: deliveryInfo,
            usedPoints: usedPoints
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        addLog('error', '❌ Ошибка создания заказа', errorData);
        throw new Error(errorData.error || 'Failed to submit order');
      }

      const result = await response.json();
      console.log('Order submitted successfully:', result);
      addLog('success', '✅ Заказ создан успешно. ID: ' + result.orderId);
      
      const orderId = result.orderId;

      // Проверяем, есть ли платежная ссылка Точка Банк в ответе
      const tochkaUrl = result.tochkaPaymentUrl || result.tochka_payment_url;
      if (tochkaUrl) {
        addLog('success', '✅ Платежная ссылка Точка Банк получена. Переход...');
        
        // Очищаем корзину перед переходом
        setCartItems([]);
        setIsCartOpen(false);
        
        // ВАЖНО: НЕ обновляем баланс вушей здесь!
        // Вуши списываются только после успешной оплаты через webhook на сервере
        
        // Переходим на страницу оплаты Точка Банк
        console.log('🔗 Redirecting to Tochka payment:', tochkaUrl);
        window.location.href = tochkaUrl;
        return;
      }

      // FALLBACK: Если нет платежной ссылки в ответе, пытаемся получь через старый endpoint
      addLog('warn', '⚠️ Платежная ссылка н найдена в заказе, используем fallback...');
      
      addLog('info', '💳 Инициализация оплаты...');
      
      const paymentResponse = await fetch(
        `${API_BASE_URL}/retail/checkout/pay`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...API_AUTH_HEADER
          },
          body: JSON.stringify({
            orderId: orderId,
            email: customerEmail,
            phone: customerPhone,
            cart: cartItems.map(item => ({
              name: item.product.name,
              price: item.product.price,
              quantity: item.quantity,
              vatType: "none"
            }))
          })
        }
      );

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        console.error('========================================');
        console.error('❌ Payment initiation failed!');
        console.error('Status:', paymentResponse.status);
        console.error('Error data:', errorData);
        console.error('Error details:', errorData.details);
        console.error('Full error object:', JSON.stringify(errorData, null, 2));
        console.error('========================================');
        addLog('error', ' Ошибка инициализации оплаты', errorData);
        throw new Error(errorData.details || 'Не удалось перейти к оплате. Пожалуйста, попробуйте позже.');
      }

      const paymentResult = await paymentResponse.json();
      
      if (paymentResult.paymentLink) {
        addLog('success', '✅ Ссылка на оплату получена. Переход...');
        
        // Очищаем корзину перед переходом
        setCartItems([]);
        setIsCartOpen(false);
        
        // ВАЖНО: НЕ обновляем баланс вушей здесь!
        // Вуши списываются тлько после успешной оплаты через webhook на сервере
        // Пользователь может вернуться со страницы оплаты, не оплатив зааз
        
        // Перенаправляем на страницу оплаты
        window.location.href = paymentResult.paymentLink;
      } else {
        throw new Error('Сервер не вернул ссылку на оплату');
      }
      
    } catch (error) {
      console.error('Error submitting retail order:', error);
      addLog('error', '❌ Критическая ошибка при оформлении', {
        error: error instanceof Error ? error.message : String(error)
      });
      toast.error('Ошибка при оформлении заказа. ' + (error instanceof Error ? error.message : ''));
      throw error;
    }
  };

  const cartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const currentTab: TabId = isCartOpen 
    ? 'cart' 
    : isFavoritesOpen 
      ? 'favorites' 
      : 'home';

  const handleTabSelect = (tab: TabId) => {
    switch (tab) {
      case 'home':
        setIsCartOpen(false);
        setIsFavoritesOpen(false);
        if (showProductId) {
           navigate('/');
        }
        break;
      case 'cart':
        setIsCartOpen(true);
        setIsFavoritesOpen(false);
        break;
      case 'favorites':
        setIsFavoritesOpen(true);
        setIsCartOpen(false);
        break;
      case 'locations':
        navigate('/locations');
        break;
      case 'harvest':
        navigate('/harvest');
        break;
      case 'profile':
        if (currentUser) {
            navigate('/dashboard');
        } else {
            onNavigateToLogin();
        }
        break;
    }
  };

  const mobileTabBar = (
    <RetailMobileTabBar
      currentTab={currentTab}
      onTabSelect={handleTabSelect}
      cartItemsCount={cartItemsCount}
      favoritesCount={validFavoritesCount}
    />
  );

  // If showing cart, render cart page
  if (isCartOpen) {
    return (
      <>
        <RetailCartPage
          items={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onSubmitOrder={handleSubmitOrder}
          onBack={() => setIsCartOpen(false)}
          onNavigateToLogin={onNavigateToLogin}
          isUserLoggedIn={!!currentUser}
          currentUser={currentUser}
          validFavoritesCount={validFavoritesCount}
          onOpenFavorites={() => {
            setIsCartOpen(false);
            setIsFavoritesOpen(true);
          }}
          onOpenCart={() => {}}
          orderLogs={orderLogs}
          onClearLogs={clearLogs}
          authLogs={authLogs}
          onClearAuthLogs={clearAuthLogs}
          allProducts={products}
          onAddToCart={handleAddToCart}
        />
        {mobileTabBar}
      </>
    );
  }

  // If showing favorites, render favorites page
  if (isFavoritesOpen) {
    return (
      <>
        <RetailFavoritesPage
          products={products}
          favoriteIds={favoriteIds}
          onRemoveFavorite={handleToggleFavorite}
          onNavigateToProduct={(slug) => {
            setIsFavoritesOpen(false);
            onNavigateToProduct(slug);
          }}
          onBack={() => setIsFavoritesOpen(false)}
          onNavigateToLogin={!currentUser ? onNavigateToLogin : undefined}
          currentUser={currentUser}
          cartItemsCount={cartItemsCount}
          onOpenCart={() => {
            setIsFavoritesOpen(false);
            setIsCartOpen(true);
          }}
        />
        {mobileTabBar}
      </>
    );
  }

  // If showing product detail, render that instead
  if (showProductId && onBackToRetail) {
    // Show loading state if products haven't loaded yet
    if (isLoading) {
      return (
          <div className="min-h-screen bg-[#FFF4E5]">
            <header className="border-b border-border sticky top-0 bg-[#FFF4E5] z-50">
              <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
                <Logo className="h-6 sm:h-8 w-auto" onClick={onBackToRetail} />
                
                <div className="flex items-center gap-2 sm:gap-4">
                  <Button 
                    onClick={onNavigateToLogin}
                    size="sm"
                    className="text-xs sm:text-sm"
                  >
                    Войти
                  </Button>
                  
                  {/* Cart Button */}
                  <button
                    onClick={() => setIsCartOpen(true)}
                    className="relative p-2 hover:bg-[#222222]/10 rounded-lg transition-colors"
                  >
                    <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-[#222222]" />
                    <AnimatePresence>
                      {cartItemsCount > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute -top-1 -right-1 bg-[#FF90A1] text-[#222222] text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium"
                        >
                          <motion.span
                            key={cartItemsCount}
                            initial={{ scale: 1 }}
                            animate={{ scale: [1, 1.5, 1] }}
                            transition={{ duration: 0.3 }}
                          >
                            {cartItemsCount}
                          </motion.span>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
              </div>
            </header>
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF90A1] border-r-transparent"></div>
            </div>
          </div>
      );
    }
    
    return (
      <RetailProductDetail 
        productId={showProductId} 
        products={products}
        onBack={onBackToRetail}
        onNavigateToLogin={onNavigateToLogin}
        onAddToCart={handleAddToCart}
        cartItemsCount={cartItemsCount}
        onOpenCart={() => setIsCartOpen(true)}
        cartItems={cartItems}
        onUpdateQuantity={(id, weight, roast, grind, qty) => {
          if (qty < 1) {
            handleRemoveItem(id, weight, roast, grind);
          } else {
            handleUpdateQuantity(id, weight, roast, grind, qty);
          }
        }}
        isFavorite={foundProduct ? favoriteIds.includes(foundProduct.id) : false}
        onToggleFavorite={() => {
          if (foundProduct) {
            handleToggleFavorite(foundProduct.id);
          }
        }}
        currentUser={currentUser}
        favoritesCount={validFavoritesCount}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
      />
    );
  }

  // Показываем страницу успеха после заказа
  if (showOrderSuccess) {
    return (
      <>
        <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center">
          <div className="max-w-md mx-auto px-4 text-center">
            <FadeIn>
              <div className="bg-white border border-border rounded-lg p-8">
                {/* Картинка */}
                <div className="flex justify-center mb-6">
                  <ImageWithFallback
                    src="https://optim.tildacdn.com/tild3266-6237-4839-b232-653738353439/-/resize/400x/-/format/webp/photo.png.webp"
                    alt="Заказ оформлен"
                    className="w-64 h-auto rounded-lg"
                  />
                </div>

                <h1 className="text-2xl mb-4 text-[#222222]">Заказ офомлен!</h1>
                <p className="text-[#222222] text-sm sm:text-base mb-6">
                  Мы свяжемся с вами в ближайшее время для подтверждения заказа.
                </p>
                <Button
                  onClick={() => setShowOrderSuccess(false)}
                  className="w-full bg-[#f5ca4a] hover:bg-[#f5ca4a]/90 text-[#222222]"
                >
                  Продолжить покупки
                </Button>
              </div>
            </FadeIn>
          </div>
        </div>
        {mobileTabBar}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF4E5] relative isolate">
      {/* SEO Meta Tags */}
      <SEOHelmet {...SEOConfig.home} />

      {/* Header */}
      <RetailHeader 
        currentUser={currentUser}
        validFavoritesCount={validFavoritesCount}
        cartItemsCount={cartItemsCount}
        onNavigateToLogin={onNavigateToLogin}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
        onOpenCart={() => setIsCartOpen(true)}
        onHeightChange={setIsHeaderVisible}
      />

      {/* Ticker — scrolls with page */}
      <Ticker variant="retail" />

      {/* Hero Section */}
      <section 
        className="relative min-h-[65vh] sm:py-32 bg-[#FFF4E5] flex items-center"
      >
        {/* Animation container */}
        <div 
          ref={containerRef}
          className="absolute inset-0 overflow-hidden pointer-events-none"
        >
          {iconUrls.map((url, index) => (
            <img
              key={index}
              ref={(el) => {
                imageRefs.current[index] = el;
              }}
              src={url}
              alt=""
              className="absolute w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 select-none pointer-events-none"
              style={{
                top: 0,
                left: 0,
                willChange: 'transform',
                transform: 'translate3d(0,0,0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden'
              }}
            />
          ))}
        </div>

        {/* Main content */}
        <div className="container mx-auto px-4 text-center relative z-10 w-full">
          <FadeIn delay={0} duration={0.8} yOffset={30}>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-normal mb-3 sm:mb-4 text-[#222222] leading-tight">
              Кофе — это Нечай
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl font-normal text-[#222222]/85 leading-snug max-w-2xl mx-auto">
              {'Обжариваем свежий кофе '}
              <br className="md:hidden" aria-hidden="true" />
              {'в Петербурге'}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Category Tabs — sticky nav */}
      {!isLoading && sortedCategories.length > 1 && (
        <>
          {/* Sentinel: когда уходит за header (58px) — tabs считаются "прилипшими" */}
          <div ref={setTabsSentinelEl} aria-hidden="true" style={{ height: 0 }} />

          <div
            className={[
              'sticky z-30 transition-[top] duration-300 ease-in-out',
              // Мобайл: top зависит от видимости шапки; десктоп — всегда под шапкой
              isHeaderVisible
                ? 'top-[58px] sm:top-[66px]'
                : 'top-0 sm:top-[66px]',
              !isTabsStuck ? 'border-b border-[#e8d5c0] md:border-none' : ''
            ].join(' ')}
          >
            {/* Desktop: всегда виден */}
            <div
              className="hidden md:flex justify-center py-3 px-4 overflow-x-auto"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div className="inline-flex items-center gap-1 p-1.5 bg-[#FFF4E5] rounded-full border border-[#222222]/10 flex-shrink-0">
                {sortedCategories.map((category) => {
                  const isActive = activeCategory === category;
                  return (
                    <button
                      key={category}
                      onClick={() => scrollToCategory(category)}
                      className="relative whitespace-nowrap px-4 py-2 rounded-full text-sm shrink-0 transition-colors duration-200"
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTabPillDesktop"
                          className="absolute inset-0 bg-[#FF90A1] rounded-full"
                          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <span className={[
                        'relative z-10 transition-colors duration-200',
                        isActive ? 'text-[#222222] font-medium' : 'text-[#222222]/40'
                      ].join(' ')}>
                        {category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile: анимированное появление */}
            <AnimatePresence>
              {isTabsStuck && (
                <motion.div
                  key="mobile-category-tabs"
                  className="md:hidden"
                  style={{ overflow: 'hidden' }}
                  initial={{ maxHeight: 0, opacity: 0 }}
                  animate={{ maxHeight: 80, opacity: 1 }}
                  exit={{ maxHeight: 0, opacity: 0 }}
                  transition={{
                    maxHeight: { type: 'spring', stiffness: 420, damping: 36 },
                    opacity: { duration: 0.15, ease: 'easeOut' }
                  }}
                >
                  <motion.div
                    initial={{ y: -10 }}
                    animate={{ y: 0 }}
                    exit={{ y: -10 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                    className="overflow-x-auto py-3"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    <div className="flex justify-center px-4">
                    <div className="inline-flex items-center gap-1 p-1.5 bg-[#FFF4E5] rounded-full border border-[#222222]/10 flex-shrink-0">
                      {sortedCategories.map((category) => {
                        const isActive = activeCategory === category;
                        return (
                          <button
                            key={category}
                            onClick={() => scrollToCategory(category)}
                            className="relative whitespace-nowrap px-4 py-2 rounded-full text-sm shrink-0 transition-colors duration-200"
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeTabPillMobile"
                                className="absolute inset-0 bg-[#FF90A1] rounded-full"
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                              />
                            )}
                            <span className={[
                              'relative z-10 transition-colors duration-200',
                              isActive ? 'text-[#222222] font-medium' : 'text-[#222222]/40'
                            ].join(' ')}>
                              {category}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Products Grid */}
      <section id="catalog" className="py-12 sm:py-16 bg-[#FFF4E5]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-12">
              Загрузка товаров...
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">Товары скоро появятся</p>
              <p className="text-sm text-muted-foreground">Если вы администратор, инициализируйте тестовые данные в админ-панели.</p>
            </div>
          ) : (
            <>
              {sortedCategories.map((category, categoryIndex) => (
                <div
                  key={category}
                  className="mb-16 last:mb-0"
                  ref={(el) => { categoryRefs.current.set(category, el); }}
                >
                  {/* Category Title */}
                  <FadeIn delay={0.1 + (categoryIndex * 0.1)}>
                    <h2 className="text-2xl sm:text-3xl font-normal text-[#222222] mb-8 text-center">{category}</h2>
                  </FadeIn>

                  {/* Products Grid for this category */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-6 sm:gap-y-16">
                    {productsByCategory[category].map((product, productIndex) => (
                      <FadeIn
                        key={product.id}
                        delay={Math.min(0.15 + (categoryIndex * 0.1) + (productIndex * 0.05), 1.5)}
                        className="h-full"
                      >
                        <div
                          className="group cursor-pointer flex flex-col text-center h-full"
                          onClick={() => onNavigateToProduct(transliterate(product.name))}
                        >
                          {/* Product Image */}
                          <div className="relative w-full aspect-[4/5] mb-4 flex items-start justify-center">
                            <ImageWithFallback
                              src={product.imageUrl || "https://optim.tildacdn.com/stor6333-3237-4037-a331-366562356133/-/format/webp/97818023.png.webp"}
                              alt={product.name}
                              className="h-full w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                            />
                            {/* Recommended sticker — slowly rotates */}
                            {product.recommended && (
                              <motion.img
                                src={recommendedStickerSrc}
                                alt="Рекомендует Вуш"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                                className="absolute pointer-events-none select-none z-10 w-[82px] h-[82px] sm:w-[70px] sm:h-[70px] lg:w-[90px] lg:h-[90px] bottom-[20px] sm:bottom-[40px] left-[-4px] sm:left-[40px]"
                                style={{}}
                              />
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="flex flex-col items-center flex-1">
                            <h3 className="text-base sm:text-lg font-normal text-[#222222] leading-tight">
                              {product.name}
                            </h3>
                            {product.description && (
                              <p className="text-[#222222] text-xs sm:text-sm mt-2">
                                {product.description}
                              </p>
                            )}
                          </div>

                          {/* Quick Add Button — stops propagation so it doesn't navigate to product */}
                          <div className="mt-[14px] flex w-full flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {isDripCategory(category) && (
                              <DripRouletteTrigger size="compact" className="max-w-[200px]" />
                            )}
                            <QuickAddButton
                              product={product}
                              cartItems={cartItems}
                              onAddToCart={handleAddToCart}
                              onUpdateQuantity={handleUpdateQuantity}
                              onRemoveItem={handleRemoveItem}
                            />
                          </div>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      <Footer className="bg-[#FFF4E5] border-[#222222]/10" />
      {mobileTabBar}
    </div>
  );
}