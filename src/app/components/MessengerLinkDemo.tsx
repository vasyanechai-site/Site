import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { MessageCircle, Send } from 'lucide-react@0.454.0';

/**
 * Демо-компонент для тестирования генерации ссылок на мессенджеры
 * Показывает, как будет выглядеть сообщение в Telegram
 */
export function MessengerLinkDemo() {
  const [phone, setPhone] = useState('79991234567');
  const [companyName, setCompanyName] = useState('ООО "Тестовая компания"');
  const [messenger, setMessenger] = useState<'telegram' | 'whatsapp'>('telegram');

  // Форматирование номера телефона (убираем все кроме цифр)
  const formatPhone = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('8') && cleaned.length === 11) {
      cleaned = '7' + cleaned.substring(1);
    }
    
    return cleaned;
  };

  // Генерация ссылки на мессенджер
  const generateLink = (): string => {
    const formattedPhone = formatPhone(phone);
    
    if (messenger === 'telegram') {
      return `https://t.me/+${formattedPhone}`;
    } else {
      return `https://wa.me/${formattedPhone}`;
    }
  };

  // Форматирование сообщения
  const formatMessage = (): string => {
    const link = generateLink();
    const messengerName = messenger === 'telegram' ? 'Telegram' : 'WhatsApp';
    
    return `🆕 Новая заявка на регистрацию оптового клиента

📱 Телефон: +${formatPhone(phone)}
🏢 Компания: ${companyName}
💬 Мессенджер: ${messengerName}
🔗 Ссылка на ${messengerName}: ${link}
🕐 Дата: ${new Date().toLocaleString('ru-RU')}`;
  };

  return (
    <div className="mx-auto p-6 space-y-6" style={{ maxWidth: '800px' }}>
      <div className="text-center">
        <h1 className="mb-2">Тестирование ссылок на мессенджеры</h1>
        <p className="text-[#8B7355]">
          Демонстрация формирования уведомлений с кликабельными ссылками
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="phone">Номер телефона</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="79991234567"
            />
          </div>

          <div>
            <Label htmlFor="company">Название компании</Label>
            <Input
              id="company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder='ООО "Название"'
            />
          </div>

          <div>
            <Label>Мессенджер</Label>
            <div className="flex gap-3 mt-2">
              <Button
                variant={messenger === 'telegram' ? 'default' : 'outline'}
                onClick={() => setMessenger('telegram')}
                className="flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Telegram
              </Button>
              <Button
                variant={messenger === 'whatsapp' ? 'default' : 'outline'}
                onClick={() => setMessenger('whatsapp')}
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-[#FFF4E5]">
        <h2 className="mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-[#D4A574]" />
          Предпросмотр сообщения Telegram
        </h2>
        <div
          className="bg-white p-4 rounded-lg border border-[#D4A574]/20 shadow-sm"
          style={{
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            fontSize: '14px',
            lineHeight: '1.6',
          }}
        >
          {formatMessage()}
        </div>
      </Card>

      <Card className="p-6 bg-blue-50">
        <h3 className="mb-3">✅ Что проверить:</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>Переносы строк отображаются корректно (не как текст "\n")</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>Ссылка на мессенджер должна быть кликабельной в Telegram</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>Номер телефона форматируется правильно (8 заменяется на 7)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>Все эмодзи отображаются корректно</span>
          </li>
        </ul>
      </Card>

      <Card className="p-6 bg-green-50">
        <h3 className="mb-3">🔗 Сгенерированная ссылка:</h3>
        <a
          href={generateLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all"
        >
          {generateLink()}
        </a>
        <p className="mt-3 text-sm text-gray-600">
          Кликните по ссылке для проверки открытия мессенджера
        </p>
      </Card>
    </div>
  );
}
