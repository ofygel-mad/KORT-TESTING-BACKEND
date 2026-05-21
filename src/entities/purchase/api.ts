import { api, apiClient } from '@/shared/api/client';
import type { ManualInvoice, CreateManualInvoiceDto, UpdateManualInvoiceDto } from './types';

export const purchaseApi = {
  list: (params?: { type?: string; archived?: boolean }) =>
    api.get<{ count: number; results: ManualInvoice[] }>('/purchase', params),

  getById: (id: string) =>
    api.get<ManualInvoice>(`/purchase/${id}`),

  create: (dto: CreateManualInvoiceDto) =>
    api.post<ManualInvoice>('/purchase', dto),

  update: (id: string, dto: UpdateManualInvoiceDto) =>
    api.patch<ManualInvoice>(`/purchase/${id}`, dto),

  archive: (id: string) =>
    api.post<ManualInvoice>(`/purchase/${id}/archive`),

  restore: (id: string) =>
    api.post<ManualInvoice>(`/purchase/${id}/restore`),

  remove: (id: string) =>
    api.delete<{ deleted: boolean }>(`/purchase/${id}`),

  download: (id: string, currency = 'KZT') =>
    apiClient.get(`/purchase/${id}/download`, {
      params: { currency },
      responseType: 'blob',
    }),
};
