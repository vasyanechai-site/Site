import { CheckCircle } from 'lucide-react@0.454.0';
import { Button } from './ui/button';
import { Logo } from './Logo';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface SuccessPageProps {
  orderId: string;
  onBackToCatalog: () => void;
  onNavigateToRetail?: () => void;
}

export function SuccessPage({ orderId, onBackToCatalog, onNavigateToRetail }: SuccessPageProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <Logo className="h-8 w-auto mx-auto mb-8" onClick={onNavigateToRetail} />
        
        <div className="flex justify-center mb-6">
          <ImageWithFallback
            src="https://optim.tildacdn.com/tild3266-6237-4839-b232-653738353439/-/resize/400x/-/format/webp/photo.png.webp"
            alt="Души в тебе Нечаю"
            className="w-64 h-auto rounded-lg"
          />
        </div>
        
        <h1 className="text-foreground mb-4 text-lg sm:text-2xl">Души в тебе Нечаю</h1>
        
        <p className="text-muted-foreground mb-8 text-sm sm:text-base">
          Ваш заказ №{orderId} принят. Скоро мы свяжемся с вами в мессенджере и ответим на любые вопросы.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            onClick={onBackToCatalog}
            className="bg-black text-white hover:bg-black/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 px-6 sm:px-8 text-sm sm:text-base"
          >
            Вернуться к прайсу
          </Button>
          {onNavigateToRetail && (
            <Button 
              onClick={onNavigateToRetail}
              variant="outline"
              className="px-6 sm:px-8 text-sm sm:text-base"
            >
              Розница
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}