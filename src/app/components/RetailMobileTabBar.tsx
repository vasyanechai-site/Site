import React from 'react';
import { motion } from 'motion/react';
import { Home, MapPin, Heart, ShoppingCart, User, CalendarDays } from 'lucide-react';
import { cn } from './ui/utils';

export type TabId = 'home' | 'locations' | 'favorites' | 'cart' | 'profile' | 'harvest';

interface RetailMobileTabBarProps {
  currentTab: TabId;
  onTabSelect: (tab: TabId) => void;
  cartItemsCount?: number;
  favoritesCount?: number;
  className?: string;
}

export function RetailMobileTabBar({
  currentTab,
  onTabSelect,
  cartItemsCount = 0,
  favoritesCount = 0,
  className
}: RetailMobileTabBarProps) {
  const tabs: { id: TabId; icon: React.ElementType; label: string }[] = [
    { id: 'home',      icon: Home,         label: 'Главная'  },
    { id: 'favorites', icon: Heart,         label: 'Избранное' },
    { id: 'cart',      icon: ShoppingCart,  label: 'Корзина'  },
    { id: 'profile',   icon: User,          label: 'Профиль'  },
    { id: 'locations', icon: MapPin,        label: 'Где купить' },
    { id: 'harvest',   icon: CalendarDays,  label: 'Календарь' },
  ];

  const getIconAnimation = (id: TabId, isActive: boolean) => {
    if (!isActive) return {};
    
    switch (id) {
      case 'home':
        return {
          scale: [1, 1.15, 0.9, 1.05, 1],
          transition: { duration: 0.6, ease: "easeInOut" }
        };
      case 'favorites':
        return {
          scale: [1, 1.25, 1],
          transition: { repeat: 1, repeatType: "reverse" as const, duration: 0.4 }
        };
      case 'cart':
        return {
          x: [0, -2, 2, -2, 2, 0],
          rotate: [0, -5, 5, -5, 5, 0],
          transition: { duration: 0.5 }
        };
      case 'profile':
        return {
          y: [0, -4, 0],
          scaleY: [1, 0.9, 1],
          transition: { duration: 0.4 }
        };
      case 'locations':
        return {
          y: [0, -4, 0],
          scale: [1, 1.15, 1],
          transition: { 
            duration: 0.5,
            ease: "easeInOut"
          }
        };
      case 'harvest':
        return {
          rotate: [0, -8, 8, -4, 0],
          scale: [1, 1.15, 1],
          transition: { duration: 0.5, ease: "easeInOut" }
        };
      default:
        return {};
    }
  };

  return (
    <div className={cn("fixed bottom-6 left-1/2 -translate-x-1/2 z-50 sm:hidden w-max max-w-[95vw]", className)}>
      <div className="flex items-center gap-1 p-1.5 bg-[#FFF4E5] rounded-full shadow-[0_0_40px_rgba(0,0,0,0.12)] border border-[#222222]/10 backdrop-blur-md">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              id={tab.id === 'cart' ? 'retail-cart-tab' : undefined}
              onClick={() => onTabSelect(tab.id)}
              className="relative px-3 py-2.5 rounded-full transition-colors flex items-center justify-center min-w-[50px]"
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-[#FF90A1] rounded-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              
              <div className="relative z-10 flex items-center justify-center">
                <motion.div
                  animate={getIconAnimation(tab.id, isActive)}
                  className="flex items-center justify-center"
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-colors duration-200",
                      isActive ? "text-[#222222]" : "text-[#222222]/40 hover:text-[#222222]"
                    )}
                    strokeWidth={2}
                  />
                </motion.div>
                
                {/* Badges */}
                {tab.id === 'cart' && cartItemsCount > 0 && (
                  <span className={cn(
                    "absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-[16px] text-[10px] font-bold rounded-full px-0.5",
                    isActive ? "bg-[#222222] text-white" : "bg-[#FF90A1] text-[#222222]"
                  )}>
                    {cartItemsCount}
                  </span>
                )}
                {tab.id === 'favorites' && favoritesCount > 0 && (
                  <span className={cn(
                    "absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-[16px] text-[10px] font-bold rounded-full px-0.5 border-2",
                    isActive ? "bg-[#222222] text-white border-[#FF90A1]" : "bg-[#222222] text-white border-white"
                  )}>
                    {favoritesCount}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}