// Backend: Lead model + LeadHistory
// paginatedResponse format: { count, page, limit, totalPages, results: [] }

export type LeadStage = 'new' | 'in_progress' | 'won' | 'lost';
export type LeadPipeline = 'qualifier' | 'closer';

export interface Lead {
  id: string;
  orgId: string;
  fullName: string;
  phone: string;                   // required in backend
  source: string;                  // required in backend
  pipeline: LeadPipeline;
  stage: LeadStage;
  email: string | null;
  companyName: string | null;
  budget: number | null;
  comment: string | null;
  assignedTo: string | null;       // userId
  assignedName: string | null;     // display name
  createdAt: string;
  updatedAt: string;
  history?: LeadHistory[];
}

export interface LeadHistory {
  id: string;
  leadId: string;
  type: string;                    // 'system' | 'comment' | 'call' | 'meeting' | 'stage_change'
  content: string | null;
  authorName: string;
  createdAt: string;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateLeadDto {
  fullName: string;                // required
  phone: string;                   // required — backend validates min(1)
  source: string;                  // required — backend validates min(1)
  pipeline?: LeadPipeline;
  assignedTo?: string;
  assignedName?: string;
  budget?: number;
  comment?: string;
  email?: string;
  companyName?: string;
}

export interface UpdateLeadDto {
  fullName?: string;
  phone?: string;
  source?: string;
  stage?: LeadStage;
  pipeline?: LeadPipeline;
  assignedTo?: string;
  assignedName?: string;
  budget?: number;
  comment?: string;
  email?: string;
}

export interface LeadFilters {
  pipeline?: LeadPipeline;
  stage?: LeadStage;
  page?: number;
  limit?: number;
}

// ── Paginated response (backend format) ──────────────────────────────────────

export interface PaginatedLeads {
  count: number;
  page: number;
  limit: number;
  totalPages: number;
  results: Lead[];
}
