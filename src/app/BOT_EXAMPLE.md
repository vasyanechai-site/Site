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
