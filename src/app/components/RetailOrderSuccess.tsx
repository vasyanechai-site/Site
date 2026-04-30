import { useSearchParams, useNavigate } from 'react-router@7.12.0';
import { Button } from './ui/button';
import { FadeIn } from './ui/fade-in';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { projectId } from '../utils/supabase/info';
import { supabase } from '../lib/supabaseClient';
import { WooshIcon } from './WooshIcon';

function getWooshDeclension(number: number) {
  const cases = [2, 0, 1, 1, 1, 2];
  const titles = ['Вуш', 'Вуша', 'Вушей'];
  return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
}
 
export function RetailOrderSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('order_id');
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const fetchOrderInfo = async () => {
      if (!orderId) return;

      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail/order-payment-info/${orderId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const info = await response.json();
          setOrderInfo(info);
        }
      } catch (error) {
        console.error('Failed to fetch order info:', error);
      }
    };

    fetchOrderInfo();
  }, [orderId]);

  if (!orderId) {
    return (
      <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold">Ошибка</h1>
          <p>Неверный номер заказа</p>
          <Button onClick={() => navigate('/')} className="mt-4">На главную</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center p-4">
        <FadeIn>
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF90A1] mx-auto mb-4" />
            <p className="text-[#222222]/70">Загрузка информации о заказе...</p>
          </div>
        </FadeIn>
      </div>
    );
  }

  const isPaid = orderInfo?.paymentStatus === 'paid';
  const isPending = orderInfo?.paymentStatus === 'pending';

  return (
    <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center p-4">
      <FadeIn>
        <div className="bg-white p-8 rounded-lg shadow-sm text-center max-w-md w-full border border-border">
          <div className={`w-16 h-16 ${isPaid ? 'bg-green-100' : 'bg-amber-100'} rounded-full flex items-center justify-center mx-auto mb-6`}>
            {checking ? (
              <Loader2 className="w-8 h-8 text-[#FF90A1] animate-spin" />
            ) : isPaid ? (
              <Check className="w-8 h-8 text-green-600" />
            ) : (
              <WooshIcon size={32} className="text-[#FF90A1]" />
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-[#222222] mb-2">
            {checking ? 'Проверяем оплату...' : isPaid ? 'Оплата успешна!' : 'Заказ создан!'}
          </h1>
          
          <p className="text-[#222222]/70 mb-6">
            {checking ? (
              <>Ждем подтверждения от банка...</>
            ) : isPaid ? (
              <>
                Спасибо за покупку! Ваш заказ #{orderId.split('-').pop()} оплачен.<br />
                Мы уже начали собирать ваш заказ и свяжемся с вами в ближайшее время.
              </>
            ) : (
              <>
                Спасибо за покупку! Ваш заказ #{orderId.split('-').pop()} создан.<br />
                Мы свяжемся с вами в ближайшее время.
              </>
            )}
          </p>

          {/* Информация о баллах лояльности */}
          {orderInfo && (isPaid || orderInfo.loyaltyPointsEarned > 0 || orderInfo.loyaltyPointsUsed > 0) && (
            <div className="bg-[#FFF4E5] rounded-lg p-4 mb-6 space-y-3">
              <div className="flex items-center justify-center gap-2 text-[#222222]">
                <WooshIcon size={24} className="text-[#FF90A1]" />
                <span className="font-medium">Баллы лояльности</span>
              </div>
              
              {orderInfo.loyaltyPointsUsed > 0 && (
                <div className="text-sm">
                  <span className="text-[#222222]/60">Списано: </span>
                  <span className="font-bold text-[#FF90A1]">
                    -{orderInfo.loyaltyPointsUsed} {getWooshDeclension(orderInfo.loyaltyPointsUsed)}
                  </span>
                </div>
              )}
              
              {orderInfo.loyaltyPointsEarned > 0 && (
                <div className="text-sm">
                  <span className="text-[#222222]/60">Начислено: </span>
                  <span className="font-bold text-green-600">
                    +{orderInfo.loyaltyPointsEarned} {getWooshDeclension(orderInfo.loyaltyPointsEarned)}
                  </span>
                </div>
              )}
              
              {orderInfo.currentBalance !== undefined && (
                <div className="pt-3 border-t border-[#222222]/10">
                  <span className="text-[#222222]/60 text-sm">Текущий баланс: </span>
                  <span className="font-bold text-[#222222]">
                    {orderInfo.currentBalance} {getWooshDeclension(orderInfo.currentBalance)}
                  </span>
                </div>
              )}
              
              <p className="text-xs text-[#222222]/50 mt-2">1 Вуш = 1₽</p>
            </div>
          )}
          
          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => navigate('/retail/dashboard')} 
              className="w-full bg-[#FF90A1] text-white hover:bg-[#FF90A1]/90"
            >
              Мои заказы
            </Button>
            
            <Button 
              onClick={() => navigate('/')} 
              variant="outline"
              className="w-full border-[#222222]/20 text-[#222222] hover:bg-[#FFF4E5]"
            >
              Продолжить покупки
            </Button>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}