// ── Chapan Clients CRM view ────────────────────────────────────────────────
// Returned by GET /api/v1/clients — enriched with order aggregates

import type { OrderStatus } from './types';

export interface Customer {
  id: string;
  orgId: string;
  fullName: string;
  phone: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CustomerAggregated {
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

export interface CustomerDetail extends CustomerAggregated {
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
    orderDiscount: number;
    deliveryFee: number;
    bankCommissionPercent: number;
    bankCommissionAmount: number;
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

export interface CustomersListParams {
  search?: string;
  customerType?: 'retail' | 'wholesale' | 'all';
  sortBy?: 'name' | 'orders' | 'spent' | 'lastOrder';
  limit?: number;
  offset?: number;
}
