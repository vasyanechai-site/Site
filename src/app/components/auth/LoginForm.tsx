import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router@7.12.0';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner@2.0.3';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { RetailMobileTabBar, type TabId } from '../RetailMobileTabBar';

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [wholesaleUserError, setWholesaleUserError] = useState(false);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setWholesaleUserError(false);

    try {
      // Сначала проверяем, не пытается ли оптовый пользователь войти
      // Если введен не email (нет @), проверяем в оптовой базе
      if (!email.includes('@')) {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/users/login`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone: email, password })
          }
        );

        if (response.ok) {
          // Это оптовый пользователь - показываем ошибку
          setWholesaleUserError(true);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          toast.error('Пожалуйста, подтвердите email перед входом');
        } else if (error.message.includes('Invalid login credentials')) {
          toast.error('Неверный email или пароль');
        } else if (error.message.includes('Email')) {
          toast.error('Некорректный email адрес');
        } else {
          toast.error('Ошибка входа. Проверьте введенные данные');
        }
        return;
      }

      if (data.user) {
        toast.success('Успешный вход');
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error('Произошла ошибка при входе');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-normal text-[#222222] tracking-tight">Вход в кабинет</h1>
          <p className="text-sm text-gray-500 mt-2">Для розничных покупателей</p>
        </div>

        {wholesaleUserError && (
          <Alert className="mb-6 border-[#FF90A1] bg-[#FFF4E5]">
            <AlertDescription className="text-sm">
              Вы пытаетесь авторизоваться в розничном кабинете, но указанные данные относятся к оптовому аккаунту.
              <div className="mt-3">
                <Button
                  onClick={() => navigate('/loginopt')}
                  className="w-full bg-[#FF90A1] hover:bg-[#FF8095] text-white h-10 text-sm"
                >
                  Войти в оптовый кабинет
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm text-gray-500 font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setWholesaleUserError(false);
              }}
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
          </div>

          <Button 
            type="submit" 
            className="w-full bg-[#FF90A1] hover:bg-[#FF8095] text-white h-12 text-base font-medium mt-2 transition-colors shadow-none" 
            disabled={loading}
          >
            {loading ? (
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