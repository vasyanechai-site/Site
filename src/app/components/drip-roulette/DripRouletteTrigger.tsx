import { useState } from 'react';
import { Button } from '../ui/button';
import { RouletteModal } from './RouletteModal';

interface DripRouletteTriggerProps {
  className?: string;
  /** compact — для карточки в сетке; default — для страницы товара */
  size?: 'compact' | 'default';
}

export function DripRouletteTrigger({ className = '', size = 'default' }: DripRouletteTriggerProps) {
  const [open, setOpen] = useState(false);

  const sizeClasses =
    size === 'compact'
      ? 'h-10 w-full text-sm rounded-lg'
      : 'h-12 w-full text-base sm:text-lg rounded-xl';

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        className={`border-[#222222]/10 bg-[#FFE500] font-medium text-[#222222] shadow-sm transition-all hover:bg-[#FFD700] hover:shadow-md active:scale-[0.98] active:bg-[#F5C400] ${sizeClasses} ${className}`}
      >
        Крути ДРИП
      </Button>
      <RouletteModal open={open} onOpenChange={setOpen} />
    </>
  );
}
