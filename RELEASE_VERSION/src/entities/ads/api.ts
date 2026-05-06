import { api } from '../../shared/api/client';
import type {
  AdChannel,
  AdsDashboard,
  AdsExportRow,
  CreateAdCampaignDto,
  ExchangeRate,
  UpdateAdCampaignDto,
  UpsertAdMetricDto,
} from './types';

export const adsApi = {
  dashboard: (params: { period: string; channel: AdChannel }) =>
    api.get<AdsDashboard>('/ads/dashboard', params),

  getExchangeRate: (params?: { date?: string; refresh?: boolean }) =>
    api.get<ExchangeRate>('/ads/exchange-rate', {
      date: params?.date,
      refresh: params?.refresh ? 'true' : undefined,
    }),

  createCampaign: (dto: CreateAdCampaignDto) =>
    api.post('/ads/campaigns', dto),

  updateCampaign: (id: string, dto: UpdateAdCampaignDto) =>
    api.patch(`/ads/campaigns/${id}`, dto),

  deleteCampaign: (id: string) =>
    api.delete(`/ads/campaigns/${id}`),

  upsertMetric: (dto: UpsertAdMetricDto) =>
    api.post('/ads/metrics', dto),

  exportRows: (params: { period: string; channel: AdChannel }) =>
    api.get<{ rows: AdsExportRow[]; exportedAt: string; count: number }>('/ads/export', params),

  importPreviewStub: () =>
    api.post<{ status: string; message: string }>('/ads/import/preview'),
};
