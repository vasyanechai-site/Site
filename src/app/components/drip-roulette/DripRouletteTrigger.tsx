import { useState } from 'react';
import { RouletteModal } from './RouletteModal';
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        className={cn(
          'group relative isolate overflow-hidden rounded-2xl border border-white',
          'bg-white text-[#222222] font-medium',
          'h-16 px-8 text-base sm:text-lg',
          'shadow-[inset_0_1px_0_rgba(255,255,255,1),0_3px_0_#d9d9d9,0_12px_32px_rgba(34,34,34,0.16)]',
          'transition-[transform,box-shadow,filter] duration-200 ease-out',
          'hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_4px_0_#d4d4d4,0_16px_36px_rgba(34,34,34,0.2)]',
          'active:translate-y-0.5 active:shadow-[inset_0_2px_6px_rgba(34,34,34,0.1),0_1px_0_#cfcfcf,0_4px_12px_rgba(34,34,34,0.12)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF90A1]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF4E5]',
          variant === 'overlay' && 'w-auto',
          variant === 'default' && 'w-full',
          className,
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-drip-button-glow bg-gradient-to-br from-[#FFE500]/30 via-white/10 to-[#FF90A1]/25"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 animate-drip-button-shimmer bg-gradient-to-r from-transparent via-white to-transparent opacity-90 mix-blend-overlay"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-2/5 animate-drip-button-shimmer bg-gradient-to-r from-transparent via-[#FF90A1]/35 to-transparent opacity-70 [animation-delay:0.8s]"
        />

        <span className="relative">Крути ДРИП</span>
      </button>
      <RouletteModal open={open} onOpenChange={setOpen} />
    </>
  );
}
