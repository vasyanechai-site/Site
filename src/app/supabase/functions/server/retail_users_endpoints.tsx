// Новые endpoints для управления розничными пользователями
// Добавить после endpoint GET /retail-users в index.tsx

// POST /retail-users/:userId/add-points - начислить баллы пользователю
app.post(`${prefix}/retail-users/:userId/add-points`, async (c) => {
  console.log('💰 [ADD-POINTS] Запрос на начисление баллов');
  
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { amount } = body;
    
    console.log('💰 [ADD-POINTS] Параметры:', { userId, amount });
    
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400);
    }
    
    // Проверка авторизации - либо admin_token, либо Supabase Auth
    const adminToken = c.req.query('admin_token');
    const authHeader = c.req.header('Authorization');
    
    console.log('🔐 [ADD-POINTS] Проверка авторизации:', { 
      hasAdminToken: !!adminToken,
      hasAuthHeader: !!authHeader 
    });
    
    // Проверка для старого админа через query параметр
    if (adminToken === 'NECHAI_ADMIN_TOKEN_2026') {
      console.log('✅ [ADD-POINTS] Доступ через админский токен подтвержден');
    } 
    // Проверка для розничного админа через Supabase
    else if (authHeader) {
      const token = authHeader.split(' ')[1];
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );
      
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        console.log('❌ [ADD-POINTS] Ошибка авторизации:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Проверяем, что пользователь - админ
      const adminProfile = await kv.get(`nechai_profile_${user.id}`);
      if (!adminProfile || adminProfile.role !== 'admin') {
        console.log('❌ [ADD-POINTS] Доступ запрещен - пользователь не админ');
        return c.json({ error: 'Forbidden: Admin access required' }, 403);
      }
    } else {
      console.log('❌ [ADD-POINTS] Отсутствуют параметры авторизации');
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Проверяем, что пользователь существует
    const profile = await kv.get(`nechai_profile_${userId}`);
    if (!profile) {
      console.log('❌ [ADD-POINTS] Пользователь не найден');
      return c.json({ error: 'User not found' }, 404);
    }
    
    // Получаем текущий баланс
    const currentBalance = await kv.get(`nechai_loyalty_${userId}`) || 0;
    const newBalance = currentBalance + amount;
    
    console.log('💰 [ADD-POINTS] Обновление баланса:', { currentBalance, amount, newBalance });
    
    // Сохраняем новый баланс
    await kv.set(`nechai_loyalty_${userId}`, newBalance);
    
    console.log(`✅ [ADD-POINTS] Успешно начислено ${amount} баллов. Новый баланс: ${newBalance}`);
    
    return c.json({ 
      success: true,
      newBalance,
      user: {
        id: userId,
        email: profile.email
      }
    });
    
  } catch (error) {
    console.error('❌ [ADD-POINTS] Ошибка при начислении баллов:', error);
    return c.json({ error: 'Failed to add points' }, 500);
  }
});

// Обновленный DELETE endpoint
// Заменить существующий DELETE /retail-users/:userId на этот:
app.delete(`${prefix}/retail-users/:userId`, async (c) => {
  console.log('🗑️ [DELETE-USER] Запрос на удаление пользователя');
  
  try {
    const userIdToDelete = c.req.param('userId');
    console.log('👤 [DELETE-USER] ID пользователя для удаления:', userIdToDelete);
    
    // Проверка авторизации - либо admin_token, либо Supabase Auth
    const adminToken = c.req.query('admin_token');
    const authHeader = c.req.header('Authorization');
    
    console.log('🔐 [DELETE-USER] Проверка авторизации:', { 
      hasAdminToken: !!adminToken,
      hasAuthHeader: !!authHeader 
    });
    
    // Проверка для старого админа через query параметр
    if (adminToken === 'NECHAI_ADMIN_TOKEN_2026') {
      console.log('✅ [DELETE-USER] Доступ через админский токен подтвержден');
    } 
    // Проверка для розничного админа через Supabase
    else if (authHeader) {
      const token = authHeader.split(' ')[1];
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );
      
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        console.log('❌ [DELETE-USER] Ошибка авторизации:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Проверяем, что пользователь - админ
      const adminProfile = await kv.get(`nechai_profile_${user.id}`);
      if (!adminProfile || adminProfile.role !== 'admin') {
        console.log('❌ [DELETE-USER] Доступ запрещен - пользователь не админ');
        return c.json({ error: 'Forbidden: Admin access required' }, 403);
      }
      
      // Нельзя удалить самого себя
      if (userIdToDelete === user.id) {
        return c.json({ error: 'Cannot delete yourself' }, 400);
      }
    } else {
      console.log('❌ [DELETE-USER] Отсутствуют параметры авторизации');
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Проверяем, что пользователь существует
    const profileToDelete = await kv.get(`nechai_profile_${userIdToDelete}`);
    if (!profileToDelete) {
      console.log('❌ [DELETE-USER] Пользователь не найден');
      return c.json({ error: 'User not found' }, 404);
    }
    
    // Нельзя удалить админа
    if (profileToDelete.role === 'admin') {
      console.log('❌ [DELETE-USER] Нельзя удалить админа');
      return c.json({ error: 'Cannot delete admin users' }, 400);
    }
    
    // Удаляем пользователя из Supabase Auth
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);
    if (deleteError) {
      console.error('❌ [DELETE-USER] Ошибка удаления из Supabase Auth:', deleteError);
      return c.json({ error: 'Failed to delete user from auth system' }, 500);
    }
    
    // Удаляем профиль из KV
    await kv.del(`nechai_profile_${userIdToDelete}`);
    
    // Удаляем баланс лояльности
    await kv.del(`nechai_loyalty_${userIdToDelete}`);
    
    console.log(`✅ [DELETE-USER] Пользователь ${userIdToDelete} успешно удален`);
    
    return c.json({ success: true });
    
  } catch (error) {
    console.error('❌ [DELETE-USER] Ошибка при удалении:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});
