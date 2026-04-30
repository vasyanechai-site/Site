// Исправленная версия endpoint для регистрации с ссылками на мессенджеры

// Замените в index.tsx раздел регистрации (app.post(`${prefix}/business-registration`)) на:

/*
app.post(`${prefix}/business-registration`, async (c) => {
  try {
    const body = await c.req.json();
    const { phone, companyName, messenger } = body;

    if (!phone || !companyName || !messenger) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Сохраняем заявку в базу данных
    const registrationId = `${REGISTRATION_PREFIX}${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const registrationData = {
      id: registrationId,
      phone,
      companyName,
      messenger,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    await kv.set(registrationId, registrationData);

    // Отправляем уведомление в Telegram с ссылкой на мессенджер
    const message = createRegistrationMessage(phone, companyName, messenger);

    try {
      await sendTelegramMessage(message);
    } catch (telegramError) {
      console.log('Failed to send Telegram notification:', telegramError);
      // Продолжаем выполнение, даже если уведомление не отправилось
    }

    return c.json({ success: true, registrationId });
  } catch (error) {
    console.log('Error creating business registration:', error);
    return c.json({ error: 'Failed to create registration' }, 500);
  }
});
*/

// Примечание: функция createRegistrationMessage уже добавлена в index.tsx
