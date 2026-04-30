import { useSearchParams, useNavigate } from 'react-router@7.12.0';
import { Button } from './ui/button';
import { FadeIn } from './ui/fade-in';
import { XCircle } from 'lucide-react';
 
export function RetailOrderFailed() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('order_id');

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

  return (
    <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center p-4">
      <FadeIn>
        <div className="bg-white p-8 rounded-lg shadow-sm text-center max-w-md w-full border border-border">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-[#222222] mb-2">Оплата не прошла</h1>
          <p className="text-[#222222]/70 mb-6">
            К сожалению, при оплате заказа #{orderId} возникла ошибка.<br />
            Вы можете попробовать еще раз или связаться с нами для уточнения деталей.
          </p>
          
          <div className="space-y-3">
            <Button 
              onClick={() => navigate('/')} 
              className="w-full bg-[#f5ca4a] text-[#222222] hover:bg-[#f5ca4a]/90"
            >
              Вернуться в магазин
            </Button>
            
            <Button 
              onClick={() => window.location.href = 'tel:+78123851877'} 
              variant="outline"
              className="w-full"
            >
              Связаться с нами
            </Button>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
