import { API_BASE_URL } from './backendConfig';
import type { Agent, AgentClient, AgentPayout, AgentFullData } from '../types/agent';

const API = API_BASE_URL;
const h = { 'Content-Type': 'application/json' };

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...h, ...(opts.headers || {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const fetchAgents = (): Promise<Agent[]> => req('/agents');

export const fetchAgent = (id: string): Promise<Agent> => req(`/agents/${id}`);

export const fetchAgentStats = (id: string): Promise<AgentFullData> => req(`/agents/${id}/stats`);

export const createAgent = (data: {
  name: string;
  phone: string;
  password: string;
  commission_rate: number;
  status?: string;
}): Promise<Agent> => req('/agents', { method: 'POST', body: JSON.stringify(data) });

export const updateAgent = (
  id: string,
  data: Partial<Agent> & { password?: string },
): Promise<Agent> => req(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const fetchAgentClients = (agentId: string): Promise<AgentClient[]> =>
  req(`/agents/${agentId}/clients`);

export const createAgentClient = (
  agentId: string,
  data: { phone: string; password: string; company_name: string },
): Promise<AgentClient> =>
  req(`/agents/${agentId}/clients`, { method: 'POST', body: JSON.stringify(data) });

export const createPayout = (
  agentId: string,
  data: { amount: number; comment?: string; status?: string },
): Promise<AgentPayout> =>
  req(`/agents/${agentId}/payouts`, { method: 'POST', body: JSON.stringify(data) });

export const updatePayout = (payoutId: string, data: Partial<AgentPayout>): Promise<AgentPayout> =>
  req(`/agents/payouts/${payoutId}`, { method: 'PUT', body: JSON.stringify(data) });
