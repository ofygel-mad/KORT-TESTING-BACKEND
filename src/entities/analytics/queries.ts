import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from './api';

export const useChapanAnalytics = (params?: { dateFrom?: string; dateTo?: string }) =>
  useQuery({
    queryKey: ['chapan-analytics', params],
    queryFn: () => analyticsApi.getOverview(params),
    staleTime: 60_000,
  });
