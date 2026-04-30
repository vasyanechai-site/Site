import { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate, useParams, NavLink, Outlet } from 'react-router@7.12.0';
import { Logo } from '../Logo';
import { Button } from '../ui/button';
import {
  LayoutDashboard, Users, ShoppingBag, Wallet, LogOut, Menu, X,
} from 'lucide-react@0.454.0';
import { fetchAgentStats } from '../../lib/agentApi';
import type { AgentFullData } from '../../types/agent';
import { toast } from 'sonner@2.0.3';

// ── Context ───────────────────────────────────────────────────────────────

interface AgentCtx {
  agentData: AgentFullData | null;
  reload: () => void;
  agentId: string;
}

export const AgentContext = createContext<AgentCtx>({ agentData: null, reload: () => {}, agentId: '' });
export const useAgent = () => useContext(AgentContext);

// ── Layout ────────────────────────────────────────────────────────────────

const NAV = [
  { to: '', end: true, icon: LayoutDashboard, label: 'Дашборд' },
  { to: 'clients',    icon: Users,           label: 'Мои клиенты' },
  { to: 'orders',     icon: ShoppingBag,     label: 'Заказы' },
  { to: 'payouts',    icon: Wallet,          label: 'Финансы' },
];

export function AgentLayout() {
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId: string }>();
  const [data, setData] = useState<AgentFullData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = async () => {
    if (!agentId) return;
    try {
      const d = await fetchAgentStats(agentId);
      setData(d);
    } catch (e) {
      console.error('AgentLayout load error:', e);
    }
  };

  useEffect(() => {
    // Auth check
    const raw = localStorage.getItem('agentAuth');
    if (!raw) { navigate('/loginopt'); return; }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.authenticated || !parsed.agentId) throw new Error('invalid');
      if (parsed.agentId !== agentId) { navigate(`/agent/${parsed.agentId}`); return; }
    } catch {
      localStorage.removeItem('agentAuth');
      navigate('/loginopt');
      return;
    }
    load();
  }, [agentId]);

  const handleLogout = () => {
    localStorage.removeItem('agentAuth');
    toast.success('Вы вышли из системы');
    navigate('/loginopt');
  };

  const agentName = data?.agent.name ?? '...';

  return (
    <AgentContext.Provider value={{ agentData: data, reload: load, agentId: agentId! }}>
      <div className="min-h-screen bg-[#FAFAF8] flex">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-border flex flex-col
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:flex lg:z-auto`}>

          <div className="flex items-center px-5 h-14 border-b border-border shrink-0">
            <Logo className="h-5 w-auto" />
            <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="px-4 py-3 border-b border-border/50 shrink-0">
            <p className="text-xs text-muted-foreground">Агентский кабинет</p>
            <p className="text-sm font-medium mt-0.5 truncate">{agentName}</p>
          </div>

          <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
            {NAV.map(item => (
              <NavLink
                key={item.label}
                to={item.end ? `/agent/${agentId}` : `/agent/${agentId}/${item.to}`}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                  ${isActive ? 'bg-[#FFF4E5] text-[#F47D37] font-medium' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="p-3 border-t border-border shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" /> Выйти
            </Button>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <header className="lg:hidden flex items-center px-4 h-12 border-b border-border bg-white sticky top-0 z-20">
            <button onClick={() => setSidebarOpen(true)} className="p-1 mr-3">
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
            <Logo className="h-5 w-auto" />
          </header>

          <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AgentContext.Provider>
  );
}
