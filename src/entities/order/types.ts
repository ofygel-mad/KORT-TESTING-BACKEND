// ── Chapan Order types — synced with backend schema ──────────────────────────
// Backend model: ChapanOrder, ChapanOrderItem, ChapanProductionTask, ChapanPayment, ChapanActivity

import type { InvoiceStatus } from './invoice.types';

export type OrderStatus =
  | 'new' | 'confirmed' | 'in_production' | 'ready'
  | 'transferred' | 'on_warehouse' | 'shipped' | 'completed' | 'cancelled';

export type PaymentStatus = 'not_paid' | 'partial' | 'paid';
export type OrderItemFulfillmentMode = 'unassigned' | 'warehouse' | 'production';

// Legacy: kept for backward compat with old data/API calls
export type Priority = 'normal' | 'urgent' | 'vip';
// New domain model: urgency and demanding are independent
export type Urgency = 'normal' | 'urgent';

export interface ChapanOrder {
  id: string;
  orgId: string;
  orderNumber: string;
  // Backend field names:
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientPhoneForeign: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  priority: Priority;          // legacy field, still returned by backend
  urgency: Urgency;            // new: 'normal' | 'urgent'
  isDemandingClient: boolean;  // new: independent demanding-client flag
  totalAmount: number;
  paidAmount: number;
  dueDate: string | null;          // was: deadline
  streetAddress: string | null;
  city: string | null;
  deliveryType: string | null;
  source: string | null;
  expectedPaymentMethod: string | null;
  shippingNote: string | null;
  cancelReason: string | null;
  postalCode: string | null;
  orderDate: string | null;
  orderDiscount: number;
  deliveryFee: number;
  bankCommissionPercent: number;
  bankCommissionAmount: number;
  completedAt: string | null;
  cancelledAt: string | null;
  requiresInvoice: boolean;
  isArchived: boolean;
  deletedAt?: string | null;   // present when order is in trash
  archivedAt: string | null;
  hasReturns: boolean;
  // Manager credited for this order (for salary/bonus calculations)
  managerId: string | null;
  managerName: string | null;
  customerType: 'retail' | 'wholesale';
  createdAt: string;
  updatedAt: string;
  // Relations (included by backend):
  items: OrderItem[];
  productionTasks: ProductionTask[];
  payments: OrderPayment[];
  activities: OrderActivity[];
  transfer: OrderTransfer | null;
  paymentBreakdown?: Record<string, number> | null;
  attachments?: OrderAttachment[];
  // Included only in getById response:
  invoiceOrders?: Array<{
    id: string;
    invoiceId: string;
    orderId: string;
    invoice: {
      id: string;
      invoiceNumber: string;
      status: InvoiceStatus;
      seamstressConfirmed: boolean;
      warehouseConfirmed: boolean;
      rejectionReason: string | null;
      createdAt: string;
    };
  }>;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productName: string;
  size: string;             // was: sizeName
  quantity: number;         // was: qty
  unitPrice: number;
  fulfillmentMode?: OrderItemFulfillmentMode | null;
  notes: string | null;
  workshopNotes: string | null;
  color: string | null;
  gender: string | null;
  length: string | null;
}

export interface ProductionTask {
  id: string;
  orderId: string;
  orderItemId: string;
  productName: string;
  size: string;
  quantity: number;
  status: ProductionStatus;
  assignedTo: string | null;    // was: assignedToName
  isBlocked: boolean;           // was: flagged
  blockReason: string | null;   // was: flagReason
  defects: string | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  // From orderItem relation (Sprint 8):
  color?: string | null;
  gender?: string | null;
  length?: string | null;
  workshopNotes?: string | null;
  // From order relation:
  order: {
    id: string;
    orderNumber: string;
    priority: Priority;
    urgency: Urgency;
    isDemandingClient: boolean;
    dueDate: string | null;
    clientName?: string;        // only in manager view
    clientPhone?: string;       // only in manager view
  };
}

export type ProductionStatus =
  | 'queued' | 'in_progress' | 'done';

export interface OrderAttachment {
  id: string;
  orderId: string;
  orgId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: string;
  createdAt: string;
}

export interface OrderPayment {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  note: string | null;
  authorName: string;
  createdAt: string;
}

export interface OrderActivity {
  id: string;
  orderId: string;
  type: string;
  content: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface OrderTransfer {
  id: string;
  orderId: string;
  status: string;
  managerConfirmed: boolean;
  clientConfirmed: boolean;
  createdAt: string;
}

// ── Warehouse types (used in order API/live state) ──────────────────────────────

export interface OrderWarehouseDocument {
  id: string;
  documentType: 'handoff_to_warehouse' | 'shipment';
  status: string;
  referenceNo?: string | null;
  postedAt: string;
  site?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface OrderWarehouseItemState {
  orderItemId: string;
  productName: string;
  quantity: number;
  fulfillmentMode?: OrderItemFulfillmentMode | null;
  variantKey?: string | null;
  attributesSummary?: string | null;
  reservationId?: string | null;
  reservationStatus: string;
  qtyReserved: number;
  site?: {
    id: string;
    code: string;
    name: string;
  } | null;
  binCodes: string[];
}

export interface OrderWarehouseState {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus | string;
  site?: {
    id: string;
    code: string;
    name: string;
  } | null;
  reservationSummary: {
    total: number;
    active: number;
    consumed: number;
    released: number;
    qtyReserved: number;
  };
  documentSummary: {
    total: number;
    handoff: number;
    shipment: number;
  };
  documents: OrderWarehouseDocument[];
  items: OrderWarehouseItemState[];
}

export interface OrderWarehouseLiveSnapshot {
  orderId: string;
  generatedAt: string;
  warehouseState: OrderWarehouseState;
}

export interface OrderWarehouseStatePatchEvent {
  orderId: string;
  generatedAt: string;
  warehouseState: OrderWarehouseState;
}

export interface OrderWarehouseMetricsPatchEvent {
  orderId: string;
  generatedAt: string;
  site: OrderWarehouseState['site'];
  reservationSummary: OrderWarehouseState['reservationSummary'];
  documentSummary: OrderWarehouseState['documentSummary'];
}

export interface OrderWarehouseStatesResponse {
  count: number;
  results: OrderWarehouseState[];
}

// ── Org member (for manager reassign dropdown) ────────────────────────────────

export interface OrgManager {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'manager' | 'viewer';
}

// ── Create/Update DTOs ────────────────────────────────────────────────────────

export interface CreateOrderDto {
  clientName: string;          // required
  clientPhone: string;         // required (can be empty if clientPhoneForeign is provided)
  clientPhoneForeign?: string; // optional: for non-Kazakhstan numbers
  clientId?: string;           // optional: link to existing ChapanClient
  priority: Priority;
  urgency?: Urgency;
  isDemandingClient?: boolean;
  orderDate?: string;
  dueDate?: string;            // ISO date: '2026-03-25'
  streetAddress?: string;
  city?: string;
  postalCode?: string;
  deliveryType?: string;
  source?: string;
  expectedPaymentMethod?: string;
  totalAmount?: number;
  orderDiscount?: number;
  deliveryFee?: number;
  bankCommissionPercent?: number;
  bankCommissionAmount?: number;
  prepayment?: number;
  paymentMethod?: 'cash' | 'kaspi_qr' | 'kaspi_terminal' | 'transfer' | 'halyk' | 'mixed';
  paymentBreakdown?: Record<string, number>;
  receiptFileNames?: string[];
  items?: CreateOrderItemDto[];
  sourceRequestId?: string;
  managerNote?: string;
  customerType?: 'retail' | 'wholesale';
}

export interface CreateOrderItemDto {
  productName: string;
  color?: string;
  gender?: string;
  length?: string;
  size: string;                // was: sizeName
  quantity: number;            // was: qty (min 1)
  unitPrice: number;
  notes?: string;
  workshopNotes?: string;
}

export interface UpdateOrderDto {
  clientName?: string;
  clientPhone?: string;
  clientPhoneForeign?: string;
  dueDate?: string | null;
  priority?: Priority;
  urgency?: Urgency;
  isDemandingClient?: boolean;
  // Address / delivery
  city?: string;
  streetAddress?: string;
  postalCode?: string;
  deliveryType?: string;
  source?: string;
  orderDate?: string;
  // Financial
  orderDiscount?: number;
  deliveryFee?: number;
  bankCommissionPercent?: number;
  bankCommissionAmount?: number;
  // Payment
  prepayment?: number;
  paymentMethod?: 'cash' | 'kaspi_qr' | 'kaspi_terminal' | 'transfer' | 'halyk' | 'mixed';
  expectedPaymentMethod?: string;
  paymentBreakdown?: Record<string, number>;
  items?: CreateOrderItemDto[];
}

export interface AddPaymentDto {
  amount: number;
  method: string;
  note?: string;
}

// ── Settings/Catalogs ─────────────────────────────────────────────────────────

// Backend returns string[] for catalogs (not {id,name}[])
export interface ChapanCatalogs {
  productCatalog: string[];
  sizeCatalog: string[];
  workers: string[];
  paymentMethodCatalog: string[];   // Sprint 4: user-managed payment methods
}

export interface ChapanProfile {
  displayName: string | null;
  descriptor: string | null;
  orderPrefix: string | null;
  publicIntakeTitle: string | null;
  publicIntakeDescription: string | null;
  publicIntakeEnabled: boolean;
  supportLabel: string | null;
  kazpostDeliveryFee: number;
  railDeliveryFee: number;
  airDeliveryFee: number;
  bankCommissionPercent: number;
}

// ── Change Requests ───────────────────────────────────────────────────────────

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ChapanChangeRequest {
  id: string;
  orderId: string;
  orgId: string;
  status: ChangeRequestStatus;
  requestedBy: string;
  proposedItems: CreateOrderItemDto[];
  managerNote: string | null;
  rejectReason: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    clientName: string;
    priority: Priority;
    status: string;
  };
}

// ── API Response wrappers ─────────────────────────────────────────────────────

export interface ListResponse<T> {
  count: number;
  results: T[];
}

// ── Re-exports from specialized type files ─────────────────────────────────────
// (These are used in other parts of the order domain, so we re-export them)

export type {
  InvoiceStatus,
  InvoiceDocumentColumns,
  InvoiceDocumentRow,
  InvoiceDocumentSourceOrder,
  InvoiceDocumentPayload,
  ChapanInvoice,
} from './invoice.types';

export type {
  ReturnReason,
  ReturnStatus,
  ReturnItemCondition,
  ReturnRefundMethod,
  ChapanReturnItem,
  ChapanReturn,
  CreateReturnItemDto,
  CreateReturnDto,
} from './returns.types';

export {
  RETURN_REASON_LABELS,
  RETURN_CONDITION_LABELS,
  RETURN_REFUND_METHOD_LABELS,
} from './returns.types';

export type {
  ChapanClient,
  ChapanClientAggregated,
  ChapanClientDetail,
  ChapanClientsListParams,
} from './client.types';
