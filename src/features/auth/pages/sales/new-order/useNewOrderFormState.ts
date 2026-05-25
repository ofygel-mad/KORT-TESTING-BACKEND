// ЧАСТЬ X / P2a — all new-order form logic, lifted verbatim out of the
// NewOrderPage component body into a hook. No behaviour change: the hook runs
// the exact same hooks/effects/derivations in the same order and returns them
// for the page shell + the block components (via NewOrderFormContext).

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateOrder, useOperationsCatalogs, useOperationsSettings, useUpdateBankCommission } from '@/entities/order/queries';
import { useAuthStore } from '@/shared/stores/auth';
import { useProductsAvailability, useVariantAvailability, useOrderFormCatalog, useCatalogDefinitions } from '@/entities/warehouse/queries';
import type { OrderFormField, OrderFormProduct } from '@/entities/warehouse/types';
import { attachmentsApi } from '@/entities/order/api';
import type { Urgency } from '@/entities/order/types';
import { useActiveOrderTemplate } from '@/entities/order/templatesApi';
import { getItemsSection } from '@/entities/order/templates';
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

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });

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
  // P5: active OrderTemplate drives both the items-section fields rendered in
  // LineItemsBlock and the catalog scope (only positions tagged with this
  // template show up in the autocomplete).
  const { data: activeTemplate } = useActiveOrderTemplate(selectedTemplateId);
  const itemsSection = useMemo(() => getItemsSection(activeTemplate), [activeTemplate]);
  const itemsTemplateFields = useMemo(
    () => itemsSection?.fields ?? [],
    [itemsSection],
  );
  // Field keys handled by dedicated columns in the legacy LineItemsBlock UI.
  // Anything else lives in customFields and renders through TemplateAttributeRenderer.
  const LEGACY_ITEM_KEYS = useMemo(
    () => new Set(['gender', 'color', 'length', 'size', 'product', 'productName']),
    [],
  );
  const customItemFields = useMemo(
    () => itemsTemplateFields.filter((f) => !LEGACY_ITEM_KEYS.has(f.key)),
    [itemsTemplateFields, LEGACY_ITEM_KEYS],
  );
  const customItemFieldKeys = useMemo(
    () => new Set(customItemFields.map((f) => f.key)),
    [customItemFields],
  );

  const { data: orderFormCatalog } = useOrderFormCatalog({
    templateId: activeTemplate?.id ?? null,
  });
  const { data: fieldDefinitions } = useCatalogDefinitions();
  const warehouseProductMap = useMemo<Record<string, OrderFormField[]>>(() => {
    const map: Record<string, OrderFormField[]> = {};
    for (const product of orderFormCatalog?.products ?? []) {
      map[product.name] = product.fields;
    }
    return map;
  }, [orderFormCatalog]);
  // P5: lookup of catalog product by name — used by LineItemsBlock to
  // auto-fill unitPrice on selection (defaultRetailPrice/defaultWholesalePrice).
  const catalogProductByName = useMemo<Record<string, OrderFormProduct>>(() => {
    const map: Record<string, OrderFormProduct> = {};
    for (const product of orderFormCatalog?.products ?? []) {
      map[product.name] = product;
    }
    return map;
  }, [orderFormCatalog]);

  const deferredProductNames = useDeferredValue(
    items.map((i) => i.productName).filter(Boolean),
  );

  // P5: helper to mirror customFields onto the item record so legacy axis
  // pickers (color/gender/size/length on item.*) AND new template axes
  // (item.customFields.<key>) both feed the variant lookup.
  const mergeItemAttrs = useCallback(
    (item: FormData['items'][number] | undefined) => {
      if (!item) return {};
      const customFields = (item as { customFields?: Record<string, unknown> }).customFields ?? {};
      return { ...item, ...customFields } as Record<string, unknown>;
    },
    [],
  );

  // Function declarations need to come before they're used by hooks below.
  // We define getEffectiveFields and related helpers further down, but use them
  // here — these are stable closures that re-derive on each render, so it's
  // safe to reference them via the function-hoisting semantics of JS.
  const getEffectiveFields = useCallback(
    (productName: string) => {
      const trimmed = productName?.trim() ?? '';
      const fromCatalog = warehouseProductMap[trimmed];
      if (fromCatalog && fromCatalog.length > 0) return fromCatalog;
      // P5: when the catalog has no per-product fields config, fall back to
      // the active OrderTemplate's items-section field list (already in
      // OrderFormField shape via this conversion). This keeps live availability
      // working for templates whose products inherit schema implicitly.
      if (itemsTemplateFields.length > 0) {
        return itemsTemplateFields.map((f) => ({
          code: f.key,
          label: f.label,
          inputType: (f.type === 'multiselect' ? 'multiselect' : 'text') as OrderFormField['inputType'],
          isRequired: !!f.required,
          affectsAvailability: !!f.affectsAvailability,
          options: (f.options ?? []).map((label) => ({ value: label, label })),
        }));
      }
      return fieldDefinitions?.map((def) => ({
        code: def.code,
        label: def.label,
        inputType: def.inputType,
        isRequired: false as const,
        affectsAvailability: def.affectsAvailability,
        options: [] as Array<{ value: string; label: string }>,
      }));
    },
    [warehouseProductMap, itemsTemplateFields, fieldDefinitions],
  );

  const availabilityVariants = useMemo(
    () => items
      .map((item) => buildVariantAvailabilityInput(
        item.productName?.trim() ?? '',
        mergeItemAttrs(item),
        getEffectiveFields(item.productName?.trim() ?? ''),
      ))
      .filter((variant): variant is VariantAvailabilityInput => Boolean(variant)),
    [items, mergeItemAttrs, getEffectiveFields],
  );
  const { data: stockMap } = useProductsAvailability(deferredProductNames);
  const { data: variantMap } = useVariantAvailability(availabilityVariants);

  // True if any catalog-registered item with variant axes hasn't filled them all —
  // submit must wait. Free-text product names (not in warehouseProductMap) are skipped:
  // the warehouse can't validate them, so the manager keeps full agency.
  const hasIncompleteVariantLines = useMemo(() => {
    for (const item of items) {
      if (!item?.productName?.trim()) continue;
      const fields = getEffectiveFields(item.productName.trim());
      if (!fields) continue;
      const required = fields.filter((f) => f.affectsAvailability);
      if (required.length === 0) continue;
      const merged = mergeItemAttrs(item);
      const incomplete = required.some((f) => {
        const value = merged[f.code];
        return !value || (typeof value === 'string' && !value.trim());
      });
      if (incomplete) return true;
    }
    return false;
  }, [items, getEffectiveFields, mergeItemAttrs]);
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
    // Block creation only when a variant-bearing line has incomplete axes.
    // Catalog products are checked against their stored fields; products only
    // present in the active template fall back to the template's items section.
    // Free-text products with no template entry skip validation.
    const incompleteLines: number[] = [];
    const missingFieldLabels = new Set<string>();
    for (let i = 0; i < data.items.length; i += 1) {
      const item = data.items[i];
      if (!item?.productName?.trim()) continue;
      const fields = getEffectiveFields(item.productName.trim()) ?? [];
      const required = fields.filter((f) => f.affectsAvailability);
      if (required.length === 0) continue;
      const merged = mergeItemAttrs(item);
      const missing = required.filter((f) => {
        const value = merged[f.code];
        return !value || (typeof value === 'string' && !value.trim());
      });
      if (missing.length > 0) {
        incompleteLines.push(i + 1);
        for (const f of missing) missingFieldLabels.add(f.label.toLowerCase());
      }
    }
    if (incompleteLines.length > 0) {
      const labels = [...missingFieldLabels].join(', ') || 'обязательные параметры';
      toast.error(`Заполните параметры: ${labels} для позиций: ${incompleteLines.join(', ')}`);
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
  // P5: when a template scope is active, restrict the autocomplete to its
  // catalog. Free-text legacy `products` (operations catalog) only show up
  // when there is no template scope — otherwise они смешивают чужие виды
  // деятельности и ломают autocomplete.
  const allProductNames = activeTemplate?.id
    ? warehouseProductNames
    : [...new Set([...products, ...warehouseProductNames])];
  const enrichedProductOptions: SearchableSelectOption[] = useMemo(
    () => allProductNames.map((name) => ({ value: name })),
    [allProductNames],
  );

  // Global color options from warehouse field definitions (fallback when product has no linked color field)
  const globalWarehouseColors = fieldDefinitions?.find(d => d.code === 'color')?.options.map(o => o.label) ?? [];
  // Global length options from warehouse field definitions (single source of truth)
  const globalWarehouseLengths = fieldDefinitions?.find(d => d.code === 'length')?.options.map(o => o.label) ?? [];

  const getAvailabilityInput = useCallback(
    (item?: FormData['items'][number]) => {
      if (!item?.productName?.trim()) return null;
      return buildVariantAvailabilityInput(
        item.productName.trim(),
        mergeItemAttrs(item),
        getEffectiveFields(item.productName.trim()),
      );
    },
    [getEffectiveFields, mergeItemAttrs],
  );

  const getMissingAxes = useCallback(
    (item?: FormData['items'][number]): OrderFormField[] => {
      if (!item?.productName?.trim()) return [];
      // Submit-gate uses the same effective-fields resolution as the live
      // indicator — catalog-bound first, then template fallback. Free-text
      // product names with no template either return [] (no required axes).
      const fields = getEffectiveFields(item.productName.trim()) ?? [];
      const required = fields.filter((f) => f.affectsAvailability);
      if (required.length === 0) return [];
      const merged = mergeItemAttrs(item);
      return required.filter((f) => {
        const value = merged[f.code];
        return !value || (typeof value === 'string' && !value.trim());
      });
    },
    [getEffectiveFields, mergeItemAttrs],
  );

  // Helper: get catalog options for a field code given current productName.
  // P5: falls back to template field options so non-clothing templates with
  // an enum-shaped axis (e.g. concentration) get a dropdown in legacy slots.
  const getCatalogOptions = useCallback(
    (productName: string, code: string): string[] => {
      const fields = warehouseProductMap[productName];
      const fromCatalog = fields?.find((f) => f.code === code)?.options.map((o) => o.label);
      if (fromCatalog && fromCatalog.length > 0) return fromCatalog;
      const tplField = itemsTemplateFields.find((f) => f.key === code);
      return tplField?.options ?? [];
    },
    [warehouseProductMap, itemsTemplateFields],
  );

  // P5: When the active template changes, drop customFields keys that belong
  // to the previous template — they would otherwise leak into the payload and
  // confuse the warehouse (extra unknown axes). Legacy four-axis columns are
  // not stripped — they remain on item.* for the legacy clothing flow.
  const lastTemplateIdRef = useRef<string | null>(activeTemplate?.id ?? null);
  useEffect(() => {
    const currentId = activeTemplate?.id ?? null;
    if (lastTemplateIdRef.current === currentId) return;
    const previousId = lastTemplateIdRef.current;
    lastTemplateIdRef.current = currentId;
    if (previousId === null) return; // first load — nothing to strip
    const allowed = customItemFieldKeys;
    replace(
      items.map((item) => {
        const customFields = (item as { customFields?: Record<string, unknown> }).customFields ?? {};
        const filtered: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(customFields)) {
          if (allowed.has(key)) filtered[key] = value;
        }
        return { ...item, customFields: filtered } as FormData['items'][number];
      }),
    );
    // Intentionally exclude `items`/`replace`/`customItemFieldKeys` from deps —
    // we only run this on template id change, not on every keystroke that
    // mutates items. eslint's exhaustive-deps already accepts this shape.
  }, [activeTemplate?.id]);

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
    // P5: active template (preselection-aware) + items-section field list +
    // catalog lookup map (used by LineItemsBlock for auto price-fill + empty
    // catalog detection + dynamic column generation).
    activeTemplate, itemsTemplateFields, customItemFields, catalogProductByName,
  };
}

export type NewOrderFormState = ReturnType<typeof useNewOrderFormState>;
