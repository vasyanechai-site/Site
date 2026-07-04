import { useCallback, useEffect, useState } from "react";
import { Loader2, MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import {
  channelSubscriberAction,
  fetchChannelStats,
  fetchChannelSubscribers,
} from "../../lib/annaApi";

const R = "rounded-md";
const SECTION = `border border-zinc-200 bg-white p-5 ${R}`;
const SELECT =
  `h-9 w-full min-w-[9.5rem] appearance-none border border-zinc-200 bg-white pl-3 pr-9 text-sm ${R} bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat` +
  ` bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2371717a%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E')]`;

export type ChannelStats = {
  totalPaid: number;
  active: number;
  joined: number;
  paidNotJoined: number;
  expired: number;
  cancelled: number;
  newToday: number;
  newWeek: number;
  newMonth: number;
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  revenueTotal: number;
  lastPaymentAt: string | null;
  lastJoinAt: string | null;
  monthlyPrice: number;
};

export type ChannelSubscriber = {
  id: number;
  telegramUserId: number;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  status: string;
  statusLabel: string;
  amount: number;
  paidAt: string | null;
  endsAt: string | null;
  joinedAt: string | null;
  inviteStatus: string | null;
  inviteStatusLabel: string | null;
};

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className={`${SECTION} flex h-[5.5rem] flex-col justify-between`}>
      <p className="text-xs leading-snug text-zinc-500">{title}</p>
      <p className="text-xl font-semibold tabular-nums tracking-tight text-zinc-900">{value}</p>
    </div>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AnnaChannelSection() {
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [rows, setRows] = useState<ChannelSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const [s, list] = await Promise.all([
        fetchChannelStats(),
        fetchChannelSubscribers(params),
      ]);
      setStats(s);
      setRows(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: number, action: string) => {
    try {
      await channelSubscriberAction(id, action);
      toast.success("Готово");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="Всего оплативших" value={stats?.totalPaid ?? 0} />
        <StatCard title="Активных" value={stats?.active ?? 0} />
        <StatCard title="Вступили" value={stats?.joined ?? 0} />
        <StatCard title="Оплатили, не вступили" value={stats?.paidNotJoined ?? 0} />
        <StatCard title="Истекшие" value={stats?.expired ?? 0} />
        <StatCard title="Отменённые" value={stats?.cancelled ?? 0} />
        <StatCard title="Новые сегодня" value={stats?.newToday ?? 0} />
        <StatCard title="Новые за 7 дн." value={stats?.newWeek ?? 0} />
        <StatCard title="Новые за месяц" value={stats?.newMonth ?? 0} />
        <StatCard title="Выручка сегодня" value={`${stats?.revenueToday ?? 0} ₽`} />
        <StatCard title="Выручка 7 дн." value={`${stats?.revenueWeek ?? 0} ₽`} />
        <StatCard title="Выручка месяц" value={`${stats?.revenueMonth ?? 0} ₽`} />
        <StatCard title="Выручка всего" value={`${stats?.revenueTotal ?? 0} ₽`} />
        <StatCard title="Цена подписки" value={`${stats?.monthlyPrice ?? 500} ₽`} />
        <StatCard title="Последняя оплата" value={fmt(stats?.lastPaymentAt ?? null)} />
        <StatCard title="Последнее вступление" value={fmt(stats?.lastJoinAt ?? null)} />
      </section>

      <section className={`${SECTION} space-y-4`}>
        <h2 className="text-sm font-semibold text-zinc-900">Подписчики</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`pl-9 ${R}`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={SELECT}
          >
            <option value="">Все статусы</option>
            <option value="pending_payment">Ожидает оплату</option>
            <option value="active">Активна</option>
            <option value="expired">Истекла</option>
            <option value="cancelled">Отменена</option>
          </select>
          <Button variant="outline" className={R} onClick={() => load()}>
            Обновить
          </Button>
        </div>

        <div className={`overflow-x-auto border border-zinc-200 ${R}`}>
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50/90 text-zinc-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">Имя</th>
                <th className="px-3 py-2.5 font-medium">Username</th>
                <th className="px-3 py-2.5 font-medium">TG ID</th>
                <th className="px-3 py-2.5 font-medium">Статус</th>
                <th className="px-3 py-2.5 font-medium">Оплата</th>
                <th className="px-3 py-2.5 font-medium">До</th>
                <th className="px-3 py-2.5 font-medium">Вступил</th>
                <th className="px-3 py-2.5 font-medium">Сумма</th>
                <th className="px-3 py-2.5 font-medium">Invite</th>
                <th className="px-3 py-2.5 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50/60">
                  <td className="px-3 py-2.5">{r.telegramFirstName || "—"}</td>
                  <td className="px-3 py-2.5 text-zinc-500">
                    {r.telegramUsername ? `@${r.telegramUsername}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{r.telegramUserId}</td>
                  <td className="px-3 py-2.5">{r.statusLabel}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmt(r.paidAt)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmt(r.endsAt)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmt(r.joinedAt)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{r.amount} ₽</td>
                  <td className="px-3 py-2.5">{r.inviteStatusLabel || "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${R}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={R}>
                        <DropdownMenuItem onClick={() => act(r.id, "extend")}>
                          Продлить
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => act(r.id, "activate")}>
                          Активировать
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => act(r.id, "cancel")}>
                          Отменить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          Повторная отправка invite-ссылки — в Telegram-админке бота (раздел «Закрытый канал»).
        </p>
      </section>
    </div>
  );
}
