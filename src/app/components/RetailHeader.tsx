import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { User, Heart, ShoppingCart, MapPin, CalendarDays } from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { cn } from './ui/utils';

interface RetailHeaderProps {
  currentUser?: any;
  validFavoritesCount?: number;
  cartItemsCount?: number;
  onNavigateToLogin: () => void;
  onOpenFavorites: () => void;
  onOpenCart: () => void;
  className?: string;
  onBack?: () => void;
  /** Колбэк — сообщает наружу актуальную высоту шапки (нужно табам для позиционирования) */
  onHeightChange?: (visible: boolean) => void;
}

export function RetailHeader({
  currentUser,
  validFavoritesCount = 0,
  cartItemsCount = 0,
  onNavigateToLogin,
  onOpenFavorites,
  onOpenCart,
  className,
  onHeightChange,
}: RetailHeaderProps) {
  const navigate = useNavigate();

  // ── Scroll-hide on mobile ─────────────────────────────────────────────────
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        // Только на мобайле (< 768px md breakpoint)
        if (window.innerWidth >= 768) {
          setVisible(true);
          ticking.current = false;
          return;
        }
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;

        if (Math.abs(delta) < 4) { ticking.current = false; return; }

        if (delta > 0 && currentY > 60) {
          // Скролл вниз — прячем
          setVisible(false);
        } else {
          // Скролл вверх — показываем
          setVisible(true);
        }
        lastScrollY.current = currentY;
        ticking.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Сообщаем родителю об изменении видимости
  useEffect(() => {
    onHeightChange?.(visible);
  }, [visible, onHeightChange]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-border bg-[#FFF4E5]',
        // Нельзя вешать transform на sticky-элемент: ломается прилипание и сверху просвечивает контент.
        // Скрытие только на мобайле; в видимом состоянии transform не задаём.
        'max-md:transition-transform max-md:duration-300 max-md:ease-in-out',
        !visible && 'max-md:pointer-events-none max-md:-translate-y-full',
        className
      )}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
        <Logo 
          className="h-6 sm:h-8 w-auto cursor-pointer" 
          onClick={() => navigate('/')} 
        />
        
        <div className="flex items-center gap-2 sm:gap-4">
          {currentUser ? (
            <button 
              onClick={() => navigate('/dashboard')}
              className="relative p-2 hover:bg-[#222222]/10 rounded-lg transition-colors hidden sm:block"
              title="Профиль"
            >
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-[#222222]" />
            </button>
          ) : (
            <>
              <Button 
                onClick={() => navigate('/loginopt')}
                size="sm"
                className="text-xs sm:text-sm"
              >
                Вход для бизнеса
              </Button>
              <button
                onClick={onNavigateToLogin}
                className="relative p-2 hover:bg-[#222222]/10 rounded-lg transition-colors hidden sm:block"
                title="Войти"
              >
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-[#222222]" />
              </button>
            </>
          )}

          {/* Locations Pin */}
          <button 
            onClick={() => navigate('/locations')}
            className="relative p-2 hover:bg-[#222222]/10 rounded-lg transition-colors hidden sm:block"
            title="Где купить"
          >
            <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-[#222222]" />
          </button>

          {/* Harvest Calendar */}
          <button
            onClick={() => navigate('/harvest')}
            className="relative p-2 hover:bg-[#222222]/10 rounded-lg transition-colors hidden sm:block"
            title="Календарь урожая"
          >
            <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-[#222222]" />
          </button>
          
          {/* Favorites Button */}
          <button
             onClick={onOpenFavorites}
             className="relative p-2 hover:bg-[#222222]/10 rounded-lg transition-colors hidden sm:block"
          >
             <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-[#222222]" />
             <AnimatePresence>
               {validFavoritesCount > 0 && (
                 <motion.span
                   initial={{ scale: 0 }}
                   animate={{ scale: 1 }}
                   exit={{ scale: 0 }}
                   className="absolute -top-1 -right-1 bg-[#FF90A1] text-[#222222] text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium"
                 >
                   {validFavoritesCount}
                 </motion.span>
               )}
             </AnimatePresence>
          </button>
          
          {/* Cart Button */}
          <button
            id="retail-cart-btn"
            onClick={onOpenCart}
            className="relative p-2 hover:bg-[#222222]/10 rounded-lg transition-colors hidden sm:block"
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
  );
}