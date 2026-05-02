// ── Returns (Акты возврата) ───────────────────────────────────────────────────

import type { OrderStatus, CreateOrderItemDto } from './types';

export type ReturnReason = 'defect' | 'wrong_size' | 'wrong_item' | 'customer_refusal' | 'other';
export type ReturnStatus = 'draft' | 'confirmed';
export type ReturnItemCondition = 'good' | 'defective' | 'damaged';
export type ReturnRefundMethod = 'cash' | 'bank';

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  defect: 'Дефект товара',
  wrong_size: 'Не тот размер',
  wrong_item: 'Не тот товар',
  customer_refusal: 'Отказ клиента',
  other: 'Другое',
};

export const RETURN_CONDITION_LABELS: Record<ReturnItemCondition, string> = {
  good: 'Хорошее',
  defective: 'Дефект',
  damaged: 'Повреждение',
};

export const RETURN_REFUND_METHOD_LABELS: Record<ReturnRefundMethod, string> = {
  cash: 'Наличные',
  bank: 'На счёт',
};

export interface ChapanReturnItem {
  id: string;
  returnId: string;
  orderItemId: string | null;
  productName: string;
  size: string;
  color: string | null;
  gender: string | null;
  qty: number;
  unitPrice: number;
  refundAmount: number;
  condition: ReturnItemCondition;
  warehouseItemId: string | null;
  createdAt: string;
}

export interface ChapanReturn {
  id: string;
  orgId: string;
  returnNumber: string;
  orderId: string;
  status: ReturnStatus;
  reason: ReturnReason;
  reasonNotes: string | null;
  createdById: string;
  createdByName: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  totalRefundAmount: number;
  refundMethod: ReturnRefundMethod;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    clientName: string;
    clientPhone: string;
    status: OrderStatus;
  };
  items: ChapanReturnItem[];
}

export interface CreateReturnItemDto {
  orderItemId?: string;
  productName: string;
  size: string;
  color?: string;
  gender?: string;
  qty: number;
  unitPrice: number;
  refundAmount: number;
  condition: ReturnItemCondition;
}

export interface CreateReturnDto {
  orderId: string;
  reason: ReturnReason;
  reasonNotes?: string;
  refundMethod: ReturnRefundMethod;
  items: CreateReturnItemDto[];
}
