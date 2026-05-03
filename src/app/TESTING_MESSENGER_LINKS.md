> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# Тестирование ссылок на мессенджеры в уведомлениях о регистрации

## Что было реализовано

✅ **Автоматическая генерация кликабельных ссылок** на мессенджеры (Telegram/WhatsApp) в уведомлениях о регистрации оптовых клиентов

## Как протестировать

### 1. Регистрация через веб-интерфейс

1. Откройте страницу оптового каталога: `/business`
2. Нажмите кнопку **"Зарегистрироваться"**
3. Заполните форму:
   - **Телефон**: введите номер в формате `8 (XXX) XXX-XX-XX`
   - **Название компании**: введите название организации
   - **Мессенджер**: выберите Telegram или WhatsApp
4. Нажмите **"Отправить заявку"**

### 2. Проверка уведомления в Telegram

После отправки заявки в ваш Telegram-бот должно прийти сообщение следующего формата:

```
🆕 Новая заявка на регистрацию оптового клиента

📱 Телефон: +79991234567
🏢 Компания: ООО "Тестовая компания"
💬 Мессенджер: Telegram
🔗 Ссылка на Telegram: https://t.me/+79991234567
🕐 Дата: 29.11.2025, 15:30:45
```

### 3. Что проверить

✅ **Форматирование сообщения**:
- Переносы строк отображаются корректно (не как текст "\n")
- Эмодзи отображаются правильно
- Все поля заполнены корректно

✅ **Ссылка на мессенджер**:
- Ссылка выделена синим цветом (кликабельна)
- При клике открывается соответствующий мессенджер
- Для Telegram: `https://t.me/+79991234567`
- Для WhatsApp: `https://wa.me/79991234567`

✅ **Форматирование телефона**:
- Номер начинается с +7 (для российских номеров)
- Начальная 8 автоматически заменяется на 7

## Технические детали

### Функции обработки

```typescript
// Форматирование номера телефона
formatPhoneForMessenger(phone: string): string

// Генерация ссылки на мессенджер
generateMessengerLink(phone: string, messenger: string): string

// Создание сообщения с кликабельной ссылкой
createRegistrationMessageWithLink(phone: string, companyName: string, messenger: string): string
```

### API Endpoint

**POST** `/make-server-aa167a09/business-registration`

**Body:**
```json
{
  "phone": "89991234567",
  "companyName": "ООО \"Тестовая компания\"",
  "messenger": "telegram"
}
```

**Response:**
```json
{
  "success": true,
  "registrationId": "nechai_registration_1234567890_123"
}
```

## Что делать при проблемах

### Сообщение не приходит в Telegram
- Проверьте логи сервера на наличие ошибок
- Убедитесь, что `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` настроены корректно
- Проверьте, что бот добавлен в нужный чат/канал

### Ссылка не кликабельна
- Убедитесь, что используется функция `createRegistrationMessageWithLink`
- Проверьте формат ссылки в логах
- Telegram автоматически распознает ссылки формата `https://t.me/+XXXXXXXXX`

### Переносы строк не работают
- Убедитесь, что используется `lines.join('\n')` вместо конкатенации с `\\n`
- Проверьте, что `parse_mode` в Telegram API установлен на 'HTML'

## Дополнительные возможности

### Админ-панель

После регистрации заявка автоматически появляется в админ-панели (`/admin`):
- Вкладка "Заявки на регистрацию"
- Статус: "На рассмотрении"
- Кнопки: "Одобрить" / "Отклонить"

### Интеграция с другими мессенджерами

Система легко расширяется для поддержки других мессенджеров:

```typescript
function generateMessengerLink(phone: string, messenger: string): string {
  const formattedPhone = formatPhoneForMessenger(phone);
  
  if (messenger === 'telegram') {
    return `https://t.me/+${formattedPhone}`;
  } else if (messenger === 'whatsapp') {
    return `https://wa.me/${formattedPhone}`;
  } else if (messenger === 'viber') {
    return `viber://chat?number=%2B${formattedPhone}`;
  }
  
  return '';
}
```

## Расположение файлов

- **Backend**: `/supabase/functions/server/index.tsx` (строки ~2109-2158)
- **Frontend**: `/components/BusinessRegistration.tsx`
- **Telegram API**: `/supabase/functions/server/telegram.tsx`
- **Документация**: `/supabase/functions/server/TELEGRAM_MESSAGE_FORMAT.md`
