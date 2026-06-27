import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  buildRouletteStrip,
  DRIP_LETTER_IMAGES,
  type DripLetter,
  SPIN_DURATION_MS,
  SPIN_EASING,
} from '../../lib/dripRoulette';

const TILE_SIZE_PX = 72;
const VIEWPORT_HEIGHT_PX = 108;

export type RouletteDirection = 'down' | 'up';

const COLUMN_DIRECTIONS: RouletteDirection[] = ['down', 'up', 'down', 'up'];

function translateForIndex(index: number): number {
  const center = (VIEWPORT_HEIGHT_PX - TILE_SIZE_PX) / 2;
  return -(index * TILE_SIZE_PX) + center;
}

interface ReelView {
  strip: DripLetter[];
  translateY: number;
  endY: number;
  transitionEnabled: boolean;
}

function buildSpinReel(letter: DripLetter, direction: RouletteDirection): ReelView {
  const targetIndex =
    direction === 'down'
      ? 28 + Math.floor(Math.random() * 10)
      : 24 + Math.floor(Math.random() * 8);
  const strip = buildRouletteStrip(letter, targetIndex);
  const endY = translateForIndex(targetIndex);
  const startY =
    direction === 'down'
      ? translateForIndex(0)
      : endY + (18 + Math.floor(Math.random() * 8)) * TILE_SIZE_PX;

  return {
    strip,
    translateY: startY,
    endY,
    transitionEnabled: false,
  };
}

function buildIdleReels(letters: DripLetter[]): ReelView[] {
  const y = translateForIndex(2);
  return letters.map((letter) => ({
    strip: buildRouletteStrip(letter, 2),
    translateY: y,
    endY: y,
    transitionEnabled: false,
  }));
}

interface RouletteBoardProps {
  letters: DripLetter[];
  spinToken: number;
  onComplete?: () => void;
}

export function RouletteBoard({ letters, spinToken, onComplete }: RouletteBoardProps) {
  const [reels, setReels] = useState<ReelView[]>(() => buildIdleReels(letters));
  const lastSpinTokenRef = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (spinToken === 0) {
      setReels(buildIdleReels(letters));
    }
  }, [letters, spinToken]);

  useLayoutEffect(() => {
    if (spinToken === 0 || spinToken === lastSpinTokenRef.current) return;
    lastSpinTokenRef.current = spinToken;
    completedRef.current = false;

    const spinReels = letters.map((letter, index) =>
      buildSpinReel(letter, COLUMN_DIRECTIONS[index]!),
    );

    setReels(spinReels);

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setReels((prev) =>
          prev.map((reel) => ({
            ...reel,
            translateY: reel.endY,
            transitionEnabled: true,
          })),
        );
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [spinToken, letters]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== 'transform' || spinToken === 0 || completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  };

  return (
    <div className="flex justify-center gap-1.5 sm:gap-2 py-2">
      {reels.map((reel, index) => (
        <div
          key={index}
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
            className="flex flex-col items-center will-change-transform"
            style={{
              transform: `translate3d(0, ${reel.translateY}px, 0)`,
              transition: reel.transitionEnabled
                ? `transform ${SPIN_DURATION_MS}ms ${SPIN_EASING}`
                : 'none',
            }}
            onTransitionEnd={index === 0 ? handleTransitionEnd : undefined}
          >
            {reel.strip.map((letter, idx) => (
              <div
                key={`${spinToken}-${index}-${idx}-${letter}`}
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
      ))}
    </div>
  );
}
