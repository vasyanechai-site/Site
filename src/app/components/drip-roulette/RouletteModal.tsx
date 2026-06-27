import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '../ui/drawer';
import { useIsMobile } from '../ui/use-mobile';
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

interface RouletteModalBodyProps {
  isSpinning: boolean;
  spinToken: number;
  result: DripLetter[];
  showFireworks: boolean;
  onSpin: () => void;
  onSpinComplete: () => void;
  onFireworksComplete: () => void;
  onClose: () => void;
  layout: 'sheet' | 'dialog';
}

function RouletteModalBody({
  isSpinning,
  spinToken,
  result,
  showFireworks,
  onSpin,
  onSpinComplete,
  onFireworksComplete,
  onClose,
  layout,
}: RouletteModalBodyProps) {
  const Title = layout === 'sheet' ? DrawerTitle : DialogTitle;
  const Header = layout === 'sheet' ? DrawerHeader : DialogHeader;

  return (
    <>
      <FireworksOverlay active={showFireworks} onComplete={onFireworksComplete} />

      <Header
        className={
          layout === 'sheet'
            ? 'relative shrink-0 space-y-0 px-0 pb-2 pt-0 text-center'
            : 'relative shrink-0 space-y-0 pb-2 pt-0 text-center sm:text-center'
        }
      >
        <Title className="text-xl font-normal text-[#222222] sm:text-2xl">
          Рулетка ДРИП
        </Title>
        {layout === 'sheet' && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-0 right-0 flex h-8 w-8 items-center justify-center rounded-full text-[#222222]/60 transition-colors hover:bg-[#222222]/8"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </Header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
        <RouletteBoard
          letters={result}
          spinToken={spinToken}
          onComplete={onSpinComplete}
        />
      </div>

      <Button
        type="button"
        disabled={isSpinning}
        onClick={onSpin}
        className={`mt-4 shrink-0 ${DRIP_ROULETTE_BUTTON_CLASS}`}
      >
        {isSpinning ? 'Крутится…' : spinToken > 0 ? 'Крутить ещё' : 'Крутить'}
      </Button>
    </>
  );
}

function useIosScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const scrollY = window.scrollY;
    const { style: htmlStyle } = document.documentElement;
    const { style: bodyStyle } = document.body;

    htmlStyle.overflow = 'hidden';
    htmlStyle.overscrollBehavior = 'none';
    bodyStyle.overflow = 'hidden';
    bodyStyle.overscrollBehavior = 'none';
    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = '0';
    bodyStyle.right = '0';
    bodyStyle.width = '100%';

    return () => {
      htmlStyle.overflow = '';
      htmlStyle.overscrollBehavior = '';
      bodyStyle.overflow = '';
      bodyStyle.overscrollBehavior = '';
      bodyStyle.position = '';
      bodyStyle.top = '';
      bodyStyle.left = '';
      bodyStyle.right = '';
      bodyStyle.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}

export function RouletteModal({ open, onOpenChange }: RouletteModalProps) {
  const isMobile = useIsMobile();
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

  useIosScrollLock(open && isMobile);

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

  const bodyProps = {
    isSpinning,
    spinToken,
    result,
    showFireworks,
    onSpin: handleSpin,
    onSpinComplete: handleSpinComplete,
    onFireworksComplete: () => setShowFireworks(false),
    onClose: () => onOpenChange(false),
  };

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        dismissible
        direction="bottom"
        snapPoints={[0.88]}
        fadeFromIndex={0}
        noBodyStyles
      >
        <DrawerContent
          className="!mt-0 !bottom-0 !inset-x-0 flex max-h-[88dvh] min-h-0 flex-col overflow-hidden overscroll-none border-[#222222]/15 bg-[#FFF4E5] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <RouletteModalBody {...bodyProps} layout="sheet" />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!fixed !top-1/2 !left-1/2 !z-[100] flex max-h-[min(88vh,720px)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden gap-0 border-[#222222]/15 bg-[#FFF4E5] p-5 sm:p-8"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <RouletteModalBody {...bodyProps} layout="dialog" />
      </DialogContent>
    </Dialog>
  );
}
