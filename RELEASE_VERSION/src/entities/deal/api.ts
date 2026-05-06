import { api } from '../../shared/api/client';
import type {
  AddDealActivityDto,
  CreateDealDto,
  Deal,
  DealActivity,
  DealBoard,
  DealStage,
  PaginatedDeals,
  UpdateDealDto,
} from './types';

type RawDeal = {
  id: string;
  title: string;
  amount?: number | null;
  value?: number | null;
  currency?: string | null;
  stage?: string | { id?: string | null } | null;
  stage_id?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  company_name?: string | null;
  companyName?: string | null;
  assigned_name?: string | null;
  assignedName?: string | null;
  assigned_to?: string | null;
  assignedTo?: string | null;
  customer_id?: string | null;
  customerId?: string | null;
  leadId?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
};

type RawBoard = {
  deals?: RawDeal[];
};

type RawActivity = {
  id: string;
  type: string;
  content?: string | null;
  payload?: { body?: string | null };
  actor?: { full_name?: string | null } | null;
  authorName?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
};

const EMPTY_BOARD: DealBoard = {
  new: [],
  qualified: [],
  proposal: [],
  negotiation: [],
  won: [],
  lost: [],
};

function mapBackendStageToFrontend(stage: string | null | undefined): DealStage {
  switch (stage) {
    case 'meeting_done':
      return 'qualified';
    case 'proposal':
      return 'proposal';
    case 'contract':
    case 'awaiting_payment':
      return 'negotiation';
    case 'won':
      return 'won';
    case 'lost':
      return 'lost';
    case 'awaiting_meeting':
    default:
      return 'new';
  }
}

function mapFrontendStageToBackend(stage: DealStage): string {
  switch (stage) {
    case 'qualified':
      return 'meeting_done';
    case 'proposal':
      return 'proposal';
    case 'negotiation':
      return 'contract';
    case 'won':
      return 'won';
    case 'lost':
      return 'lost';
    case 'new':
    default:
      return 'awaiting_meeting';
  }
}

function readStageId(raw: RawDeal) {
  if (typeof raw.stage === 'string') {
    return raw.stage;
  }

  if (raw.stage && typeof raw.stage === 'object' && raw.stage.id) {
    return raw.stage.id;
  }

  return raw.stage_id ?? 'awaiting_meeting';
}

function normalizeDeal(raw: RawDeal): Deal {
  const backendStage = readStageId(raw);

  return {
    id: raw.id,
    orgId: '',
    title: raw.title,
    fullName: raw.fullName ?? raw.full_name ?? null,
    phone: raw.phone ?? null,
    email: raw.email ?? null,
    companyName: raw.companyName ?? raw.company_name ?? null,
    source: null,
    stage: mapBackendStageToFrontend(backendStage),
    amount: raw.amount ?? raw.value ?? null,
    currency: raw.currency ?? 'KZT',
    probability: null,
    assignedTo: raw.assignedTo ?? raw.assigned_to ?? null,
    assignedName: raw.assignedName ?? raw.assigned_name ?? null,
    leadId: raw.leadId ?? null,
    customerId: raw.customerId ?? raw.customer_id ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? new Date().toISOString(),
  };
}

function normalizeBoard(raw: RawBoard | null): DealBoard {
  const board: DealBoard = {
    new: [],
    qualified: [],
    proposal: [],
    negotiation: [],
    won: [],
    lost: [],
  };

  for (const deal of raw?.deals ?? []) {
    const normalized = normalizeDeal(deal);
    board[normalized.stage].push(normalized);
  }

  return board;
}

function normalizeActivity(raw: RawActivity): DealActivity {
  return {
    id: raw.id,
    dealId: '',
    type: raw.type,
    content: raw.content ?? raw.payload?.body ?? null,
    authorName: raw.authorName ?? raw.actor?.full_name ?? 'Система',
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  };
}

export const dealsApi = {
  list: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get<{ count: number; page: number; limit: number; totalPages: number; results: RawDeal[] }>('/deals', params);

    return {
      ...response,
      results: response.results.map(normalizeDeal),
    } satisfies PaginatedDeals;
  },

  getBoard: async () => {
    const response = await api.get<RawBoard>('/deals/board/');
    return normalizeBoard(response);
  },

  get: async (id: string) => {
    const response = await api.get<RawDeal>(`/deals/${id}`);
    return normalizeDeal(response);
  },

  getActivities: async (id: string) => {
    const response = await api.get<{ results: RawActivity[] }>(`/deals/${id}/activities`);
    return {
      results: response.results.map(normalizeActivity),
    };
  },

  create: async (dto: CreateDealDto) => {
    const response = await api.post<RawDeal>('/deals', {
      title: dto.title,
      fullName: dto.fullName?.trim() || 'Без клиента',
      phone: dto.phone,
      email: dto.email,
      companyName: dto.companyName,
      source: dto.source,
      value: dto.value,
      assignedTo: dto.assignedTo,
      assignedName: dto.assignedName,
      leadId: dto.leadId,
      customerId: dto.customerId,
    });

    return normalizeDeal(response);
  },

  update: async (id: string, dto: UpdateDealDto) => {
    const response = await api.patch<RawDeal>(`/deals/${id}`, {
      title: dto.title,
      fullName: dto.fullName,
      phone: dto.phone,
      stage: dto.stage ? mapFrontendStageToBackend(dto.stage) : undefined,
      amount: dto.amount,
      probability: dto.probability,
      assignedTo: dto.assignedTo,
      assignedName: dto.assignedName,
    });

    return normalizeDeal(response);
  },

  addActivity: async (id: string, dto: AddDealActivityDto) => {
    const response = await api.post<RawActivity>(`/deals/${id}/activities`, dto);
    return normalizeActivity(response);
  },

  delete: (id: string) =>
    api.delete<{ ok: boolean }>(`/deals/${id}`),
};
