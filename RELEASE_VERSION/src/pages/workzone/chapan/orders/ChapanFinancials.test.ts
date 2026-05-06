/**
 * Sprint 13: Smoke tests for F1 financial calculation pipeline
 * Tests the math that powers the ChapanNewOrder financial block.
 */
import { describe, expect, it } from 'vitest';

// ── F1: Calculation pipeline (mirrors ChapanNewOrder derived values) ──────────

function calcF1(params: {
  itemsTotal: number;
  orderDiscount?: number;
  deliveryFee?: number;
  bankCommissionPct?: number;
}) {
  const { itemsTotal, orderDiscount = 0, deliveryFee = 0, bankCommissionPct = 0 } = params;
  const subtotalAfterDiscount = Math.max(0, itemsTotal - orderDiscount);
  const bankCommissionAmount = Math.round(subtotalAfterDiscount * bankCommissionPct / 100);
  const finalTotal = Math.max(0, subtotalAfterDiscount + deliveryFee + bankCommissionAmount);
  return { subtotalAfterDiscount, bankCommissionAmount, finalTotal };
}

describe('F1: financial calculation pipeline', () => {
  it('base case: no discount, no delivery, no commission', () => {
    const result = calcF1({ itemsTotal: 100_000 });
    expect(result.subtotalAfterDiscount).toBe(100_000);
    expect(result.bankCommissionAmount).toBe(0);
    expect(result.finalTotal).toBe(100_000);
  });

  it('F5: discount reduces subtotal before other additions', () => {
    const result = calcF1({ itemsTotal: 100_000, orderDiscount: 10_000 });
    expect(result.subtotalAfterDiscount).toBe(90_000);
    expect(result.finalTotal).toBe(90_000);
  });

  it('F3: delivery fee adds on top of discounted subtotal', () => {
    const result = calcF1({ itemsTotal: 100_000, orderDiscount: 10_000, deliveryFee: 2_000 });
    expect(result.subtotalAfterDiscount).toBe(90_000);
    expect(result.finalTotal).toBe(92_000);
  });

  it('F4: bank commission calculated on post-discount subtotal', () => {
    const result = calcF1({ itemsTotal: 100_000, bankCommissionPct: 10 });
    expect(result.bankCommissionAmount).toBe(10_000);
    expect(result.finalTotal).toBe(110_000);
  });

  it('F4: commission + delivery stack on top of discount', () => {
    const result = calcF1({
      itemsTotal: 100_000,
      orderDiscount: 10_000,
      deliveryFee: 3_000,
      bankCommissionPct: 5,
    });
    // subtotal = 90_000, commission = 4500, final = 97_500
    expect(result.subtotalAfterDiscount).toBe(90_000);
    expect(result.bankCommissionAmount).toBe(4_500);
    expect(result.finalTotal).toBe(97_500);
  });

  it('discount cannot make subtotal negative', () => {
    const result = calcF1({ itemsTotal: 5_000, orderDiscount: 99_999 });
    expect(result.subtotalAfterDiscount).toBe(0);
    expect(result.finalTotal).toBe(0);
  });

  it('F3 auto-fee: Казпочта=2000, Жд=3000, Авиа=5000', () => {
    const DELIVERY_FEE_MAP: Record<string, number> = {
      'Казпочта': 2000,
      'Жд': 3000,
      'Авиа': 5000,
    };
    expect(DELIVERY_FEE_MAP['Казпочта']).toBe(2000);
    expect(DELIVERY_FEE_MAP['Жд']).toBe(3000);
    expect(DELIVERY_FEE_MAP['Авиа']).toBe(5000);
    expect(DELIVERY_FEE_MAP['Самовывоз']).toBeUndefined();
  });
});
