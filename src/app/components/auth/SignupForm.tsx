import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router@7.12.0';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner@2.0.3';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { RetailMobileTabBar, type TabId } from '../RetailMobileTabBar';

export function SignupForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        navigate('/login'); // Profile on signup goes to login
        break;
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация паролей
    if (password !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Пароль должен содержать минимум 6 символов');
      return;
    }
    
    setLoading(true);

    try {
      // Используем серверный endpoint для регистрации с автоматическим подтверждением email
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail-signup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        const errorMsg = data.error || 'Неизвестная ошибка';
        console.log('Signup error:', errorMsg);
        
        // Если пользователь уже существует, предлагаем перейти на страницу входа
        if (errorMsg.includes('уже зарегистрирован') || errorMsg.includes('already registered')) {
          toast.error(errorMsg, {
            duration: 5000,
            action: {
              label: 'Войти',
              onClick: () => navigate('/login')
            }
          });
        } else {
          toast.error('Ошибка регистрации: ' + errorMsg);
        }
        return;
      }

      if (data.success && data.user) {
        setIsSuccess(true);
        toast.success('Регистрация успешна! Вы можете сразу войти в систему');
      }
    } catch (err) {
      toast.error('Произошла ошибка при регистрации');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] bg-white p-8 md:p-12 shadow-none text-center">
          <div className="mb-8">
            <h1 className="text-2xl font-normal text-[#222222] tracking-tight">Регистрация завершена</h1>
            <p className="text-sm text-gray-500 mt-2">
              Ваш аккаунт успешно создан
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="text-sm text-gray-600 bg-[#F9F9F9] p-4 border border-[#E5E5E5]">
              <p>
                ✓ Вы можете сразу войти в систему, используя ваш email и пароль.
              </p>
            </div>
            <Button 
              onClick={() => navigate('/login')}
              className="w-full bg-[#FF90A1] hover:bg-[#FF8095] text-white h-12 text-base font-medium transition-colors shadow-none"
            >
              Войти в систему
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white p-8 md:p-12 shadow-none">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-[#222222] opacity-60 hover:opacity-100 mb-8 transition-opacity text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </button>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-normal text-[#222222] tracking-tight">Регистрация</h1>
          <p className="text-sm text-gray-500 mt-2">Создайте аккаунт для розничных покупок</p>
        </div>
        
        <form onSubmit={handleSignup} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm text-gray-500 font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[#F9F9F9] border-none h-12 text-base focus-visible:ring-1 focus-visible:ring-[#FF90A1] placeholder:text-gray-400"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm text-gray-500 font-medium">Пароль</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Введите пароль"
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
            <p className="text-xs text-gray-500 mt-1">Минимум 6 символов</p>
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-sm text-gray-500 font-medium">Подтвердите пароль</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Введите пароль"
                className="bg-[#F9F9F9] border-none h-12 text-base focus-visible:ring-1 focus-visible:ring-[#FF90A1] placeholder:text-gray-400 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-[#FF90A1] hover:bg-[#FF8095] text-white h-12 text-base font-medium mt-2 transition-colors shadow-none" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Регистрация...
              </>
            ) : (
              'Зарегистрироваться'
            )}
          </Button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-[#FF90A1] font-semibold hover:text-[#FF7085] transition-colors">
              Войти
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