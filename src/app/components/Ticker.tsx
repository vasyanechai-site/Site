import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { API_BASE_URL } from '../lib/backendConfig';

interface TickerSettings {
  enabled: boolean;
  text: string;
}

interface TickerProps {
  variant?: 'wholesale' | 'retail';
  className?: string;
}

export function Ticker({ variant = 'wholesale', className }: TickerProps) {
  const [settings, setSettings] = useState<TickerSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
    // Обновляем настройки каждые 30 секунд
    const interval = setInterval(fetchSettings, 30000);
    return () => clearInterval(interval);
  }, [variant]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/ticker-settings?type=${variant}`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      // Тихо игнорируем ошибки - просто не показываем бегущую строку
    } finally {
      setLoading(false);
    }
  };

  if (loading || !settings || !settings.enabled || !settings.text) {
    return null;
  }

  // Повторяем текст много раз для бесконечного эффекта
  const textArray = Array(20).fill(settings.text);

  return (
    <div className={`h-[32px] sm:h-[50px] bg-[#9aaed9] overflow-hidden flex items-center w-full relative ${className || ''}`}>
      <motion.div
        className="whitespace-nowrap flex items-center absolute"
        animate={{ x: ['0%', '-50%'] }}
        transition={{
          repeat: Infinity,
          duration: 120,
          ease: "linear",
        }}
        style={{ willChange: "transform" }}
      >
        <div className="inline-flex items-center">
          {textArray.map((text, i) => (
            <span key={i} className="text-white dark:text-gray-900 text-sm sm:text-lg font-normal mr-[32px] sm:mr-[48px]">
              {text}
            </span>
          ))}
        </div>
        <div className="inline-flex items-center">
          {textArray.map((text, i) => (
            <span key={`dup-${i}`} className="text-white dark:text-gray-900 text-sm sm:text-lg font-normal mr-[32px] sm:mr-[48px]">
              {text}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}