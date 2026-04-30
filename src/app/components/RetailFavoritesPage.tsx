import { ArrowLeft, Heart, ShoppingCart } from 'lucide-react';
import { Button } from './ui/button';
import { RetailHeader } from './RetailHeader';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { RetailProduct } from '../lib/api';
import { transliterate } from '../lib/transliterate';
import { WooshIcon } from './WooshIcon';

interface RetailFavoritesPageProps {
  products: RetailProduct[];
  favoriteIds: string[];
  onRemoveFavorite: (productId: string) => void;
  onNavigateToProduct: (slug: string) => void;
  onBack: () => void;
  onNavigateToLogin?: () => void;
  currentUser?: any;
  cartItemsCount?: number;
  onOpenCart?: () => void;
}

export function RetailFavoritesPage({
  products,
  favoriteIds,
  onRemoveFavorite,
  onNavigateToProduct,
  onBack,
  onNavigateToLogin,
  currentUser,
  cartItemsCount = 0,
  onOpenCart
}: RetailFavoritesPageProps) {
  const favoriteProducts = products.filter(p => favoriteIds.includes(p.id));

  if (favoriteProducts.length === 0) {
    return (
      <div className="min-h-screen bg-[#FFF4E5] flex flex-col">
        <RetailHeader 
          currentUser={currentUser}
          validFavoritesCount={favoriteIds.length}
          cartItemsCount={cartItemsCount}
          onNavigateToLogin={onNavigateToLogin || (() => {})}
          onOpenFavorites={() => {}} // Already on favorites
          onOpenCart={() => onOpenCart?.()}
        />

        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-20 h-20 bg-[#FF90A1]/20 rounded-full flex items-center justify-center mx-auto text-[#222222]">
              <Heart className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-medium text-[#222222]">В избранном пока пусто</h2>
            <p className="text-[#222222]/60">Добавляйте товары, чтобы не потерять их</p>
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
        currentUser={currentUser}
        validFavoritesCount={favoriteIds.length}
        cartItemsCount={cartItemsCount}
        onNavigateToLogin={onNavigateToLogin || (() => {})}
        onOpenFavorites={() => {}} // Already on favorites
        onOpenCart={() => onOpenCart?.()}
      />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl text-[#222222] mb-8 sm:mb-12 font-normal">Избранное</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-6 sm:gap-y-16">
          {favoriteProducts.map((product) => (
            <div 
              key={product.id}
              className="group cursor-pointer flex flex-col text-center"
              onClick={() => onNavigateToProduct(transliterate(product.name))}
            >
              {/* Product Image - aligned to top */}
              <div className="w-full aspect-[4/5] mb-4 flex items-start justify-center">
                <ImageWithFallback
                  src={product.imageUrl || "https://optim.tildacdn.com/stor6333-3237-4037-a331-366562356133/-/format/webp/97818023.png.webp"}
                  alt={product.name}
                  className="h-full w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Product Info */}
              <div className="flex flex-col items-center space-y-3">
                <h3 className="text-lg sm:text-xl font-normal text-[#222222] leading-tight">
                  {product.name}
                </h3>
                {product.description && (
                  <p className="text-[#222222] text-sm sm:text-base">
                    {product.description}
                  </p>
                )}
                <div className="text-lg sm:text-xl text-[#222222]">
                  {product.price} ₽
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
