import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="relative max-w-[min(100%,420px)] overflow-hidden border-[#222222]/15 bg-[#FFF4E5] p-5 sm:max-w-md sm:p-8"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <FireworksOverlay
          active={showFireworks}
          onComplete={() => setShowFireworks(false)}
        />

        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl font-normal text-[#222222] sm:text-2xl">
            Рулетка ДРИП
          </DialogTitle>
        </DialogHeader>

        <RouletteBoard
          letters={result}
          spinToken={spinToken}
          onComplete={handleSpinComplete}
        />

        <Button
          type="button"
          size="sm"
          disabled={isSpinning}
          onClick={handleSpin}
          className={`mt-2 h-10 w-full sm:h-9 ${DRIP_ROULETTE_BUTTON_CLASS}`}
        >
          {isSpinning ? 'Крутится…' : spinToken > 0 ? 'Крутить ещё' : 'Крутить'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
