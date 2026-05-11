import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, CheckCircle2, HelpCircle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { API_BASE_URL } from '../../lib/backendConfig';
import { formatRuMobile8Display, isCompleteRuMobile8, parseRuMobile8Input } from '../../lib/ruMobilePhoneMask';
import { isValidTelegramUsername } from '../../lib/telegramUsername';

const TELEGRAM_USERNAME_HINT =
  'Настройки → ваш профиль → «Имя пользователя». Это @ник; если поля нет — задайте username там же (латиница, цифры, _).';

export function WholesaleAccessForm() {
  const navigate = useNavigate();
  /** Только цифры: 8 + 10 цифр (после нормализации +7→8 и т.п.) */
  const [phoneDigits, setPhoneDigits] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    channel: 'telegram' as 'telegram' | 'whatsapp',
    telegramUsername: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [phoneError, setPhoneError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPhoneError(''); // Сбрасываем ошибку перед отправкой

    if (!isCompleteRuMobile8(phoneDigits)) {
      toast.error('Введите номер телефона полностью в формате 8 (999) 000-00-00');
      setLoading(false);
      return;
    }

    if (formData.channel === 'telegram' && !isValidTelegramUsername(formData.telegramUsername)) {
      toast.error('Введите ник в Telegram, например @name (латиница, цифры, _, от 5 символов)');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/wholesale/request-access`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...formData,
            phone: phoneDigits,
            ...(formData.channel === 'whatsapp' ? { telegramUsername: undefined } : {}),
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        
        // Проверяем, является ли это ошибкой существующего пользователя
        if (response.status === 400 && errorText.includes('уже зарегистрирован')) {
          setPhoneError('Пользователь с этим номером телефона уже зарегистрирован. Если у вас возникли проблемы со входом, свяжитесь с нами.');
          setLoading(false);
          return;
        }
        
        throw new Error(errorText || 'Ошибка при отправке заявки');
      }

      const result = await response.json();
      console.log('Access request submitted:', result);
      
      setSubmitted(true);
      toast.success('Заявка успешно отправлена');
    } catch (err) {
      console.error('Access request error:', err);
      toast.error('Произошла ошибка при отправке заявки');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] bg-white p-8 md:p-12 shadow-none text-center">
          <CheckCircle2 className="w-16 h-16 text-[#FF90A1] mx-auto mb-6" />
          <h1 className="text-2xl font-normal text-[#222222] tracking-tight mb-4">Заявка отправлена</h1>
          <p className="text-gray-600 mb-8">
            Кабинет опта создан автоматически. Логин и пароль отправлены в Telegram администратору — вам их перешлют в выбранный канал связи (Telegram или WhatsApp).
          </p>
          <Button
            onClick={() => navigate('/loginopt')}
            className="w-full bg-[#FF90A1] hover:bg-[#FF8095] text-white h-12 text-base"
          >
            Войти с учетными данными
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white p-8 md:p-12 shadow-none">
        <button 
          onClick={() => navigate('/loginopt')}
          className="flex items-center gap-2 text-[#222222] opacity-60 hover:opacity-100 mb-8 transition-opacity text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-normal text-[#222222] tracking-tight">Получить доступ</h1>
          <p className="text-sm text-gray-500 mt-2">К оптовому кабинету</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm text-gray-500 font-medium">Ваше имя</Label>
            <Input
              id="name"
              type="text"
              placeholder="Иван Иванов"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="bg-[#F9F9F9] border-none h-12 text-base focus-visible:ring-1 focus-visible:ring-[#FF90A1] placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company" className="text-sm text-gray-500 font-medium">Название компании</Label>
            <Input
              id="company"
              type="text"
              placeholder="ООО Рога и Копыта"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              required
              className="bg-[#F9F9F9] border-none h-12 text-base focus-visible:ring-1 focus-visible:ring-[#FF90A1] placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm text-gray-500 font-medium">Телефон</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="8 (999) 000-00-00"
              value={formatRuMobile8Display(phoneDigits)}
              onChange={(e) => {
                setPhoneDigits(parseRuMobile8Input(e.target.value));
                if (phoneError) setPhoneError('');
              }}
              required
              className={`bg-[#F9F9F9] border-none h-12 text-base focus-visible:ring-1 placeholder:text-gray-400 ${
                phoneError 
                  ? 'ring-1 ring-red-500 focus-visible:ring-red-500' 
                  : 'focus-visible:ring-[#FF90A1]'
              }`}
            />
            {phoneError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                <p className="text-red-600 text-sm flex items-start gap-1.5">
                  <span className="mt-0.5">⚠️</span>
                  <span>
                    Пользователь с этим номером телефона уже зарегистрирован.{' '}
                    <Link to="/loginopt" className="underline font-medium hover:text-red-700">
                      Войти в систему
                    </Link>
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm text-gray-500 font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@company.ru"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-[#F9F9F9] border-none h-12 text-base focus-visible:ring-1 focus-visible:ring-[#FF90A1] placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-gray-500 font-medium">Куда прислать данные для входа?</Label>
            <RadioGroup
              value={formData.channel}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  channel: value as 'telegram' | 'whatsapp',
                  ...(value === 'whatsapp' ? { telegramUsername: '' } : {}),
                }))
              }
              className="flex flex-col space-y-2"
            >
              <div className="flex items-center space-x-2 bg-[#F9F9F9] p-3 rounded-lg cursor-pointer hover:bg-[#F0F0F0] transition-colors">
                <RadioGroupItem value="telegram" id="telegram" />
                <Label htmlFor="telegram" className="text-base cursor-pointer flex-1">Telegram</Label>
              </div>
              <div className="flex items-center space-x-2 bg-[#F9F9F9] p-3 rounded-lg cursor-pointer hover:bg-[#F0F0F0] transition-colors">
                <RadioGroupItem value="whatsapp" id="whatsapp" />
                <Label htmlFor="whatsapp" className="text-base cursor-pointer flex-1">WhatsApp</Label>
              </div>
            </RadioGroup>

            {formData.channel === 'telegram' && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="telegram-username" className="text-sm text-gray-500 font-medium">
                    Ник в Telegram
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        aria-label="Где узнать ник в Telegram"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[min(280px,calc(100vw-2rem))] border-0 bg-zinc-900 px-3 py-2 text-xs leading-snug text-zinc-50"
                    >
                      {TELEGRAM_USERNAME_HINT}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="telegram-username"
                  type="text"
                  inputMode="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="@name"
                  value={formData.telegramUsername}
                  onChange={(e) => setFormData({ ...formData, telegramUsername: e.target.value })}
                  required
                  className="bg-[#F9F9F9] border-none h-12 text-base focus-visible:ring-1 focus-visible:ring-[#FF90A1] placeholder:text-gray-400"
                />
              </div>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full bg-[#FF90A1] hover:bg-[#FF8095] text-white h-12 text-base font-medium mt-6 transition-colors shadow-none" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Отправка...
              </>
            ) : (
              'Отправить заявку'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-400">
          После отправки мы создадим для вас личный кабинет и вышлем логин с паролем
        </div>
      </div>
    </div>
  );
}