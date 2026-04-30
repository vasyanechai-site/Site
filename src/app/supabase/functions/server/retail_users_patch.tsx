// Патч для исправления проверки авторизации в /retail-users эндпоинте
// Замените строки 4588-4635 в index.tsx на этот код:

  try {
    const authHeader = c.req.header('Authorization');
    
    console.log('🔐 [RETAIL-USERS] Проверка заголовка Authorization:', !!authHeader);
    
    if (!authHeader) {
      console.log('❌ [RETAIL-USERS] Отсутствует заголовок Authorization');
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const token = authHeader.split(' ')[1];
    console.log('🔑 [RETAIL-USERS] Токен извлечен:', token?.substring(0, 20) + '...');
    
    // Проверка для старого админа через специальный токен
    if (token === 'NECHAI_ADMIN_TOKEN_2026') {
      console.log('✅ [RETAIL-USERS] Доступ через админский токен подтвержден');
    } 
    // Проверка для розничного админа через Supabase
    else {
      console.log('🔍 [RETAIL-USERS] Проверка через Supabase Auth...');
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );
      
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        console.log('❌ [RETAIL-USERS] Ошибка авторизации через Supabase:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      console.log('✅ [RETAIL-USERS] Пользователь авторизован:', user.id, user.email);
      
      // Проверяем, что пользователь - админ
      console.log('🔍 [RETAIL-USERS] Проверка роли пользователя...');
      const adminProfile = await kv.get(`nechai_profile_${user.id}`);
      console.log('📋 [RETAIL-USERS] Профиль пользователя:', adminProfile);
      
      if (!adminProfile || adminProfile.role !== 'admin') {
        console.log('❌ [RETAIL-USERS] Доступ запрещен - пользователь не админ');
        return c.json({ error: 'Forbidden: Admin access required' }, 403);
      }
      
      console.log('✅ [RETAIL-USERS] Розничный админ авторизован');
    }
