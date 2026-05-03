import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { RetailMobileTabBar, type TabId } from './RetailMobileTabBar';
import { loginRetail } from '../lib/retailAuth';

interface UnifiedLoginProps {
  onAdminLogin: () => void;
  onUserLogin: (userId: string, phone: string, companyName: string, discount: number) => void;
  onRetailLogin: () => void;
  onBack: () => void;
}

export function UnifiedLogin({ onAdminLogin, onUserLogin, onRetailLogin, onBack }: UnifiedLoginProps) {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cartItemsCount, setCartItemsCount] = useState(0);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('retailCart');
      if (savedCart) {
        const items = JSON.parse(savedCart);
        setCartItemsCount(items.reduce((sum: number, item: any) => sum + item.quantity, 0));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleTabSelect = (tab: TabId) => {
    switch (tab) {
      case 'home':
        navigate('/');
        break;
      case 'cart':
        navigate('/?action=cart');
        break;
      case 'favorites':
        navigate('/?action=favorites');
        break;
      case 'locations':
        navigate('/locations');
        break;
      case 'harvest':
        navigate('/harvest');
        break;
      case 'profile':
        // Already here
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (login.includes('@')) {
        try {
          await loginRetail(login, password);
          onRetailLogin();
          return;
        } catch {
          /* не розница — пробуем опт */
        }
      }

      // Оптовый пользователь (телефон / логин без email)
      const { loginUser } = await import('../lib/api');
      const user = await loginUser(login, password);
      
      if (user) {
        // Проверяем роль администратора
        if (user.role === 'super-admin' || user.role === 'admin') {
          console.log('Admin login detected');
          // Сохраняем сессию админа
          const expiresAt = new Date().getTime() + 24 * 60 * 60 * 1000; // 24 часа
          localStorage.setItem('adminAuth', JSON.stringify({
            authenticated: true,
            expiresAt: expiresAt
          }));
          
          onAdminLogin();
          return;
        }

        // Сохраняем данные пользователя в localStorage
        localStorage.setItem('userAuth', JSON.stringify({
          userId: user.id,
          phone: user.phone,
          companyName: user.company_name || '',
          discount: user.discount || 0,
          authenticated: true
        }));
        onUserLogin(user.id, user.phone, user.company_name || '', user.discount || 0);
      } else {
        setError('Неверный логин или пароль');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Неверный логин или пароль');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white p-8 md:p-12 shadow-none">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#222222] opacity-60 hover:opacity-100 mb-8 transition-opacity text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-normal text-[#222222] tracking-tight">Вход</h1>
          <p className="text-sm text-gray-500 mt-2">Войдите, чтобы продолжить</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="login" className="text-sm text-gray-500 font-medium">
              Логин / Email
            </Label>
            <Input
              id="login"
              value={login}
              onChange={(e) => {
                setLogin(e.target.value);
                setError('');
              }}
              placeholder="Введите логин"
              required
              className="bg-[#F9F9F9] border-none h-12 text-base focus-visible:ring-1 focus-visible:ring-[#FF90A1] placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm text-gray-500 font-medium">
              Пароль
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Введите пароль"
                required
                className="bg-[#F9F9F9] border-none h-12 text-base focus-visible:ring-1 focus-visible:ring-[#FF90A1] placeholder:text-gray-400 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-500 text-sm text-center font-medium rounded-md">
              {error}
            </div>
          )}

          <Button 
            type="submit"
            className="w-full bg-[#FF90A1] hover:bg-[#FF8095] text-white h-12 text-base font-medium mt-2 transition-colors shadow-none"
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

        <div className="mt-8 text-center pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Нет аккаунта?{' '}
            <Link to="/signup" className="text-[#FF90A1] font-semibold hover:text-[#FF7085] transition-colors">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>

      <RetailMobileTabBar
        currentTab="profile"
        onTabSelect={handleTabSelect}
        cartItemsCount={cartItemsCount}
        favoritesCount={0}
      />
    </div>
  );
}