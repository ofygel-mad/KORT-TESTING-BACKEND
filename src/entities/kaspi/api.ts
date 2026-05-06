import { api } from '../../shared/api/client';
import type {
  KaspiConnection,
  KaspiOrderDetail,
  KaspiOrdersSummary,
  KaspiOrdersListResponse,
  SaveKaspiConnectionDto,
  ListKaspiOrdersParams,
  SyncKaspiOrdersResponse,
} from './types';

export const kaspiApi = {
  getConnection: () =>
    api.get<KaspiConnection | null>('/integrations/kaspi/connection'),

  saveConnection: (dto: SaveKaspiConnectionDto) =>
    api.put<KaspiConnection>('/integrations/kaspi/connection', dto),

  testConnection: () =>
    api.post<{ ok: true; checkedAt: string; sampleOrders: number }>('/integrations/kaspi/connection/test', {}),

  syncOrders: () =>
    api.post<SyncKaspiOrdersResponse>('/integrations/kaspi/sync', {}),

  listOrders: (params?: ListKaspiOrdersParams) =>
    api.get<KaspiOrdersListResponse>('/integrations/kaspi/orders', params),

  getOrder: (externalOrderId: string) =>
    api.get<KaspiOrderDetail>(`/integrations/kaspi/orders/${externalOrderId}`),

  getSummary: () =>
    api.get<KaspiOrdersSummary>('/integrations/kaspi/orders/summary'),
};
