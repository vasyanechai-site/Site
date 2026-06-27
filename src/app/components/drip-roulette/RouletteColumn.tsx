import { useEffect, useRef, useState } from 'react';
import {
  buildRouletteStrip,
  DRIP_LETTER_IMAGES,
  type DripLetter,
  SPIN_DURATION_MS,
  SPIN_EASING,
} from '../../lib/dripRoulette';

const TILE_SIZE_PX = 72;
const VIEWPORT_HEIGHT_PX = 108;

function translateForIndex(index: number): number {
  const center = (VIEWPORT_HEIGHT_PX - TILE_SIZE_PX) / 2;
  return -(index * TILE_SIZE_PX) + center;
}

export type RouletteDirection = 'down' | 'up';

interface RouletteColumnProps {
  targetLetter: DripLetter;
  direction: RouletteDirection;
  /** Меняется при каждом запуске — триггер анимации */
  spinToken: number;
  onComplete?: () => void;
}

export function RouletteColumn({
  targetLetter,
  direction,
  spinToken,
  onComplete,
}: RouletteColumnProps) {
  const completedRef = useRef(false);
  const spinTokenRef = useRef(spinToken);
  const [strip, setStrip] = useState<DripLetter[]>(() =>
    buildRouletteStrip(targetLetter, 2),
  );
  const [translateY, setTranslateY] = useState(() => translateForIndex(2));
  const [transitionEnabled, setTransitionEnabled] = useState(false);

  // Обновить букву на экране без анимации (до первого спина или смена result)
  useEffect(() => {
    if (spinToken > 0) return;
    setTransitionEnabled(false);
    setStrip(buildRouletteStrip(targetLetter, 2));
    setTranslateY(translateForIndex(2));
  }, [targetLetter, spinToken]);

  useEffect(() => {
    if (spinToken === 0) return;

    spinTokenRef.current = spinToken;
    completedRef.current = false;

    const targetIndex =
      direction === 'down'
        ? 22 + Math.floor(Math.random() * 8)
        : 18 + Math.floor(Math.random() * 6);
    const nextStrip = buildRouletteStrip(targetLetter, targetIndex);
    const endY = translateForIndex(targetIndex);
    const startY =
      direction === 'down'
        ? translateForIndex(0)
        : endY - (14 + Math.floor(Math.random() * 6)) * TILE_SIZE_PX;

    setTransitionEnabled(false);
    setStrip(nextStrip);
    setTranslateY(startY);

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionEnabled(true);
        setTranslateY(endY);
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [spinToken, targetLetter, direction]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== 'transform' || completedRef.current) return;
    if (!transitionEnabled || spinToken === 0) return;
    completedRef.current = true;
    onComplete?.();
  };

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-xl bg-[#FFF4E5]/80 ring-1 ring-[#222222]/10"
      style={{ width: TILE_SIZE_PX + 8, height: VIEWPORT_HEIGHT_PX }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[#FFF4E5] to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-[#FFF4E5] to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-[5] h-[72px] -translate-y-1/2 rounded-lg ring-2 ring-[#222222]/15 ring-inset"
        aria-hidden
      />

      <div
        className="flex flex-col items-center will-change-transform"
        style={{
          transform: `translate3d(0, ${translateY}px, 0)`,
          transition: transitionEnabled
            ? `transform ${SPIN_DURATION_MS}ms ${SPIN_EASING}`
            : 'none',
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {strip.map((letter, idx) => (
          <div
            key={`${spinToken}-${idx}-${letter}`}
            className="flex shrink-0 items-center justify-center p-0.5"
            style={{ width: TILE_SIZE_PX + 8, height: TILE_SIZE_PX }}
          >
            <img
              src={DRIP_LETTER_IMAGES[letter]}
              alt={letter}
              className="h-[68px] w-[68px] object-contain select-none"
              draggable={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
