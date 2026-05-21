import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

export interface UnpaidAlert {
  id: string;
  orgId: string;
  orderId: string;
  orderNumber: string;
  createdBy: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  order: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
    orderDiscount?: number;
    deliveryFee?: number;
    bankCommissionPercent?: number;
    bankCommissionAmount?: number;
    clientName: string;
    paymentStatus: string;
  };
}

export function useCreateUnpaidAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, orderNumber }: { orderId: string; orderNumber: string }) =>
      api.post<UnpaidAlert>('/alerts/unpaid', { orderId, orderNumber }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unpaid-alerts'] });
    },
  });
}

export function useUnpaidAlerts() {
  return useQuery({
    queryKey: ['unpaid-alerts'],
    queryFn: () =>
      api.get<{ results: UnpaidAlert[]; count: number }>('/alerts/unpaid'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) =>
      api.post(`/alerts/${alertId}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unpaid-alerts'] });
    },
  });
}
