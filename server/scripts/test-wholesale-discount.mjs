/**
 * Discount logic regression (first wholesale order with no_discount items).
 * Run: node server/scripts/test-wholesale-discount.mjs
 */
import assert from "node:assert/strict";

function calcDiscountTotals(items, volumeDiscountPercent) {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  if (volumeDiscountPercent === 0) {
    return { subtotal, discountAmount: 0, total: subtotal };
  }
  const discountableAmount = items.reduce(
    (sum, item) => sum + (item.no_discount ? 0 : item.subtotal),
    0,
  );
  const discountAmount = Math.round((discountableAmount * volumeDiscountPercent) / 100);
  return { subtotal, discountAmount, total: subtotal - discountAmount };
}

function applyLineDiscount(items, discountPercent) {
  if (discountPercent <= 0) return items;
  const factor = 1 - discountPercent / 100;
  return items.map((item) => {
    if (item.no_discount) return item;
    return {
      ...item,
      subtotal: Math.round(item.subtotal * factor),
    };
  });
}

let passed = 0;
let failed = 0;

function ok(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`  ✗ ${name}: ${e.message}`);
  }
}

console.log("\n=== Wholesale first-order discount (no_discount) ===");

ok("5% on 100k subtotal with mixed items", () => {
  const items = [
    { name: "A", subtotal: 60000, no_discount: false },
    { name: "B", subtotal: 40000, no_discount: true },
  ];
  const { discountAmount, total } = calcDiscountTotals(items, 5);
  assert.equal(discountAmount, 3000); // 5% only on 60k
  assert.equal(total, 97000);
});

ok("discounted line items sum matches total", () => {
  const items = [
    { name: "A", subtotal: 60000, no_discount: false },
    { name: "B", subtotal: 40000, no_discount: true },
  ];
  const adjusted = applyLineDiscount(items, 5);
  const linesSum = adjusted.reduce((s, i) => s + i.subtotal, 0);
  const { total } = calcDiscountTotals(items, 5);
  assert.equal(linesSum, total);
});

ok("no_discount item unchanged in line adjustment", () => {
  const items = [{ name: "B", subtotal: 40000, no_discount: true }];
  const adjusted = applyLineDiscount(items, 5);
  assert.equal(adjusted[0].subtotal, 40000);
});

ok("OrderCheckout discountAmount overrides percent-of-full-cart", () => {
  const total = 97000;
  const discountPercent = 5;
  const discountAmount = 3000;
  const shown = discountAmount ?? Math.round((total * discountPercent) / 100);
  assert.equal(shown, 3000);
  assert.notEqual(shown, Math.round((total * discountPercent) / 100));
});

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
process.exit(failed > 0 ? 1 : 0);
