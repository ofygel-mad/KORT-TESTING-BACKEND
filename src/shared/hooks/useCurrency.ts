import { useAuthStore } from '../stores/auth';

export function useCurrency(): string {
  return useAuthStore((s) => s.org?.currency ?? 'KZT');
}
