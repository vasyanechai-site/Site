// ============================================================================
// AGENTS MODULE — НЕЧАЙ B2B
// Агенты: CRUD, клиенты, статистика, выплаты
// ============================================================================

import * as kv from './kv_store.tsx';

export const AGENTS_PREFIX        = 'nechai_agent_';
export const AGENT_PAYOUT_PREFIX  = 'nechai_agent_payout_';
const USERS_PREFIX                = 'nechai_user_';
const ORDERS_PREFIX               = 'nechai_order_';

function genId(prefix = ''): string {
  return `${prefix}${Date.now()}_${Math.floor(Math.random() * 9999)}`;
}

// --------------------------------------------------------------------------
// Вычисление статистики агента
// --------------------------------------------------------------------------
async function computeAgentStats(agentId: string, commissionRate: number) {
  const [allUsers, allOrders, allPayouts] = await Promise.all([
    kv.getByPrefix(USERS_PREFIX),
    kv.getByPrefix(ORDERS_PREFIX),
    kv.getByPrefix(AGENT_PAYOUT_PREFIX),
  ]);

  const clients = allUsers.filter((u: any) => u.agent_id === agentId);
  const clientIds = new Set(clients.map((c: any) => c.id));

  const orders = allOrders.filter(
    (o: any) => o.userId && clientIds.has(o.userId) && (!o.orderType || o.orderType === 'wholesale')
  );

  const payouts = allPayouts.filter((p: any) => p.agent_id === agentId);

  const totalRevenue    = orders.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0);
  const totalCommission = Math.round(totalRevenue * commissionRate / 100);
  const totalPaid       = payouts
    .filter((p: any) => p.status === 'paid')
    .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const balance = Math.max(0, totalCommission - totalPaid);

  return {
    clients: clients.map((u: any) => { const { password, ...safe } = u; return safe; }),
    orders,
    payouts,
    stats: { totalClients: clients.length, totalOrders: orders.length, totalRevenue, totalCommission, totalPaid, balance },
  };
}

// --------------------------------------------------------------------------
// Регистрация маршрутов
// --------------------------------------------------------------------------
export function registerAgentRoutes(app: any, prefix: string) {

  // ── GET /agents ──────────────────────────────────────────────────────────
  app.get(`${prefix}/agents`, async (c: any) => {
    try {
      const agents = await kv.getByPrefix(AGENTS_PREFIX);
      const result = await Promise.all(
        agents.map(async (a: any) => {
          const { password, ...safe } = a;
          const { stats } = await computeAgentStats(a.id, a.commission_rate || 0);
          return { ...safe, ...stats };
        })
      );
      return c.json(result.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (err) {
      console.log('agents GET error:', err);
      return c.json({ error: 'Failed to fetch agents' }, 500);
    }
  });

  // ── POST /agents ─────────────────────────────────────────────────────────
  app.post(`${prefix}/agents`, async (c: any) => {
    try {
      const body = await c.req.json();
      const { name, phone, password, commission_rate, status } = body;

      if (!name || !phone || !password) {
        return c.json({ error: 'Required: name, phone, password' }, 400);
      }

      const existing = await kv.getByPrefix(AGENTS_PREFIX);
      if (existing.some((a: any) => a.phone === phone)) {
        return c.json({ error: 'Login already taken' }, 400);
      }

      const agent = {
        id: genId('ag_'),
        name,
        phone,
        password,
        commission_rate: Number(commission_rate) || 0,
        status: status || 'active',
        invite_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        created_at: new Date().toISOString(),
        role: 'agent',
      };

      await kv.set(`${AGENTS_PREFIX}${agent.id}`, agent);
      const { password: _, ...safe } = agent;
      return c.json(safe);
    } catch (err) {
      console.log('agent CREATE error:', err);
      return c.json({ error: 'Failed to create agent' }, 500);
    }
  });

  // ── GET /agents/:id ───────────────────────────────────────────────────────
  app.get(`${prefix}/agents/:id`, async (c: any) => {
    try {
      const id = c.req.param('id');
      const agent = await kv.get(`${AGENTS_PREFIX}${id}`);
      if (!agent) return c.json({ error: 'Agent not found' }, 404);
      const { password, ...safe } = agent;
      return c.json(safe);
    } catch (err) {
      console.log('agent GET/:id error:', err);
      return c.json({ error: 'Failed to fetch agent' }, 500);
    }
  });

  // ── PUT /agents/:id ───────────────────────────────────────────────────────
  app.put(`${prefix}/agents/:id`, async (c: any) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      const agent = await kv.get(`${AGENTS_PREFIX}${id}`);
      if (!agent) return c.json({ error: 'Agent not found' }, 404);

      if (body.phone && body.phone !== agent.phone) {
        const all = await kv.getByPrefix(AGENTS_PREFIX);
        if (all.some((a: any) => a.phone === body.phone && a.id !== id)) {
          return c.json({ error: 'Login already taken' }, 400);
        }
      }

      const updated = {
        ...agent,
        name: body.name ?? agent.name,
        phone: body.phone ?? agent.phone,
        password: body.password || agent.password,
        commission_rate: body.commission_rate !== undefined ? Number(body.commission_rate) : agent.commission_rate,
        status: body.status ?? agent.status,
        role: 'agent',
      };

      await kv.set(`${AGENTS_PREFIX}${id}`, updated);
      const { password, ...safe } = updated;
      return c.json(safe);
    } catch (err) {
      console.log('agent PUT error:', err);
      return c.json({ error: 'Failed to update agent' }, 500);
    }
  });

  // ── GET /agents/:id/stats ─────────────────────────────────────────────────
  app.get(`${prefix}/agents/:id/stats`, async (c: any) => {
    try {
      const id = c.req.param('id');
      const agent = await kv.get(`${AGENTS_PREFIX}${id}`);
      if (!agent) return c.json({ error: 'Agent not found' }, 404);

      const { password, ...safeAgent } = agent;
      const data = await computeAgentStats(id, agent.commission_rate || 0);
      return c.json({ agent: safeAgent, ...data });
    } catch (err) {
      console.log('agent stats error:', err);
      return c.json({ error: 'Failed to fetch agent stats' }, 500);
    }
  });

  // ── GET /agents/:id/clients ───────────────────────────────────────────────
  app.get(`${prefix}/agents/:id/clients`, async (c: any) => {
    try {
      const id = c.req.param('id');
      const all = await kv.getByPrefix(USERS_PREFIX);
      const clients = all
        .filter((u: any) => u.agent_id === id)
        .map((u: any) => { const { password, ...safe } = u; return safe; });
      return c.json(clients);
    } catch (err) {
      console.log('agent clients error:', err);
      return c.json({ error: 'Failed to fetch clients' }, 500);
    }
  });

  // ── POST /agents/:id/clients ──────────────────────────────────────────────
  app.post(`${prefix}/agents/:id/clients`, async (c: any) => {
    try {
      const agentId = c.req.param('id');
      const agent = await kv.get(`${AGENTS_PREFIX}${agentId}`);
      if (!agent) return c.json({ error: 'Agent not found' }, 404);

      const body = await c.req.json();
      const { phone, password, company_name } = body;

      if (!phone || !password || !company_name) {
        return c.json({ error: 'Required: phone, password, company_name' }, 400);
      }

      const allUsers = await kv.getByPrefix(USERS_PREFIX);
      if (allUsers.some((u: any) => u.phone === phone)) {
        return c.json({ error: 'Login already exists' }, 400);
      }

      const userId = Date.now().toString();
      const user = {
        id: userId,
        phone,
        password,
        company_name,
        discount: 0,
        loyaltyLevel: 0,
        loyaltyLevelSetDate: new Date().toISOString(),
        agent_id: agentId,
        role: 'wholesale',
        created_at: new Date().toISOString(),
      };

      await kv.set(`${USERS_PREFIX}${userId}`, user);
      const { password: _, ...safe } = user;
      return c.json(safe);
    } catch (err) {
      console.log('agent create client error:', err);
      return c.json({ error: 'Failed to create client' }, 500);
    }
  });

  // ── POST /agents/:id/payouts ──────────────────────────────────────────────
  app.post(`${prefix}/agents/:id/payouts`, async (c: any) => {
    try {
      const agentId = c.req.param('id');
      const agent = await kv.get(`${AGENTS_PREFIX}${agentId}`);
      if (!agent) return c.json({ error: 'Agent not found' }, 404);

      const body = await c.req.json();
      const { amount, comment, status } = body;

      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return c.json({ error: 'Invalid amount' }, 400);
      }

      const isPaid = (status || 'pending') === 'paid';
      const payout = {
        id: genId('pay_'),
        agent_id: agentId,
        amount: Number(amount),
        status: isPaid ? 'paid' : 'pending',
        comment: comment || '',
        created_at: new Date().toISOString(),
        paid_at: isPaid ? new Date().toISOString() : null,
      };

      await kv.set(`${AGENT_PAYOUT_PREFIX}${payout.id}`, payout);
      return c.json(payout);
    } catch (err) {
      console.log('agent payout create error:', err);
      return c.json({ error: 'Failed to create payout' }, 500);
    }
  });

  // ── PUT /agents/payouts/:payoutId ─────────────────────────────────────────
  // NOTE: must be registered BEFORE /agents/:id to avoid param collision
  app.put(`${prefix}/agents/payouts/:payoutId`, async (c: any) => {
    try {
      const payoutId = c.req.param('payoutId');
      const body = await c.req.json();

      const payout = await kv.get(`${AGENT_PAYOUT_PREFIX}${payoutId}`);
      if (!payout) return c.json({ error: 'Payout not found' }, 404);

      const updated = { ...payout, ...body, id: payout.id, agent_id: payout.agent_id };
      if (body.status === 'paid' && !payout.paid_at) {
        updated.paid_at = new Date().toISOString();
      }

      await kv.set(`${AGENT_PAYOUT_PREFIX}${payoutId}`, updated);
      return c.json(updated);
    } catch (err) {
      console.log('payout update error:', err);
      return c.json({ error: 'Failed to update payout' }, 500);
    }
  });
}

// --------------------------------------------------------------------------
// Экспорт для логина: найти агента по логину + паролю
// --------------------------------------------------------------------------
export async function findAgentByCredentials(phone: string, password: string): Promise<any | null> {
  const agents = await kv.getByPrefix(AGENTS_PREFIX);
  const agent = agents.find((a: any) => a.phone === phone && a.password === password);
  if (!agent) return null;
  const { password: _, ...safe } = agent;
  return { ...safe, role: 'agent' };
}
