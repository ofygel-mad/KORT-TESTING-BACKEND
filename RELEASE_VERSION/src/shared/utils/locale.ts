import { ru } from 'date-fns/locale';

export const KZ_LOCALE = 'kk-KZ' as const;
export const RU_LOCALE = 'ru-RU' as const;
export const DEFAULT_LOCALE = 'ru-KZ' as const;
export const DEFAULT_CURRENCY = 'KZT' as const;

export function getDateLocale() {
  return ru;
}
