export type DripLetter = 'Д' | 'Р' | 'И' | 'П';

export const DRIP_LETTERS: DripLetter[] = ['Д', 'Р', 'И', 'П'];

export const PIDR_WORD: DripLetter[] = ['П', 'И', 'Д', 'Р'];

/** Вероятность выпадения «П И Д Р» за один спин */
export const PIDR_WORD_CHANCE = 0.1;

export const DRIP_LETTER_IMAGES: Record<DripLetter, string> = {
  Д: '/drip-roulette/d.png',
  Р: '/drip-roulette/r.png',
  И: '/drip-roulette/i.png',
  П: '/drip-roulette/p.png',
};

/** Чуть дольше прежних 5 с */
export const SPIN_DURATION_MS = 6800;

/** Быстрый старт, длинное замедление, лёгкий overshoot в конце */
export const SPIN_EASING = 'cubic-bezier(0.08, 0.82, 0.12, 1.04)';

export function randomDripLetter(): DripLetter {
  return DRIP_LETTERS[Math.floor(Math.random() * DRIP_LETTERS.length)]!;
}

export function randomDripWord(): DripLetter[] {
  if (Math.random() < PIDR_WORD_CHANCE) {
    return [...PIDR_WORD];
  }
  let word: DripLetter[];
  do {
    word = Array.from({ length: 4 }, () => randomDripLetter());
  } while (isPidrWord(word));
  return word;
}

export function isPidrWord(letters: DripLetter[]): boolean {
  return (
    letters.length === 4 &&
    letters.every((letter, index) => letter === PIDR_WORD[index])
  );
}

export function isDripCategory(category?: string | null): boolean {
  if (!category) return false;
  return category === 'Дрип' || category === 'Дрип кофе';
}

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

/** Крупная кнопка рулетки (≈2× «Вход для бизнеса») */
export const DRIP_ROULETTE_BUTTON_CLASS =
  'h-16 w-full px-8 text-base sm:text-lg sm:h-16';
