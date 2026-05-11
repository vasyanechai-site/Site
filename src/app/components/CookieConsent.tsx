import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { Button } from './ui/button';
import { loadYandexMetrika } from '../lib/yandexMetrikaLoader';
import { RETAIL_AUTH_STORAGE_KEY } from '../lib/retailAuth';

export const COOKIE_CONSENT_KEY = 'nechai_cookie_consent_v1';

type Stored = { v: 1; analytics: boolean; at: string };

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Stored>;
    if (p && typeof p.analytics === 'boolean' && p.at) return { v: 1, analytics: p.analytics, at: p.at };
    return null;
  } catch {
    return null;
  }
}

function writeStored(analytics: boolean) {
  const s: Stored = { v: 1, analytics, at: new Date().toISOString() };
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(s));
}

/**
 * Компактное уведомление о cookie (152‑ФЗ): необходимые для работы сайта;
 * аналитика (Яндекс.Метрика) — только после явного выбора «Принять».
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  const applyStored = useCallback((s: Stored) => {
    if (s.analytics) loadYandexMetrika();
    setVisible(false);
  }, []);

  useEffect(() => {
    const existing = readStored();
    if (existing) {
      applyStored(existing);
      return;
    }
    try {
      const recognized =
        !!localStorage.getItem('userAuth') || !!localStorage.getItem(RETAIL_AUTH_STORAGE_KEY);
      if (recognized) {
        writeStored(true);
        loadYandexMetrika();
        setVisible(false);
        return;
      }
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, [applyStored]);

  const acceptAll = () => {
    writeStored(true);
    loadYandexMetrika();
    setVisible(false);
  };

  const necessaryOnly = () => {
    writeStored(false);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[200] p-2 sm:p-3 pointer-events-none"
      role="dialog"
      aria-label="Уведомление о файлах cookie"
    >
      <div className="pointer-events-auto mx-auto max-w-lg rounded-xl border border-border/80 bg-background/95 backdrop-blur-md shadow-lg px-3 py-2.5 sm:px-4 sm:py-3 text-[11px] sm:text-xs leading-snug text-muted-foreground">
        <p className="text-foreground/90 mb-2">
          Для работы сайта используются необходимые cookie. Сервис веб-аналитики (Яндекс.Метрика) подключается только с вашего согласия. Подробнее в{' '}
          <Link to="/privacy" className="underline text-foreground hover:text-[#F47D37]">
            Политике конфиденциальности
          </Link>
          ,{' '}
          <Link to="/agreement" className="underline text-foreground hover:text-[#F47D37]">
            Пользовательском соглашении
          </Link>
          {' '}и{' '}
          <Link to="/marketing-consent" className="underline text-foreground hover:text-[#F47D37]">
            Согласии на сообщения
          </Link>
          .
        </p>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={necessaryOnly}
            className="text-[11px] sm:text-xs text-muted-foreground underline-offset-2 hover:underline px-1"
          >
            Только необходимые
          </button>
          <Button
            type="button"
            size="sm"
            className="h-7 sm:h-8 text-[11px] sm:text-xs px-3 bg-[#F47D37] hover:bg-[#d96a2a] text-white"
            onClick={acceptAll}
          >
            Принять
          </Button>
        </div>
      </div>
    </div>
  );
}
