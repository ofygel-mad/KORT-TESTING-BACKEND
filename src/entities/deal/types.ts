// Backend: Deal model + DealActivity
// Backend uses 'value'/'amount' interchangeably for deal value

export type DealStage =
  | 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface Deal {
  id: string;
  orgId: string;
  title: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  source: string | null;
  stage: DealStage;
  amount: number | null;     // deal value in KZT
  currency: string;
  probability: number | null;
  assignedTo: string | null;
  assignedName: string | null;
  leadId: string | null;
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
  activities?: DealActivity[];
}

export interface DealActivity {
  id: string;
  dealId: string;
  type: string;      // 'call' | 'meeting' | 'note' | 'email' | 'system'
  content: string | null;
  authorName: string;
  createdAt: string;
}

// Board response: deals grouped by stage
export interface DealBoard {
  [stage: string]: Deal[];
}

export interface PaginatedDeals {
  count: number;
  page: number;
  limit: number;
  totalPages: number;
  results: Deal[];
}

export interface CreateDealDto {
  title: string;              // required
  fullName?: string;
  phone?: string;
  email?: string;
  companyName?: string;
  source?: string;
  value?: number;             // backend accepts as value OR amount
  assignedTo?: string;
  assignedName?: string;
  leadId?: string;
  customerId?: string;
}

export interface UpdateDealDto {
  title?: string;
  fullName?: string;
  phone?: string;
  stage?: DealStage;
  amount?: number;
  probability?: number;
  assignedTo?: string;
  assignedName?: string;
}

export interface AddDealActivityDto {
  type: string;
  content?: string;
}
