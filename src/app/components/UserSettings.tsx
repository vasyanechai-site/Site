import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Loader2, Save } from 'lucide-react@0.454.0';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { CompanyAutocomplete } from './CompanyAutocomplete';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface UserSettingsProps {
  userId: string;
  userCompanyName: string;
  onBack: () => void;
  onLogout: () => void;
  onNavigateToRetail?: () => void;
}

interface UserSettingsData {
  company: string;
  inn: string;
  account: string;
  bik: string;
  contact: string;
  phone: string;
  address: string;
  delivery_company: string;
  delivery_method: string;
}

export function UserSettings({ userId, userCompanyName, onBack, onLogout, onNavigateToRetail }: UserSettingsProps) {
  const [formData, setFormData] = useState<UserSettingsData>({
    company: '',
    inn: '',
    account: '',
    bik: '',
    contact: '',
    phone: '',
    address: '',
    delivery_company: '',
    delivery_method: ''
  });
  const [errors, setErrors] = useState<Partial<Record<keyof UserSettingsData, string>>>({});
  const [showBankFields, setShowBankFields] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadUserSettings();
  }, []); // Загружаем при каждом монтировании компонента

  const loadUserSettings = async () => {
    try {
      setIsLoading(true);
      console.log('Loading user settings');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/user-settings/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Loaded user settings:', data);
        if (data.settings) {
          setFormData(data.settings);
          if (data.settings.inn) {
            setShowBankFields(true);
          }
        } else {
          console.log('No settings found for user');
        }
      } else {
        console.error('Failed to load settings - response not ok:', response.status);
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof UserSettingsData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
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
    
    if (data.inn) {
      setShowBankFields(true);
    }
    
    setErrors(prev => ({
      ...prev,
      company: undefined,
      inn: undefined,
      address: undefined
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof UserSettingsData, string>> = {};

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
    if (!formData.delivery_company.trim()) {
      newErrors.delivery_company = 'Заполните поле';
    }
    if (!formData.delivery_method.trim()) {
      newErrors.delivery_method = 'Заполните поле';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Пожалуйста, исправьте ошибки в форме');
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/user-settings/${userId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ settings: formData })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success('Настройки успешно сохранены');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Не удалось сохранить настройки');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <Logo onClick={onNavigateToRetail} />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {onNavigateToRetail && (
                <Button 
                  variant="ghost"
                  onClick={onNavigateToRetail}
                  className="text-sm"
                >
                  Розница
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={onLogout}
              >
                Выйти
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-foreground">{userCompanyName}</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Вернуться в каталог
        </Button>

        <div className="max-w-2xl">
          <h2 className="text-foreground mb-6">Профиль</h2>
          <p className="text-muted-foreground text-sm mb-8">
            Данные профиля автоматически подставляются при оформлении заказа. Чтобы обновить профиль, измените данные здесь и нажмите «Сохранить профиль».
          </p>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="company" className="text-foreground">
                Наименование ИП / ООО
              </Label>
              <CompanyAutocomplete
                value={formData.company}
                onChange={(value) => handleChange('company', value)}
                onSelect={handleCompanySelect}
                error={errors.company}
              />
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
                className={errors.inn ? 'border-red-500' : ''}
              />
              {errors.inn && <p className="text-red-600 text-xs">{errors.inn}</p>}
            </div>

            {showBankFields && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="account" className="text-foreground">
                    Расчетный счет
                  </Label>
                  <Input
                    id="account"
                    value={formData.account}
                    onChange={(e) => handleChange('account', e.target.value)}
                    placeholder="12345678901234567890"
                    className={errors.account ? 'border-red-500' : ''}
                  />
                  {errors.account && <p className="text-red-600 text-xs">{errors.account}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bik" className="text-foreground">
                    БИК банка
                  </Label>
                  <Input
                    id="bik"
                    value={formData.bik}
                    onChange={(e) => handleChange('bik', e.target.value)}
                    placeholder="123456789"
                    className={errors.bik ? 'border-red-500' : ''}
                  />
                  {errors.bik && <p className="text-red-600 text-xs">{errors.bik}</p>}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="address" className="text-foreground">
                Адрес организации
              </Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="г. Москва, ул. Примерная, д. 1"
                className={errors.address ? 'border-red-500' : ''}
              />
              {errors.address && <p className="text-red-600 text-xs">{errors.address}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="contact" className="text-foreground">
                  Контактное лицо
                </Label>
                <Input
                  id="contact"
                  value={formData.contact}
                  onChange={(e) => handleChange('contact', e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  className={errors.contact ? 'border-red-500' : ''}
                />
                {errors.contact && <p className="text-red-600 text-xs">{errors.contact}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground">
                  Телефон
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+7 (999) 123-45-67"
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && <p className="text-red-600 text-xs">{errors.phone}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="delivery_company" className="text-foreground">
                  Транспортная компания
                </Label>
                <Input
                  id="delivery_company"
                  value={formData.delivery_company}
                  onChange={(e) => handleChange('delivery_company', e.target.value)}
                  placeholder="СДЭК, ПЭК и т.д."
                  className={errors.delivery_company ? 'border-red-500' : ''}
                />
                {errors.delivery_company && <p className="text-red-600 text-xs">{errors.delivery_company}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_method" className="text-foreground">
                  Способ доставки
                </Label>
                <Input
                  id="delivery_method"
                  value={formData.delivery_method}
                  onChange={(e) => handleChange('delivery_method', e.target.value)}
                  placeholder="До терминала / До двери"
                  className={errors.delivery_method ? 'border-red-500' : ''}
                />
                {errors.delivery_method && <p className="text-red-600 text-xs">{errors.delivery_method}</p>}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={isSaving}
                className="w-full md:w-auto bg-[#FECC4B] text-black hover:bg-[#FECC4B]/90 disabled:opacity-40"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Сохранить профиль
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}