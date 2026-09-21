/**
 * Оптовая программа лояльности. Правила совпадают с прежней реализацией:
 *   ступень 3 — 12 заказов за 365 дней и нет перерыва больше 40 дней
 *   ступень 2 — 8 заказов за 180 дней и нет перерыва больше 45 дней
 *   ступень 1 — 4 заказа за 90 дней
 *   ступень 0 — иначе
 * Рост сразу до заработанной ступени. Снижение — не больше чем на 1 ступень
 * за один пересчёт. Ручной уровень (loyaltyLevelManualOverride) не трогаем.
 */

export const LOYALTY_LEVELS = [
  { level: 0, label: "Случайный визит", discount: 0 },
  { level: 1, label: "Нечайная встреча", discount: 5 },
  { level: 2, label: "Приятная нечайность", discount: 7 },
  { level: 3, label: "Главный Нечай", discount: 10 },
];

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function wholesaleOrdersForUser(orders, userId) {
  if (!userId) return [];
  return (Array.isArray(orders) ? orders : []).filter((order) => {
    if (!order || typeof order !== "object") return false;
    const owner = order.userId || order.user_id;
    if (owner !== userId) return false;
    return !order.orderType || order.orderType === "wholesale";
  });
}

export function orderTimestamp(order) {
  const raw = order?.date || order?.created_at;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : NaN;
}

/** Между соседними заказами нет перерыва больше maxGapDays. */
export function hasNoLargeGap(orders, maxGapDays) {
  if (!Array.isArray(orders) || orders.length < 2) return true;
  const sorted = [...orders].sort((a, b) => orderTimestamp(a) - orderTimestamp(b));
  for (let i = 1; i < sorted.length; i++) {
    const prev = orderTimestamp(sorted[i - 1]);
    const curr = orderTimestamp(sorted[i]);
    if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue;
    if ((curr - prev) / MS_PER_DAY > maxGapDays) return false;
  }
  return true;
}

export function getAutoLoyaltyForOrders(orders, now = Date.now()) {
  const list = Array.isArray(orders) ? orders : [];
  const within = (days) =>
    list.filter((order) => {
      const ts = orderTimestamp(order);
      return Number.isFinite(ts) && now - ts <= days * MS_PER_DAY;
    });
  const ordersIn3Mo = within(90);
  const ordersIn6Mo = within(180);
  const ordersIn12Mo = within(365);

  let lvl = LOYALTY_LEVELS[0];
  if (ordersIn3Mo.length >= 4) lvl = LOYALTY_LEVELS[1];
  if (ordersIn6Mo.length >= 8 && hasNoLargeGap(ordersIn6Mo, 45)) lvl = LOYALTY_LEVELS[2];
  if (ordersIn12Mo.length >= 12 && hasNoLargeGap(ordersIn12Mo, 40)) lvl = LOYALTY_LEVELS[3];

  return {
    ...lvl,
    ordersIn3Mo: ordersIn3Mo.length,
    ordersIn6Mo: ordersIn6Mo.length,
    ordersIn12Mo: ordersIn12Mo.length,
  };
}

/** Рост сразу, снижение не больше чем на одну ступень от сохранённого уровня. */
export function applyDropByOne(storedLevel, earnedLevel) {
  const stored = Number(storedLevel) || 0;
  const earned = Number(earnedLevel) || 0;
  if (earned >= stored) return earned;
  return Math.max(earned, stored - 1);
}

/** Суммарный вес для совместимости ответа. Колд брю не входит в вес. */
export function computeTotalKgFromOrders(orders) {
  let total = 0;
  for (const order of orders || []) {
    if (!Array.isArray(order.items)) continue;
    for (const item of order.items) {
      if (item?.type === "coldbrew") continue;
      total += Number(item?.kg) || 0;
      total += (Number(item?.packs200) || 0) * 0.2;
    }
  }
  return Math.round(total * 10) / 10;
}

export function levelByNumber(level) {
  return LOYALTY_LEVELS.find((item) => item.level === level) ?? LOYALTY_LEVELS[0];
}

/**
 * Считает ступень и, если нет ручной фиксации, возвращает пользователя с новым уровнем.
 * Исходный объект не мутирует.
 */
export function evaluateWholesaleLoyalty(user, allOrders, now = Date.now()) {
  const userOrders = wholesaleOrdersForUser(allOrders, user?.id);
  const auto = getAutoLoyaltyForOrders(userOrders, now);
  const totalKg = computeTotalKgFromOrders(userOrders);
  const isManual = !!user?.loyaltyLevelManualOverride || user?.role === "admin";
  const storedLevel = Number(user?.loyaltyLevel ?? 0);
  const appliedLevel = isManual ? storedLevel : applyDropByOne(storedLevel, auto.level);
  const appliedMeta = levelByNumber(appliedLevel);
  const appliedDiscount = isManual ? Number(user?.discount ?? 0) : appliedMeta.discount;
  const changed =
    !isManual &&
    (Number(user?.loyaltyLevel ?? 0) !== appliedLevel || Number(user?.discount ?? 0) !== appliedDiscount);
  const nextUser = changed
    ? {
        ...user,
        loyaltyLevel: appliedLevel,
        discount: appliedDiscount,
        loyaltyLevelSetDate: new Date(now).toISOString(),
      }
    : user;
  const nextLevel = LOYALTY_LEVELS.find((item) => item.level === appliedLevel + 1) ?? null;
  return {
    user: nextUser,
    changed,
    auto,
    totalKg,
    appliedLevel,
    appliedDiscount,
    isManual,
    nextLevel,
  };
}
