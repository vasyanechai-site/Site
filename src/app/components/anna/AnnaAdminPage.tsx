import { Component, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Loader2, MessageCircle, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  annaLogin,
  clearAnnaToken,
  createAnnaSlot,
  deleteAnnaSlot,
  fetchAnnaBookings,
  fetchAnnaCalendar,
  fetchAnnaSettings,
  fetchAnnaSlots,
  fetchAnnaStats,
  getAnnaToken,
  updateAnnaBooking,
  updateAnnaSettings,
} from "../../lib/annaApi";
import {
  dateDigitsToApi,
  formatDateDisplay,
  formatTimeDisplay,
  parseDateDigits,
  parseTimeDigits,
  timeDigitsToApi,
  validateDateDigits,
  validateFutureSlot,
  validateTimeDigits,
} from "../../lib/datetimeMask";
import {
  AnnaBooking,
  AnnaSlot,
  AnnaStats,
  BOOKING_STATUS_OPTIONS,
  STATUS_COLORS,
} from "./types";
import "react-day-picker/dist/style.css";

const SECTION = "border border-zinc-200 bg-white p-5";

function dateToDigits(d: Date): string {
  return format(d, "ddMMyyyy");
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.cancelled}`}
    >
      {label}
    </span>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className={`${SECTION} flex h-full min-h-[5.5rem] flex-col justify-between`}>
      <p className="text-xs text-zinc-500">{title}</p>
      <p className="text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
    </div>
  );
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await annaLogin(password);
      toast.success("Добро пожаловать");
      onSuccess();
    } catch {
      toast.error("Неверный пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm border border-zinc-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-zinc-900">Вход</h1>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10"
            autoFocus
          />
          <Button type="submit" className="h-10 w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Войти"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function safeFormatIso(iso: string | null | undefined, pattern: string) {
  if (!iso) return "—";
  try {
    const d = parseISO(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return format(d, pattern, { locale: ru });
  } catch {
    return "—";
  }
}

class AnnaErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || "Ошибка интерфейса" };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
          <div className="max-w-md border border-red-200 bg-white p-6 text-center">
            <p className="text-lg font-semibold text-zinc-900">Что-то пошло не так</p>
            <p className="mt-2 text-sm text-zinc-600">{this.state.error}</p>
            <Button
              className="mt-4"
              onClick={() => {
                clearAnnaToken();
                window.location.reload();
              }}
            >
              Сбросить и обновить
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AnnaAdminPage() {
  return (
    <AnnaErrorBoundary>
      <AnnaAdminPageInner />
    </AnnaErrorBoundary>
  );
}

function AnnaAdminPageInner() {
  const [authed, setAuthed] = useState(!!getAnnaToken());
  const [initialLoading, setInitialLoading] = useState(!!getAnnaToken());
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AnnaStats | null>(null);
  const [calendarDays, setCalendarDays] = useState<
    Record<string, { total: number; available: number; occupied: number }>
  >({});
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [daySlots, setDaySlots] = useState<AnnaSlot[]>([]);
  const [daySlotsLoading, setDaySlotsLoading] = useState(false);
  const [bookings, setBookings] = useState<AnnaBooking[]>([]);
  const [pricing, setPricing] = useState({
    fullPrice: 3000,
    prepayPercent: 50,
    prepayAmount: 1500,
  });
  const [pricingDraft, setPricingDraft] = useState({
    fullPrice: "3000",
    prepayPercent: "50",
  });
  const [savingPricing, setSavingPricing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "future" | "past">("all");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [modalDateDigits, setModalDateDigits] = useState("");
  const [modalTimeDigits, setModalTimeDigits] = useState("");
  const [savingSlot, setSavingSlot] = useState(false);
  const selectedDayRef = useRef(selectedDay);
  selectedDayRef.current = selectedDay;

  const monthKey = format(calendarMonth, "yyyy-MM");

  useEffect(() => {
    let robots = document.querySelector('meta[name="robots"]');
    const prev = robots?.getAttribute("content") || "";
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow");
    return () => {
      if (robots) robots.setAttribute("content", prev || "index, follow");
    };
  }, []);

  const loadDaySlots = useCallback(async (day: Date, silent = false) => {
    if (!getAnnaToken()) return;
    if (!silent) setDaySlotsLoading(true);
    try {
      const slotsData = await fetchAnnaSlots(format(day, "yyyy-MM-dd"));
      if (format(selectedDayRef.current, "yyyy-MM-dd") === format(day, "yyyy-MM-dd")) {
        setDaySlots(Array.isArray(slotsData) ? slotsData : []);
      }
    } catch (e) {
      if (!silent) {
        toast.error(e instanceof Error ? e.message : "Ошибка загрузки слотов");
      }
    } finally {
      if (!silent) setDaySlotsLoading(false);
    }
  }, []);

  const loadCalendarMonth = useCallback(async (month: string) => {
    if (!getAnnaToken()) return;
    try {
      const calData = await fetchAnnaCalendar(month);
      setCalendarDays(calData?.days || {});
    } catch {
      /* silent — calendar markers are non-critical */
    }
  }, []);

  const loadBookings = useCallback(async () => {
    if (!getAnnaToken()) return;
    const bookingParams: Record<string, string> = {};
    if (statusFilter) bookingParams.status = statusFilter;
    if (timeFilter === "future") bookingParams.future = "true";
    if (timeFilter === "past") bookingParams.past = "true";
    const bookingsData = await fetchAnnaBookings(bookingParams);
    setBookings(Array.isArray(bookingsData) ? bookingsData : []);
  }, [statusFilter, timeFilter]);

  const loadStatsAndSettings = useCallback(async () => {
    if (!getAnnaToken()) return;
    const [statsData, settingsData] = await Promise.all([
      fetchAnnaStats(),
      fetchAnnaSettings(),
    ]);
    setStats(
      statsData?.counts
        ? statsData
        : {
            counts: {
              totalFuture: 0,
              available: 0,
              reserved: 0,
              awaiting_payment: 0,
              prepaid: 0,
              paid_full: 0,
              cancelled: 0,
            },
            nearestSession: null,
          }
    );
    const p = settingsData?.pricing;
    if (p) {
      setPricing(p);
      setPricingDraft({
        fullPrice: String(p.fullPrice),
        prepayPercent: String(p.prepayPercent),
      });
    }
  }, []);

  const refreshAll = useCallback(
    async (silent = false) => {
      if (!getAnnaToken()) return;
      if (!silent) setRefreshing(true);
      try {
        await Promise.all([
          loadStatsAndSettings(),
          loadCalendarMonth(monthKey),
          loadBookings(),
        ]);
        await loadDaySlots(selectedDayRef.current, true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        const authFailed = msg.includes("Unauthorized") || msg.includes("401");
        if (!silent) {
          toast.error(msg || "Ошибка загрузки");
          clearAnnaToken();
          setAuthed(false);
        } else if (authFailed) {
          clearAnnaToken();
          setAuthed(false);
        }
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [loadStatsAndSettings, loadCalendarMonth, loadBookings, loadDaySlots, monthKey]
  );

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      try {
        await Promise.all([
          loadStatsAndSettings(),
          loadCalendarMonth(monthKey),
          loadBookings(),
        ]);
        if (!cancelled) await loadDaySlots(selectedDay, true);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
          clearAnnaToken();
          setAuthed(false);
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial auth bootstrap only
  }, [authed]);

  useEffect(() => {
    if (!authed || initialLoading) return;
    loadCalendarMonth(monthKey);
  }, [authed, initialLoading, monthKey, loadCalendarMonth]);

  useEffect(() => {
    if (!authed || initialLoading) return;
    loadBookings();
  }, [authed, initialLoading, loadBookings]);

  useEffect(() => {
    if (!authed || initialLoading) return;
    loadDaySlots(selectedDay);
  }, [authed, initialLoading, selectedDay, loadDaySlots]);

  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => refreshAll(true), 8000);
    return () => clearInterval(id);
  }, [authed, refreshAll]);

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) => {
      const hay = [
        b.telegramUsername,
        b.telegramFirstName,
        b.telegramLastName,
        String(b.telegramUserId),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [bookings, search]);

  const nearestLabel = stats?.nearestSession
    ? safeFormatIso(stats.nearestSession, "d MMMM, HH:mm")
    : "—";

  const openAddModal = useCallback(() => {
    setModalDateDigits(dateToDigits(selectedDay));
    setModalTimeDigits("");
    setAddModalOpen(true);
  }, [selectedDay]);

  const handleSavePricing = async () => {
    const fullPrice = Number(pricingDraft.fullPrice);
    const prepayPercent = Number(pricingDraft.prepayPercent);
    if (!Number.isFinite(fullPrice) || fullPrice <= 0) {
      toast.error("Укажите корректную полную стоимость");
      return;
    }
    if (!Number.isFinite(prepayPercent) || prepayPercent < 1 || prepayPercent > 99) {
      toast.error("Предоплата должна быть от 1% до 99%");
      return;
    }
    setSavingPricing(true);
    try {
      const res = await updateAnnaSettings({ fullPrice, prepayPercent });
      setPricing(res.pricing);
      setPricingDraft({
        fullPrice: String(res.pricing.fullPrice),
        prepayPercent: String(res.pricing.prepayPercent),
      });
      toast.success("Настройки цен сохранены");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSavingPricing(false);
    }
  };

  const draftPrepayAmount = useMemo(() => {
    const full = Number(pricingDraft.fullPrice);
    const pct = Number(pricingDraft.prepayPercent);
    if (!Number.isFinite(full) || !Number.isFinite(pct)) return "—";
    return Math.round((full * pct) / 100);
  }, [pricingDraft]);

  const handleSaveSlot = async () => {
    const dateErr = validateDateDigits(modalDateDigits);
    const timeErr = validateTimeDigits(modalTimeDigits);
    const futureErr =
      !dateErr && !timeErr ? validateFutureSlot(modalDateDigits, modalTimeDigits) : null;
    if (dateErr || timeErr || futureErr) {
      toast.error(dateErr || timeErr || futureErr);
      return;
    }

    setSavingSlot(true);
    try {
      const res = await createAnnaSlot(
        dateDigitsToApi(modalDateDigits),
        timeDigitsToApi(modalTimeDigits)
      );
      const slot = res.slot as AnnaSlot;
      toast.success("Слот добавлен");
      setAddModalOpen(false);
      setModalTimeDigits("");

      const modalDayKey = formatDateDisplay(modalDateDigits);
      const selectedDayKey = format(selectedDay, "dd.MM.yyyy");
      if (modalDayKey === selectedDayKey) {
        setDaySlots((prev) => {
          const next = [...prev, { ...slot, booking: slot.booking ?? null }];
          next.sort((a, b) => a.time.localeCompare(b.time));
          return next;
        });
      }
      void loadStatsAndSettings();
      const parts = modalDayKey.split(".");
      if (parts.length === 3) {
        void loadCalendarMonth(`${parts[2]}-${parts[1]}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingSlot(false);
    }
  };

  const handleDeleteSlot = async (slot: AnnaSlot) => {
    if (slot.status !== "available") {
      toast.error("Нельзя удалить занятый слот");
      return;
    }
    try {
      await deleteAnnaSlot(slot.id);
      toast.success("Слот удалён");
      setDaySlots((prev) => prev.filter((s) => s.id !== slot.id));
      void loadStatsAndSettings();
      void loadCalendarMonth(monthKey);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const handleStatusChange = async (booking: AnnaBooking, status: string) => {
    try {
      await updateAnnaBooking(booking.id, { status });
      toast.success("Статус обновлён");
      void loadBookings();
      void loadDaySlots(selectedDay, true);
      void loadStatsAndSettings();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const handleCommentSave = async (booking: AnnaBooking, comment: string) => {
    try {
      await updateAnnaBooking(booking.id, { adminComment: comment });
      toast.success("Комментарий сохранён");
      void loadBookings();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2 px-4 py-3 sm:px-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshAll()}
            disabled={refreshing}
          >
            {refreshing ? "Обновление..." : "Обновить"}
          </Button>
          <Button size="sm" onClick={openAddModal}>
            Добавить слот
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearAnnaToken();
              setAuthed(false);
            }}
          >
            Выйти
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {initialLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <>
            <section className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <StatCard title="Будущие слоты" value={stats?.counts.totalFuture ?? 0} />
              <StatCard title="Свободные" value={stats?.counts.available ?? 0} />
              <StatCard title="Забронированы" value={stats?.counts.reserved ?? 0} />
              <StatCard title="Ждут оплату" value={stats?.counts.awaiting_payment ?? 0} />
              <StatCard title="Предоплата" value={stats?.counts.prepaid ?? 0} />
              <StatCard title="Оплачено" value={stats?.counts.paid_full ?? 0} />
              <StatCard title="Отменено" value={stats?.counts.cancelled ?? 0} />
              <StatCard title="Ближайшая" value={nearestLabel} />
            </section>

            <section className={SECTION}>
              <h2 className="mb-4 text-sm font-semibold text-zinc-900">Календарь</h2>
              <DayPicker
                mode="single"
                selected={selectedDay}
                onSelect={(day) => day && setSelectedDay(day)}
                locale={ru}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                modifiers={{
                  hasFree: (date) => {
                    const key = format(date, "yyyy-MM-dd");
                    return (calendarDays[key]?.available || 0) > 0;
                  },
                  hasBusy: (date) => {
                    const key = format(date, "yyyy-MM-dd");
                    return (calendarDays[key]?.occupied || 0) > 0;
                  },
                }}
                modifiersClassNames={{
                  hasFree: "rdp-day_has-free",
                  hasBusy: "rdp-day_has-busy",
                }}
                className="mx-auto"
              />
              <style>{`
                .rdp-day_has-free:not(.rdp-day_selected) { background: #f0fdf4; border-radius: 6px; }
                .rdp-day_has-busy:not(.rdp-day_selected) { box-shadow: inset 0 0 0 1px #fdba74; border-radius: 6px; }
                .rdp-day_selected { background: #18181b !important; color: white; border-radius: 6px; }
              `}</style>

              <div className="mt-5 border-t border-zinc-100 pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Button variant="outline" size="sm" onClick={openAddModal}>
                    Добавить слот
                  </Button>
                  {daySlotsLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  )}
                </div>

                {daySlots.length === 0 && !daySlotsLoading ? (
                  <p className="py-6 text-center text-sm text-zinc-500">
                    На этот день слотов нет
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-100">
                    {daySlots.map((slot) => (
                      <li
                        key={slot.id}
                        className="flex items-center gap-3 py-2 text-sm"
                      >
                        <span className="w-12 shrink-0 font-medium tabular-nums text-zinc-900">
                          {slot.time}
                        </span>
                        <span className="text-zinc-300">|</span>
                        <StatusBadge status={slot.status} label={slot.statusLabel} />
                        {slot.booking?.telegramUsername && (
                          <>
                            <span className="text-zinc-300">|</span>
                            <span className="truncate text-zinc-500">
                              @{slot.booking.telegramUsername}
                            </span>
                          </>
                        )}
                        <span className="flex-1" />
                        {slot.status === "available" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-zinc-500 hover:text-red-600"
                            onClick={() => handleDeleteSlot(slot)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Удалить</span>
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className={SECTION}>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">Записи</h2>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      placeholder="Поиск..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-9 pl-9"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 border border-zinc-200 bg-white px-3 text-sm"
                  >
                    <option value="">Все статусы</option>
                    {BOOKING_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value as typeof timeFilter)}
                    className="h-9 border border-zinc-200 bg-white px-3 text-sm"
                  >
                    <option value="all">Все даты</option>
                    <option value="future">Будущие</option>
                    <option value="past">Прошедшие</option>
                  </select>
                </div>
              </div>

              {filteredBookings.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-500">Записей пока нет</p>
              ) : (
                <div className="space-y-4">
                  {filteredBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      pricing={pricing}
                      onStatusChange={handleStatusChange}
                      onCommentSave={handleCommentSave}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className={SECTION}>
              <h2 className="mb-4 text-sm font-semibold text-zinc-900">Цена и предоплата</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    Полная стоимость, ₽
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={pricingDraft.fullPrice}
                    onChange={(e) =>
                      setPricingDraft((s) => ({ ...s, fullPrice: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Предоплата, %</label>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={pricingDraft.prepayPercent}
                    onChange={(e) =>
                      setPricingDraft((s) => ({ ...s, prepayPercent: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Сумма предоплаты</label>
                  <div className="flex h-9 items-center border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium">
                    {draftPrepayAmount} ₽
                  </div>
                </div>
              </div>
              <Button className="mt-4" onClick={handleSavePricing} disabled={savingPricing}>
                {savingPricing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Сохранить настройки"
                )}
              </Button>
            </section>
          </>
        )}
      </main>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="border-zinc-200 shadow-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить слот</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Дата</label>
              <Input
                placeholder="ДД.ММ.ГГГГ"
                inputMode="numeric"
                autoComplete="off"
                value={formatDateDisplay(modalDateDigits)}
                onChange={(e) => setModalDateDigits(parseDateDigits(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Время</label>
              <Input
                placeholder="ЧЧ:ММ"
                inputMode="numeric"
                autoComplete="off"
                value={formatTimeDisplay(modalTimeDigits)}
                onChange={(e) => setModalTimeDigits(parseTimeDigits(e.target.value))}
                autoFocus
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Можно вводить только цифры — точки и двоеточие подставятся сами
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveSlot} disabled={savingSlot}>
              {savingSlot ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingCard({
  booking,
  pricing,
  onStatusChange,
  onCommentSave,
}: {
  booking: AnnaBooking;
  pricing: { prepayAmount: number; fullPrice: number };
  onStatusChange: (b: AnnaBooking, status: string) => void;
  onCommentSave: (b: AnnaBooking, comment: string) => void;
}) {
  const [comment, setComment] = useState(booking.adminComment || "");
  const name = [booking.telegramFirstName, booking.telegramLastName].filter(Boolean).join(" ");

  return (
    <div className="border border-zinc-100 bg-zinc-50/50 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold">
              {booking.date} · {booking.time}
            </p>
            <StatusBadge status={booking.status} label={booking.statusLabel} />
          </div>
          <p className="text-sm text-zinc-600">{name || "—"}</p>
          <p className="text-sm text-zinc-500">
            {booking.telegramUsername
              ? `@${booking.telegramUsername}`
              : `Telegram ID: ${booking.telegramUserId}`}
          </p>
          <p className="text-sm text-zinc-500">
            Предоплата {booking.prepaymentAmount || pricing.prepayAmount} ₽ · Полная{" "}
            {booking.totalAmount || pricing.fullPrice} ₽
          </p>
          <p className="text-xs text-zinc-400">
            Создано: {safeFormatIso(booking.createdAt, "d MMM yyyy, HH:mm")}
          </p>
          {booking.telegramUsername && (
            <a
              href={`https://t.me/${booking.telegramUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-zinc-900 px-3 py-2 text-sm text-white transition hover:bg-zinc-800"
            >
              <MessageCircle className="h-4 w-4" />
              Написать в Telegram
            </a>
          )}
        </div>
        <div className="w-full max-w-sm space-y-3">
          <select
            value={booking.status}
            onChange={(e) => onStatusChange(booking, e.target.value)}
            className="h-10 w-full border border-zinc-200 bg-white px-3 text-sm"
          >
            {BOOKING_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Textarea
            placeholder="Комментарий администратора..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[80px]"
          />
          <Button variant="outline" size="sm" onClick={() => onCommentSave(booking, comment)}>
            Сохранить комментарий
          </Button>
        </div>
      </div>
    </div>
  );
}
