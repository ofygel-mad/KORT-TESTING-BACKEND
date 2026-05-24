// ЧАСТЬ X / P2a — new-order form model: schema, types, draft persistence.
// Extracted verbatim from NewOrderPage.tsx — no behaviour change.

import { z } from 'zod';
import { calculateOrderFinancials } from '@/shared/lib/orderFinancials';
import { isKazakhPhoneComplete } from '@/shared/utils/kz';

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Payment methods ──────────────────────────────────────────────────────────
export type PaymentMethodValue = 'cash' | 'kaspi_terminal' | 'transfer' | 'halyk' | 'mixed';

// ─── Schemas ──────────────────────────────────────────────────────────────────
export const itemSchema = z.object({
  productName:  z.string().min(1, 'Укажите модель'),
  gender:       z.enum(['муж', 'жен', '']).optional(),
  length:       z.string().optional(),
  color:        z.string().optional(),
  // P5: size was required for the clothing profile. Made optional so non-
  // clothing templates (watches/chemicals/services) can omit it. Templates
  // that include `size` as a required field re-impose the requirement via
  // schema-driven validation at submit time.
  size:         z.string().optional().default(''),
  quantity:     z.coerce.number().int().min(1).max(10000, 'Подозрительно большое количество'),
  // Hard cap on unit price catches typo'd extra zeros (50000 → 5000000 → 50000000).
  // 5М ₸/ед is well above any plausible unit price; if a real product needs
  // more, raise the cap deliberately.
  unitPrice:    z.coerce.number().min(0).max(5_000_000, 'Цена слишком большая — проверьте, нет ли лишних нулей').optional().default(0),
  itemDiscount: z.coerce.number().min(0).optional().default(0),
  workshopNotes: z.string().optional(),
  // P5: schema-driven custom fields bag. Keys come from the active
  // OrderTemplate's items section (other than gender/color/length/size,
  // which dual-write to their dedicated columns). Persisted into
  // OrderItem.attributes on the server.
  customFields: z.record(z.string(), z.unknown()).optional().default({}),
});

export const schema = z
  .object({
    clientName:   z.string().min(2, 'Минимум 2 символа'),
    clientPhone:  z.string().optional().default(''),
    clientPhoneForeign: z.string().optional(),
    city:          z.string().optional(),
    streetAddress: z.string().optional(),
    postalCode:    z.string().optional(),
    deliveryType:  z.string().optional(),
    source:       z.string().optional(),
    urgency:      z.enum(['normal', 'urgent']).default('normal'),
    isDemandingClient: z.boolean().default(false),
    orderDate:    z.string(),
    dueDate:      z.string().optional(),
    orderDiscount: z.coerce.number().min(0).optional(),
    deliveryFee:   z.coerce.number().min(0).optional(),
    bankCommissionPercent: z.coerce.number().min(0).max(100).optional(),
    prepayment:   z.coerce.number().min(0).optional(),
    paymentMethod: z.enum(['cash', 'kaspi_terminal', 'transfer', 'halyk', 'mixed']).optional(),
    // Tolerate empty inputs / partial typing: drop blank keys before coercion so
    // RHF-registered Controllers that hold "" don't blow up zod with "received nan".
    paymentBreakdown: z
      .record(z.string(), z.union([z.string(), z.number(), z.null(), z.undefined()]))
      .optional()
      .transform((raw) => {
        if (!raw) return undefined;
        const cleaned: Record<string, number> = {};
        for (const [key, value] of Object.entries(raw)) {
          if (value === undefined || value === null || value === '') continue;
          const n = Number(value);
          if (!Number.isFinite(n) || n < 0) continue;
          cleaned[key] = n;
        }
        return Object.keys(cleaned).length > 0 ? cleaned : undefined;
      }),
    expectedPaymentMethod: z.string().optional(),
    items:        z.array(itemSchema).min(1, 'Добавьте хотя бы одну позицию'),
    managerNote:  z.string().optional(),
    // P5: client/order-level custom fields from the active OrderTemplate's
    // client section. Persisted into Order.extraAttributes.
    extraAttributes: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .superRefine((data, ctx) => {
    const hasKzPhone = isKazakhPhoneComplete(data.clientPhone ?? '');
    const hasForeignPhone = !!(data.clientPhoneForeign?.trim());
    if (!hasKzPhone && !hasForeignPhone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите казахстанский или иностранный номер', path: ['clientPhone'] });
    } else if ((data.clientPhone ?? '') && !hasKzPhone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Введите номер в формате +7 (777)-777-77-77', path: ['clientPhone'] });
    }

    const itemsSubtotal = data.items.reduce((sum, item) => {
      return sum + Math.max(0,
        (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) - (Number(item.itemDiscount) || 0),
      );
    }, 0);
    const financials = calculateOrderFinancials({
      itemsSubtotal,
      orderDiscount: data.orderDiscount,
      deliveryFee: data.deliveryFee,
      bankCommissionPercent: data.bankCommissionPercent,
    });
    const finalTotal = financials.totalDue;

    if ((data.prepayment ?? 0) > 0 && !data.paymentMethod) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите способ оплаты', path: ['paymentMethod'] });
    }

    if ((data.prepayment ?? 0) > finalTotal) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Предоплата не может превышать итоговую сумму', path: ['prepayment'] });
    }

    if (data.paymentMethod === 'mixed' && (data.prepayment ?? 0) > 0) {
      const mixedSum = Object.values(data.paymentBreakdown ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
      if (mixedSum > 0 && Math.abs(mixedSum - (data.prepayment ?? 0)) > 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Сумма разбивки должна совпадать с предоплатой', path: ['paymentBreakdown'] });
      }
    }
  });

export type FormData = z.infer<typeof schema>;

export function sanitizeDraft(data: Partial<FormData>): Partial<FormData> {
  return {
    ...data,
    items: (data.items ?? []).map((item) => ({
      ...item,
      workshopNotes: '',
    })),
  };
}

export function createEmptyItem(): FormData['items'][number] {
  return {
    productName: '',
    gender: '',
    length: '',
    color: '',
    size: '',
    quantity: 1,
    unitPrice: undefined,
    itemDiscount: undefined,
    workshopNotes: '',
    customFields: {},
  } as unknown as FormData['items'][number];
}

export function createEmptyFormDefaults(): Partial<FormData> {
  return {
    clientName: '',
    clientPhone: '',
    clientPhoneForeign: '',
    city: '',
    streetAddress: '',
    postalCode: '',
    deliveryType: '',
    source: '',
    urgency: 'normal',
    isDemandingClient: false,
    orderDate: todayIso(),
    dueDate: '',
    orderDiscount: undefined,
    deliveryFee: undefined,
    bankCommissionPercent: undefined,
    prepayment: undefined,
    paymentMethod: undefined,
    paymentBreakdown: undefined,
    expectedPaymentMethod: '',
    items: [createEmptyItem()],
    managerNote: '',
    extraAttributes: {},
  } as unknown as Partial<FormData>;
}

// ─── Draft autosave ───────────────────────────────────────────────────────────
export function draftKey(userId?: string) {
  return `kort_new_order_draft_${userId ?? 'guest'}`;
}

export function loadDraft(userId?: string): Partial<FormData> | null {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    return raw ? sanitizeDraft(JSON.parse(raw) as Partial<FormData>) : null;
  } catch {
    return null;
  }
}

export function saveDraft(data: Partial<FormData>, userId?: string) {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify(sanitizeDraft(data)));
  } catch { /* ignore */ }
}

export function clearDraft(userId?: string) {
  try {
    localStorage.removeItem(draftKey(userId));
  } catch { /* ignore */ }
}
