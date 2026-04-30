import { Link } from 'react-router@7.12.0';
import { cn } from './ui/utils';

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  return (
    <footer className={cn("border-t border-border bg-background py-8 mt-auto", className)}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-sm text-muted-foreground order-last md:order-first">
          © {new Date().getFullYear()} Nechai Coffee. Все права защищены.
        </div>
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center">
          <Link 
            to="/contacts" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Контакты
          </Link>
          <Link 
            to="/privacy" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Политика конфиденциальности
          </Link>
          <Link 
            to="/agreement" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Пользовательское соглашение
          </Link>
          <Link 
            to="/marketing-consent" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Согласие на получение сообщений
          </Link>
        </div>
      </div>
    </footer>
  );
}