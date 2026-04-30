import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from "react-router@7.12.0";
import { CatalogPage } from "./components/CatalogPage";
import { FavoritesPage } from "./components/FavoritesPage";
import { SuccessPage } from "./components/SuccessPage";
import { AdminPanel } from "./components/AdminPanel";
import { UnifiedLogin } from "./components/UnifiedLogin";
import { MyOrders } from "./components/MyOrders";
import { UserSettings } from "./components/UserSettings";
import { RetailStorefront } from "./components/RetailStorefront";
import { BusinessPublicPage } from "./components/BusinessPublicPage";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { UserAgreement } from "./components/UserAgreement";
import { MarketingConsent } from "./components/MarketingConsent";
import { ContactsPage } from "./components/ContactsPage";
import { Footer } from "./components/Footer";
import { RetailOrderSuccess } from "./components/RetailOrderSuccess";
import { RetailOrderFailed } from "./components/RetailOrderFailed";
import { RetailPaymentSuccess } from "./components/RetailPaymentSuccess";
import { RetailPaymentFail } from "./components/RetailPaymentFail";
import { TochkaDiagnostics } from "./components/TochkaDiagnostics";

import { LoginForm } from "./components/auth/LoginForm";
import { SignupForm } from "./components/auth/SignupForm";
import { ConfirmPage } from "./components/auth/ConfirmPage";
import { WholesaleLoginForm } from "./components/auth/WholesaleLoginForm";
import { WholesaleAccessForm } from "./components/auth/WholesaleAccessForm";
import { RetailDashboard as UserDashboard } from "./components/dashboard/RetailDashboard";
import { RetailUsersPage } from "./components/admin/RetailUsersPage";
import { LocationsPage } from "./components/LocationsPage";
import { HarvestCalendarPage } from "./components/HarvestCalendarPage";
import { AgentLayout } from "./components/agent/AgentLayout";
import { AgentDashboard } from "./components/agent/AgentDashboard";
import { AgentClients } from "./components/agent/AgentClients";
import { AgentOrders } from "./components/agent/AgentOrders";
import { AgentPayouts } from "./components/agent/AgentPayouts";

import MessengerLinksTest from "./pages/MessengerLinksTest";
import { autoKeepAlive } from "./lib/keepAlive";
import { ThemeProvider } from "./components/theme-provider";
import { EncodingChecker } from "./components/EncodingChecker";
import { EncodingValidator } from "./components/EncodingValidator";
import { Toaster } from "./components/ui/sonner";
import { isUUID } from "./lib/transliterate";
import { supabase } from "./lib/supabaseClient";
import { projectId, publicAnonKey } from './utils/supabase/info';
import "./lib/devTools"; // Expose dev tools to window

function App() {
  const [orderId, setOrderId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [userPhone, setUserPhone] = useState<string>("");
  const [userCompanyName, setUserCompanyName] = useState<string>("");
  const [userDiscount, setUserDiscount] = useState<number>(0);
  const [settingsRefreshKey, setSettingsRefreshKey] = useState<number>(0);
  const [cart, setCart] = useState<Map<string, { kg: number; packs200: number }>>(new Map());

  useEffect(() => {
    // Автоматический keep-alive для предотвращения отключения БД
    autoKeepAlive();

    // Проверка и восстановление сессии Supabase для розничных пользователей
    const checkSupabaseSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error checking Supabase session:', error);
          // Если токен недействителен, очищаем сессию
          if (error.message.includes('Refresh Token') || error.message.includes('Invalid')) {
            await supabase.auth.signOut();
            console.log('Invalid session cleared');
          }
          return;
        }
        
        if (session) {
          // Сессия активна - пользователь авторизован
          console.log('Supabase session restored');
        }
      } catch (error) {
        console.error('Error checking Supabase session:', error);
      }
    };
    
    checkSupabaseSession();
    
    // Подписываемся на изменения состояния авторизации Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        console.log('User signed in');
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed');
      }
    });

    // Проверка админской авторизации
    const authData = localStorage.getItem("adminAuth");
    console.log('🔍 Checking admin auth on mount:', authData);
    
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        const now = new Date().getTime();

        console.log('📊 Parsed admin auth:', parsed);
        console.log('📊 Current time:', now);
        console.log('📊 Expires at:', parsed.expiresAt);
        console.log('📊 Time until expiry (ms):', parsed.expiresAt - now);
        console.log('📊 Is expired?', parsed.expiresAt <= now);

        // Проверяем, не истек ли срок сессии
        if (
          parsed.authenticated &&
          parsed.expiresAt &&
          parsed.expiresAt > now
        ) {
          console.log('✅ Admin authenticated - setting state to true');
          setIsAdminAuthenticated(true);
        } else {
          // Сессия истекла, удаляем
          console.log('❌ Admin session expired or invalid');
          localStorage.removeItem("adminAuth");
          setIsAdminAuthenticated(false);
        }
      } catch (e) {
        // Старый формат или некорректные данные
        console.error('❌ Error parsing admin auth:', e);
        localStorage.removeItem("adminAuth");
        setIsAdminAuthenticated(false);
      }
    } else {
      console.log('⚪ No admin auth data found');
    }

    // Проверка пользовательской авторизации
    const userAuthData = localStorage.getItem("userAuth");
    if (userAuthData) {
      try {
        const parsed = JSON.parse(userAuthData);
        if (
          parsed.authenticated &&
          parsed.userId &&
          parsed.phone
        ) {
          setIsUserAuthenticated(true);
          setUserId(parsed.userId);
          setUserPhone(parsed.phone);
          setUserCompanyName(parsed.companyName);
          setUserDiscount(parsed.discount);
        }
      } catch (e) {
        localStorage.removeItem("userAuth");
        setIsUserAuthenticated(false);
      }
    }
    
    // Очищаем подписку при размонтировании
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleOrderSuccess = (id: string) => {
    setOrderId(id);
  };

  const handleAdminLogin = (success: boolean) => {
    if (success) {
      setIsAdminAuthenticated(true);
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    localStorage.removeItem("adminAuth");
  };

  const handleUserLogin = (
    id: string,
    phone: string,
    companyName: string,
    discount: number,
  ) => {
    setIsUserAuthenticated(true);
    setUserId(id);
    setUserPhone(phone);
    setUserCompanyName(companyName);
    setUserDiscount(discount);
  };

  const handleUserLogout = () => {
    setIsUserAuthenticated(false);
    setUserId("");
    setUserPhone("");
    setUserCompanyName("");
    setUserDiscount(0);
    localStorage.removeItem("userAuth");
  };

  const handleRepeatOrder = async (orderItems: any[], orderId: string) => {
    try {
      // Загружаем актуальный список товаров
      const { fetchCoffeeItems } = await import('./lib/api');
      const currentItems = await fetchCoffeeItems();
      
      const newCart = new Map<string, { kg: number; packs200: number }>();
      const missingItems: string[] = [];
      const changedPriceItems: string[] = [];
      
      // Проходим по товарам из заказа
      for (const orderItem of orderItems) {
        const currentItem = currentItems.find(item => item.id === orderItem.id);
        
        if (!currentItem) {
          // Товар больше не существует
          missingItems.push(orderItem.name);
        } else {
          // Товар существует - добавляем в корзину
          newCart.set(orderItem.id, {
            kg: orderItem.kg || 0,
            packs200: orderItem.packs200 || 0
          });
          
          // Проверяем изменение цен с учетом скидки пользователя
          const personalDiscount = userDiscount || 0;
          const currentPriceKg = personalDiscount > 0 
            ? Math.round(currentItem.price_kg * (1 - personalDiscount / 100)) 
            : currentItem.price_kg;
          const currentPrice200 = personalDiscount > 0 
            ? Math.round(currentItem.price_200 * (1 - personalDiscount / 100)) 
            : currentItem.price_200;
            
          // Вычисляем цену из заказа (subtotal / количество)
          const orderTotalQuantity = (orderItem.kg || 0) + (orderItem.packs200 || 0);
          const orderPricePerUnit = orderTotalQuantity > 0 ? orderItem.subtotal / orderTotalQuantity : 0;
          
          // Вычисляем текущую цену за единицу (примерная)
          const currentTotalPrice = (orderItem.kg || 0) * currentPriceKg + (orderItem.packs200 || 0) * currentPrice200;
          const currentPricePerUnit = orderTotalQuantity > 0 ? currentTotalPrice / orderTotalQuantity : 0;
          
          // Проверяем изменение цены (больше 1% разницы)
          if (Math.abs(currentPricePerUnit - orderPricePerUnit) / orderPricePerUnit > 0.01) {
            changedPriceItems.push(orderItem.name);
          }
        }
      }
      
      // Устанавливаем корзину
      setCart(newCart);
      
      // Показываем тосты если есть проблемы
      const { toast } = await import('sonner@2.0.3');
      if (missingItems.length > 0) {
        toast.error('Некоторые товары закончились', {
          description: `Недоступно: ${missingItems.join(', ')}`
        });
      }
      if (changedPriceItems.length > 0) {
        toast.warning('Цены на некоторые позиции изменились', {
          description: `Изменения: ${changedPriceItems.join(', ')}`
        });
      }
      if (missingItems.length === 0 && changedPriceItems.length === 0) {
        toast.success('Заказ добавлен в корзину');
      }
    } catch (error) {
      console.error('Failed to repeat order:', error);
      const { toast } = await import('sonner@2.0.3');
      toast.error('Не удалось повторить заказ');
    }
  };

  return (
    <ThemeProvider defaultTheme="light" storageKey="nechai-ui-theme">
      <EncodingChecker />
      <EncodingValidator />
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground">
          <Routes>
            {/* Главная - Розничная витрин */}
            <Route path="/" element={<RetailRoute />} />

            {/* Где купить */}
            <Route path="/locations" element={<LocationsPage />} />

            {/* Календарь урожая */}
            <Route path="/harvest" element={<HarvestCalendarPage />} />
            
            {/* Детальная страница товара */}
            <Route path="/:productSlug" element={<ProductRoute />} />
            
            {/* Публичная страница для бизнса */}
            <Route path="/business" element={<BusinessRoute />} />
            
            {/* Политика конфиденциальности */}
            <Route path="/privacy" element={<PrivacyPolicy />} />
            
            {/* Пользовательское соглашение */}
            <Route path="/agreement" element={<UserAgreement />} />
            
            {/* Согласие на получение информационных и рекламных сообщений */}
            <Route path="/marketing-consent" element={<MarketingConsent />} />

            {/* Контакты и реквизиты */}
            <Route path="/contacts" element={<ContactsPage />} />
            
            {/* Auth Routes */}
            <Route path="/login" element={<LoginForm />} />
            <Route path="/signup" element={<SignupForm />} />
            <Route path="/confirm" element={<ConfirmPage />} />
            <Route path="/loginopt" element={<WholesaleLoginForm />} />
            <Route path="/wholesale-access" element={<WholesaleAccessForm />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/admin/retail-users" element={<RetailUsersPage />} />

            {/* Страницы статуса оплаты */}
            <Route path="/order-success" element={<RetailOrderSuccess />} />
            <Route path="/order-failed" element={<RetailOrderFailed />} />
            <Route path="/payment-success" element={<RetailPaymentSuccess />} />
            <Route path="/payment-fail" element={<RetailPaymentFail />} />
            <Route path="/payment/success" element={<RetailPaymentSuccess />} />
            <Route path="/payment/fail" element={<RetailPaymentFail />} />

            {/* Тестовая страница для проверки ссылок на мессенджееры */}
            <Route path="/messenger-test" element={<MessengerTestRoute />} />
            
            {/* Диагностика интеграции Точка Банк */}
            <Route path="/tochka-diagnostics" element={<TochkaDiagnostics />} />
            
            {/* Агентский кабинет */}
            <Route path="/agent/:agentId" element={<AgentLayout />}>
              <Route index element={<AgentDashboard />} />
              <Route path="clients" element={<AgentClients />} />
              <Route path="orders" element={<AgentOrders />} />
              <Route path="payouts" element={<AgentPayouts />} />
            </Route>

            {/* Единый вход */}
            <Route path="/login" element={<LoginRoute onAdminLogin={handleAdminLogin} onUserLogin={handleUserLogin} />} />
            
            {/* Админ панель */}
            <Route 
              path="/admin" 
              element={<AdminPanelRoute onLogout={handleAdminLogout} />}
            />
            
            {/* Оптовая часть для конкретного пользователя */}
            <Route 
              path="/w/:userId" 
              element={
                <WholesaleRoute
                  isUserAuthenticated={isUserAuthenticated}
                  userId={userId}
                  userCompanyName={userCompanyName}
                  userDiscount={userDiscount}
                  cart={cart}
                  setCart={setCart}
                  onOrderSuccess={handleOrderSuccess}
                  onLogin={handleUserLogin}
                  onLogout={handleUserLogout}
                  orderId={orderId}
                  onRepeatOrder={handleRepeatOrder}
                  settingsRefreshKey={settingsRefreshKey}
                  setSettingsRefreshKey={setSettingsRefreshKey}
                />
              } 
            />
          </Routes>
        </div>
        <Toaster />
      </BrowserRouter>
    </ThemeProvider>
  );
}

// Компонент для главной станицы (Розница)
function RetailRoute() {
  const navigate = useNavigate();
  
  return (
    <RetailStorefront
      onNavigateToLogin={() => navigate('/login')}
      onNavigateToProduct={(productSlug: string) => {
        // Переходим по slug товара
        navigate(`/${productSlug}`);
      }}
    />
  );
}

// Компонент для публичной страницы бизнеса
function BusinessRoute() {
  const navigate = useNavigate();
  
  return (
    <BusinessPublicPage
      onNavigateToRetail={() => navigate('/')}
      onNavigateToLogin={() => navigate('/w/login')}
    />
  );
}

// Компонент для тестовой страницы мессенджеров
function MessengerTestRoute() {
  return <MessengerLinksTest />;
}

// Компонент для страницы товара
function ProductRoute() {
  const { productSlug } = useParams<{ productSlug: string }>();
  const navigate = useNavigate();
  
  // Проверяем, не является ли это UUID (тогда это пользовательский ID)
  if (productSlug && isUUID(productSlug)) {
    return <Navigate to={`/w/${productSlug}`} replace />;
  }
  
  return (
    <RetailStorefront
      onNavigateToLogin={() => navigate('/login')}
      onNavigateToProduct={(slug: string) => navigate(`/${slug}`)}
      showProductId={productSlug}
      onBackToRetail={() => navigate('/')}
    />
  );
}

// Копонент для админ-панели
function AdminPanelRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  
  // Проверяем adminAuth при каждом рендере
  const checkAdminAuth = () => {
    const authData = localStorage.getItem("adminAuth");
    console.log('🔍 AdminPanelRoute: Checking admin auth:', authData);
    
    if (!authData) {
      console.log('❌ AdminPanelRoute: No admin auth found, redirecting to /login');
      return false;
    }
    
    try {
      const parsed = JSON.parse(authData);
      const now = new Date().getTime();
      
      console.log('📊 AdminPanelRoute: Parsed auth:', parsed);
      console.log('📊 AdminPanelRoute: Current time:', now);
      console.log('📊 AdminPanelRoute: Expires at:', parsed.expiresAt);
      console.log('📊 AdminPanelRoute: Is valid?', parsed.authenticated && parsed.expiresAt && parsed.expiresAt > now);
      
      if (parsed.authenticated && parsed.expiresAt && parsed.expiresAt > now) {
        console.log('✅ AdminPanelRoute: Auth is valid');
        return true;
      } else {
        console.log('❌ AdminPanelRoute: Auth expired, removing');
        localStorage.removeItem("adminAuth");
        return false;
      }
    } catch (e) {
      console.error('❌ AdminPanelRoute: Error parsing auth:', e);
      localStorage.removeItem("adminAuth");
      return false;
    }
  };
  
  const isAuthenticated = checkAdminAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <AdminPanel
      onLogout={() => { onLogout(); navigate('/'); }}
      onNavigateToRetail={() => navigate('/')}
    />
  );
}

// Компонент для логина админа
function LoginRoute({ 
  onAdminLogin, 
  onUserLogin 
}: { 
  onAdminLogin: (success: boolean) => void;
  onUserLogin: (id: string, phone: string, companyName: string, discount: number) => void;
}) {
  const navigate = useNavigate();
  
  return (
    <UnifiedLogin
      onAdminLogin={() => {
        onAdminLogin(true);
        navigate('/admin');
      }}
      onUserLogin={(id, phone, companyName, discount) => {
        onUserLogin(id, phone, companyName, discount);
        navigate(`/w/${id}`);
      }}
      onRetailLogin={() => {
        navigate('/');
      }}
      onBack={() => navigate('/')}
    />
  );
}

// Компонент для оптовой части
function WholesaleRoute({
  isUserAuthenticated,
  userId,
  userCompanyName,
  userDiscount,
  cart,
  setCart,
  onOrderSuccess,
  onLogin,
  onLogout,
  orderId,
  onRepeatOrder,
  settingsRefreshKey,
  setSettingsRefreshKey,
}: {
  isUserAuthenticated: boolean;
  userId: string;
  userCompanyName: string;
  userDiscount: number;
  cart: Map<string, { kg: number; packs200: number }>;
  setCart: React.Dispatch<React.SetStateAction<Map<string, { kg: number; packs200: number }>>>;
  onOrderSuccess: (id: string) => void;
  onLogin: (id: string, phone: string, companyName: string, discount: number) => void;
  onLogout: () => void;
  orderId: string;
  onRepeatOrder: (items: any[], orderId: string) => Promise<void>;
  settingsRefreshKey: number;
  setSettingsRefreshKey: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { userId: urlUserId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [wholesalePage, setWholesalePage] = useState<
    'catalog' | 'favorites' | 'success' | 'my-orders' | 'user-settings'
  >('catalog');

  // Читаем данные из localStorage напрямую — это авторитетный источник для первого рендера,
  // пока App state ещё не синхронизирован после навигации
  const getLocalAuthData = () => {
    const userAuthData = localStorage.getItem("userAuth");
    if (userAuthData) {
      try {
        const parsed = JSON.parse(userAuthData);
        if (parsed.authenticated && parsed.userId && parsed.phone) {
          return parsed as { userId: string; phone: string; companyName: string; discount: number; authenticated: boolean };
        }
      } catch (e) { /* ignore */ }
    }
    return null;
  };

  const localAuthData = getLocalAuthData();
  const locallyAuthenticated = !!localAuthData;

  // Синхронизируем App state из localStorage через useEffect — нельзя вызывать setState во время рендера
  useEffect(() => {
    if (locallyAuthenticated && !isUserAuthenticated && localAuthData) {
      onLogin(localAuthData.userId, localAuthData.phone, localAuthData.companyName, localAuthData.discount);
    }
  }, [locallyAuthenticated, isUserAuthenticated]);

  // Если пользователь не авторизован или это страница логина
  if ((!isUserAuthenticated && !locallyAuthenticated) || urlUserId === 'login') {
    return <Navigate to="/loginopt" replace />;
  }

  // Эффективные значения: предпочитаем App state (он уже синхронизирован),
  // но при первом рендере фолбэчим на localStorage
  const effectiveUserId = isUserAuthenticated ? userId : (localAuthData?.userId ?? '');
  const effectiveCompanyName = isUserAuthenticated ? userCompanyName : (localAuthData?.companyName ?? '');
  const effectiveDiscount = isUserAuthenticated ? userDiscount : (localAuthData?.discount ?? 0);
  const effectiveAuthenticated = isUserAuthenticated || locallyAuthenticated;

  // Проверяем, соответствует ли userId из URL авторизованному пользователю
  if (urlUserId && effectiveUserId && urlUserId !== effectiveUserId) {
    return <Navigate to={`/w/${effectiveUserId}`} replace />;
  }

  const handleOrderSuccessWithNav = (id: string) => {
    onOrderSuccess(id);
    setWholesalePage('success');
  };

  return (
    <>
      {wholesalePage === 'catalog' && (
        <CatalogPage
          onOrderSuccess={handleOrderSuccessWithNav}
          onNavigateToAdmin={() => navigate('/admin')}
          onNavigateToUserLogin={() => navigate('/w/login')}
          onNavigateToMyOrders={() => setWholesalePage('my-orders')}
          onNavigateToFavorites={() => setWholesalePage('favorites')}
          onNavigateToUserSettings={() => {
            setWholesalePage('user-settings');
            setSettingsRefreshKey(prev => prev + 1);
          }}
          onNavigateToRetail={() => navigate('/')}
          isUserAuthenticated={effectiveAuthenticated}
          userCompanyName={effectiveCompanyName}
          userDiscount={effectiveDiscount}
          userId={effectiveUserId}
          cart={cart}
          setCart={setCart}
          onDiscountSync={(newDiscount) => {
            // Обновляем App state (так effectiveDiscount обновится без перелогина)
            const freshAuth = getLocalAuthData();
            onLogin(effectiveUserId, freshAuth?.phone ?? '', effectiveCompanyName, newDiscount);
          }}
        />
      )}
      {wholesalePage === 'favorites' && (
        <FavoritesPage
          userId={effectiveUserId}
          userDiscount={effectiveDiscount}
          onBack={() => setWholesalePage('catalog')}
          cart={cart}
          setCart={setCart}
          onOrderSuccess={handleOrderSuccessWithNav}
          onNavigateToRetail={() => navigate('/')}
        />
      )}
      {wholesalePage === 'success' && (
        <SuccessPage
          orderId={orderId}
          onBackToCatalog={() => setWholesalePage('catalog')}
          onNavigateToRetail={() => navigate('/')}
        />
      )}
      {wholesalePage === 'my-orders' && (
        <MyOrders
          userId={effectiveUserId}
          userCompanyName={effectiveCompanyName}
          userDiscount={effectiveDiscount}
          onBack={() => setWholesalePage('catalog')}
          onLogout={() => {
            onLogout();
            navigate('/');
          }}
          onRepeatOrder={async (items, orderId) => {
            await onRepeatOrder(items, orderId);
            setWholesalePage('catalog');
          }}
          onNavigateToRetail={() => navigate('/')}
        />
      )}
      {wholesalePage === 'user-settings' && (
        <UserSettings
          key={settingsRefreshKey}
          userId={effectiveUserId}
          userCompanyName={effectiveCompanyName}
          onBack={() => setWholesalePage('catalog')}
          onLogout={() => {
            onLogout();
            navigate('/');
          }}
          onNavigateToRetail={() => navigate('/')}
        />
      )}
      <Footer />
    </>
  );
}

export default App;