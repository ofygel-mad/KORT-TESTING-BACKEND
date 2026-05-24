// ЧАСТЬ X / P2a — all new-order form logic, lifted verbatim out of the
// NewOrderPage component body into a hook. No behaviour change: the hook runs
// the exact same hooks/effects/derivations in the same order and returns them
// for the page shell + the block components (via NewOrderFormContext).

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateOrder, useOperationsCatalogs, useOperationsSettings, useUpdateBankCommission } from '@/entities/order/queries';
import { useAuthStore } from '@/shared/stores/auth';
import { useProductsAvailability, useVariantAvailability, useOrderFormCatalog, useCatalogDefinitions } from '@/entities/warehouse/queries';
import type { OrderFormField } from '@/entities/warehouse/types';
import { attachmentsApi } from '@/entities/order/api';
import type { Urgency } from '@/entities/order/types';
import {
  buildDeliveryOptions,
  buildMixedBreakdownRows,
  buildPaymentMethodOptions,
  buildSizeCatalog,
} from '@/shared/lib/productCatalogDefaults';
import { calculateOrderFinancials } from '@/shared/lib/orderFinancials';
import type { SearchableSelectOption } from '@/shared/ui/SearchableSelect';
import { formatPersonNameInput } from '@/shared/utils/person';
import { formatKazakhPhoneInput } from '@/shared/utils/kz';
import { buildVariantAvailabilityInput, type VariantAvailabilityInput } from '@/shared/utils/variantAvailability';
import {
  schema,
  createEmptyFormDefaults,
  clearDraft,
  loadDraft,
  saveDraft,
  type FormData,
} from './formModel';
import { buildPayloadItems } from './formHelpers';

export function useNewOrderFormState() {
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();
  const isWholesale = searchParams.get('type') === 'wholesale';
  const createOrder = useCreateOrder();
  const { data: catalogs } = useOperationsCatalogs();
  const { data: profile } = useOperationsSettings();
  const updateBankCommission = useUpdateBankCommission();

  const [discountPercent, setDiscountPercent] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [bankCommissionPrefilled, setBankCommissionPrefilled] = useState(false);
  // P5/Stage1: user-pickable template id. When null, useActiveOrderTemplate
  // falls back to the system "Clothing" default. Sent to the server on submit
  // so the order persists with this template association.
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // File state — UI selection only; server upload endpoint not yet implemented.
  // receiptFileNames sends file names to order metadata; actual bytes are not persisted yet.
  const [itemPhotos, setItemPhotos] = useState<Record<number, File | null>>({});
  const [receipts, setReceipts]     = useState<File[]>([]);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const userId = useAuthStore((s) => s.user?.id);
  const savedDraft = useRef(loadDraft(userId));

  const {
    register, control, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: savedDraft.current ?? createEmptyFormDefaults(),
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Draft autosave — дебаунс 800 мс, не сохраняем пустой стартовый стейт
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveEnabledRef = useRef(true);
  // Autosave: subscribe to form changes via watch callback (RHF v7 pattern)
  // Avoids JSON.stringify(watch()) in dep array which re-renders on every keystroke
  useEffect(() => {
    const { unsubscribe } = watch((snapshot) => {
      if (!autosaveEnabledRef.current) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        const isEmpty =
          !snapshot.clientName &&
          !snapshot.clientPhone &&
          (snapshot.items ?? []).every((i) => !i?.productName && !i?.size);
        if (!isEmpty) saveDraft(snapshot as Partial<FormData>, userId);
      }, 800);
    });
    return () => {
      unsubscribe();
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [watch, userId]);

  const deliveryType          = watch('deliveryType');
  const deliveryFeeRaw        = watch('deliveryFee');
  const bankCommissionPctRaw  = watch('bankCommissionPercent');

  const deliveryFeeMap: Record<string, number> = {
    'Казпочта': profile?.kazpostDeliveryFee ?? 2000,
    'Жд':       profile?.railDeliveryFee    ?? 3000,
    'Авиа':     profile?.airDeliveryFee     ?? 5000,
  };

  // F3: Автоматически проставляем сумму доставки при выборе типа
  useEffect(() => {
    const autoFee = deliveryFeeMap[deliveryType ?? ''];
    if (autoFee !== undefined && deliveryFeeRaw == null && !dirtyFields.deliveryFee) {
      setValue('deliveryFee', autoFee, { shouldDirty: false, shouldTouch: false });
    }
  }, [deliveryType, deliveryFeeRaw, dirtyFields.deliveryFee, profile?.kazpostDeliveryFee, profile?.railDeliveryFee, profile?.airDeliveryFee, setValue]);

  // Авто-подстановка глобальной ставки комиссии если поле пустое
  useEffect(() => {
    if (
      profile?.bankCommissionPercent != null
      && bankCommissionPctRaw == null
      && !dirtyFields.bankCommissionPercent
      && !bankCommissionPrefilled
    ) {
      setValue('bankCommissionPercent', profile.bankCommissionPercent, { shouldDirty: false, shouldTouch: false });
      setBankCommissionPrefilled(true);
    }
  }, [bankCommissionPctRaw, bankCommissionPrefilled, dirtyFields.bankCommissionPercent, profile?.bankCommissionPercent, setValue]);

  // Показываем тост один раз, если черновик был восстановлен
  useEffect(() => {
    if (savedDraft.current && !draftRestored) {
      setDraftRestored(true);
    }
  }, []);

  // Derived values
  const items            = watch('items');
  const urgency          = watch('urgency');
  const isDemandingClient = watch('isDemandingClient');
  const { data: orderFormCatalog } = useOrderFormCatalog();
  const { data: fieldDefinitions } = useCatalogDefinitions();
  const warehouseProductMap = useMemo<Record<string, OrderFormField[]>>(() => {
    const map: Record<string, OrderFormField[]> = {};
    for (const product of orderFormCatalog?.products ?? []) {
      map[product.name] = product.fields;
    }
    return map;
  }, [orderFormCatalog]);
  const deferredProductNames = useDeferredValue(
    items.map((i) => i.productName).filter(Boolean),
  );
  const availabilityVariants = items
    .map((item) => buildVariantAvailabilityInput(
      item.productName?.trim() ?? '',
      item,
      getEffectiveFields(item.productName?.trim() ?? ''),
    ))
    .filter((variant): variant is VariantAvailabilityInput => Boolean(variant));
  const { data: stockMap } = useProductsAvailability(deferredProductNames);
  const { data: variantMap } = useVariantAvailability(availabilityVariants);

  // True if any catalog-registered item with variant axes hasn't filled them all —
  // submit must wait. Free-text product names (not in warehouseProductMap) are skipped:
  // the warehouse can't validate them, so the manager keeps full agency.
  const hasIncompleteVariantLines = useMemo(() => {
    for (const item of items) {
      if (!item?.productName?.trim()) continue;
      const fields = warehouseProductMap[item.productName.trim()];
      if (!fields) continue;
      const required = fields.filter((f) => f.affectsAvailability);
      if (required.length === 0) continue;
      const incomplete = required.some((f) => {
        const value = (item as Record<string, unknown>)[f.code];
        return !value || (typeof value === 'string' && !value.trim());
      });
      if (incomplete) return true;
    }
    return false;
  }, [items, warehouseProductMap]);
  const paymentMethod    = watch('paymentMethod');
  const orderDiscountRaw = watch('orderDiscount');
  const prepaymentRaw    = watch('prepayment');
  const paymentBreakdownWatch = watch('paymentBreakdown');

  const itemsTotal = items.reduce((sum, item) => {
    const line = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    return sum + Math.max(0, line - (Number(item.itemDiscount) || 0));
  }, 0);

  const orderDiscount       = Number.isFinite(orderDiscountRaw)       ? (orderDiscountRaw       ?? 0) : 0;
  const prepayment          = Number.isFinite(prepaymentRaw)          ? (prepaymentRaw          ?? 0) : 0;
  const deliveryFee         = Number.isFinite(deliveryFeeRaw)         ? (deliveryFeeRaw         ?? 0) : 0;
  const bankCommissionPct   = Number.isFinite(bankCommissionPctRaw)   ? (bankCommissionPctRaw   ?? 0) : 0;

  // F1: правильный порядок вычислений
  const financials = calculateOrderFinancials({
    itemsSubtotal: itemsTotal,
    orderDiscount,
    deliveryFee,
    bankCommissionPercent: bankCommissionPct,
  });
  const bankCommissionAmount  = financials.bankCommissionAmount;
  const finalTotal            = financials.totalDue;
  const debt                  = Math.max(0, finalTotal - prepayment);
  const mixedSum = Object.values(paymentBreakdownWatch ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);

  function fmt(n: number) {
    return `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n)} ₸`;
  }

  // Stable idempotency key: generated once per form mount, reused on retries,
  // rotated only after a successful submission to allow creating another order.
  const idemKeyRef = useRef(crypto.randomUUID());

  function stopDraftAutosave() {
    autosaveEnabledRef.current = false;
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
  }

  function resetDraftState() {
    stopDraftAutosave();
    clearDraft(userId);
    savedDraft.current = null;
    reset(createEmptyFormDefaults());
    // Explicitly clear nested paymentBreakdown subkeys: reset() with paymentBreakdown=undefined
    // does NOT walk into already-registered child fields like paymentBreakdown.cash.
    setValue('paymentBreakdown', {} as FormData['paymentBreakdown']);
    setDiscountPercent('');
    setEditingRate(false);
    setRateInput('');
    setItemPhotos({});
    setReceipts([]);
    if (receiptInputRef.current) {
      receiptInputRef.current.value = '';
    }
    setDraftRestored(false);
    // Keep prefill flag TRUE so the bankCommissionPercent autoeffect doesn't
    // immediately repopulate the field from profile after the user explicitly
    // asked to clear the draft. Same goes for the deliveryFee autoeffect —
    // it depends on deliveryType which is now '' so it's already inert.
    setBankCommissionPrefilled(true);
    autosaveEnabledRef.current = true;
  }

  // Surface zod/RHF validation failures so a "dead" submit button always tells
  // the user (and the console) what's wrong instead of silently doing nothing.
  function onValidationError(formErrors: Record<string, unknown>) {
    const flat: string[] = [];
    const walk = (node: unknown, path: string[]) => {
      if (!node || typeof node !== 'object') return;
      if ('message' in (node as Record<string, unknown>) && typeof (node as { message?: unknown }).message === 'string') {
        flat.push(`${path.join('.') || '(form)'}: ${(node as { message: string }).message}`);
      }
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        if (key === 'message' || key === 'type' || key === 'ref') continue;
        walk(val, [...path, key]);
      }
    };
    walk(formErrors, []);
    console.warn('[NewOrderPage] form validation failed:', formErrors);
    if (flat.length > 0) {
      toast.error(`Проверьте поля: ${flat.slice(0, 3).join('; ')}${flat.length > 3 ? `; +${flat.length - 3} ещё` : ''}`);
    } else {
      toast.error('Форма заполнена некорректно');
    }
  }

  async function onSubmit(data: FormData) {
    // Block creation only when a CATALOG-REGISTERED variant-bearing line has incomplete axes.
    // Free-text product names are not validated here — warehouse has no SKU to match against.
    const incompleteLines: number[] = [];
    for (let i = 0; i < data.items.length; i += 1) {
      const item = data.items[i];
      if (!item?.productName?.trim()) continue;
      const fields = warehouseProductMap[item.productName.trim()];
      if (!fields) continue;
      const required = fields.filter((f) => f.affectsAvailability);
      if (required.length === 0) continue;
      const missing = required.filter((f) => {
        const value = (item as Record<string, unknown>)[f.code];
        return !value || (typeof value === 'string' && !value.trim());
      });
      if (missing.length > 0) incompleteLines.push(i + 1);
    }
    if (incompleteLines.length > 0) {
      toast.error(`Заполните параметры (цвет, размер, длина, пол) для позиций: ${incompleteLines.join(', ')}`);
      return;
    }

    const hasPrepayment = (data.prepayment ?? 0) > 0;
    const isMixed = data.paymentMethod === 'mixed';
    const payloadItems = buildPayloadItems(data.items);

    let created;
    try {
      created = await createOrder.mutateAsync({
        idempotencyKey: idemKeyRef.current,
        clientName:    formatPersonNameInput(data.clientName).trim(),
        clientPhone:   data.clientPhone ? formatKazakhPhoneInput(data.clientPhone) : '',
        clientPhoneForeign: data.clientPhoneForeign?.trim() || undefined,
        streetAddress: data.streetAddress?.trim() || undefined,
        city:          data.city?.trim() || undefined,
        deliveryType:  data.deliveryType?.trim() || undefined,
        source:        data.source?.trim() || undefined,
        expectedPaymentMethod: data.expectedPaymentMethod?.trim() || undefined,
        priority:      data.urgency === 'urgent' ? 'urgent' : data.isDemandingClient ? 'vip' : 'normal',
        urgency:       data.urgency as Urgency,
        isDemandingClient: data.isDemandingClient,
        postalCode:    data.postalCode?.trim() || undefined,
        orderDate:     data.orderDate || undefined,
        orderDiscount: orderDiscount > 0 ? orderDiscount : undefined,
        deliveryFee:   deliveryFee > 0 ? deliveryFee : undefined,
        bankCommissionPercent: bankCommissionPct > 0 ? bankCommissionPct : undefined,
        bankCommissionAmount:  bankCommissionAmount > 0 ? bankCommissionAmount : undefined,
        dueDate:       data.dueDate   || undefined,
        prepayment:       hasPrepayment ? data.prepayment : undefined,
        paymentMethod:    hasPrepayment ? data.paymentMethod : undefined,
        paymentBreakdown: hasPrepayment && isMixed
          ? Object.fromEntries(Object.entries(data.paymentBreakdown ?? {}).filter(([, v]) => Number(v) > 0))
          : undefined,
        items: payloadItems,
        managerNote: data.managerNote?.trim() || undefined,
        customerType: isWholesale ? 'wholesale' : 'retail',
        // P5/Stage1: persist the user-selected template; server falls back to
        // the org default when null.
        templateId: selectedTemplateId ?? undefined,
      });
    } catch {
      return;
    }

    if (receipts.length > 0 && created?.id) {
      for (const file of receipts) {
        try {
          await attachmentsApi.upload(created.id, file);
        } catch {
          // non-blocking: order already saved, file upload failure is recoverable
        }
      }
    }

    // Rotate the key so the next order from this session gets its own unique key
    idemKeyRef.current = crypto.randomUUID();
    resetDraftState();
    navigate('/sales');
  }

  const products             = catalogs?.productCatalog ?? [];
  const catalogPaymentMethods = catalogs?.paymentMethodCatalog ?? [];
  const activePaymentMethods  = buildPaymentMethodOptions(catalogPaymentMethods)
    .filter((method) => method.value !== 'kaspi_qr');
  const mixedBreakdownRows    = buildMixedBreakdownRows(catalogPaymentMethods)
    .filter((method) => method.value !== 'kaspi_qr');
  const sizeOptions           = buildSizeCatalog(catalogs?.sizeCatalog ?? []);
  const deliveryOptions       = buildDeliveryOptions();

  useEffect(() => {
    // Guard against stale local drafts created before Kaspi QR was removed.
    if ((paymentMethod as string | undefined) === 'kaspi_qr') {
      setValue('paymentMethod', undefined);
    }
    if (paymentBreakdownWatch?.kaspi_qr !== undefined) {
      setValue('paymentBreakdown.kaspi_qr', undefined);
    }
  }, [paymentMethod, paymentBreakdownWatch?.kaspi_qr, setValue]);

  const warehouseProductNames = Object.keys(warehouseProductMap);
  // Merged product list: sales catalog + warehouse catalog (deduped)
  const allProductNames = [...new Set([...products, ...warehouseProductNames])];
  const enrichedProductOptions: SearchableSelectOption[] = allProductNames.map(name => ({ value: name }));

  // Global color options from warehouse field definitions (fallback when product has no linked color field)
  const globalWarehouseColors = fieldDefinitions?.find(d => d.code === 'color')?.options.map(o => o.label) ?? [];
  // Global length options from warehouse field definitions (single source of truth)
  const globalWarehouseLengths = fieldDefinitions?.find(d => d.code === 'length')?.options.map(o => o.label) ?? [];

  // When a product has no per-product order form config, fall back to global field definitions
  // so that non-axis fields like gender are correctly excluded from the variant lookup key.
  function getEffectiveFields(productName: string) {
    return warehouseProductMap[productName?.trim() ?? '']
      ?? fieldDefinitions?.map(def => ({
          code: def.code,
          label: def.label,
          inputType: def.inputType,
          isRequired: false as const,
          affectsAvailability: def.affectsAvailability,
          options: [] as Array<{ value: string; label: string }>,
        }));
  }

  function getAvailabilityInput(item?: FormData['items'][number]) {
    if (!item?.productName?.trim()) return null;
    return buildVariantAvailabilityInput(
      item.productName.trim(),
      item,
      getEffectiveFields(item.productName.trim()),
    );
  }

  function getMissingAxes(item?: FormData['items'][number]): OrderFormField[] {
    if (!item?.productName?.trim()) return [];
    // Submit-gate only applies to products registered in the warehouse catalog.
    // Free-text product names (not in warehouseProductMap) skip variant validation —
    // there's nothing to look up against, so the manager owns the choice.
    const fields = warehouseProductMap[item.productName.trim()];
    if (!fields) return [];
    const required = fields.filter((f) => f.affectsAvailability);
    return required.filter((f) => {
      const value = (item as Record<string, unknown>)[f.code];
      return !value || (typeof value === 'string' && !value.trim());
    });
  }
  // Helper: get catalog options for a field code given current productName
  function getCatalogOptions(productName: string, code: string): string[] {
    const fields = warehouseProductMap[productName];
    if (!fields) return [];
    const field = fields.find((f) => f.code === code);
    return field?.options.map((o) => o.label) ?? [];
  }

  return {
    // form core
    control, register, setValue, errors, handleSubmit, isSubmitting,
    fields, append, remove,
    // mode + navigation + submit
    isWholesale, navigate, createOrder, onSubmit, onValidationError,
    hasIncompleteVariantLines,
    // draft
    draftRestored, resetDraftState,
    // watched values
    items, urgency, isDemandingClient, paymentMethod, prepaymentRaw,
    // derived financials
    itemsTotal, finalTotal, debt, bankCommissionAmount, bankCommissionPct, prepayment, mixedSum,
    // catalogs
    deliveryOptions, enrichedProductOptions, sizeOptions, activePaymentMethods,
    mixedBreakdownRows, globalWarehouseColors, globalWarehouseLengths,
    // warehouse availability
    stockMap, variantMap,
    // helpers
    getEffectiveFields, getAvailabilityInput, getMissingAxes, getCatalogOptions, fmt,
    // file + ui state
    itemPhotos, setItemPhotos, receipts, setReceipts, receiptInputRef,
    discountPercent, setDiscountPercent, editingRate, setEditingRate, rateInput, setRateInput,
    updateBankCommission,
    // P5/Stage1: template picker state
    selectedTemplateId, setSelectedTemplateId,
  };
}

export type NewOrderFormState = ReturnType<typeof useNewOrderFormState>;
