import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseApi } from './api';
import type { CreateManualInvoiceDto } from './types';

const purchaseKeys = {
  all: ['chapan-purchase'] as const,
  list: (type?: string) => [...purchaseKeys.all, 'list', type] as const,
  detail: (id: string) => [...purchaseKeys.all, 'detail', id] as const,
};

export const useManualInvoices = (type?: string) =>
  useQuery({
    queryKey: purchaseKeys.list(type),
    queryFn: () => purchaseApi.list(type ? { type } : undefined),
    staleTime: 30_000,
  });

export const useManualInvoice = (id: string) =>
  useQuery({
    queryKey: purchaseKeys.detail(id),
    queryFn: () => purchaseApi.getById(id),
    enabled: !!id,
  });

export const useCreateManualInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateManualInvoiceDto) => purchaseApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseKeys.all }),
  });
};

export const useDeleteManualInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseKeys.all }),
  });
};
