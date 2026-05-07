export type KaspiOrderMatchState = 'matched' | 'partial' | 'unmatched' | 'no_items';

export type KaspiStockImpactState =
  | 'pending_acceptance'
  | 'reserved'
  | 'partial_reserved'
  | 'pending_reservation'
  | 'released'
  | 'no_match'
  | 'no_active_site'
  | 'not_tracked';

export interface KaspiConnection {
  id: string;
  orgId: string;
  sellerName: string | null;
  tokenMasked: string;
  isActive: boolean;
  archivedAt: string | null;
  lastCheckedAt: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KaspiConnectionHistoryItem extends KaspiConnection {
  ordersCount: number;
  completedOrdersCount: number;
  cancelledOrdersCount: number;
  lastOrderUpdateAt: string | null;
}

export interface KaspiOrderItem {
  externalEntryId: string;
  entryNumber: number | null;
  quantity: number | null;
  totalPrice: number | null;
  basePrice: number | null;
  deliveryCost: number | null;
  weight: number | null;
  unitType: string | null;
  categoryCode: string | null;
  categoryTitle: string | null;
  merchantSku: string | null;
  productName: string | null;
  manufacturer: string | null;
  matchState: 'matched' | 'unmatched';
  matchReason: string | null;
  stockImpactState: KaspiStockImpactState;
  warehouseItemId: string | null;
  warehouseItemName: string | null;
  warehouseSku: string | null;
  warehouseVariantId: string | null;
  reservationId: string | null;
  reservationStatus: string | null;
}

export interface KaspiOrder {
  id: string;
  orgId: string;
  connectionId: string;
  externalOrderId: string;
  externalOrderCode: string | null;
  externalState: string | null;
  externalStatus: string | null;
  deliveryMode: string | null;
  totalPrice: number | null;
  paymentMode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  plannedDeliveryDate: string | null;
  creationDate: string | null;
  approvedByBankDate: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  internalOrderId: string | null;
  internalOrderType: string | null;
  matchState: KaspiOrderMatchState;
  stockImpactState: KaspiStockImpactState;
  matchedItems: KaspiOrderItem[];
  unmatchedItems: KaspiOrderItem[];
  lastExternalUpdateAt: string | null;
  lastSyncedAt: string | null;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KaspiOrderDetail extends KaspiOrder {
  statusHistory: Array<{
    key: string;
    label: string;
    at: string | null;
  }>;
  deliverySnapshot: Record<string, unknown> | null;
  customerSnapshot: Record<string, unknown> | null;
  syncDiagnostics: {
    lastExternalUpdateAt: string | null;
    lastSyncedAt: string | null;
    syncError: string | null;
    rawPayloadPresent: boolean;
  };
}

export interface KaspiOrdersSummary {
  total: number;
  newOrNeedsAcceptance: number;
  accepted: number;
  handoffOrDeliveryInProgress: number;
  completed: number;
  cancelledOrReturned: number;
  unmatchedOrStockIssues: number;
}

export interface SaveKaspiConnectionDto {
  apiToken?: string;
  sellerName?: string;
  isActive?: boolean;
}

export interface ListKaspiOrdersParams {
  state?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface KaspiOrdersListResponse {
  count: number;
  results: KaspiOrder[];
}

export interface SyncKaspiOrdersResponse {
  fetched: number;
  upserted: number;
  fetchedPages: number;
  syncedAt: string;
}
