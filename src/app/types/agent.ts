export interface Agent {
  id: string;
  name: string;
  phone: string; // login
  commission_rate: number; // %
  status: 'active' | 'disabled';
  invite_code?: string;
  created_at: string;
  role: 'agent';
  // computed stats (from server)
  totalClients?: number;
  totalOrders?: number;
  totalRevenue?: number;
  totalCommission?: number;
  totalPaid?: number;
  balance?: number;
}

export interface AgentClient {
  id: string;
  phone: string;
  company_name: string;
  discount?: number;
  agent_id: string;
  created_at: string;
  role: 'wholesale';
}

export interface AgentPayout {
  id: string;
  agent_id: string;
  amount: number;
  status: 'pending' | 'paid';
  comment: string;
  created_at: string;
  paid_at: string | null;
}

export interface AgentStats {
  totalClients: number;
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;
  totalPaid: number;
  balance: number;
}

export interface AgentFullData {
  agent: Agent;
  clients: AgentClient[];
  orders: any[];
  payouts: AgentPayout[];
  stats: AgentStats;
}
