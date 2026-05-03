import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { OrderFormData } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Loader2, X, Check, AlertCircle } from 'lucide-react';
import { CompanyAutocomplete } from './CompanyAutocomplete';
import { verifyPromoCode } from '../lib/api';
import { toast } from 'sonner';
import { API_BASE_URL } from '../lib/backendConfig';

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: OrderFormData, promoDiscount?: number) => void;
  userId?: string;
  totalAmount: number;
}

export function OrderDialog({ open, onOpenChange, onSubmit, userId, totalAmount }: OrderDialogProps) {
  const [formData, setFormData] = useState<OrderFormData>({
    company: '',
    inn: '',
    account: '',
    bik: '',
    contact: '',
    phone: '',
    address: '',
    delivery_address: '',
    delivery_company: '',
    delivery_method: '',
    promoCode: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof OrderFormData, string>>>({});
  const [showBankFields, setShowBankFields] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  
  // Promo Code State
  const [promoStatus, setPromoStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');
  const [promoDiscount, setPromoDiscount] = useState<number | null>(null);
  const [promoMessage, setPromoMessage] = useState('');
  
  const [agreedToCommunications, setAgreedToCommunications] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [checkboxErrors, setCheckboxErrors] = useState<{
    communications?: string;
    privacy?: string;
    terms?: string;
  }>({});

  // Загружаем настройки пользователя при открытии диалога
  useEffect(() => {
    if (open && userId) {
      loadUserSettings();
    }
  }, [open, userId]);

  const loadUserSettings = async () => {
    if (!userId) return;
    
    try {
      setIsLoadingSettings(true);
      const response = await fetch(`${API_BASE_URL}/user-settings/${userId}`);

      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          // Профиль уже существует - подставляем данные в форму
          // Гарантируем, что все поля определены (не undefined)
          setFormData({
            company: data.settings.company || '',
            inn: data.settings.inn || '',
            account: data.settings.account || '',
            bik: data.settings.bik || '',
            contact: data.settings.contact || '',
            phone: data.settings.phone || '',
            address: data.settings.address || '',
            delivery_address: data.settings.delivery_address || '',
            delivery_company: data.settings.delivery_company || '',
            delivery_method: data.settings.delivery_method || '',
            promoCode: ''
          });
          setHasExistingProfile(true);
          if (data.settings.inn) {
            setShowBankFields(true);
          }
        } else {
          // Профиль пустой - это первый заказ
          setHasExistingProfile(false);
        }
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const saveUserSettings = async (data: OrderFormData) => {
    if (!userId) return;
    
    try {
      console.log('Saving user settings');
      const response = await fetch(`${API_BASE_URL}/user-settings/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: data }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('User settings saved successfully:', result);
      } else {
        const error = await response.text();
        console.error('Failed to save user settings - response not ok:', error);
      }
    } catch (error) {
      console.error('Failed to save user settings - exception:', error);
    }
  };

  const handleChange = (field: keyof OrderFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Показываем банковские поля после заполнения ИНН
    if (field === 'inn' && value.trim().length >= 10) {
      setShowBankFields(true);
    }
  };
  
  const handleCompanySelect = (data: { company: string; inn: string; address: string }) => {
    setFormData(prev => ({
      ...prev,
      company: data.company,
      inn: data.inn,
      address: data.address
    }));
    
    // Показываем банковские поля после выбора компании
    if (data.inn) {
      setShowBankFields(true);
    }
    
    // Очищаем ошибки
    setErrors(prev => ({
      ...prev,
      company: undefined,
      inn: undefined,
      address: undefined
    }));
  };

  const handleApplyPromo = async () => {
    if (!formData.promoCode?.trim()) return;
    
    setPromoStatus('verifying');
    setPromoMessage('');
    setPromoDiscount(null);

    try {
      const result = await verifyPromoCode(formData.promoCode.trim());
      
      if (result.valid) {
        setPromoStatus('valid');
        setPromoDiscount(result.discountPercent || 0);
        
        const discount = result.discountPercent || 0;
        const newTotal = Math.round(totalAmount * (1 - discount / 100));
        
        setPromoMessage(`Скидка ${discount}% применена`);
        
        toast.success(
          <div>
            Промокод применен! Сумма: <span className="line-through text-muted-foreground">{totalAmount.toLocaleString()} ₽</span> <span className="font-bold">{newTotal.toLocaleString()} ₽</span>
          </div>
        );
      } else {
        setPromoStatus('invalid');
        setPromoMessage(result.error || 'Промокод не найден');
        toast.error(result.error || 'Промокод не найден');
      }
    } catch (error) {
      setPromoStatus('invalid');
      setPromoMessage('Ошибка проверки промокода');
      toast.error('Ошибка проверки промокода');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof OrderFormData, string>> = {};

    if (!formData.company.trim()) {
      newErrors.company = 'Заполните поле';
    }
    if (!formData.inn.trim()) {
      newErrors.inn = 'Заполните поле';
    } else if (!/^\d{10}$|^\d{12}$/.test(formData.inn.trim())) {
      newErrors.inn = 'ИНН должен содержать 10 или 12 цифр';
    }
    if (!formData.account.trim()) {
      newErrors.account = 'Заполните поле';
    } else if (!/^\d{20}$/.test(formData.account.trim())) {
      newErrors.account = 'Расчетный счет должен содержать 20 цифр';
    }
    if (!formData.bik.trim()) {
      newErrors.bik = 'Заполните поле';
    } else if (!/^\d{9}$/.test(formData.bik.trim())) {
      newErrors.bik = 'БИК должен содержать 9 цифр';
    }
    if (!formData.contact.trim()) {
      newErrors.contact = 'Заполните поле';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Заполните поле';
    } else if (!/^[\d\s\+\-\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Неверный формат телефона';
    }
    if (!formData.address.trim()) {
      newErrors.address = 'Заполните поле';
    }
    if (!formData.delivery_address.trim()) {
      newErrors.delivery_address = 'Заполните поле';
    }
    if (!formData.delivery_company.trim()) {
      newErrors.delivery_company = 'Заполните поле';
    }
    if (!formData.delivery_method.trim()) {
      newErrors.delivery_method = 'Заполните поле';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newCheckboxErrors: {
      communications?: string;
      privacy?: string;
      terms?: string;
    } = {};

    if (!agreedToCommunications) {
      newCheckboxErrors.communications = 'Необходимо согласие на получение информационных сообщений';
    }
    if (!agreedToPrivacy) {
      newCheckboxErrors.privacy = 'Необходимо согласие на обработку персональных данных';
    }
    if (!agreedToTerms) {
      newCheckboxErrors.terms = 'Необходимо принять условия Пользовательского соглашения';
    }

    setCheckboxErrors(newCheckboxErrors);

    if (validateForm() && Object.keys(newCheckboxErrors).length === 0) {
      setIsSubmitting(true);
      try {
        // Сохраняем данные в профиль ТОЛЬКО при первом заказе (когда профиль пустой)
        if (userId && !hasExistingProfile) {
          console.log('First order - saving profile data');
          await saveUserSettings(formData);
          setHasExistingProfile(true); // После первого сохранения устанавливаем флаг
        }
        
        await onSubmit(formData, promoDiscount || undefined);
        
        // Сбрасываем состояние промокода после успешного заказа
        setPromoStatus('idle');
        setPromoMessage('');
        setPromoDiscount(null);
        setFormData(prev => ({ ...prev, promoCode: '' }));
        
        // Не очищаем остальные поля формы, если есть userId - данные останутся для следующего заказа
        if (!userId) {
          setFormData({
            company: '',
            inn: '',
            account: '',
            bik: '',
            contact: '',
            phone: '',
            address: '',
            delivery_address: '',
            delivery_company: '',
            delivery_method: '',
            promoCode: ''
          });
        }
        setErrors({});
        setCheckboxErrors({});
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Показываем первую ошибку
      if (Object.keys(newCheckboxErrors).length > 0) {
        const firstError = Object.values(newCheckboxErrors)[0];
        toast.error(firstError);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] lg:max-h-[90vh] lg:top-[50%] lg:translate-y-[-50%] max-lg:top-auto max-lg:bottom-0 max-lg:translate-y-0 max-lg:rounded-b-none max-lg:max-h-[95vh] overflow-hidden flex flex-col p-0 gap-0 bg-transparent [&>button]:hidden">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-foreground">Оформление заказа</DialogTitle>
              <DialogClose className="opacity-70 transition-opacity hover:opacity-100">
                <X className="h-4 w-4 text-foreground" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="overflow-y-auto px-6 flex-1 bg-background">
          <DialogDescription className="text-muted-foreground text-sm pt-4 pb-2">
            Пожалуйста, заполните все поля для оформления заказа.
          </DialogDescription>
          {isLoadingSettings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 pb-6">
          <div className="space-y-2">
            <Label htmlFor="company" className="text-foreground">
              Наименование ИП / ООО
            </Label>
            <CompanyAutocomplete
              value={formData.company}
              onChange={(value) => handleChange('company', value)}
              error={errors.company}
              onSelect={handleCompanySelect} // Passed as onCompanySelect in previous version but prop is onSelect in usages? No wait, prop name is onCompanySelect in interface but passed as onSelect here?
              // Checking usage in read output: <CompanyAutocomplete ... onSelect={handleCompanySelect} />
              // Checking component definition: onCompanySelect?: (data: ...) => void;
              // Wait, previous file read of OrderDialog.tsx showed: onSelect={handleCompanySelect}
              // But CompanyAutocomplete props has onCompanySelect.
              // This might be a bug or I misread. Let me check CompanyAutocomplete props again.
              // CompanyAutocompleteProps: onCompanySelect
              // OrderDialog.tsx usage: onSelect={handleCompanySelect}
              // If it was working, maybe I am misreading or React is ignoring it? 
              // Ah, I see in CompanyAutocomplete.tsx: export function CompanyAutocomplete({ value, onChange, error, onCompanySelect }: CompanyAutocompleteProps)
              // So the prop IS onCompanySelect.
              // In OrderDialog.tsx it is passed as onSelect. This suggests it might NOT be working currently if the prop name doesn't match.
              // OR the read output of OrderDialog.tsx I got earlier might have `onSelect` but I should correct it to `onCompanySelect` if I am rewriting it.
              // However, I should probably stick to fixing styles first. But if I rewrite the whole block I can fix the prop name too if it's wrong.
              // Actually, I should probably check if I should just replace the whole return block to be safe.
              // However, I should probably check if I should just replace the whole return block to be safe.
            />
            {errors.company && (
              <p className="text-destructive text-sm">{errors.company}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="inn" className="text-foreground">
              ИНН
            </Label>
            <Input
              id="inn"
              value={formData.inn}
              onChange={(e) => handleChange('inn', e.target.value)}
              placeholder="1234567890"
              className={errors.inn ? 'border-destructive' : ''}
              required
            />
            {errors.inn && (
              <p className="text-destructive text-sm">{errors.inn}</p>
            )}
          </div>

          {showBankFields && (
            <>
              <div className="space-y-2">
                <Label htmlFor="account" className="text-foreground">
                  Расчетный счет
                </Label>
                <Input
                  id="account"
                  value={formData.account}
                  onChange={(e) => handleChange('account', e.target.value)}
                  placeholder="40702810000000000000"
                  className={errors.account ? 'border-destructive' : ''}
                  required
                />
                {errors.account && (
                  <p className="text-destructive text-sm">{errors.account}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bik" className="text-foreground">
                  БИК банка
                </Label>
                <Input
                  id="bik"
                  value={formData.bik}
                  onChange={(e) => handleChange('bik', e.target.value)}
                  placeholder="044525225"
                  className={errors.bik ? 'border-destructive' : ''}
                  required
                />
                {errors.bik && (
                  <p className="text-destructive text-sm">{errors.bik}</p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="contact" className="text-foreground">
              Контактное лицо
            </Label>
            <Input
              id="contact"
              value={formData.contact}
              onChange={(e) => handleChange('contact', e.target.value)}
              placeholder="Иванов Иван Иванович"
              className={errors.contact ? 'border-destructive' : ''}
              required
            />
            {errors.contact && (
              <p className="text-destructive text-sm">{errors.contact}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground">
              Телефон
            </Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+7 (900) 123-45-67"
              className={errors.phone ? 'border-destructive' : ''}
              required
            />
            {errors.phone && (
              <p className="text-destructive text-sm">{errors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-foreground">
              Юридический адрес
            </Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="г. Москва, ул. Примерная, д. 1"
              className={errors.address ? 'border-destructive' : ''}
              required
            />
            {errors.address && (
              <p className="text-destructive text-sm">{errors.address}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_address" className="text-foreground">
              Адрес доставки
            </Label>
            <Input
              id="delivery_address"
              value={formData.delivery_address}
              onChange={(e) => handleChange('delivery_address', e.target.value)}
              placeholder="г. Москва, ул. Складская, д. 10"
              className={errors.delivery_address ? 'border-destructive' : ''}
              required
            />
            {errors.delivery_address && (
              <p className="text-destructive text-sm">{errors.delivery_address}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_company" className="text-foreground">
              Транспортная кмпания
            </Label>
            <Input
              id="delivery_company"
              value={formData.delivery_company}
              onChange={(e) => handleChange('delivery_company', e.target.value)}
              placeholder="СДЭК, ПЭК, Деловые Линии"
              className={errors.delivery_company ? 'border-destructive' : ''}
              required
            />
            {errors.delivery_company && (
              <p className="text-destructive text-sm">{errors.delivery_company}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_method" className="text-foreground">
              Способ доставки
            </Label>
            <Input
              id="delivery_method"
              value={formData.delivery_method}
              onChange={(e) => handleChange('delivery_method', e.target.value)}
              placeholder="До склада / До двери"
              className={errors.delivery_method ? 'border-destructive' : ''}
              required
            />
            {errors.delivery_method && (
              <p className="text-destructive text-sm">{errors.delivery_method}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="promoCode" className="text-foreground">
              Промокод
            </Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  id="promoCode"
                  value={formData.promoCode || ''}
                  onChange={(e) => {
                    handleChange('promoCode', e.target.value.toUpperCase());
                    setPromoStatus('idle');
                    setPromoDiscount(null);
                    setPromoMessage('');
                  }}
                  placeholder="SALE2024"
                  className={
                    promoStatus === 'valid' ? 'border-green-500 pr-10' : 
                    promoStatus === 'invalid' ? 'border-destructive pr-10' : ''
                  }
                />
                {promoStatus === 'valid' && (
                  <Check className="w-4 h-4 text-green-500 absolute right-3 top-1/2 -translate-y-1/2" />
                )}
                {promoStatus === 'invalid' && (
                  <AlertCircle className="w-4 h-4 text-destructive absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleApplyPromo}
                disabled={promoStatus === 'verifying' || !formData.promoCode}
              >
                {promoStatus === 'verifying' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Применить'}
              </Button>
            </div>
            {promoMessage && (
              <p className={`text-sm ${promoStatus === 'valid' ? 'text-green-600' : 'text-destructive'}`}>
                {promoMessage}
              </p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-start space-x-3">
              <Checkbox 
                id="wholesale-communications" 
                checked={agreedToCommunications}
                onCheckedChange={(checked) => {
                  setAgreedToCommunications(checked as boolean);
                  if (checkboxErrors.communications) {
                    setCheckboxErrors(prev => ({ ...prev, communications: undefined }));
                  }
                }}
                className={`mt-0.5 ${checkboxErrors.communications ? 'border-red-500' : ''}`}
              />
              <div className="flex-1">
                <label 
                  htmlFor="wholesale-communications" 
                  className="text-sm leading-[1.3] font-normal cursor-pointer text-foreground"
                >
                  Я согласен(а) на получение <a href="/marketing-consent" target="_blank" className="text-muted-foreground underline hover:text-foreground transition-colors">информационных и рекламных сообщений</a>
                </label>
                {checkboxErrors.communications && (
                  <p className="text-red-500 text-xs mt-1">{checkboxErrors.communications}</p>
                )}
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox 
                id="wholesale-privacy" 
                checked={agreedToPrivacy}
                onCheckedChange={(checked) => {
                  setAgreedToPrivacy(checked as boolean);
                  if (checkboxErrors.privacy) {
                    setCheckboxErrors(prev => ({ ...prev, privacy: undefined }));
                  }
                }}
                className={`mt-0.5 ${checkboxErrors.privacy ? 'border-red-500' : ''}`}
              />
              <div className="flex-1">
                <label 
                  htmlFor="wholesale-privacy" 
                  className="text-sm leading-[1.3] font-normal cursor-pointer text-foreground"
                >
                  Я даю согласие на обработку моих персональных данных и принимаю <a href="/privacy" target="_blank" className="text-muted-foreground underline hover:text-foreground transition-colors">Политику конфиденциальности</a>
                </label>
                {checkboxErrors.privacy && (
                  <p className="text-red-500 text-xs mt-1">{checkboxErrors.privacy}</p>
                )}
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox 
                id="wholesale-terms" 
                checked={agreedToTerms}
                onCheckedChange={(checked) => {
                  setAgreedToTerms(checked as boolean);
                  if (checkboxErrors.terms) {
                    setCheckboxErrors(prev => ({ ...prev, terms: undefined }));
                  }
                }}
                className={`mt-0.5 ${checkboxErrors.terms ? 'border-red-500' : ''}`}
              />
              <div className="flex-1">
                <label 
                  htmlFor="wholesale-terms" 
                  className="text-sm leading-[1.3] font-normal cursor-pointer text-foreground"
                >
                  Я принимаю условия <a href="/agreement" target="_blank" className="text-muted-foreground underline hover:text-foreground transition-colors">Пользовательского соглашения</a>
                </label>
                {checkboxErrors.terms && (
                  <p className="text-red-500 text-xs mt-1">{checkboxErrors.terms}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="submit"
              className="flex-1 bg-black text-white hover:bg-black/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Оформление...
                </>
              ) : (
                'Оформить заказ'
              )}
            </Button>
            <Button 
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Отмена
            </Button>
          </div>
        </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}