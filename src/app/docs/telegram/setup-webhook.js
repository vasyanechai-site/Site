#!/usr/bin/env node

/**
 * Скрипт для настройки Telegram Webhook
 * 
 * Использование:
 *   node setup-webhook.js <BOT_TOKEN>
 * 
 * Пример:
 *   node setup-webhook.js 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
 */

const https = require('https');

// Константы проекта
const PROJECT_ID = 'pkhinqiplfezrzvsqgwo';
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/telegram-webhook`;

// Получаем токен из аргументов командной строки
const BOT_TOKEN = process.argv[2];

if (!BOT_TOKEN) {
  console.error('❌ Ошибка: не указан токен бота');
  console.error('');
  console.error('Использование:');
  console.error('  node setup-webhook.js <BOT_TOKEN>');
  console.error('');
  console.error('Пример:');
  console.error('  node setup-webhook.js 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
  process.exit(1);
}

/**
 * Отправляет запрос к Telegram API
 */
function telegramRequest(method, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: data ? 'POST' : 'GET',
      headers: data ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(data))
      } : {}
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Не удалось разобрать ответ: ' + body));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Основная функция
 */
async function main() {
  console.log('🚀 Настройка Telegram Webhook\n');
  console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);
  console.log(`🤖 Bot Token: ${BOT_TOKEN.substring(0, 10)}...`);
  console.log('');

  try {
    // 1. Получаем текущую информацию о webhook
    console.log('1️⃣ Проверка текущего webhook...');
    const currentInfo = await telegramRequest('getWebhookInfo');
    
    if (!currentInfo.ok) {
      throw new Error('Не удалось получить информацию о webhook: ' + currentInfo.description);
    }

    if (currentInfo.result.url) {
      console.log(`   ℹ️  Текущий webhook: ${currentInfo.result.url}`);
      
      if (currentInfo.result.url === WEBHOOK_URL) {
        console.log('   ✅ Webhook уже настроен правильно!');
        console.log('');
        console.log('Информация:');
        console.log(`   - URL: ${currentInfo.result.url}`);
        console.log(`   - Необработанных обновлений: ${currentInfo.result.pending_update_count}`);
        if (currentInfo.result.last_error_message) {
          console.log(`   - Последняя ошибка: ${currentInfo.result.last_error_message}`);
        }
        return;
      }
    } else {
      console.log('   ℹ️  Webhook не настроен');
    }

    // 2. Устанавливаем webhook
    console.log('\n2️⃣ Установка webhook...');
    const setResult = await telegramRequest('setWebhook', {
      url: WEBHOOK_URL,
      allowed_updates: ['message']
    });

    if (!setResult.ok) {
      throw new Error('Не удалось установить webhook: ' + setResult.description);
    }

    console.log('   ✅ Webhook успешно установлен!');

    // 3. Проверяем результат
    console.log('\n3️⃣ Проверка установки...');
    const verifyInfo = await telegramRequest('getWebhookInfo');
    
    if (!verifyInfo.ok) {
      throw new Error('Не удалось проверить webhook: ' + verifyInfo.description);
    }

    console.log('   ✅ Проверка пройдена!');
    console.log('');
    console.log('📊 Информация о webhook:');
    console.log(`   - URL: ${verifyInfo.result.url}`);
    console.log(`   - Необработанных обновлений: ${verifyInfo.result.pending_update_count}`);
    console.log(`   - Отслеживаемые события: ${verifyInfo.result.allowed_updates?.join(', ') || 'все'}`);
    
    if (verifyInfo.result.last_error_message) {
      console.log(`   ⚠️  Последняя ошибка: ${verifyInfo.result.last_error_message}`);
      if (verifyInfo.result.last_error_date) {
        console.log(`   📅 Дата ошибки: ${new Date(verifyInfo.result.last_error_date * 1000).toLocaleString('ru-RU')}`);
      }
    }

    console.log('');
    console.log('✨ Готово! Теперь напишите боту любое сообщение для тестирования.');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  }
}

// Запуск
main();
