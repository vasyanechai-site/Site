import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { MessageCircle, Send } from 'lucide-react@0.454.0';
import { FadeIn } from './ui/fade-in';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface BusinessRegistrationProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BusinessRegistration({ isOpen, onClose }: BusinessRegistrationProps) {
  const [phone, setPhone] = useState('8');
  const [companyName, setCompanyName] = useState('');
  const [messenger, setMessenger] = useState<'telegram' | 'whatsapp' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Разрешаем только цифры
    const digitsOnly = value.replace(/\D/g, '');
    
    // Ограничиваем до 11 цифр
    if (digitsOnly.length <= 11) {
      setPhone(digitsOnly);
    }
  };

  const formatPhoneDisplay = (value: string) => {
    if (value.length === 0) return '';
    if (value.length === 1) return value;
    
    // Формат: 8 (XXX) XXX-XX-XX
    let formatted = value[0];
    if (value.length > 1) {
      formatted += ' (' + value.slice(1, 4);
    }
    if (value.length >= 5) {
      formatted += ') ' + value.slice(4, 7);
    }
    if (value.length >= 8) {
      formatted += '-' + value.slice(7, 9);
    }
    if (value.length >= 10) {
      formatted += '-' + value.slice(9, 11);
    }
    return formatted;
  };

  const isFormValid = () => {
    return phone.length === 11 && companyName.trim().length > 0 && messenger !== null;
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;
    
    setIsSubmitting(true);
    
    try {
      // Отправляем данные на сервер
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/business-registration`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            phone,
            companyName,
            messenger
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to submit registration');
      }

      const result = await response.json();
      console.log('Registration submitted:', result);
      
      setShowSuccess(true);
      toast.success('Заявка успешно отправлена!');
    } catch (error) {
      console.error('Failed to submit registration:', error);
      toast.error('Произошла ошибка при отправке заявки');
      // Показываем успех даже при ошибке отправки на сервер
      setShowSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setPhone('8');
    setCompanyName('');
    setMessenger(null);
    setShowSuccess(false);
  };

  const handleBackToCatalog = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleReset();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        {!showSuccess ? (
          <>
            <DialogHeader>
              <DialogTitle>Регистрация оптового клиента</DialogTitle>
              <DialogDescription>
                Заполните форму для создания оптового аккаунта. Мы отправим вам учетные данные в выбранный мессенджер.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Телефон */}
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formatPhoneDisplay(phone)}
                  onChange={handlePhoneChange}
                  placeholder="8 (___) ___-__-__"
                  className={phone.length > 0 && phone.length < 11 ? 'border-red-500' : ''}
                  autoFocus
                />
                {phone.length > 0 && phone.length < 11 && (
                  <p className="text-xs text-red-600">Введите 11 цифр</p>
                )}
              </div>

              {/* Название компании */}
              <div className="space-y-2">
                <Label htmlFor="company">Название компании</Label>
                <Input
                  id="company"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="ООО Ромашка"
                />
              </div>

              {/* Выбор мессенджера */}
              <div className="space-y-3">
                <Label>Куда вам отправить логин и пароль?</Label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMessenger('telegram')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                      messenger === 'telegram'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}
                  >
                    <Send className="w-5 h-5" />
                    <span>Telegram</span>
                    {messenger === 'telegram' && (
                      <span className="ml-auto">✓</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMessenger('whatsapp')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                      messenger === 'whatsapp'
                        ? 'border-green-500 bg-green-50 dark:bg-green-950'
                        : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>WhatsApp</span>
                    {messenger === 'whatsapp' && (
                      <span className="ml-auto">✓</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Кнопка отправки */}
              <Button
                onClick={handleSubmit}
                disabled={!isFormValid() || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Отправка...' : 'Отправить'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Заявка отправлена!</DialogTitle>
              <DialogDescription>
                Спасибо за регистрацию!
              </DialogDescription>
            </DialogHeader>
            <div className="py-6">
              <FadeIn>
                <div className="text-center space-y-6">
                  {/* Картинка */}
                  <div className="flex justify-center">
                    <ImageWithFallback
                      src="https://optim.tildacdn.com/tild3266-6237-4839-b232-653738353439/-/resize/400x/-/format/webp/photo.png.webp"
                      alt="Успешная регистрация"
                      className="w-64 h-auto rounded-lg"
                    />
                  </div>

                  {/* Текст успеха */}
                  <div className="space-y-3">
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Мы скоро отправим вам логин и пароль в личный кабинет, чтобы вы могли сделать первый заказ со скидкой до 10% и получили доступ к системе лояльности.
                    </p>
                  </div>

                  {/* Кнопка возврата */}
                  <Button
                    onClick={handleBackToCatalog}
                    className="w-full"
                  >
                    Вернуться к прайсу
                  </Button>
                </div>
              </FadeIn>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
