import { createClient } from 'jsr:@supabase/supabase-js';
import * as kv from './kv_store.tsx';

// Initialize Supabase Admin Client (Service Role)
// WARNING: This client has full access to the database and auth. Use with caution.
const getSupabaseAdmin = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase Service Role credentials');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
};

// GET /admin/retail-users
// Fetch all retail users (combining auth.users and public.profiles)
// ⚠️ ОТКРЫТЫЙ ДОСТУП: Админ-панель доступна всем (проверка токена убрана)
export async function getRetailUsers(c: any) {
  try {
    console.log('📥 GET /admin/retail-users - Request received');
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch users from auth.users (pagination might be needed for large sets, but start simple)
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });

    if (authError) throw authError;

    // 2. Fetch profiles to filter/enrich
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*');

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
    }

    // 3. Combine data
    const usersWithRoles = users
      .map(user => {
        const profile = profiles?.find(p => p.id === user.id);
        return {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          confirmed_at: user.email_confirmed_at,
          last_sign_in_at: user.last_sign_in_at,
          role: profile?.role || 'unknown', // Default to unknown if not in profiles
          profile_data: profile
        };
      })
      .filter(user => user.role === 'retail' || user.role === 'unknown'); // Include unknown to see users without profiles

    // 4. Enrich with loyalty balance
    const retailUsers = await Promise.all(usersWithRoles.map(async (user) => {
      const balance = await kv.get(`nechai_loyalty_${user.id}`);
      return {
        ...user,
        balance: balance || 0
      };
    }));

    console.log(`✅ Total auth users: ${users.length}`);
    console.log(`✅ Retail users found: ${retailUsers.length}`);
    console.log(`📊 Sample users:`, retailUsers.slice(0, 3).map(u => ({ email: u.email, role: u.role })));

    return c.json(retailUsers);
  } catch (error) {
    console.error('Error fetching retail users:', error);
    return c.json({ error: 'Failed to fetch users', details: error.message }, 500);
  }
}

// DELETE /admin/retail-users/:id
// Delete a user from Auth and Profiles
export async function deleteRetailUser(c: any) {
  const userId = c.req.param('id');
  
  if (!userId) {
    return c.json({ error: 'User ID is required' }, 400);
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Delete from Auth (Cascade should handle profiles if set up, but let's be safe)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) throw deleteError;

    // 2. Delete from Profiles (Manual cleanup if no cascade)
    // Note: If configured with "On Delete Cascade" in Postgres, this is redundant but harmless.
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    return c.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'Failed to delete user', details: error.message }, 500);
  }
}

// POST /admin/retail-users/:id/balance
// Update user loyalty balance
// ⚠️ ОТКРЫТЫЙ ДОСТУП: Админ-панель доступна всем (проверка токена убрана)
export async function updateRetailUserBalance(c: any) {
  const userId = c.req.param('id');
  
  if (!userId) {
    return c.json({ error: 'User ID is required' }, 400);
  }

  try {
    console.log('📥 POST /admin/retail-users/:id/balance - Request received');
    const supabaseAdmin = getSupabaseAdmin();

    const body = await c.req.json();
    const { amount, action } = body; // action: 'set' or 'add'

    if (amount === undefined) {
      return c.json({ error: 'Amount is required' }, 400);
    }

    const key = `nechai_loyalty_${userId}`;
    let newBalance = Number(amount);

    if (action === 'add') {
      const current = await kv.get(key) || 0;
      newBalance = Number(current) + Number(amount);
    }

    await kv.set(key, newBalance);

    return c.json({ success: true, balance: newBalance });
  } catch (error) {
    console.error('Error updating balance:', error);
    return c.json({ error: 'Failed to update balance', details: error.message }, 500);
  }
}