import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { RouletteBoard } from './RouletteBoard';
import { FireworksOverlay } from './FireworksOverlay';
import {
  DRIP_ROULETTE_BUTTON_CLASS,
  isPidrWord,
  randomDripWord,
  type DripLetter,
} from '../../lib/dripRoulette';

interface RouletteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RouletteModal({ open, onOpenChange }: RouletteModalProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinToken, setSpinToken] = useState(0);
  const [result, setResult] = useState<DripLetter[]>(() => randomDripWord());
  const [showFireworks, setShowFireworks] = useState(false);
  const resultRef = useRef(result);
  resultRef.current = result;

  const resetSpinState = useCallback(() => {
    setIsSpinning(false);
    setShowFireworks(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetSpinState();
      setSpinToken(0);
    }
  }, [open, resetSpinState]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  const handleSpin = () => {
    if (isSpinning) return;
    setShowFireworks(false);
    const next = randomDripWord();
    setResult(next);
    resultRef.current = next;
    setIsSpinning(true);
    setSpinToken((t) => t + 1);
  };

  const handleSpinComplete = () => {
    setIsSpinning(false);
    if (isPidrWord(resultRef.current)) {
      setShowFireworks(true);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Закрыть"
        onClick={() => onOpenChange(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drip-roulette-title"
        className="relative z-[101] flex h-[88vh] max-h-[88vh] w-full max-w-none flex-col overflow-hidden rounded-t-[20px] border border-[#222222]/15 bg-[#FFF4E5] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl animate-in slide-in-from-bottom duration-300"
        onClick={(event) => event.stopPropagation()}
      >
        <FireworksOverlay
          active={showFireworks}
          onComplete={() => setShowFireworks(false)}
        />

        <div className="mx-auto mb-1 h-1.5 w-12 shrink-0 rounded-full bg-[#222222]/15" />

        <div className="relative shrink-0 pb-2 pt-1 text-center">
          <h2
            id="drip-roulette-title"
            className="text-xl font-normal text-[#222222] sm:text-2xl"
          >
            Рулетка ДРИП
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-0 right-0 flex h-8 w-8 items-center justify-center rounded-full text-[#222222]/60 transition-colors hover:bg-[#222222]/8"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <RouletteBoard
            letters={result}
            spinToken={spinToken}
            onComplete={handleSpinComplete}
          />
        </div>

        <Button
          type="button"
          disabled={isSpinning}
          onClick={handleSpin}
          className={`mt-4 shrink-0 ${DRIP_ROULETTE_BUTTON_CLASS}`}
        >
          {isSpinning ? 'Крутится…' : spinToken > 0 ? 'Крутить ещё' : 'Крутить'}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
