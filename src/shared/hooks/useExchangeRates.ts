import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface Rates { base: string; rates: Record<string, number>; date: string; }

export function useExchangeRates() {
  return useQuery<Rates>({
    queryKey: ['exchange-rates'],
    queryFn: () => api.get('/exchange-rates/'),
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useConvert() {
  const { data } = useExchangeRates();
  return (amount: number, from: string, to = 'KZT'): number => {
    if (!data || from === to) return amount;
    const fromRate = data.rates[from] ?? 1;
    const toRate = data.rates[to] ?? 1;
    return Math.round((amount * fromRate) / toRate);
  };
}
