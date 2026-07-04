import { Component, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { format, parseISO, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { motion, AnimatePresence } from "motion/react";
import {
  CalendarDays,
  Camera,
  Loader2,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { FadeIn } from "../ui/fade-in";
import {
  annaLogin,
  clearAnnaToken,
  createAnnaSlot,
  createAnnaSlotsBulk,
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
  normalizeBulkSlotText,
  parseDateDigits,
  parseTimeDigits,
  timeDigitsToApi,
  validateBulkSlotText,
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

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.cancelled}`}
    >
      {label}
    </span>
  );
}

function StatCard({
  title,
  value,
  delay,
}: {
  title: string;
  value: number | string;
  delay: number;
}) {
  return (
    <FadeIn delay={delay} duration={0.35} yOffset={12}>
      <div className="group rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <p className="text-sm text-zinc-500">{title}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{value}</p>
      </div>
    </FadeIn>
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf2f8,_#fafafa_45%,_#f4f4f5)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-black/5 bg-white/90 p-8 shadow-xl backdrop-blur"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white">
            <Camera className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Anna CRM</h1>
            <p className="text-sm text-zinc-500">Запись на фотосессию</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl"
            autoFocus
          />
          <Button type="submit" className="h-12 w-full rounded-xl" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Войти"}
          </Button>
        </form>
      </motion.div>
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
          <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <p className="text-lg font-semibold text-zinc-900">Что-то пошло не так</p>
            <p className="mt-2 text-sm text-zinc-600">{this.state.error}</p>
            <Button
              className="mt-4 rounded-xl"
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
  const [loading, setLoading] = useState(!!getAnnaToken());
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AnnaStats | null>(null);
  const [calendarDays, setCalendarDays] = useState<Record<string, { total: number; available: number; occupied: number }>>({});
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [daySlots, setDaySlots] = useState<AnnaSlot[]>([]);
  const [bookings, setBookings] = useState<AnnaBooking[]>([]);
  const [pricing, setPricing] = useState({ fullPrice: 3000, prepayPercent: 50, prepayAmount: 1500 });
  const [pricingDraft, setPricingDraft] = useState({ fullPrice: "3000", prepayPercent: "50" });
  const [savingPricing, setSavingPricing] = useState(false);
  const [slotDateDigits, setSlotDateDigits] = useState("");
  const [slotTimeDigits, setSlotTimeDigits] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "future" | "past">("all");

  const monthKey = format(selectedDay || new Date(), "yyyy-MM");

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

  const loadAll = useCallback(async (silent = false) => {
    if (!getAnnaToken()) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const dayIso = selectedDay ? format(selectedDay, "yyyy-MM-dd") : "";
      const bookingParams: Record<string, string> = {};
      if (statusFilter) bookingParams.status = statusFilter;
      if (timeFilter === "future") bookingParams.future = "true";
      if (timeFilter === "past") bookingParams.past = "true";

      const [statsData, calData, slotsData, bookingsData, settingsData] = await Promise.all([
        fetchAnnaStats(),
        fetchAnnaCalendar(monthKey),
        dayIso ? fetchAnnaSlots(dayIso) : Promise.resolve([]),
        fetchAnnaBookings(bookingParams),
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
      setCalendarDays(calData?.days || {});
      setDaySlots(Array.isArray(slotsData) ? slotsData : []);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      const p = settingsData?.pricing;
      if (p) {
        setPricing(p);
        setPricingDraft({
          fullPrice: String(p.fullPrice),
          prepayPercent: String(p.prepayPercent),
        });
      }
    } catch (e) {
      if (!silent) {
        toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
        clearAnnaToken();
        setAuthed(false);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthKey, selectedDay, statusFilter, timeFilter]);

  useEffect(() => {
    if (authed) loadAll();
  }, [authed, loadAll]);

  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => loadAll(true), 8000);
    return () => clearInterval(id);
  }, [authed, loadAll]);

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
      toast.success("Настройки цен сохранены — бот использует их сразу");
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

  const handleAddSlot = async () => {
    const dateErr = validateDateDigits(slotDateDigits);
    const timeErr = validateTimeDigits(slotTimeDigits);
    const futureErr =
      !dateErr && !timeErr ? validateFutureSlot(slotDateDigits, slotTimeDigits) : null;
    if (dateErr || timeErr || futureErr) {
      toast.error(dateErr || timeErr || futureErr);
      return;
    }

    try {
      await createAnnaSlot(dateDigitsToApi(slotDateDigits), timeDigitsToApi(slotTimeDigits));
      toast.success("Слот добавлен");
      setSlotDateDigits("");
      setSlotTimeDigits("");
      loadAll(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const handleBulk = async () => {
    const normalized = normalizeBulkSlotText(bulkText);
    const bulkErr = validateBulkSlotText(normalized);
    if (bulkErr) {
      toast.error(bulkErr);
      setBulkText(normalized);
      return;
    }

    try {
      const res = await createAnnaSlotsBulk(normalized);
      toast.success(`Добавлено: ${res.added}`);
      if (res.errors?.length) toast.warning(`Ошибок: ${res.errors.length}`);
      setBulkText("");
      loadAll(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
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
      loadAll(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const handleStatusChange = async (booking: AnnaBooking, status: string) => {
    try {
      await updateAnnaBooking(booking.id, { status });
      toast.success("Статус обновлён");
      loadAll(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const handleCommentSave = async (booking: AnnaBooking, comment: string) => {
    try {
      await updateAnnaBooking(booking.id, { adminComment: comment });
      toast.success("Комментарий сохранён");
      loadAll(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Anna CRM</h1>
              <p className="text-xs text-zinc-500">Фотосессии · синхронизация с Telegram</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => loadAll(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Обновить
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                clearAnnaToken();
                setAuthed(false);
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <StatCard title="Будущие слоты" value={stats?.counts.totalFuture ?? 0} delay={0} />
              <StatCard title="Свободные" value={stats?.counts.available ?? 0} delay={0.03} />
              <StatCard title="Забронированы" value={stats?.counts.reserved ?? 0} delay={0.06} />
              <StatCard title="Ждут оплату" value={stats?.counts.awaiting_payment ?? 0} delay={0.09} />
              <StatCard title="Предоплата" value={stats?.counts.prepaid ?? 0} delay={0.12} />
              <StatCard title="Оплачено" value={stats?.counts.paid_full ?? 0} delay={0.15} />
              <StatCard title="Отменено" value={stats?.counts.cancelled ?? 0} delay={0.18} />
              <StatCard title="Ближайшая" value={nearestLabel} delay={0.21} />
            </section>

            <FadeIn delay={0.05}>
              <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-zinc-500" />
                  <h2 className="text-lg font-semibold">Цены и предоплата</h2>
                </div>
                <p className="mb-4 text-sm text-zinc-500">
                  Меняется здесь — сразу применяется в Telegram-боте для новых записей.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                      Полная стоимость, ₽
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={pricingDraft.fullPrice}
                      onChange={(e) =>
                        setPricingDraft((s) => ({ ...s, fullPrice: e.target.value }))
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                      Предоплата, %
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={pricingDraft.prepayPercent}
                      onChange={(e) =>
                        setPricingDraft((s) => ({ ...s, prepayPercent: e.target.value }))
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                      Сумма предоплаты
                    </label>
                    <div className="flex h-10 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium">
                      {draftPrepayAmount} ₽
                    </div>
                  </div>
                </div>
                <Button
                  className="mt-4 rounded-xl"
                  onClick={handleSavePricing}
                  disabled={savingPricing}
                >
                  {savingPricing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Сохранить настройки"
                  )}
                </Button>
              </div>
            </FadeIn>

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <FadeIn delay={0.1}>
                <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-zinc-500" />
                    <h2 className="text-lg font-semibold">Календарь</h2>
                  </div>
                  <DayPicker
                    mode="single"
                    selected={selectedDay}
                    onSelect={setSelectedDay}
                    locale={ru}
                    month={startOfMonth(selectedDay || new Date())}
                    onMonthChange={(m) => setSelectedDay(m)}
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
                    .rdp-day_has-free:not(.rdp-day_selected) { background: #ecfdf5; border-radius: 9999px; }
                    .rdp-day_has-busy:not(.rdp-day_selected) { box-shadow: inset 0 0 0 2px #fdba74; border-radius: 9999px; }
                    .rdp-day_selected { background: #18181b !important; color: white; border-radius: 9999px; }
                  `}</style>
                </div>
              </FadeIn>

              <FadeIn delay={0.15}>
                <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold">
                    {selectedDay
                      ? format(selectedDay, "d MMMM yyyy", { locale: ru })
                      : "Выберите день"}
                  </h2>
                  <AnimatePresence mode="popLayout">
                    {daySlots.length === 0 ? (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500"
                      >
                        На этот день слотов нет
                      </motion.p>
                    ) : (
                      <div className="space-y-3">
                        {daySlots.map((slot) => (
                          <motion.div
                            key={slot.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4 transition hover:bg-white hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-lg font-semibold">{slot.time}</p>
                                <StatusBadge status={slot.status} label={slot.statusLabel} />
                              </div>
                              {slot.status === "available" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600"
                                  onClick={() => handleDeleteSlot(slot)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            {slot.booking && (
                              <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 text-sm">
                                <p className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-zinc-400" />
                                  {[slot.booking.telegramFirstName, slot.booking.telegramLastName]
                                    .filter(Boolean)
                                    .join(" ") || "—"}
                                </p>
                                <p className="text-zinc-500">
                                  {slot.booking.telegramUsername
                                    ? `@${slot.booking.telegramUsername}`
                                    : `ID ${slot.booking.telegramUserId}`}
                                </p>
                                <p className="text-zinc-500">
                                  Предоплата: {slot.booking.prepaymentAmount || pricing.prepayAmount} ₽
                                </p>
                                {slot.booking.adminComment && (
                                  <p className="rounded-xl bg-white p-2 text-zinc-600">
                                    {slot.booking.adminComment}
                                  </p>
                                )}
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeIn>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <FadeIn delay={0.1}>
                <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <Plus className="h-5 w-5" /> Добавить слот
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="ДД.ММ.ГГГГ"
                      inputMode="numeric"
                      autoComplete="off"
                      value={formatDateDisplay(slotDateDigits)}
                      onChange={(e) => setSlotDateDigits(parseDateDigits(e.target.value))}
                      className="rounded-xl"
                    />
                    <Input
                      placeholder="ЧЧ:ММ"
                      inputMode="numeric"
                      autoComplete="off"
                      value={formatTimeDisplay(slotTimeDigits)}
                      onChange={(e) => setSlotTimeDigits(parseTimeDigits(e.target.value))}
                      className="rounded-xl"
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Можно вводить только цифры — точки и двоеточие подставятся сами
                  </p>
                  <Button className="mt-3 rounded-xl" onClick={handleAddSlot}>
                    Сохранить слот
                  </Button>
                </div>
              </FadeIn>
              <FadeIn delay={0.15}>
                <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold">Массовое добавление</h2>
                  <Textarea
                    placeholder={"230720261700\n230720261900"}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    onBlur={() => setBulkText(normalizeBulkSlotText(bulkText))}
                    className="min-h-[120px] rounded-xl"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    По одному слоту на строку — 12 цифр подряд (дата + время) или ДД.ММ.ГГГГ ЧЧ:ММ
                  </p>
                  <Button className="mt-3 rounded-xl" variant="outline" onClick={handleBulk}>
                    Добавить список
                  </Button>
                </div>
              </FadeIn>
            </section>

            <section>
              <FadeIn delay={0.1}>
                <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <h2 className="text-lg font-semibold">Записи</h2>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                          placeholder="Поиск..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="rounded-xl pl-9"
                        />
                      </div>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
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
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                      >
                        <option value="all">Все даты</option>
                        <option value="future">Будущие</option>
                        <option value="past">Прошедшие</option>
                      </select>
                    </div>
                  </div>

                  {filteredBookings.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center text-sm text-zinc-500">
                      Записей пока нет
                    </p>
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
                </div>
              </FadeIn>
            </section>
          </>
        )}
      </main>
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
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/40 p-5 transition hover:bg-white hover:shadow-sm">
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
            {booking.telegramUsername ? `@${booking.telegramUsername}` : `Telegram ID: ${booking.telegramUserId}`}
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
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white transition hover:bg-zinc-800"
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
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
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
            className="min-h-[80px] rounded-xl"
          />
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => onCommentSave(booking, comment)}
          >
            Сохранить комментарий
          </Button>
        </div>
      </div>
    </div>
  );
}
