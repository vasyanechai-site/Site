export function Logo({ className = "", onClick }: { className?: string; onClick?: () => void }) {
  return (
    <img 
      src="https://static.tildacdn.com/tild6163-6438-4039-b766-333133303937/logo.svg" 
      alt="НЕЧАЙ" 
      className={`${className || "h-5 sm:h-7 w-auto"} dark:brightness-0 dark:invert ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
      onClick={onClick}
    />
  );
}