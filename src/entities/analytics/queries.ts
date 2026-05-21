import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from './api';

export const useAnalytics = (params?: { dateFrom?: string; dateTo?: string }) =>
  useQuery({
    queryKey: ['analytics', params],
    queryFn: () => analyticsApi.getOverview(params),
    staleTime: 60_000,
  });
