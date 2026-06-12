/**
 * Единицы измерения оптовых позиций.
 *
 * Для дрипов: kg = количество упаковок (в упаковке DRIP_PACK_UNITS шт),
 * packs200 = одиночные штуки. 1 дрип-пакет весит 12 г.
 */

export const DRIP_PACK_UNITS = 10;
export const DRIP_UNIT_WEIGHT_KG = 0.012; // 12 г
export const DRIP_PACK_WEIGHT_KG = DRIP_PACK_UNITS * DRIP_UNIT_WEIGHT_KG; // 120 г

interface WholesaleQuantities {
  type?: string;
  kg: number;
  packs200: number;
}

/** Вес позиции в кг (колд брю в весе не учитывается). */
export function wholesaleItemWeightKg(item: WholesaleQuantities): number {
  const kg = Number(item.kg) || 0;
  const packs200 = Number(item.packs200) || 0;
  if (item.type === 'coldbrew') return 0;
  if (item.type === 'drip') return kg * DRIP_PACK_WEIGHT_KG + packs200 * DRIP_UNIT_WEIGHT_KG;
  return kg + packs200 * 0.2;
}

/** Текст количества для позиции: «2 кг, 1 × 200 г» / «1 упак. (10 шт.), 2 шт.» / «3 × 5 л». */
export function formatWholesaleItemQuantity(item: WholesaleQuantities): string {
  const kg = Number(item.kg) || 0;
  const packs200 = Number(item.packs200) || 0;
  if (item.type === 'coldbrew') return `${kg} × 5 л`;
  const parts: string[] = [];
  if (item.type === 'drip') {
    if (kg > 0) parts.push(`${kg} упак. (${DRIP_PACK_UNITS} шт.)`);
    if (packs200 > 0) parts.push(`${packs200} шт.`);
  } else {
    if (kg > 0) parts.push(`${kg} кг`);
    if (packs200 > 0) parts.push(`${packs200} × 200 г`);
  }
  return parts.join(', ');
}
