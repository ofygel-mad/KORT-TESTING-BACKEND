import { api } from '@/shared/api/client';
import type { Plan, Subscription } from './types';

export const subscriptionApi = {
  get: () => api.get<Subscription>('/subscription'),
  listPlans: () => api.get<{ count: number; results: Plan[] }>('/subscription/plans'),
  changePlan: (planCode: string) =>
    api.patch<Subscription>('/subscription', { plan_code: planCode }),
};
