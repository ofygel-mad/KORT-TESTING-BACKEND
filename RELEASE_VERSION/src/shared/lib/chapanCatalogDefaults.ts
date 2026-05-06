/**
 * Centralized catalog defaults and normalization for Chapan module.
 *
 * This module replaces all locally-duplicated size/payment/delivery constant
 * arrays and normalization tables scattered across Settings, NewOrder, EditOrder.
 *
 * Exports:
 * - DEFAULT_NUMERIC_SIZE_CATALOG   — 38–60 even numeric sizes
 * - DEFAULT_PAYMENT_METHODS        — canonical CIS payment labels
 * - DEFAULT_DELIVERY_OPTIONS       — standard KZ delivery options
 * - normalizeSizeValue             — convert letter or raw size → normalized string
 * - normalizeSizeCatalog           — deduplicate + sort a list of sizes
 * - buildSizeCatalog               — merge defaults + custom, return sorted
 * - normalizePaymentMethodLabel    — map code/alias → display label
 * - normalizePaymentCatalog        — merge + deduplicate payment methods
 * - buildPaymentMethodOptions      — return {value, label}[] for <select>
 * - buildMixedBreakdownRows        — rows for the mixed-payment breakdown UI
 * - buildDeliveryOptions           — merge defaults + custom delivery options
 */

export const DEFAULT_NUMERIC_SIZE_CATALOG = [
  '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58', '60',
] as const;


export const DEFAULT_PAYMENT_METHODS = [
  'Наличные', 'Kaspi QR', 'Kaspi Терминал', 'Перевод', 'Халык',
] as const;

export const DEFAULT_DELIVERY_OPTIONS = [
  'Самовывоз', 'Курьер по городу', 'Казпочта', 'Жд', 'Авиа', 'СДЭК', 'Другое',
] as const;

// ── Internal helpers ─────────────────────────────────────────────────────────

const LETTER_SIZE_ALIAS: Record<string, string> = {
  XS: '42', S: '44', M: '46', L: '48',
  XL: '50', XXL: '52', XXXL: '54', '3XL': '54',
};

const PAYMENT_ALIAS: Record<string, string> = {
  cash:             'Наличные',
  card:             'Карта',
  kaspi_qr:         'Kaspi QR',
  kaspi_terminal:   'Kaspi Терминал',
  terminal:         'Kaspi Терминал',
  transfer:         'Перевод',
  halyk:            'Халык',
  mixed:            'Смешанный',
};

function compact(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

// ── Size normalization ────────────────────────────────────────────────────────

export function normalizeSizeValue(value: string | null | undefined): string {
  const raw = compact(value);
  if (!raw) return '';

  const upper = raw.toUpperCase();
  if (LETTER_SIZE_ALIAS[upper]) return LETTER_SIZE_ALIAS[upper];

  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length >= 2 && digits.length <= 3) return String(Number(digits));

  return raw;
}

export function normalizeSizeCatalog(values: string[] | undefined | null): string[] {
  const prepared = unique((values ?? []).map(normalizeSizeValue));
  const numeric = prepared.filter(v => /^\d+$/.test(v)).sort((a, b) => Number(a) - Number(b));
  const custom  = prepared.filter(v => !/^\d+$/.test(v)).sort((a, b) => a.localeCompare(b, 'ru'));
  return [...numeric, ...custom];
}

/**
 * Build a complete size catalog: defaults 38–60 merged with any custom values.
 */
export function buildSizeCatalog(values: string[] | undefined | null): string[] {
  return normalizeSizeCatalog([...DEFAULT_NUMERIC_SIZE_CATALOG, ...normalizeSizeCatalog(values)]);
}

// ── Payment method normalization ─────────────────────────────────────────────

export function normalizePaymentMethodLabel(value: string | null | undefined): string {
  const raw = compact(value);
  if (!raw) return '';
  const byAlias = PAYMENT_ALIAS[raw.toLowerCase()];
  return byAlias ?? raw;
}

export function normalizePaymentCatalog(values: string[] | undefined | null): string[] {
  return unique([
    ...DEFAULT_PAYMENT_METHODS,
    ...(values ?? []).map(normalizePaymentMethodLabel),
  ]);
}

// ── Payment method options for <select> ──────────────────────────────────────

export function buildPaymentMethodOptions(
  values: string[] | undefined | null,
): Array<{ value: string; label: string }> {
  const normalized = normalizePaymentCatalog(values);
  return [
    ...normalized.map((label) => ({
      value:
        label === 'Наличные'      ? 'cash' :
        label === 'Kaspi QR'      ? 'kaspi_qr' :
        label === 'Kaspi Терминал'? 'kaspi_terminal' :
        label === 'Перевод'       ? 'transfer' :
        label === 'Халык'         ? 'halyk' :
        label.toLowerCase(),
      label,
    })),
    { value: 'mixed', label: 'Смешанный' },
  ];
}

// ── Mixed breakdown rows ──────────────────────────────────────────────────────

export type MixedBreakdownRow = {
  value: 'cash' | 'kaspi_qr' | 'kaspi_terminal' | 'transfer' | 'halyk';
  label: string;
};

export function buildMixedBreakdownRows(
  values: string[] | undefined | null,
): MixedBreakdownRow[] {
  return buildPaymentMethodOptions(values)
    .filter(opt => opt.value !== 'mixed')
    .filter((opt): opt is { value: MixedBreakdownRow['value']; label: string } => (
      opt.value === 'cash' ||
      opt.value === 'kaspi_qr' ||
      opt.value === 'kaspi_terminal' ||
      opt.value === 'transfer' ||
      opt.value === 'halyk'
    ))
    .map(opt => ({ value: opt.value, label: opt.label }));
}

// ── Delivery options ─────────────────────────────────────────────────────────

export function buildDeliveryOptions(values?: string[] | null): string[] {
  return unique([...DEFAULT_DELIVERY_OPTIONS, ...(values ?? []).map(compact)]);
}
