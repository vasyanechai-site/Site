export type DripLetter = 'Д' | 'Р' | 'И' | 'П';

export const DRIP_LETTERS: DripLetter[] = ['Д', 'Р', 'И', 'П'];

export const DRIP_LETTER_IMAGES: Record<DripLetter, string> = {
  Д: '/drip-roulette/d.png',
  Р: '/drip-roulette/r.png',
  И: '/drip-roulette/i.png',
  П: '/drip-roulette/p.png',
};

export const SPIN_DURATION_MS = 5000;

/** cubic-bezier: ускорение в начале, замедление и лёгкий overshoot в конце */
export const SPIN_EASING = 'cubic-bezier(0.22, 1, 0.36, 1.05)';

export function randomDripLetter(): DripLetter {
  return DRIP_LETTERS[Math.floor(Math.random() * DRIP_LETTERS.length)]!;
}

export function randomDripWord(): DripLetter[] {
  return Array.from({ length: 4 }, () => randomDripLetter());
}

export function isDripCategory(category?: string | null): boolean {
  if (!category) return false;
  return category === 'Дрип' || category === 'Дрип кофе';
}

/** Лента плиток со случайным порядком; targetLetter окажется на targetIndex. */
export function buildRouletteStrip(targetLetter: DripLetter, targetIndex: number): DripLetter[] {
  const strip: DripLetter[] = [];
  for (let i = 0; i < targetIndex; i += 1) {
    strip.push(randomDripLetter());
  }
  strip.push(targetLetter);
  for (let i = 0; i < 6; i += 1) {
    strip.push(randomDripLetter());
  }
  return strip;
}
