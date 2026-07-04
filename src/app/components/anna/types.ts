export type AnnaStats = {
  counts: {
    totalFuture: number;
    available: number;
    reserved: number;
    awaiting_payment: number;
    prepaid: number;
    paid_full: number;
    cancelled: number;
  };
  nearestSession: string | null;
};

export type AnnaBooking = {
  id: number;
  slotId: number;
  slotAt: string;
  date: string;
  time: string;
  telegramUserId: number;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  telegramLastName: string | null;
  status: string;
  statusLabel: string;
  prepaymentAmount: number;
  totalAmount: number;
  adminComment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnnaSlot = {
  id: number;
  slotAt: string;
  date: string;
  time: string;
  status: string;
  statusLabel: string;
  userId: number | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  booking: AnnaBooking | null;
};

export const STATUS_COLORS: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800 border-emerald-200",
  reserved: "bg-amber-100 text-amber-800 border-amber-200",
  awaiting_payment: "bg-orange-100 text-orange-800 border-orange-200",
  prepaid: "bg-sky-100 text-sky-800 border-sky-200",
  paid_full: "bg-violet-100 text-violet-800 border-violet-200",
  cancelled: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export const BOOKING_STATUS_OPTIONS = [
  { value: "reserved", label: "Забронирован" },
  { value: "awaiting_payment", label: "Ожидает оплату" },
  { value: "prepaid", label: "Предоплата внесена" },
  { value: "paid_full", label: "Оплачено полностью" },
  { value: "cancelled", label: "Отменено" },
];
