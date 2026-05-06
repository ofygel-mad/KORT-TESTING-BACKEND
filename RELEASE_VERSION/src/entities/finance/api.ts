import { api } from '../../shared/api/client';
import type { AccountingEntry, AccountingSummary, PaginatedEntries, CreateEntryDto } from './types';

export const financeApi = {
  listEntries: (params?: {
    type?: string; from?: string; to?: string; period?: string;
    page?: number; limit?: number; search?: string;
  }) => api.get<PaginatedEntries>('/accounting/entries', params),

  createEntry: (dto: CreateEntryDto) =>
    api.post<AccountingEntry>('/accounting/entries', dto),

  getSummary: (params?: { period?: string; from?: string; to?: string }) =>
    api.get<AccountingSummary>('/accounting/summary', params),
};
