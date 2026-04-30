import { useState } from 'react';
import { Button } from './ui/button';
import { CreditCard, Smartphone, Wallet } from 'lucide-react';

export type PaymentMode = 'card' | 'sbp' | 'tinkoff';

interface PaymentMethodSelectorProps {
  onSelect: (paymentMode: PaymentMode) => void;
  selectedMethod?: PaymentMode;
  disabled?: boolean;
}

export function PaymentMethodSelector({ 
  onSelect, 
  selectedMethod,
  disabled = false 
}: PaymentMethodSelectorProps) {
  const methods = [
    {
      id: 'card' as PaymentMode,
      name: 'Банковская карта',
      description: 'Visa, MasterCard, Мир',
      icon: CreditCard,
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
    },
    {
      id: 'sbp' as PaymentMode,
      name: 'СБП',
      description: 'Система Быстрых Платежей',
      icon: Smartphone,
      color: 'bg-green-50 border-green-200 hover:bg-green-100'
    },
    {
      id: 'tinkoff' as PaymentMode,
      name: 'T-Pay',
      description: 'Тинькофф',
      icon: Wallet,
      color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
    }
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-foreground">Выберите способ оплаты</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {methods.map((method) => {
          const Icon = method.icon;
          const isSelected = selectedMethod === method.id;
          
          return (
            <button
              key={method.id}
              onClick={() => !disabled && onSelect(method.id)}
              disabled={disabled}
              className={`
                relative p-4 rounded-lg border-2 transition-all
                ${isSelected 
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                  : `border-border ${!disabled ? 'hover:border-primary/50' : ''}`
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <Icon className={`w-8 h-8 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <div className={`text-sm ${isSelected ? 'text-foreground' : 'text-foreground'}`}>
                    {method.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {method.description}
                  </div>
                </div>
              </div>
              
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
