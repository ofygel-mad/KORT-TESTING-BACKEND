// Backend: /api/v1/accounting/*

export type EntryType = 'income' | 'expense' | 'transfer' | 'adjustment' | 'write_off' | 'return';

export interface AccountingEntry {
  id: string;
  orgId: string;
  seq: number;
  type: EntryType;
  amount: number;
  currency: string;
  category: string;
  account: string;
  counterparty?: string | null;
  sourceModule?: string | null;
  sourceLabel?: string | null;
  period: string;   // YYYY-MM
  author: string;
  notes?: string | null;
  tags: string[];
  createdAt: string;
}

export interface AccountingSummary {
  income: number;
  expense: number;
  balance: number;
  byCategory?: Record<string, number>;
}

export interface PaginatedEntries {
  count: number;
  page: number;
  limit: number;
  totalPages: number;
  results: AccountingEntry[];
}

export interface CreateEntryDto {
  type: EntryType;
  amount: number;
  category: string;
  account: string;
  counterparty?: string;
  notes?: string;
  // sourceModule / sourceId used by system — not from manual form
}

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  income: 'Доход',
  expense: 'Расход',
  transfer: 'Перевод',
  adjustment: 'Корректировка',
  write_off: 'Списание',
  return: 'Возврат',
};

export const INCOME_CATEGORIES = ['Оплата заказа', 'Предоплата', 'Возврат от поставщика', 'Прочие доходы'];
export const EXPENSE_CATEGORIES = ['Закупка материалов', 'Аренда', 'Зарплата', 'Реклама', 'Оборудование', 'Прочие расходы'];
