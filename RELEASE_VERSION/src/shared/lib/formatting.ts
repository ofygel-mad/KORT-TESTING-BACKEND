import { formatDistanceToNow as formatDateDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export function formatPhoneNumber(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const digits = value.replace(/\D/g, '');

  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    const normalized = digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
    return `+${normalized.slice(0, 1)} ${normalized.slice(1, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 9)} ${normalized.slice(9)}`;
  }

  if (digits.length === 10) {
    return `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
  }

  return value.trim();
}

export function formatDistanceToNow(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return formatDateDistanceToNow(date, { addSuffix: true, locale: ru });
}
