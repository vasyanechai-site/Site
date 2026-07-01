import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { XCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { useDisplayOrderNumber } from '../lib/useDisplayOrderNumber';

export function RetailPaymentFail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const technicalOrderId = searchParams.get('order_id') || searchParams.get('orderId');
  const { displayNumber } = useDisplayOrderNumber(technicalOrderId);
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    // Автоматический редирект через 15 секунд
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
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Error Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-2xl mb-2 text-gray-900">
          Оплата не прошла
        </h1>
        <p className="text-gray-600 mb-6">
          К сожалению, не удалось завершить платёж
        </p>

        {/* Order Number */}
        {technicalOrderId && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              Заказ №<span className="font-mono">{displayNumber}</span> не был оплачен
            </p>
          </div>
        )}

        {/* Possible Reasons */}
        <div className="text-left bg-orange-50 rounded-lg p-4 mb-6">
          <p className="text-sm mb-2">
            Возможные причины:
          </p>
          <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
            <li>Недостаточно средств на карте</li>
            <li>Операция была отменена</li>
            <li>Технические проблемы банка</li>
            <li>Превышен лимит операций</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => navigate('/')}
            className="w-full"
            size="lg"
            variant="default"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Попробовать снова
          </Button>
          
          <Button
            onClick={() => navigate('/')}
            className="w-full"
            size="lg"
            variant="outline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Вернуться на главную
          </Button>
          
          <p className="text-sm text-gray-500">
            Автоматический переход через {countdown} сек.
          </p>
        </div>

        {/* Support Info */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Нужна помощь?{' '}
            <a 
              href="mailto:chai.nechai@yandex.ru" 
              className="text-blue-600 hover:underline"
            >
              Напишите нам
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
