import { api } from '../../shared/api/client';
import type { Lead, CreateLeadDto, UpdateLeadDto, LeadFilters, PaginatedLeads } from './types';

export const leadsApi = {
  list: (filters?: LeadFilters) =>
    api.get<PaginatedLeads>('/leads', filters),

  get: (id: string) =>
    api.get<Lead>(`/leads/${id}`),

  create: (dto: CreateLeadDto) =>
    api.post<Lead>('/leads', dto),

  update: (id: string, dto: UpdateLeadDto) =>
    api.patch<Lead>(`/leads/${id}`, dto),

  addHistory: (id: string, body: { type: string; content?: string }) =>
    api.post<{ ok: boolean }>(`/leads/${id}/history`, body),
};
