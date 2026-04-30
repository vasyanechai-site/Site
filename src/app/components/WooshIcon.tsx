import { cn } from './ui/utils';

interface WooshIconProps {
  size?: number;
  className?: string;
}

/**
 * Иконка Вуша - валюты лояльности интернет-магазина кофе «Нечай»
 * Представляет собой стилизованную букву "W" с элементами кофейной тематики
 */
export function WooshIcon({ size = 24, className }: WooshIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block", className)}
      aria-label="Вуш"
    >
      {/* Основная форма W */}
      <path
        d="M3 4L6.5 18L10 8L13.5 18L17 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Кофейное зерно - акцент */}
      <ellipse
        cx="19"
        cy="8"
        rx="2.5"
        ry="3"
        fill="currentColor"
        opacity="0.8"
      />
      <path
        d="M19 6.5C18.5 6.5 18 7 18 7.5"
        stroke="white"
        strokeWidth="0.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}
