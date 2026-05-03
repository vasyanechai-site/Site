> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# Пример кода Telegram-бота

## Telegraf (Node.js)

```javascript
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Регистрация при любом сообщении
bot.on('message', async (ctx) => {
  const chat_id = ctx.chat.id;
  
  try {
    const response = await fetch(
      'https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-aa167a09/register-telegram',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_ANON_KEY'
        },
        body: JSON.stringify({ chat_id })
      }
    );
    
    if (response.ok) {
      await ctx.reply('✅ Вы подписались на рассылку!');
    }
  } catch (error) {
    console.error('Registration error:', error);
  }
});

// Команда /start
bot.command('start', async (ctx) => {
  await ctx.reply(
    'Привет! 👋\n\n' +
    'Я буду присылать вам информацию о новых поступлениях кофе и специальных предложениях.\n\n' +
    'Вы автоматически подписаны на рассылку!'
  );
});

bot.launch();
console.log('Bot started!');
```

## Установка

```bash
npm install telegraf
node bot.js
```
