# 🏗️ Архитектура системы кликабельных ссылок на мессенджеры

## 📊 Общая схема работы

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (/business)                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │       BusinessPublicPage Component                    │  │
│  │                                                        │  │
│  │  - Показывает каталог товаров                         │  │
│  │  - Кнопка "Зарегистрироваться"                        │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │ onClick                              │
│                     ▼                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │     BusinessRegistration Component (Dialog)          │  │
│  │                                                        │  │
│  │  INPUT:                                                │  │
│  │  - Телефон: 8 (999) 123-45-67                         │  │
│  │  - Компания: ООО "Название"                           │  │
│  │  - Мессенджер: Telegram | WhatsApp                    │  │
│  │                                                        │  │
│  │  [Отправить заявку] ──────────────────┐               │  │
│  └───────────────────────────────────────┼───────────────┘  │
└────────────────────────────────────────┼───────────────────┘
                                         │
                                         │ POST /business-registration
                                         │ {phone, companyName, messenger}
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Edge Function Server)                 │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Endpoint: /make-server-aa167a09/business-registration│ │
│  │                                                        │  │
│  │  1. Валидация данных                                  │  │
│  │     ├─ Проверка формата телефона                      │  │
│  │     ├─ Проверка названия компании                     │  │
│  │     └─ Проверка мессенджера                           │  │
│  │                                                        │  │
│  │  2. Создание заявки                                   │  │
│  │     └─ kv.set(registrationId, data)                   │  │
│  │                                                        │  │
│  │  3. ⭐ Генерация уведомления                          │  │
│  │     │                                                  │  │
│  │     ├─► formatPhoneForMessenger(phone)                │  │
│  │     │    Input:  "89991234567"                        │  │
│  │     │    Output: "79991234567"                        │  │
│  │     │                                                  │  │
│  │     ├─► generateMessengerLink(phone, messenger)       │  │
│  │     │    Telegram: https://t.me/+79991234567          │  │
│  │     │    WhatsApp: https://wa.me/79991234567          │  │
│  │     │                                                  │  │
│  │     └─► createRegistrationMessageWithLink()           │  │
│  │         Output: Отформатированное сообщение           │  │
│  │                                                        │  │
│  │  4. Отправка в Telegram                               │  │
│  │     └─ sendTelegramMessage(message)                   │  │
│  └──────────────────┬───────────────────────────────────┘  │
└────────────────────┼───────────────────────────────────────┘
                     │
                     │ POST https://api.telegram.org/bot.../sendMessage
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      TELEGRAM BOT                           │
│                                                             │
│  📱 Сообщение в чат/канал:                                 │
│                                                             │
│  🆕 Новая заявка на регистрацию оптового клиента           │
│                                                             │
│  📱 Телефон: +79991234567                                  │
│  🏢 Компания: ООО "Тестовая компания"                      │
│  💬 Мессенджер: Telegram                                   │
│  🔗 Ссылка на Telegram: https://t.me/+79991234567  ◄─ КЛИКАБЕЛЬНО!
│  🕐 Дата: 29.11.2025, 15:30:45                             │
│                                                             │
│  [Кликнуть по ссылке] ────────┐                            │
└────────────────────────────────┼───────────────────────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │  Открывается Telegram │
                     │  с готовым диалогом   │
                     │  с клиентом           │
                     └───────────────────────┘
```

---

## 🔄 Поток данных

### 1. Ввод данных пользователем
```typescript
// BusinessRegistration.tsx
const formData = {
  phone: "89991234567",        // Вводится как 8 (999) 123-45-67
  companyName: "ООО \"Тест\"",
  messenger: "telegram"
}
```

### 2. Обработка на сервере
```typescript
// /supabase/functions/server/index.tsx

// Шаг 1: Форматирование телефона
formatPhoneForMessenger("89991234567")
  → "79991234567"

// Шаг 2: Генерация ссылки
generateMessengerLink("79991234567", "telegram")
  → "https://t.me/+79991234567"

// Шаг 3: Создание сообщения
createRegistrationMessageWithLink(
  "89991234567",
  "ООО \"Тест\"",
  "telegram"
)
  → Форматированный текст с кликабельной ссылкой
```

### 3. Отправка в Telegram
```typescript
// telegram.tsx
sendTelegramMessage(message)
  → POST https://api.telegram.org/bot{token}/sendMessage
  → {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML"
    }
```

---

## 🧩 Компоненты системы

### Frontend

#### 1. BusinessPublicPage
- **Путь:** `/components/BusinessPublicPage.tsx`
- **Функция:** Отображение каталога и кнопки регистрации
- **Зависимости:** BusinessRegistration

#### 2. BusinessRegistration
- **Путь:** `/components/BusinessRegistration.tsx`
- **Функция:** Форма регистрации с выбором мессенджера
- **API:** POST `/make-server-aa167a09/business-registration`

#### 3. MessengerLinkDemo (тестовый)
- **Путь:** `/components/MessengerLinkDemo.tsx`
- **Функция:** Визуальная демонстрация генерации ссылок
- **Роут:** `/messenger-test`

---

### Backend

#### 1. formatPhoneForMessenger()
```typescript
function formatPhoneForMessenger(phone: string): string
```
- **Вход:** "89991234567" или "+7 (999) 123-45-67"
- **Выход:** "79991234567"
- **Логика:**
  - Удаляет все нецифровые символы
  - Заменяет начальную "8" на "7"
  - Возвращает чистый номер

#### 2. generateMessengerLink()
```typescript
function generateMessengerLink(phone: string, messenger: string): string
```
- **Вход:** "79991234567", "telegram"
- **Выход:** "https://t.me/+79991234567"
- **Поддержка:**
  - Telegram: `t.me/+{phone}`
  - WhatsApp: `wa.me/{phone}`

#### 3. createRegistrationMessageWithLink()
```typescript
function createRegistrationMessageWithLink(
  phone: string,
  companyName: string,
  messenger: string
): string
```
- **Метод:** Массив строк + `join('\n')`
- **Преимущество:** Правильное форматирование переносов
- **Включает:** Эмодзи, форматированный телефон, кликабельную ссылку

---

## 🔐 Безопасность

### Environment Variables
```bash
TELEGRAM_BOT_TOKEN=...      # Токен бота
TELEGRAM_CHAT_ID=...        # ID чата/канала
SUPABASE_URL=...            # URL Supabase
SUPABASE_SERVICE_ROLE_KEY=... # Ключ сервиса
```

### Валидация
- ✅ Проверка формата телефона
- ✅ Валидация названия компании
- ✅ Проверка выбора мессенджера
- ✅ Защита от SQL-инъекций (через KV store)

---

## 📈 Расширяемость

### Добавление нового мессенджера

```typescript
function generateMessengerLink(phone: string, messenger: string): string {
  const formattedPhone = formatPhoneForMessenger(phone);
  
  switch(messenger) {
    case 'telegram':
      return `https://t.me/+${formattedPhone}`;
    case 'whatsapp':
      return `https://wa.me/${formattedPhone}`;
    case 'viber':  // ⭐ Новый мессенджер
      return `viber://chat?number=%2B${formattedPhone}`;
    case 'signal':
      return `https://signal.me/#p/+${formattedPhone}`;
    default:
      return '';
  }
}
```

### Шаблонизация сообщений

```typescript
interface MessageTemplate {
  emoji: string;
  title: string;
  fields: Array<{key: string, value: string, emoji: string}>;
}

function createMessageFromTemplate(
  template: MessageTemplate,
  data: Record<string, string>
): string {
  // Генерация сообщения по шаблону
}
```

---

## 🧪 Тестирование

### Unit Tests (концепт)
```typescript
describe('formatPhoneForMessenger', () => {
  test('конвертирует 8 в 7', () => {
    expect(formatPhoneForMessenger('89991234567'))
      .toBe('79991234567');
  });
  
  test('удаляет нецифровые символы', () => {
    expect(formatPhoneForMessenger('+7 (999) 123-45-67'))
      .toBe('79991234567');
  });
});

describe('generateMessengerLink', () => {
  test('создаёт ссылку на Telegram', () => {
    expect(generateMessengerLink('79991234567', 'telegram'))
      .toBe('https://t.me/+79991234567');
  });
});
```

### Integration Testing
1. **Тестовая страница:** `/messenger-test`
2. **Реальная регистрация:** `/business` → "Зарегистрироваться"
3. **Проверка Telegram:** Наличие сообщения с кликабельной ссылкой

---

## 📊 Мониторинг

### Логи сервера
```typescript
console.log('Registration request:', { phone, companyName, messenger });
console.log('Generated link:', messengerLink);
console.log('Telegram response:', telegramResponse);
```

### Метрики
- Количество регистраций по мессенджерам
- Успешность отправки уведомлений
- Время обработки заявок

---

## 🎯 Ключевые решения

### Почему массив строк + join?
```typescript
// ❌ Плохо: конкатенация с \\n
return "строка1\\n" + "строка2\\n" + "строка3";

// ✅ Хорошо: массив + join
const lines = ["строка1", "строка2", "строка3"];
return lines.join('\n');
```
**Причина:** Избегаем проблем с экранированием, код читабельнее

### Почему отдельные функции?
- **Модульность:** Легко тестировать
- **Переиспользование:** Можно использовать в других местах
- **Расширяемость:** Просто добавить новый мессенджер

### Почему не хранить ссылку в БД?
- Ссылка генерируется динамически
- Номер телефона уже есть в БД
- Меньше дублирования данных

---

## 📚 Связанные документы

- **Quick Start:** `/QUICK_START_MESSENGER_LINKS.md`
- **Release Notes:** `/RELEASE_NOTES_MESSENGER_LINKS.md`
- **Testing Guide:** `/TESTING_MESSENGER_LINKS.md`
- **Technical Docs:** `/supabase/functions/server/TELEGRAM_MESSAGE_FORMAT.md`

---

**Версия:** 1.0.0  
**Дата:** 29 ноября 2025  
**Статус:** Готово к продакшену
