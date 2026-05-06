// ── Invoice (Накладная) types ────────────────────────────────────────────────

import type { ChapanOrder } from './types';

export type InvoiceStatus = 'pending_confirmation' | 'confirmed' | 'rejected' | 'archived';

export interface InvoiceDocumentColumns {
  itemNumber: string;
  productName: string;
  gender: string;
  length: string;
  size: string;
  color: string;
  quantity: string;
  orders: string;
  unitPrice: string;
  lineTotal: string;
}

export interface InvoiceDocumentRow {
  id: string;
  itemNumber: string;
  productName: string;
  gender: string;
  length: string;
  size: string;
  color: string;
  quantity: number;
  orders: string;
  unitPrice: number;
  /** Internal (warehouse) cost price — split-price P2 */
  warehouseUnitPrice?: number | null;
  sourceOrders?: InvoiceDocumentSourceOrder[];
}

export interface InvoiceDocumentSourceOrder {
  orderId: string;
  orderNumber: string;
}

export interface InvoiceDocumentPayload {
  invoiceNumber?: string;
  invoiceDate: string;
  route: string;
  signatureLabel: string;
  columns: InvoiceDocumentColumns;
  rows: InvoiceDocumentRow[];
}

export interface ChapanInvoice {
  id: string;
  orgId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  createdById: string;
  createdByName: string;
  seamstressConfirmed: boolean;
  seamstressConfirmedAt: string | null;
  seamstressConfirmedBy: string | null;
  warehouseConfirmed: boolean;
  warehouseConfirmedAt: string | null;
  warehouseConfirmedBy: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  documentPayload?: InvoiceDocumentPayload | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    invoiceId: string;
    orderId: string;
    order: ChapanOrder;
  }>;
}
