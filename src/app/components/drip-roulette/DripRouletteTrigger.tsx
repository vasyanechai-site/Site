import { useState } from 'react';
import { Button } from '../ui/button';
import { RouletteModal } from './RouletteModal';
import { DRIP_ROULETTE_BUTTON_CLASS } from '../../lib/dripRoulette';
import { cn } from '../ui/utils';

interface DripRouletteTriggerProps {
  className?: string;
  /** overlay — по центру обложки товара */
  variant?: 'default' | 'overlay';
}

export function DripRouletteTrigger({
  className = '',
  variant = 'default',
}: DripRouletteTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        className={cn(
          DRIP_ROULETTE_BUTTON_CLASS,
          variant === 'overlay' && 'shadow-md',
          className,
        )}
      >
        Крути ДРИП
      </Button>
      <RouletteModal open={open} onOpenChange={setOpen} />
    </>
  );
}
