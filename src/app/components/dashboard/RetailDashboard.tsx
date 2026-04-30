import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router@7.12.0';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { toast } from 'sonner@2.0.3';
import { RetailHeader } from '../RetailHeader';
import { 
  ArrowLeft, 
  LogOut, 
  User, 
  Package, 
  CreditCard, 
  Heart,
  ShoppingBag,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { fetchMyRetailOrders, fetchFavorites, fetchRetailProducts } from '../../lib/api';
import { RetailOrder, RetailProduct } from '../../types';
import { FadeIn } from '../ui/fade-in';
import { motion } from 'motion/react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { transliterate } from '../../lib/transliterate';
import { projectId } from '../../utils/supabase/info';

import { RetailMobileTabBar, type TabId } from '../RetailMobileTabBar';

function getDeclension(number: number, titles: [string, string, string]) {
  const cases = [2, 0, 1, 1, 1, 2];
  return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
}

export function RetailDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<RetailOrder[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [balance, setBalance] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'settings'>('overview');
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [bonusClaimed, setBonusClaimed] = useState(false);
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

  useEffect(() => {
    const initData = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }
        setUser(user);

        console.log('📥 Loading dashboard');

        // Get session token
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        // Fetch data in parallel
        const [myOrders, userFavorites, allProducts, balanceRes] = await Promise.all([
          fetchMyRetailOrders(user.id),
          fetchFavorites(user.id),
          fetchRetailProducts(),
          accessToken 
            ? fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail/loyalty/${user.id}`, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`
                }
              }).then(r => r.json()).catch(() => ({ balance: 0 }))
            : Promise.resolve({ balance: 0 })
        ]);

        console.log('🔍 User Info loaded');
        console.log('📦 My orders:', myOrders.length, myOrders.map(o => ({
          orderId: o.orderId,
          email: o.email,
          total: o.total
        })));

        setOrders(myOrders);
        setFavorites(userFavorites);
        setProducts(allProducts);
        
        // Parse balance from response
        let balanceValue = 0;
        if (typeof balanceRes === 'number') {
          balanceValue = balanceRes;
        } else if (typeof balanceRes === 'object' && balanceRes !== null && 'balance' in balanceRes) {
          balanceValue = balanceRes.balance || 0;
        }
        
        setBalance(balanceValue);
        setBonusClaimed(false);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        toast.error('Не удалось загрузить данные профиля');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [navigate]);

  useEffect(() => {
    // Слушаем событие обновления заказов (например, после успешной оплаты)
    const handleOrdersUpdate = async () => {
      if (!user) return;
      
      console.log('📦 Orders update event received, reloading orders...');
      
      try {
        const myOrders = await fetchMyRetailOrders(user.id);
        setOrders(myOrders);
        
        // Также обновляем баланс
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        
        if (accessToken) {
          const balanceRes = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail/loyalty/${user.id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }).then(r => r.json());
          
          if (balanceRes.balance !== undefined) {
            setBalance(balanceRes.balance);
          }
        }
      } catch (error) {
        console.error('Failed to reload orders:', error);
        toast.error('Не удалось перезагрузить заказы');
      }
    };
    
    window.addEventListener('orders-updated', handleOrdersUpdate);
    return () => window.removeEventListener('orders-updated', handleOrdersUpdate);
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
    toast.success('Вы вышли из системы');
  };

  const handleClaimBonus = async () => {
    if (claimingBonus) return; // Убрали проверку на bonusClaimed
    
    setClaimingBonus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Необходимо авторизоваться');
        return;
      }

      console.log('🎯 Claiming bonus');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail/loyalty/claim-bonus`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error claiming bonus:', errorData);
        toast.error('Не удалось получить бонус');
        return;
      }

      const data = await response.json();
      console.log('✅ Bonus claimed successfully:', data);
      setBalance(data.balance); // Обновляем баланс сразу
      
      // Отправляем событие для обновления баланса в магазине
      window.dispatchEvent(new Event('loyalty-balance-updated'));
      
      toast.success(`🎉 Вам начислено 2000 ${getDeclension(2000, ['Вуш', 'Вуша', 'Вушей'])}!`, {
        description: '1 Вуш = 1₽ при следующем заказе'
      });
    } catch (error) {
      console.error('Error claiming bonus:', error);
      toast.error('Произошла ошибка при получении бонуса');
    } finally {
      setClaimingBonus(false);
    }
  };

  const stats = useMemo(() => {
    const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const completedOrders = orders.filter(o => o.status === 'completed').length;
    const activeOrders = orders.filter(o => ['pending', 'processing', 'paid'].includes(o.status || 'pending')).length;
    
    // Find favorite coffee category if possible (simple heuristic)
    const categories: Record<string, number> = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.category) {
          categories[item.category] = (categories[item.category] || 0) + item.quantity;
        }
      });
    });
    const favoriteCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    return {
      totalSpent,
      completedOrders,
      activeOrders,
      favoriteCategory
    };
  }, [orders]);

  // Valid favorites count (only existing products)
  const validFavoritesCount = useMemo(() => {
    return favorites.filter(id => products.some(p => p.id === id)).length;
  }, [favorites, products]);

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
        // Already on profile
        break;
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#FF90A1] border-r-transparent"></div>
        <p className="mt-4 text-[#222222]">Загрузка профиля...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FFF4E5] text-[#222222]">
      {/* Header */}
      <RetailHeader 
        currentUser={user}
        validFavoritesCount={validFavoritesCount}
        cartItemsCount={cartItemsCount}
        onNavigateToLogin={() => navigate('/login')}
        onOpenFavorites={() => navigate('/')}
        onOpenCart={() => navigate('/')}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sidebar Navigation */}
          <div className="lg:col-span-3">
             <div className="bg-[#FFF4E5] rounded-2xl p-6 border border-[#222222]/5 sticky top-24">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[#222222]/5">
                   <div className="w-12 h-12 rounded-full bg-[#FF90A1]/20 flex items-center justify-center text-[#FF90A1]">
                      <User className="w-6 h-6" />
                   </div>
                   <div className="overflow-hidden">
                      <p className="font-medium truncate">{user.user_metadata?.name || 'Пользователь'}</p>
                      <p className="text-sm text-[#222222]/60 truncate">{user.email}</p>
                   </div>
                </div>

                <nav className="space-y-1">
                   <button
                      onClick={() => setActiveTab('overview')}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                         activeTab === 'overview' 
                           ? 'bg-[#FF90A1] text-white shadow-md shadow-[#FF90A1]/20' 
                           : 'hover:bg-[#FFF4E5] text-[#222222]/80'
                      }`}
                   >
                      <TrendingUp className="w-5 h-5" />
                      <span className="font-medium">Обзор</span>
                   </button>
                   <button
                      onClick={() => setActiveTab('orders')}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                         activeTab === 'orders' 
                           ? 'bg-[#FF90A1] text-white shadow-md shadow-[#FF90A1]/20' 
                           : 'hover:bg-[#FFF4E5] text-[#222222]/80'
                      }`}
                   >
                      <ShoppingBag className="w-5 h-5" />
                      <span className="font-medium">Заказы</span>
                      {stats.activeOrders > 0 && (
                        <span className="ml-auto bg-white text-[#FF90A1] text-xs font-bold px-2 py-0.5 rounded-full">
                           {stats.activeOrders}
                        </span>
                      )}
                   </button>
                   
                   <div className="pt-4 mt-4 border-t border-[#222222]/5">
                     <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-red-50 text-[#222222]/80 hover:text-red-600"
                     >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Выйти</span>
                     </button>
                   </div>
                </nav>
             </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9">
             <FadeIn>
                {activeTab === 'overview' && (
                   <div className="space-y-8">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                         <Card className="bg-[#FFF4E5] border-[#222222]/5 shadow-none hover:shadow-none transition-shadow">
                            <CardContent className="p-6 h-full flex flex-col justify-between">
                               <div className="flex items-start justify-between mb-8">
                                  <div className="w-10 h-10 rounded-full bg-[#FF90A1]/20 flex items-center justify-center text-[#222222]">
                                     <ShoppingBag className="w-5 h-5" />
                                  </div>
                               </div>
                               <div>
                                  <div className="text-2xl font-bold mb-1">{orders.length}</div>
                                  <div className="text-sm text-[#222222]/60">Всего заказов</div>
                               </div>
                            </CardContent>
                         </Card>

                         <Card className="bg-[#FFF4E5] border-[#222222]/5 shadow-none hover:shadow-none transition-shadow">
                            <CardContent className="p-6 h-full flex flex-col justify-between">
                               <div className="flex items-start justify-between mb-8">
                                  <div className="w-10 h-10 rounded-full bg-[#FF90A1]/20 flex items-center justify-center text-[#222222]">
                                     <CreditCard className="w-5 h-5" />
                                  </div>
                               </div>
                               <div>
                                  <div className="text-2xl font-bold mb-1">
                                     {new Intl.NumberFormat('ru-RU').format(stats.totalSpent)} ₽
                                  </div>
                                  <div className="text-sm text-[#222222]/60">Потрачено</div>
                               </div>
                            </CardContent>
                         </Card>

                         <Card className="bg-[#FFF4E5] border-[#222222]/5 shadow-none hover:shadow-none transition-shadow">
                            <CardContent className="p-6 h-full flex flex-col justify-between">
                               <div className="flex items-start justify-between mb-8">
                                  <div className="w-10 h-10 rounded-full bg-[#FF90A1]/20 flex items-center justify-center text-[#222222]">
                                     <Heart className="w-5 h-5" />
                                  </div>
                               </div>
                               <div>
                                  <div className="text-2xl font-bold mb-1">{validFavoritesCount}</div>
                                  <div className="text-sm text-[#222222]/60">В избранном</div>
                               </div>
                            </CardContent>
                         </Card>
                      </div>

                      {/* Recent Orders Preview */}
                      <div>
                         <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-medium">Последние заказы</h2>
                            {orders.length > 0 && (
                               <Button variant="link" onClick={() => setActiveTab('orders')} className="text-[#FF90A1]">
                                  Все заказы
                               </Button>
                            )}
                         </div>
                         
                         {orders.length === 0 ? (
                            <div className="bg-[#FFF4E5] rounded-2xl p-8 text-center border border-[#222222]/5">
                               <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-[#222222]/40">
                                  <ShoppingBag className="w-8 h-8" />
                               </div>
                               <h3 className="font-medium text-lg mb-2">У вас пока нет заказов</h3>
                               <p className="text-[#222222]/60 mb-6">Самое время выбрать свой любимый кофе</p>
                               <Button 
                                  onClick={() => navigate('/')}
                                  className="bg-[#FF90A1] hover:bg-[#FF90A1]/90 text-white"
                               >
                                  Перейти в каталог
                               </Button>
                            </div>
                         ) : (
                            <div className="space-y-4">
                               {orders.slice(0, 3).map(order => (
                                  <OrderCard key={order.orderId} order={order} />
                               ))}
                            </div>
                         )}
                      </div>
                   </div>
                )}

                {activeTab === 'orders' && (
                   <div>
                      <h2 className="text-2xl font-medium mb-6">История заказов</h2>
                      {orders.length === 0 ? (
                          <div className="bg-[#FFF4E5] rounded-2xl p-12 text-center border border-[#222222]/5">
                             <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-[#222222]/40">
                                <ShoppingBag className="w-8 h-8" />
                             </div>
                             <h3 className="font-medium text-lg mb-2">История заказов пуста</h3>
                             <Button 
                                onClick={() => navigate('/')}
                                className="bg-[#FF90A1] hover:bg-[#FF90A1]/90 text-white mt-4"
                             >
                                Перейти в каталог
                             </Button>
                          </div>
                      ) : (
                          <div className="space-y-4">
                             {orders.map(order => (
                                <OrderCard key={order.orderId} order={order} expanded={true} />
                             ))}
                          </div>
                      )}
                   </div>
                )}
             </FadeIn>
          </div>
        </div>
      </main>

      <RetailMobileTabBar
        currentTab="profile"
        onTabSelect={handleTabSelect}
        cartItemsCount={cartItemsCount}
        favoritesCount={validFavoritesCount}
      />
    </div>
  );
}

function OrderCard({ order, expanded = false }: { order: RetailOrder, expanded?: boolean }) {
  const [localOrder, setLocalOrder] = useState(order);
  
  const date = new Date(localOrder.date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="bg-[#FFF4E5] rounded-xl p-5 border border-[#222222]/5 shadow-none hover:shadow-none transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <span className="font-medium text-lg">Заказ №{order.orderId ? order.orderId.split('-').pop() : 'N/A'}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#222222]/60">
             <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {date}
             </div>
             <div className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                {new Intl.NumberFormat('ru-RU').format(localOrder.total)} ₽
             </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#222222]/5 pt-4">
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {order.items.map((item, idx) => (
               <div key={`${order.orderId}-item-${item.productId || item.name}-${idx}`} className="flex items-center gap-3 bg-white p-2 rounded-lg">
                  <div className="w-10 h-10 bg-[#FFF4E5] rounded-md flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#222222]/5">
                     {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                     ) : (
                        <ShoppingBag className="w-5 h-5 text-[#222222]/20" />
                     )}
                  </div>
                  <div className="min-w-0">
                     <p className="text-sm font-medium truncate">{item.name}</p>
                     <p className="text-xs text-[#222222]/60">
                        {item.quantity} шт • {item.weight || '250г'}
                     </p>
                  </div>
               </div>
            ))}
            {order.items.length > 3 && (
               <div className="flex items-center justify-center text-sm text-[#222222]/60 bg-[#FFF4E5]/50 rounded-lg">
                  + еще {order.items.length - 3} позиций
               </div>
            )}
         </div>
      </div>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t border-[#222222]/5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
           <div>
              <p className="text-[#222222]/60 mb-1">Способ получения</p>
              <div className="flex items-center gap-2">
                 <Package className="w-4 h-4 text-[#222222]/40" />
                 <span>{order.delivery_method === 'pickup' ? 'Самовывоз' : 'СДЭК Доставка'}</span>
              </div>
           </div>
           {order.delivery_address && (
              <div>
                 <p className="text-[#222222]/60 mb-1">Адрес доставки</p>
                 <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#222222]/40" />
                    <span className="truncate">{order.delivery_address}</span>
                 </div>
              </div>
           )}
        </div>
      )}
    </div>
  );
}