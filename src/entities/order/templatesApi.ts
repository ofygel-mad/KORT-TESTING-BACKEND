// P5 — Frontend hooks for OrderTemplates.
//
// Read-only in P5 (list + detail). P7 will add create/update/delete when the
// Field Designer ships.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { OrderTemplate, OrderTemplateSection } from './templates';

export interface OrderTemplateInput {
  name: string;
  itemNoun: string;
  primaryUnit: string;
  primaryPrecision: number;
  sections: OrderTemplateSection[];
}

const KEY = ['order-templates'] as const;

export const orderTemplateKeys = {
  all: KEY,
  list: () => [...KEY, 'list'] as const,
  detail: (id: string) => [...KEY, 'detail', id] as const,
};

export function useOrderTemplates() {
  return useQuery({
    queryKey: orderTemplateKeys.list(),
    queryFn: () => api.get<{ count: number; results: OrderTemplate[] }>('/order-templates'),
    staleTime: 60_000,
  });
}

export function useOrderTemplate(id: string | null | undefined) {
  return useQuery({
    queryKey: orderTemplateKeys.detail(id ?? ''),
    queryFn: () => api.get<OrderTemplate>(`/order-templates/${id}`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateOrderTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OrderTemplateInput) =>
      api.post<OrderTemplate>('/order-templates', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderTemplateKeys.list() }),
  });
}

export function useUpdateOrderTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OrderTemplateInput }) =>
      api.put<OrderTemplate>(`/order-templates/${id}`, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: orderTemplateKeys.list() });
      qc.invalidateQueries({ queryKey: orderTemplateKeys.detail(vars.id) });
    },
  });
}

export function useDeleteOrderTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/order-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderTemplateKeys.list() }),
  });
}

export function useCloneOrderTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      api.post<OrderTemplate>(`/order-templates/${id}/clone`, name ? { name } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderTemplateKeys.list() }),
  });
}

/**
 * Returns the template considered "active" for the current org.
 * - If `overrideId` is provided (e.g. from a picker), that template wins.
 * - Otherwise: `isDefault` → system "Бланк" → first system → first available → null.
 *
 * P1 (multi-business): the legacy `/одежда/i` fallback was removed because
 * non-clothing orgs (Chemicals, Services, Furniture, ...) should never be
 * forced into the Clothing template. Default selection now relies on the
 * explicit `isDefault` flag on OrderTemplate (set by `ensureSystemTemplatesForOrg`).
 */
export function useActiveOrderTemplate(overrideId?: string | null) {
  const all = useOrderTemplates();
  const list = all.data?.results ?? [];
  const picked = overrideId ? list.find((t) => t.id === overrideId) : undefined;
  const active =
    picked
    ?? list.find((t) => t.isDefault)
    ?? list.find((t) => t.isSystem && t.name === 'Бланк')
    ?? list.find((t) => t.isSystem)
    ?? list[0]
    ?? null;
  return { ...all, data: active };
}
