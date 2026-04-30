import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { API_BASE_URL } from '../../lib/backendConfig';

export function WholesaleLoginForm() {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [retailUserError, setRetailUserError] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setRetailUserError(false);

    try {
      // Проверяем, не пытается ли пользователь войти с розничными данными (email)
      if (login.includes('@')) {
        const { supabase } = await import('../../lib/supabaseClient');
        const { data: supabaseData, error: supabaseError } = await supabase.auth.signInWithPassword({
          email: login,
          password: password,
        });

        if (supabaseData?.user && !supabaseError) {
          // Это розничный пользователь - показываем ошибку
          setRetailUserError(true);
          setLoading(false);
          return;
        }
      }

      // Пытаемся войти как оптовый пользователь
      const response = await fetch(
        `${API_BASE_URL}/users/login`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ phone: login, password })
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Неверный логин или пароль');
          return;
        }
        throw new Error('Ошибка при входе');
      }

      const user = await response.json();
      
      console.log('✅ User logged in successfully');
      console.log('User role:', user.role);
      
      if (user) {
        // Проверяем роль пользователя
        const userRole = user.role || 'wholesale';
        
        console.log('Checking user role:', userRole);
        
        if (userRole === 'admin' || userRole === 'super-admin') {
          // Администратор - сохраняем админскую авторизацию
          // Важно: удаляем userAuth, чтобы не было конфликта
          localStorage.removeItem('userAuth');
          localStorage.removeItem('agentAuth');
          
          const expiresAt = new Date().getTime() + (30 * 24 * 60 * 60 * 1000); // 30 дней
          const adminAuthData = {
            authenticated: true,
            expiresAt: expiresAt,
            userId: user.id,
            login: user.phone
          };
          
          console.log('Saving admin auth data:', adminAuthData);
          localStorage.setItem('adminAuth', JSON.stringify(adminAuthData));
          
          // Проверяем, что данные сохранились
          const saved = localStorage.getItem('adminAuth');
          console.log('Saved admin auth (verify):', saved);
          
          toast.success('Успешный вход в админ-панель');
          
          // Используем navigate вместо window.location.href, чтобы не было полной перезагрузки
          // (window.location.href ломается в preview-среде Figma Make)
          navigate('/admin');
        } else if (userRole === 'agent') {
          // Агент - сохраняем агентскую авторизацию
          localStorage.removeItem('userAuth');
          localStorage.removeItem('adminAuth');

          localStorage.setItem('agentAuth', JSON.stringify({
            authenticated: true,
            agentId: user.id,
            name: user.name || '',
            phone: user.phone,
          }));

          toast.success('Добро пожаловать в агентский кабинет');
          navigate(`/agent/${user.id}`);
        } else {
          // Обычный оптовый пользователь
          // Важно: удаляем adminAuth, чтобы не было конфликта
          localStorage.removeItem('adminAuth');
          localStorage.removeItem('agentAuth');
          
          // Сохраняем данные пользователя в localStorage
          localStorage.setItem('userAuth', JSON.stringify({
            userId: user.id,
            phone: user.phone,
            companyName: user.company_name || '',
            discount: user.discount || 0,
            authenticated: true
          }));
          
          toast.success('Успешный вход');
          // Используем navigate вместо window.location.href, чтобы не было полной перезагрузки
          // (window.location.href ломается в preview-среде Figma Make)
          navigate(`/w/${user.id}`);
        }
      } else {
        toast.error('Неверный логин или пароль');
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error('Произошла ошибка при входе');
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
          <h1 className="text-2xl font-normal text-[#222222] tracking-tight">Вход в оптовый кабинет</h1>
        </div>

        {retailUserError && (
          <Alert className="mb-6 border-[#FF90A1] bg-[#FFF4E5]">
            <AlertDescription className="text-sm">
              Вы пытаетесь авторизоваться в кабинете оптового покупателя, но указанные данные относятся к розничному аккаунту.
              <div className="mt-3">
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full bg-[#FF90A1] hover:bg-[#FF8095] text-white h-10 text-sm"
                >
                  Войти в розничный кабинет
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="login" className="text-sm text-gray-500 font-medium">Логин</Label>
            <Input
              id="login"
              type="text"
              placeholder="Введите логин"
              value={login}
              onChange={(e) => {
                setLogin(e.target.value);
                setRetailUserError(false);
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
            Нужен доступ?{' '}
            <Link to="/wholesale-access" className="text-[#FF90A1] font-semibold hover:text-[#FF7085] transition-colors">
              Получить логин и пароль
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}