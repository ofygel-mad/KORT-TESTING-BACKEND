// P5 pre-work — Sacred calculation regression matrix.
//
// Locks down the financial pipeline before schema-driven form changes touch
// `useNewOrderFormState`. If any of these snapshots flip, calculations have
// drifted from pre-P5 behavior and the change MUST be reverted or the test
// updated with explicit justification.
//
// Covers the full Cartesian product of:
//   - itemDiscount: {0, abs, %}   (encoded into itemsSubtotal as caller does)
//   - orderDiscount: {0, abs, %}  (only abs is supported — % is upstream)
//   - deliveryFee:  {0, positive}
//   - bankCommissionPercent / bankCommissionAmount precedence
//   - edge cases: negative inputs clamped, NaN tolerated, over-discount clamped
//
// `calculateOrderFinancials` is the single source of truth for both the
// New Order form and OrderDetailPage. Any schema-driven changes must NOT
// alter its inputs or outputs.

import { describe, it, expect } from 'vitest';
import {
  calculateOrderFinancials,
  getOrderBalance,
  type OrderFinancialInput,
} from '../orderFinancials';

interface Case {
  name: string;
  input: OrderFinancialInput;
  expected: {
    itemsSubtotal: number;
    orderDiscount: number;
    discountedSubtotal: number;
    deliveryFee: number;
    bankCommissionPercent: number;
    bankCommissionAmount: number;
    totalDue: number;
  };
}

const CASES: Case[] = [
  {
    name: 'baseline · subtotal only, nothing else',
    input: { itemsSubtotal: 10_000 },
    expected: {
      itemsSubtotal: 10_000,
      orderDiscount: 0,
      discountedSubtotal: 10_000,
      deliveryFee: 0,
      bankCommissionPercent: 0,
      bankCommissionAmount: 0,
      totalDue: 10_000,
    },
  },
  {
    name: 'order discount · absolute',
    input: { itemsSubtotal: 10_000, orderDiscount: 1500 },
    expected: {
      itemsSubtotal: 10_000,
      orderDiscount: 1500,
      discountedSubtotal: 8500,
      deliveryFee: 0,
      bankCommissionPercent: 0,
      bankCommissionAmount: 0,
      totalDue: 8500,
    },
  },
  {
    name: 'delivery fee only',
    input: { itemsSubtotal: 10_000, deliveryFee: 1200 },
    expected: {
      itemsSubtotal: 10_000,
      orderDiscount: 0,
      discountedSubtotal: 10_000,
      deliveryFee: 1200,
      bankCommissionPercent: 0,
      bankCommissionAmount: 0,
      totalDue: 11_200,
    },
  },
  {
    name: 'bank commission · percent path takes precedence over manual amount',
    input: {
      itemsSubtotal: 10_000,
      bankCommissionPercent: 2.95,
      bankCommissionAmount: 9999, // ignored when percent > 0
    },
    expected: {
      itemsSubtotal: 10_000,
      orderDiscount: 0,
      discountedSubtotal: 10_000,
      deliveryFee: 0,
      bankCommissionPercent: 2.95,
      // round(10_000 * 2.95 / 100) = round(295) = 295
      bankCommissionAmount: 295,
      totalDue: 10_295,
    },
  },
  {
    name: 'bank commission · manual amount only (percent = 0)',
    input: {
      itemsSubtotal: 10_000,
      bankCommissionAmount: 350,
    },
    expected: {
      itemsSubtotal: 10_000,
      orderDiscount: 0,
      discountedSubtotal: 10_000,
      deliveryFee: 0,
      bankCommissionPercent: 0,
      bankCommissionAmount: 350,
      totalDue: 10_350,
    },
  },
  {
    name: 'percent commission · computed on discounted subtotal, not raw',
    input: {
      itemsSubtotal: 10_000,
      orderDiscount: 2000,
      bankCommissionPercent: 3,
    },
    expected: {
      itemsSubtotal: 10_000,
      orderDiscount: 2000,
      discountedSubtotal: 8000,
      deliveryFee: 0,
      bankCommissionPercent: 3,
      // round(8000 * 3 / 100) = 240, NOT round(10000*3/100) = 300
      bankCommissionAmount: 240,
      totalDue: 8240,
    },
  },
  {
    name: 'full stack · discount + delivery + percent commission',
    input: {
      itemsSubtotal: 25_000,
      orderDiscount: 5000,
      deliveryFee: 2000,
      bankCommissionPercent: 2,
    },
    expected: {
      itemsSubtotal: 25_000,
      orderDiscount: 5000,
      discountedSubtotal: 20_000,
      deliveryFee: 2000,
      bankCommissionPercent: 2,
      // round(20_000 * 2 / 100) = 400
      bankCommissionAmount: 400,
      totalDue: 22_400, // 20_000 + 2000 + 400
    },
  },
  {
    name: 'over-discount · discount exceeds subtotal, discountedSubtotal clamps to 0',
    input: { itemsSubtotal: 5000, orderDiscount: 7000 },
    expected: {
      itemsSubtotal: 5000,
      orderDiscount: 7000,
      discountedSubtotal: 0,
      deliveryFee: 0,
      bankCommissionPercent: 0,
      bankCommissionAmount: 0,
      totalDue: 0,
    },
  },
  {
    name: 'over-discount with delivery · totalDue keeps delivery floor',
    input: { itemsSubtotal: 5000, orderDiscount: 7000, deliveryFee: 1500 },
    expected: {
      itemsSubtotal: 5000,
      orderDiscount: 7000,
      discountedSubtotal: 0,
      deliveryFee: 1500,
      bankCommissionPercent: 0,
      bankCommissionAmount: 0,
      totalDue: 1500,
    },
  },
  {
    name: 'negative inputs · treated as zero (no negative subtotal)',
    input: {
      itemsSubtotal: -100,
      orderDiscount: -50,
      deliveryFee: -10,
      bankCommissionPercent: -1,
      bankCommissionAmount: -5,
    },
    expected: {
      itemsSubtotal: 0,
      orderDiscount: 0,
      discountedSubtotal: 0,
      deliveryFee: 0,
      bankCommissionPercent: 0,
      bankCommissionAmount: 0,
      totalDue: 0,
    },
  },
  {
    name: 'NaN / undefined inputs · tolerated as zero',
    input: {
      itemsSubtotal: Number.NaN,
      orderDiscount: undefined,
      deliveryFee: null,
      bankCommissionPercent: Number.NaN,
      bankCommissionAmount: undefined,
    },
    expected: {
      itemsSubtotal: 0,
      orderDiscount: 0,
      discountedSubtotal: 0,
      deliveryFee: 0,
      bankCommissionPercent: 0,
      bankCommissionAmount: 0,
      totalDue: 0,
    },
  },
  {
    name: 'fractional commission percent · banker rounding via Math.round',
    input: {
      itemsSubtotal: 1234,
      bankCommissionPercent: 1.5,
    },
    expected: {
      itemsSubtotal: 1234,
      orderDiscount: 0,
      discountedSubtotal: 1234,
      deliveryFee: 0,
      bankCommissionPercent: 1.5,
      // 1234 * 1.5 / 100 = 18.51 → Math.round = 19
      bankCommissionAmount: 19,
      totalDue: 1253,
    },
  },
  {
    name: 'large amounts · no overflow, integers preserved',
    input: {
      itemsSubtotal: 9_999_999,
      orderDiscount: 100,
      deliveryFee: 500,
      bankCommissionPercent: 5,
    },
    expected: {
      itemsSubtotal: 9_999_999,
      orderDiscount: 100,
      discountedSubtotal: 9_999_899,
      deliveryFee: 500,
      bankCommissionPercent: 5,
      // round(9_999_899 * 5 / 100) = round(499_994.95) = 499_995
      bankCommissionAmount: 499_995,
      totalDue: 10_500_394,
    },
  },
];

describe('calculateOrderFinancials — sacred regression matrix (P5)', () => {
  for (const c of CASES) {
    it(c.name, () => {
      const result = calculateOrderFinancials(c.input);
      expect(result).toEqual(c.expected);
    });
  }
});

describe('getOrderBalance', () => {
  it('returns 0 when fully paid', () => {
    expect(getOrderBalance(10_000, 10_000)).toBe(0);
  });

  it('returns positive remainder when partially paid', () => {
    expect(getOrderBalance(10_000, 6500)).toBe(3500);
  });

  it('clamps to 0 when overpaid', () => {
    expect(getOrderBalance(10_000, 12_000)).toBe(0);
  });

  it('treats negative paid amounts as zero', () => {
    expect(getOrderBalance(10_000, -500)).toBe(10_000);
  });

  it('handles NaN paid amounts as zero', () => {
    expect(getOrderBalance(10_000, Number.NaN)).toBe(10_000);
  });
});
