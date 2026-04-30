import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AutoPaymentCheckerIndicatorProps {
  /** Показывать ли индикатор */
  show?: boolean;
  /** Интервал проверки в миллисекундах */
  checkInterval?: number;
}

/**
 * Индикатор автоматической проверки платежей (опционально)
 * Показывает маленький бейдж с информацией о следующей проверке
 */
export function AutoPaymentCheckerIndicator({ 
  show = true,
  checkInterval = 300000 // 5 минут по умолчанию
}: AutoPaymentCheckerIndicatorProps) {
  const [nextCheckIn, setNextCheckIn] = useState<number>(10); // Первая проверка через 10 секунд
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!show) return;

    // Обновляем таймер каждую секунду
    const timer = setInterval(() => {
      setNextCheckIn(prev => {
        if (prev <= 1) {
          // Время проверки!
          setIsChecking(true);
          setTimeout(() => setIsChecking(false), 2000);
          return checkInterval / 1000; // Следующая проверка через полный интервал
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [show, checkInterval]);

  if (!show) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}м ${secs}с`;
    }
    return `${secs}с`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <div className="bg-background border border-border rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
          <RefreshCw 
            className={`h-4 w-4 text-muted-foreground ${isChecking ? 'animate-spin text-[#FF90A1]' : ''}`} 
          />
          <div className="text-sm">
            <div className="text-foreground">
              {isChecking ? (
                <span className="text-[#FF90A1]">Проверка платежей...</span>
              ) : (
                <>
                  Следующая проверка через{' '}
                  <span className="text-[#FF90A1]">{formatTime(nextCheckIn)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
