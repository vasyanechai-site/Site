import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckCircle, Package, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { SEOHelmet, SEOConfig } from './SEOHelmet';

export function RetailPaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    // Обновляем баланс вушей и заказы
    window.dispatchEvent(new Event('loyalty-balance-updated'));
    window.dispatchEvent(new Event('orders-updated'));

    // Автоматический редирект через 10 секунд
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      {/* SEO Meta Tags */}
      <SEOHelmet {...SEOConfig.paymentSuccess} />
      
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Success Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
        </div>

        {/* Success Message */}
        <h1 className="text-2xl mb-2 text-gray-900">
          Спасибо за заказ!
        </h1>
        <p className="text-gray-600 mb-6">
          Ваш заказ принят в обработку
        </p>

        {/* Order Number */}
        {orderId && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-gray-700">
              <Package className="w-5 h-5" />
              <span>Номер заказа:</span>
              <span className="font-mono">{orderId}</span>
            </div>
          </div>
        )}

        {/* Information */}
        <div className="text-sm text-gray-600 mb-6 space-y-2">
          <p>✅ Кассовый чек будет отправлен на вашу почту</p>
          <p>📦 Мы начнём обработку вашего заказа после подтверждения оплаты</p>
          <p>📧 Информация о доставке придёт на email</p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => navigate('/')}
            className="w-full"
            size="lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Вернуться на главную
          </Button>
          
          <p className="text-sm text-gray-500">
            Автоматический переход через {countdown} сек.
          </p>
        </div>
      </div>
    </div>
  );
}