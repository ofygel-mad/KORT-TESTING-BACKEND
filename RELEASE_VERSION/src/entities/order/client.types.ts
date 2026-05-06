// ── Chapan Clients CRM view ────────────────────────────────────────────────
// Returned by GET /api/v1/chapan/clients — enriched with order aggregates

import type { OrderStatus } from './types';

export interface ChapanClient {
  id: string;
  orgId: string;
  fullName: string;
  phone: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ChapanClientAggregated {
  id: string;
  orgId: string;
  fullName: string;
  phone: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  crmCustomerId: string | null;
  orderCount: number;
  totalSpent: number;
  totalPaid: number;
  lastOrderAt: string | null;
  retailOrderCount: number;
  wholesaleOrderCount: number;
}

export interface ChapanClientDetail extends ChapanClientAggregated {
  stats: {
    orderCount: number;
    totalSpent: number;
    totalPaid: number;
    retailOrders: number;
    wholesaleOrders: number;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalAmount: number;
    paidAmount: number;
    customerType: 'retail' | 'wholesale';
    createdAt: string;
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
    }>;
  }>;
}

export interface ChapanClientsListParams {
  search?: string;
  customerType?: 'retail' | 'wholesale' | 'all';
  sortBy?: 'name' | 'orders' | 'spent' | 'lastOrder';
  limit?: number;
  offset?: number;
}
