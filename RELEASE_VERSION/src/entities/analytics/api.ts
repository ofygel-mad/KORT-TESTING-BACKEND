import { api } from '../../shared/api/client';
import type { AnalyticsOverview } from './types';

export const analyticsApi = {
  getOverview: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<AnalyticsOverview>('/chapan/analytics/overview', params),
};
