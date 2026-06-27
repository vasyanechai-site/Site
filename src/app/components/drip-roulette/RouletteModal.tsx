import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '../ui/drawer';
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
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <DrawerContent
        className="relative mx-auto flex h-[88vh] max-h-[88vh] w-full max-w-none flex-col overflow-hidden rounded-t-[20px] border-[#222222]/15 bg-[#FFF4E5] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <FireworksOverlay
          active={showFireworks}
          onComplete={() => setShowFireworks(false)}
        />

        <DrawerHeader className="shrink-0 pb-2 pt-1 text-center">
          <DrawerTitle className="text-xl font-normal text-[#222222] sm:text-2xl">
            Рулетка ДРИП
          </DrawerTitle>
        </DrawerHeader>

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
      </DrawerContent>
    </Drawer>
  );
}
