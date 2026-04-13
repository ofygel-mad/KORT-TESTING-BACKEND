export const CURRENCY_SYMBOLS: Record<string, string> = {
  KZT: '₸', RUB: '₽', USD: '$', EUR: '€', CNY: '¥',
};

const CURRENCY_LOCALES: Record<string, string> = {
  KZT: 'kk-KZ', RUB: 'ru-RU', USD: 'en-US', EUR: 'de-DE', CNY: 'zh-CN',
};

export function formatMoney(
  amount: number,
  currency = 'KZT',
  compact = false,
): string {
  const locale = CURRENCY_LOCALES[currency] ?? 'kk-KZ';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    currencyDisplay: 'narrowSymbol',
    ...(compact ? { notation: 'compact' } : {}),
  }).format(amount);
}

export function formatNumber(
  amount: number,
  locale: string = 'ru-KZ',
  compact = false,
): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
}

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}
