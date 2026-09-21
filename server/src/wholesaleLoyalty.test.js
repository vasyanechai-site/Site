import test from "node:test";
import assert from "node:assert/strict";
import {
  MS_PER_DAY,
  applyDropByOne,
  evaluateWholesaleLoyalty,
  getAutoLoyaltyForOrders,
  hasNoLargeGap,
} from "./wholesaleLoyalty.js";

const NOW = Date.parse("2026-09-21T12:00:00.000Z");

function order(daysAgo, id = "user-1") {
  return {
    userId: id,
    orderType: "wholesale",
    date: new Date(NOW - daysAgo * MS_PER_DAY).toISOString(),
    items: [{ type: "grain", kg: 1, packs200: 0 }],
  };
}

test("4 заказа за 90 дней дают ступень 1 и скидку 5%", () => {
  const orders = [10, 20, 40, 80].map((days) => order(days));
  const auto = getAutoLoyaltyForOrders(orders, NOW);
  assert.equal(auto.level, 1);
  assert.equal(auto.discount, 5);
  assert.equal(auto.ordersIn3Mo, 4);
});

test("3 заказа за 90 дней остаются на ступени 0", () => {
  const auto = getAutoLoyaltyForOrders([10, 20, 40].map((days) => order(days)), NOW);
  assert.equal(auto.level, 0);
  assert.equal(auto.ordersIn3Mo, 3);
});

test("8 заказов за 180 дней без длинного перерыва дают ступень 2", () => {
  const orders = [5, 20, 40, 60, 80, 100, 120, 150].map((days) => order(days));
  const auto = getAutoLoyaltyForOrders(orders, NOW);
  assert.equal(auto.level, 2);
  assert.equal(auto.discount, 7);
  assert.equal(hasNoLargeGap(orders, 45), true);
});

test("перерыв больше 45 дней не даёт ступень 2", () => {
  const orders = [5, 10, 20, 30, 40, 50, 60, 120].map((days) => order(days));
  const auto = getAutoLoyaltyForOrders(orders, NOW);
  assert.equal(auto.level, 1);
  assert.equal(auto.ordersIn6Mo, 8);
});

test("12 заказов за год без перерыва больше 40 дней дают ступень 3", () => {
  const days = [5, 20, 40, 60, 80, 100, 120, 150, 180, 210, 240, 270];
  const auto = getAutoLoyaltyForOrders(days.map((d) => order(d)), NOW);
  assert.equal(auto.level, 3);
  assert.equal(auto.discount, 10);
});

test("перерыв больше 40 дней не даёт ступень 3, но ступень 2 сохраняется", () => {
  const days = [5, 25, 45, 65, 85, 105, 125, 145, 200, 250, 300, 350];
  const auto = getAutoLoyaltyForOrders(days.map((d) => order(d)), NOW);
  assert.equal(auto.ordersIn6Mo, 8);
  assert.equal(auto.ordersIn12Mo, 12);
  assert.equal(auto.level, 2);
});

test("снижение не больше чем на одну ступень, рост сразу", () => {
  assert.equal(applyDropByOne(3, 0), 2);
  assert.equal(applyDropByOne(0, 3), 3);
  assert.equal(applyDropByOne(2, 2), 2);
});

test("новый заказ существующего клиента поднимает ступень", () => {
  const history = [10, 30, 50].map((days) => order(days));
  const before = evaluateWholesaleLoyalty({ id: "user-1", loyaltyLevel: 0, discount: 0 }, history, NOW);
  assert.equal(before.appliedLevel, 0);
  const after = evaluateWholesaleLoyalty(
    { id: "user-1", loyaltyLevel: 0, discount: 0 },
    [...history, order(1)],
    NOW,
  );
  assert.equal(after.appliedLevel, 1);
  assert.equal(after.appliedDiscount, 5);
  assert.equal(after.changed, true);
  assert.equal(after.auto.ordersIn3Mo, 4);
});

test("ручная фиксация не меняет уровень и скидку", () => {
  const orders = [5, 20, 40, 60, 80, 100, 120, 150].map((days) => order(days));
  const result = evaluateWholesaleLoyalty(
    { id: "user-1", loyaltyLevel: 1, discount: 5, loyaltyLevelManualOverride: true },
    orders,
    NOW,
  );
  assert.equal(result.appliedLevel, 1);
  assert.equal(result.appliedDiscount, 5);
  assert.equal(result.changed, false);
  assert.equal(result.isManual, true);
  assert.equal(result.auto.level, 2);
  assert.equal(result.auto.ordersIn6Mo, 8);
});

test("чужие и розничные заказы не учитываются", () => {
  const orders = [
    order(1, "user-1"),
    order(2, "user-2"),
    { ...order(3, "user-1"), orderType: "retail" },
  ];
  const result = evaluateWholesaleLoyalty({ id: "user-1", loyaltyLevel: 0, discount: 0 }, orders, NOW);
  assert.equal(result.auto.ordersIn3Mo, 1);
  assert.equal(result.appliedLevel, 0);
});
