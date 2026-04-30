import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Logo } from './Logo';

interface UserLoginProps {
  onLogin: (userId: string, phone: string, companyName: string, discount: number) => void;
  onBack: () => void;
}

export function UserLogin({ onLogin, onBack }: UserLoginProps) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { loginUser } = await import('../lib/api');
      const user = await loginUser(phone, password);
      
      if (user) {
        // Сохраняем данные пользователя в localStorage
        localStorage.setItem('userAuth', JSON.stringify({
          userId: user.id,
          phone: user.phone,
          companyName: user.company_name || '',
          discount: user.discount || 0,
          authenticated: true
        }));
        onLogin(user.id, user.phone, user.company_name || '', user.discount || 0);
      } else {
        setError('Неверный телефон или пароль');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Произошла ошибка при входе. Попробуйте еще раз.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-8 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </Button>

        <div className="border border-border rounded-lg p-8">
          <div className="text-center mb-8">
            <Logo className="h-8 w-auto mx-auto mb-4" onClick={onBack} />
            <h1 className="text-foreground">Вход для бизнеса</h1>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-foreground">Телефон</Label>
              <Input
                id="phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ваш телефон начиная с 8, без пробелов"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <Button 
              type="submit"
              className="w-full bg-black text-white hover:bg-black/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Вход...
                </>
              ) : (
                'Войти'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}