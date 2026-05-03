import {
  getAgents,
  setAgents,
  getAgentPayouts,
  setAgentPayouts,
  getUsers,
  setUsers,
  getOrders,
} from "./store.js";

function genId(prefix) {
  return `${prefix}${Date.now()}_${Math.floor(Math.random() * 9999)}`;
}

function stripPassword(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const { password, ...rest } = obj;
  return rest;
}

async function computeAgentStats(agentId, commissionRate) {
  const rate = Number(commissionRate) || 0;
  const [allUsers, allOrders, allPayouts] = await Promise.all([getUsers(), getOrders(), getAgentPayouts()]);

  const clients = allUsers.filter((u) => u.agent_id === agentId);
  const clientIds = new Set(clients.map((c) => c.id));

  const orders = allOrders.filter(
    (o) => o && (o.userId || o.user_id) && clientIds.has(o.userId || o.user_id) && (!o.orderType || o.orderType === "wholesale"),
  );

  const payouts = allPayouts.filter((p) => p.agent_id === agentId);

  const totalRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const totalCommission = Math.round((totalRevenue * rate) / 100);
  const totalPaid = payouts
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = Math.max(0, totalCommission - totalPaid);

  return {
    clients: clients.map((u) => stripPassword(u)),
    orders,
    payouts,
    stats: {
      totalClients: clients.length,
      totalOrders: orders.length,
      totalRevenue,
      totalCommission,
      totalPaid,
      balance,
    },
  };
}

/**
 * @param {import("express").Express} app
 */
export function registerAgentRoutes(app) {
  app.get("/api/agents", async (_req, res) => {
    try {
      const agents = await getAgents();
      const result = await Promise.all(
        agents.map(async (a) => {
          const safe = stripPassword(a);
          const { stats } = await computeAgentStats(a.id, a.commission_rate || 0);
          return { ...safe, ...stats };
        }),
      );
      result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      res.json(result);
    } catch (err) {
      console.error("[agents GET]", err);
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const body = req.body || {};
      const { name, phone, password, commission_rate, status } = body;

      if (!name || !phone || !password) {
        return res.status(400).json({ error: "Required: name, phone, password" });
      }

      const existing = await getAgents();
      if (existing.some((a) => a.phone === phone)) {
        return res.status(400).json({ error: "Login already taken" });
      }

      const agent = {
        id: genId("ag_"),
        name,
        phone,
        password,
        commission_rate: Number(commission_rate) || 0,
        status: status || "active",
        invite_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        created_at: new Date().toISOString(),
        role: "agent",
      };

      await setAgents([agent, ...existing]);
      res.json(stripPassword(agent));
    } catch (err) {
      console.error("[agents POST]", err);
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.put("/api/agents/payouts/:payoutId", async (req, res) => {
    try {
      const { payoutId } = req.params;
      const body = req.body || {};
      const payouts = await getAgentPayouts();
      const payout = payouts.find((p) => p.id === payoutId);
      if (!payout) return res.status(404).json({ error: "Payout not found" });

      const updated = { ...payout, ...body, id: payout.id, agent_id: payout.agent_id };
      if (body.status === "paid" && !payout.paid_at) {
        updated.paid_at = new Date().toISOString();
      }

      await setAgentPayouts(payouts.map((p) => (p.id === payoutId ? updated : p)));
      res.json(updated);
    } catch (err) {
      console.error("[agents payout PUT]", err);
      res.status(500).json({ error: "Failed to update payout" });
    }
  });

  app.get("/api/agents/:id/stats", async (req, res) => {
    try {
      const { id } = req.params;
      const agents = await getAgents();
      const agent = agents.find((a) => a.id === id);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      const safeAgent = stripPassword(agent);
      const data = await computeAgentStats(id, agent.commission_rate || 0);
      res.json({ agent: safeAgent, ...data });
    } catch (err) {
      console.error("[agents stats]", err);
      res.status(500).json({ error: "Failed to fetch agent stats" });
    }
  });

  app.get("/api/agents/:id/clients", async (req, res) => {
    try {
      const { id } = req.params;
      const all = await getUsers();
      const clients = all.filter((u) => u.agent_id === id).map((u) => stripPassword(u));
      res.json(clients);
    } catch (err) {
      console.error("[agents clients GET]", err);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.post("/api/agents/:id/clients", async (req, res) => {
    try {
      const agentId = req.params.id;
      const agents = await getAgents();
      if (!agents.some((a) => a.id === agentId)) {
        return res.status(404).json({ error: "Agent not found" });
      }

      const body = req.body || {};
      const { phone, password, company_name } = body;

      if (!phone || !password || !company_name) {
        return res.status(400).json({ error: "Required: phone, password, company_name" });
      }

      const allUsers = await getUsers();
      if (allUsers.some((u) => u.phone === phone)) {
        return res.status(400).json({ error: "Login already exists" });
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
        role: "wholesale",
        created_at: new Date().toISOString(),
      };

      await setUsers([user, ...allUsers]);
      res.json(stripPassword(user));
    } catch (err) {
      console.error("[agents clients POST]", err);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.post("/api/agents/:id/payouts", async (req, res) => {
    try {
      const agentId = req.params.id;
      const agents = await getAgents();
      if (!agents.some((a) => a.id === agentId)) {
        return res.status(404).json({ error: "Agent not found" });
      }

      const body = req.body || {};
      const { amount, comment, status } = body;

      if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const isPaid = (status || "pending") === "paid";
      const payout = {
        id: genId("pay_"),
        agent_id: agentId,
        amount: Number(amount),
        status: isPaid ? "paid" : "pending",
        comment: comment || "",
        created_at: new Date().toISOString(),
        paid_at: isPaid ? new Date().toISOString() : null,
      };

      const payouts = await getAgentPayouts();
      await setAgentPayouts([payout, ...payouts]);
      res.json(payout);
    } catch (err) {
      console.error("[agents payouts POST]", err);
      res.status(500).json({ error: "Failed to create payout" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const agents = await getAgents();
      const agent = agents.find((a) => a.id === id);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      res.json(stripPassword(agent));
    } catch (err) {
      console.error("[agents GET/:id]", err);
      res.status(500).json({ error: "Failed to fetch agent" });
    }
  });

  app.put("/api/agents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const agents = await getAgents();
      const agent = agents.find((a) => a.id === id);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      if (body.phone && body.phone !== agent.phone) {
        if (agents.some((a) => a.phone === body.phone && a.id !== id)) {
          return res.status(400).json({ error: "Login already taken" });
        }
      }

      const updated = {
        ...agent,
        name: body.name ?? agent.name,
        phone: body.phone ?? agent.phone,
        password: body.password || agent.password,
        commission_rate: body.commission_rate !== undefined ? Number(body.commission_rate) : agent.commission_rate,
        status: body.status ?? agent.status,
        role: "agent",
      };

      await setAgents(agents.map((a) => (a.id === id ? updated : a)));
      res.json(stripPassword(updated));
    } catch (err) {
      console.error("[agents PUT]", err);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });
}
