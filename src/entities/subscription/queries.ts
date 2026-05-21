import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from './api';

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.get(),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: () => subscriptionApi.listPlans(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planCode: string) => subscriptionApi.changePlan(planCode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['organization'] });
    },
  });
}
