// Email service using Resend API

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const BACKUP_EMAIL = 'dmlomov321@gmail.com';

interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
}

export async function sendBackupEmail(
  backupData: any,
  isScheduled: boolean = false
): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    throw new Error('Email service not configured');
  }

  const timestamp = new Date().toISOString();
  const dateStr = new Date().toLocaleDateString('ru-RU');
  
  // Prepare backup file content
  const backupJson = JSON.stringify(backupData, null, 2);
  const backupBase64 = btoa(unescape(encodeURIComponent(backupJson)));

  const subject = isScheduled 
    ? `Автоматический бэкап Nechai Coffee - ${dateStr}`
    : `Ручной бэкап Nechai Coffee - ${dateStr}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #F47D37 0%, #FF9A56 100%); 
                  color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .stats { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .stat-item { display: flex; justify-content: space-between; padding: 10px 0; 
                     border-bottom: 1px solid #eee; }
        .stat-item:last-child { border-bottom: none; }
        .stat-label { font-weight: 600; color: #666; }
        .stat-value { font-weight: bold; color: #F47D37; }
        .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
        .badge { display: inline-block; padding: 4px 12px; background: #F47D37; 
                 color: white; border-radius: 12px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">☕ Nechai Coffee</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Бэкап базы данных</p>
        </div>
        
        <div class="content">
          <p><strong>Тип бэкапа:</strong> 
            <span class="badge">${isScheduled ? 'Автоматический' : 'Ручной'}</span>
          </p>
          <p><strong>Дата и время:</strong> ${new Date().toLocaleString('ru-RU', { 
            timeZone: 'Europe/Moscow' 
          })} (МСК)</p>
          
          <div class="stats">
            <h3 style="margin-top: 0; color: #333;">📊 Статистика бэкапа</h3>
            <div class="stat-item">
              <span class="stat-label">Товары кофе</span>
              <span class="stat-value">${backupData.coffeeItems?.length || 0} шт.</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Заказы</span>
              <span class="stat-value">${backupData.orders?.length || 0} шт.</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Пользователи</span>
              <span class="stat-value">${backupData.users?.length || 0} чел.</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Промокоды</span>
              <span class="stat-value">${backupData.promoCodes?.length || 0} шт.</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Курс USD/RUB</span>
              <span class="stat-value">${backupData.exchangeRate?.usd_to_rub || 'N/A'} ₽</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Размер файла</span>
              <span class="stat-value">${(backupJson.length / 1024).toFixed(2)} KB</span>
            </div>
          </div>

          <p style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #F47D37;">
            <strong>📎 Во вложении:</strong><br>
            Полный бэкап базы данных в формате JSON. Этот файл можно использовать для восстановления 
            данных через раздел "Импорт" в админ-панели.
          </p>

          ${isScheduled ? `
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
              Это автоматический бэкап. Следующий бэкап будет отправлен через 3 дня.
            </p>
          ` : ''}
        </div>
        
        <div class="footer">
          <p>Nechai Coffee - Интернет-магазин кофе</p>
          <p>Это автоматическое письмо, пожалуйста, не отвечайте на него</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Бэкап базы данных Nechai Coffee

Тип: ${isScheduled ? 'Автоматический' : 'Ручной'}
Дата: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}

Статистика:
- Товары кофе: ${backupData.coffeeItems?.length || 0}
- Заказы: ${backupData.orders?.length || 0}
- Пользователи: ${backupData.users?.length || 0}
- Промокоды: ${backupData.promoCodes?.length || 0}
- Курс USD/RUB: ${backupData.exchangeRate?.usd_to_rub || 'N/A'} ₽

Файл бэкапа прикреплен к письму.
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Nechai Coffee <noreply@resend.dev>',
        to: [BACKUP_EMAIL],
        subject: subject,
        html: htmlContent,
        text: textContent,
        attachments: [
          {
            filename: `nechai-backup-${new Date().toISOString().split('T')[0]}.json`,
            content: backupBase64,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Resend API error:', errorData);
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log('Backup email sent successfully');
  } catch (error) {
    console.error('Error sending backup email:', error);
    throw error;
  }
}

// Send test email
export async function sendTestEmail(): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Nechai Coffee <noreply@resend.dev>',
      to: [BACKUP_EMAIL],
      subject: 'Тестовое письмо - Nechai Coffee',
      html: '<h1>Привет!</h1><p>Email сервис настроен и работает корректно.</p>',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to send test email: ${JSON.stringify(errorData)}`);
  }
}

// Отправить приветственное письмо новому пользователю
export async function sendWelcomeEmail(email: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, skipping welcome email');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: #FF90A1; color: white; padding: 40px 30px; text-align: center; }
        .content { background: #FFF4E5; padding: 40px 30px; }
        .inner-content { background: white; padding: 30px; border-radius: 0; }
        .button { display: inline-block; background: #FF90A1; color: white; 
                  padding: 14px 32px; text-decoration: none; border-radius: 0; 
                  font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; padding: 30px; color: #666; font-size: 13px; 
                  background: #FFF4E5; }
        h1 { margin: 0; font-size: 28px; font-weight: normal; }
        h2 { color: #222; font-size: 22px; margin-top: 0; font-weight: normal; }
        p { margin: 15px 0; color: #444; }
        .features { margin: 25px 0; }
        .feature-item { padding: 12px 0; border-bottom: 1px solid #F0F0F0; }
        .feature-item:last-child { border-bottom: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>☕ Добро пожаловать в Nechai Coffee!</h1>
        </div>
        
        <div class="content">
          <div class="inner-content">
            <h2>Рады видеть вас!</h2>
            
            <p>Спасибо, что зарегистрировались в нашем интернет-магазине кофе. Ваш аккаунт успешно создан и готов к использованию.</p>
            
            <div class="features">
              <div class="feature-item">
                ✓ Доступ к широкому ассортименту свежеобжаренного кофе
              </div>
              <div class="feature-item">
                ✓ Удобное оформление заказов с доставкой
              </div>
              <div class="feature-item">
                ✓ История ваших покупок
              </div>
              <div class="feature-item">
                ✓ Избранные товары
              </div>
            </div>
            
            <p style="margin-top: 25px;">Теперь вы можете войти в свой аккаунт и начать делать покупки:</p>
            
            <div style="text-align: center;">
              <a href="https://coffeenechai.ru/auth/login" class="button">Войти в аккаунт</a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #F0F0F0;">
              <strong>Ваш email:</strong> ${email}
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Nechai Coffee</strong> - интернет-магазин кофе</p>
          <p style="margin-top: 10px;">
            Если у вас есть вопросы, мы всегда рады помочь
          </p>
          <p style="color: #999; margin-top: 15px; font-size: 12px;">
            Это автоматическое письмо. Пожалуйста, не отвечайте на него.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Добро пожаловать в Nechai Coffee!

Спасибо, что зарегистрировались в нашем интернет-магазине кофе. Ваш аккаунт успешно создан и готов к использованию.

Теперь вам доступны:
- Широкий ассортимент свежеобжаренного кофе
- Удобное оформление заказов с доставкой
- История ваших покупок
- Избранные товары

Войти в аккаунт: https://coffeenechai.ru/auth/login

Ваш email: ${email}

--
Nechai Coffee - интернет-магазин кофе
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Nechai Coffee <noreply@resend.dev>',
        to: [email],
        subject: 'Добро пожаловать в Nechai Coffee ☕',
        html: htmlContent,
        text: textContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.warn('Resend API: Unable to send welcome email (non-critical):', errorData.message || errorData);
      // Не бросаем ошибку, чтобы регистрация не прерывалась из-за проблем с email
    } else {
      const result = await response.json();
      console.log('Welcome email sent successfully');
    }
  } catch (error) {
    console.warn('Error sending welcome email (non-critical):', error instanceof Error ? error.message : error);
    // Не бросаем ошибку, чтобы регистрация не прерывалась
  }
}