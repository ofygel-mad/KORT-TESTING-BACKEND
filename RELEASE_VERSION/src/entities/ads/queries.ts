import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { readApiErrorMessage } from '../../shared/api/errors';
import { adsApi } from './api';
import type { AdChannel, CreateAdCampaignDto, UpdateAdCampaignDto, UpsertAdMetricDto } from './types';

export const adsKeys = {
  all: ['ads'] as const,
  dashboard: (params: { period: string; channel: AdChannel }) => ['ads', 'dashboard', params] as const,
  exchangeRate: (date?: string) => ['ads', 'exchange-rate', date] as const,
};

export const useAdsDashboard = (params: { period: string; channel: AdChannel }) =>
  useQuery({
    queryKey: adsKeys.dashboard(params),
    queryFn: () => adsApi.dashboard(params),
    staleTime: 30_000,
  });

export const useRefreshUsdKztRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date?: string) => adsApi.getExchangeRate({ date, refresh: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adsKeys.all });
      toast.success('Курс USD/KZT обновлен');
    },
    onError: (err) => toast.error(readApiErrorMessage(err, 'Не удалось обновить курс USD/KZT')),
  });
};

export const useCreateAdCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAdCampaignDto) => adsApi.createCampaign(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adsKeys.all });
      toast.success('Кампания добавлена');
    },
    onError: (err) => toast.error(readApiErrorMessage(err, 'Не удалось добавить кампанию')),
  });
};

export const useUpdateAdCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: UpdateAdCampaignDto & { id: string }) =>
      adsApi.updateCampaign(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adsKeys.all });
      toast.success('Кампания обновлена');
    },
    onError: (err) => toast.error(readApiErrorMessage(err, 'Не удалось обновить кампанию')),
  });
};

export const useDeleteAdCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adsApi.deleteCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adsKeys.all });
      toast.success('Кампания удалена');
    },
    onError: (err) => toast.error(readApiErrorMessage(err, 'Не удалось удалить кампанию')),
  });
};

export const useUpsertAdMetric = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpsertAdMetricDto) => adsApi.upsertMetric(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adsKeys.all });
      toast.success('Дневные метрики сохранены');
    },
    onError: (err) => toast.error(readApiErrorMessage(err, 'Не удалось сохранить метрики')),
  });
};
