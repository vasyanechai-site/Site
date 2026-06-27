import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { RouletteColumn, type RouletteDirection } from './RouletteColumn';
import {
  randomDripWord,
  type DripLetter,
} from '../../lib/dripRoulette';

const COLUMN_DIRECTIONS: RouletteDirection[] = ['down', 'up', 'down', 'up'];

interface RouletteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RouletteModal({ open, onOpenChange }: RouletteModalProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinToken, setSpinToken] = useState(0);
  const [result, setResult] = useState<DripLetter[]>(() => randomDripWord());
  const completedCountRef = useRef(0);

  const resetSpinState = useCallback(() => {
    completedCountRef.current = 0;
    setIsSpinning(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetSpinState();
      setSpinToken(0);
    }
  }, [open, resetSpinState]);

  const handleSpin = () => {
    if (isSpinning) return;
    const next = randomDripWord();
    setResult(next);
    completedCountRef.current = 0;
    setIsSpinning(true);
    setSpinToken((t) => t + 1);
  };

  const handleColumnComplete = () => {
    if (!isSpinning) return;
    completedCountRef.current += 1;
    if (completedCountRef.current >= 4) {
      setIsSpinning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[min(100%,420px)] border-[#222222]/15 bg-[#FFF4E5] p-5 sm:p-8 sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl font-normal text-[#222222] sm:text-2xl">
            Рулетка ДРИП
          </DialogTitle>
          <DialogDescription className="text-[#222222]/70">
            Крути барабаны и собери случайное слово из букв Д, Р, И, П
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-1.5 sm:gap-2 py-2">
          {result.map((letter, index) => (
            <RouletteColumn
              key={index}
              targetLetter={letter}
              direction={COLUMN_DIRECTIONS[index]!}
              spinToken={spinToken}
              onComplete={handleColumnComplete}
            />
          ))}
        </div>

        {!isSpinning && spinToken > 0 && (
          <p className="text-center text-lg tracking-[0.35em] text-[#222222] font-medium">
            {result.join('')}
          </p>
        )}

        <Button
          type="button"
          disabled={isSpinning}
          onClick={handleSpin}
          className="mt-2 h-14 w-full rounded-xl border border-[#222222]/10 bg-[#FFE500] text-lg font-medium text-[#222222] shadow-sm transition-all hover:bg-[#FFD700] hover:shadow-md active:scale-[0.98] active:bg-[#F5C400] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
        >
          {isSpinning ? 'Крутится…' : spinToken > 0 ? 'Крутить ещё' : 'Крутить'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
