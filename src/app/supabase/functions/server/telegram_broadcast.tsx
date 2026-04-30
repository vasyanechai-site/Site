import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js';

const app = new Hono();

// Получаем переменные окружения для работы с Supabase REST API
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Префикс для Telegram пользователей в KV хранилище
const TG_USER_PREFIX = 'telegram_user:';

// Регистрация Telegram пользователя (используем KV таблицу)
app.post('/register-telegram', async (c) => {
  try {
    const { chat_id } = await c.req.json();
    
    if (!chat_id || typeof chat_id !== 'number') {
      return c.json({ error: 'Invalid chat_id' }, 400);
    }

    // Сохраняем chat_id в KV таблицу
    const key = `${TG_USER_PREFIX}${chat_id}`;
    const userData = {
      chat_id,
      created_at: new Date().toISOString()
    };
    
    await kv.set(key, userData);

    return c.json({ success: true, chat_id });
  } catch (error) {
    console.error('Error registering Telegram user:', error);
    return c.json({ error: 'Failed to register user' }, 500);
  }
});

// Загрузка изображения для рассылки
app.post('/upload-broadcast-image', async (c) => {
  try {
    // Проверка админской авторизации
    const authHeader = c.req.header('X-Admin-Auth');
    if (!authHeader || authHeader !== 'true') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Проверка типа файла
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Only JPG, PNG and WebP allowed' }, 400);
    }

    // Проверка размера (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: 'File size exceeds 5MB limit' }, 400);
    }

    // Создаем Supabase клиент с service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Создаем уникальное имя файла
    const fileExt = file.name.split('.').pop();
    const fileName = `broadcast-${Date.now()}.${fileExt}`;
    const filePath = `broadcasts/${fileName}`;

    // Преобразуем File в ArrayBuffer для Deno
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Проверяем существование bucket и создаем если нужно
    const bucketName = 'make-aa167a09-broadcasts';
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log('Creating bucket:', bucketName);
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 5242880 // 5MB
      });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
        throw createError;
      }
    }

    // Загружаем файл
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading file:', error);
      throw error;
    }

    // Получаем публичный URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return c.json({ 
      success: true, 
      url: urlData.publicUrl,
      path: data.path 
    });

  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }, 500);
  }
});

// Отправка рассылки
app.post('/broadcast', async (c) => {
  try {
    // Проверка админской авторизации
    const authHeader = c.req.header('X-Admin-Auth');
    if (!authHeader || authHeader !== 'true') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { text, imageUrl } = await c.req.json();

    if (!text && !imageUrl) {
      return c.json({ error: 'Text or image required' }, 400);
    }

    // Получаем Telegram Bot Token
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!TELEGRAM_BOT_TOKEN) {
      return c.json({ error: 'Telegram bot token not configured' }, 500);
    }

    // Получаем всех зарегистрированных пользователей из KV таблицы
    const allUsersData = await kv.getByPrefix(TG_USER_PREFIX);
    
    if (allUsersData.length === 0) {
      return c.json({ 
        sent: 0, 
        total: 0,
        errors: [],
        message: 'No registered users found'
      });
    }

    let sent = 0;
    const errors: Array<{ chat_id: number; error: string }> = [];

    // Отправляем сообщения всем пользователям
    for (const userData of allUsersData) {
      try {
        // Проверяем валидность данных
        if (!userData || userData === 'undefined') {
          console.warn('Skipping invalid user data');
          continue;
        }

        const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
        const chat_id = user.chat_id;
        
        if (!chat_id) {
          console.warn('Skipping user without chat_id');
          continue;
        }
        
        // Задержка 30 мс для избегания flood limit
        await new Promise(resolve => setTimeout(resolve, 30));

        if (imageUrl) {
          // Отправка с картинкой
          const response = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id,
                photo: imageUrl,
                caption: text || undefined,
                parse_mode: 'HTML'
              })
            }
          );

          const result = await response.json();
          
          if (!result.ok) {
            throw new Error(result.description || 'Failed to send photo');
          }
        } else {
          // Отправка только текста
          const response = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id,
                text,
                parse_mode: 'HTML'
              })
            }
          );

          const result = await response.json();
          
          if (!result.ok) {
            throw new Error(result.description || 'Failed to send message');
          }
        }

        sent++;
      } catch (error) {
        const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
        console.error(`Error sending to chat_id ${user.chat_id}:`, error);
        errors.push({
          chat_id: user.chat_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return c.json({
      sent,
      total: allUsersData.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Broadcast failed' 
    }, 500);
  }
});

// Получение статистики
app.get('/broadcast-stats', async (c) => {
  try {
    // Получаем всех пользователей из KV таблицы
    const allUsersData = await kv.getByPrefix(TG_USER_PREFIX);
    
    const users = allUsersData
      .filter(userData => userData && userData !== 'undefined')
      .map(userData => {
        try {
          // userData уже является объектом value, не нужно парсить
          const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
          return {
            chat_id: user.chat_id,
            username: user.username || null,
            first_name: user.first_name || null,
            created_at: user.created_at,
            test_user: user.test_user || false
          };
        } catch (e) {
          console.error('Error parsing user data:', e, userData);
          return null;
        }
      })
      .filter(user => user !== null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return c.json({
      total_users: users.length,
      users
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

export default app;