import { api, apiClient } from '@/shared/api/client';
import type {
  Order, Invoice, CreateOrderDto, UpdateOrderDto, AddPaymentDto, ListResponse,
  ProductionTask, OperationsCatalogs, OperationsSettings, Customer, ChangeRequest, CreateOrderItemDto, InvoiceDocumentPayload,
  OrderAttachment, OrderWarehouseState, OrgManager,
  Return, CreateReturnDto, CustomerAggregated, CustomerDetail, CustomersListParams,
} from './types';

// ── Orders ────────────────────────────────────────────────────────────────────

export const ordersApi = {
  list: (params?: {
    status?: string;
    statuses?: string;
    /** Comma-separated list of statuses to EXCLUDE (e.g. "completed,cancelled"
     *  to back the lifecycle "Активные" chip). */
    statusNotIn?: string;
    priority?: string;
    paymentStatus?: string;
    search?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
    archived?: boolean;
    hasWarehouseItems?: boolean;
    createdFrom?: string;
    createdTo?: string;
    managerId?: string;
    mineOnly?: boolean;
    customerType?: string;
  }) =>
    api.get<ListResponse<Order>>('/orders', params),

  get: (id: string, params?: { mineOnly?: boolean }) =>
    api.get<Order>(`/orders/${id}`, params),

  getWarehouseState: (id: string) =>
    api.get<OrderWarehouseState>(`/orders/${id}/warehouse-state`),

  listWarehouseStates: (ids: string[]) =>
    api.get<{ count: number; results: OrderWarehouseState[] }>('/orders/warehouse-states', {
      ids: ids.join(','),
    }),

  create: (dto: CreateOrderDto, idempotencyKey?: string) =>
    api.post<Order>(
      '/orders',
      dto,
      idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    ),

  update: (id: string, dto: UpdateOrderDto) =>
    api.patch<Order>(`/orders/${id}`, dto),

  restore: (id: string, _status?: string) =>
    api.post<{ ok: boolean }>(`/orders/${id}/restore`, {}),

  archive: (id: string) =>
    api.post<{ ok: boolean }>(`/orders/${id}/archive`, {}),

  close: (id: string) =>
    api.post<{ ok: boolean }>(`/orders/${id}/close`, {}),

  confirm: (id: string) =>
    api.post<{ ok: boolean }>(`/orders/${id}/confirm`, {}),

  changeStatus: (id: string, status: string) =>
    api.patch<{ ok: boolean }>(`/orders/${id}/status`, { status }),

  addPayment: (id: string, dto: AddPaymentDto) =>
    api.post<{ ok: boolean }>(`/orders/${id}/payments`, {
      amount: dto.amount,
      method: dto.method,
      notes: dto.note,
    }),

  ship: (id: string, data?: {
    courierType?: string;
    recipientName?: string;
    recipientAddress?: string;
    shippingNote?: string;
  }) =>
    api.post<{ ok: boolean }>(`/orders/${id}/ship`, data ?? {}),

  fulfillFromStock: (id: string) =>
    api.post<{ ok: boolean }>(`/orders/${id}/fulfill-from-stock`, {}),

  routeItems: (
    id: string,
    items: Array<{ itemId: string; fulfillmentMode: 'warehouse' | 'production' }>,
  ) =>
    api.post<Order>(`/orders/${id}/route-items`, { items }),

  addActivity: (id: string, content: string) =>
    api.post<{ ok: boolean }>(`/orders/${id}/activities`, {
      type: 'comment',
      content,
    }),

  setRequiresInvoice: (id: string, requiresInvoice: boolean) =>
    api.patch<{ ok: boolean }>(`/orders/${id}/requires-invoice`, { requiresInvoice }),

  returnToReady: (id: string, reason: string) =>
    api.post<{ ok: boolean }>(`/orders/${id}/return-to-ready`, { reason }),

  requestItemChange: (id: string, items: CreateOrderItemDto[], managerNote?: string) =>
    api.post<ChangeRequest>(`/orders/${id}/change-request`, { items, managerNote }),

  // Trash (soft-delete)
  trash: (id: string) =>
    api.post<{ ok: boolean }>(`/orders/${id}/trash`, {}),
  restoreFromTrash: (id: string) =>
    api.post<{ ok: boolean }>(`/orders/${id}/restore-from-trash`, {}),
  permanentDelete: (id: string) =>
    api.delete<{ ok: boolean }>(`/orders/${id}`),
  listTrashed: () =>
    api.get<Order[]>('/orders/trash'),

  routeItem: (orderId: string, itemId: string, fulfillmentMode: 'warehouse' | 'production') =>
    api.post<{ ok: boolean }>(`/orders/${orderId}/items/${itemId}/route`, { fulfillmentMode }),

  reassignManager: (orderId: string, managerId: string) =>
    api.patch<Order>(`/orders/${orderId}/manager`, { managerId }),

  listManagers: () =>
    api.get<OrgManager[]>('/orders/managers'),
};

// ── Production ────────────────────────────────────────────────────────────────

export const productionApi = {
  // Manager view — includes clientName/clientPhone
  list: (params?: { status?: string; assignedTo?: string }) =>
    api.get<ListResponse<ProductionTask>>('/production', params),

  // Workshop view — no PII
  listWorkshop: () =>
    api.get<ListResponse<ProductionTask>>('/production/workshop'),

  claim: (taskId: string) =>
    api.post<{ ok: boolean }>(`/production/${taskId}/claim`, {}),

  updateStatus: (taskId: string, status: string) =>
    api.patch<{ ok: boolean; orderId: string }>(`/production/${taskId}/status`, { status }),

  assignWorker: (taskId: string, worker: string | null) =>
    api.patch<{ ok: boolean }>(`/production/${taskId}/assign`, { worker }),

  flag: (taskId: string, reason: string) =>
    api.post<{ ok: boolean }>(`/production/${taskId}/flag`, { reason }),

  unflag: (taskId: string) =>
    api.post<{ ok: boolean }>(`/production/${taskId}/unflag`, {}),

  setDefect: (taskId: string, defect: string) =>
    api.patch<{ ok: boolean }>(`/production/${taskId}/defect`, { defect }),
};

// ── Invoices (Накладные) ──────────────────────────────────────────────────────

export const invoicesApi = {
  create: (orderIds: string[], notes?: string, documentPayload?: InvoiceDocumentPayload) =>
    api.post<Invoice>('/invoices', { orderIds, notes, documentPayload }),

  list: (params?: { status?: string; orderId?: string; limit?: number; offset?: number }) =>
    api.get<ListResponse<Invoice>>('/invoices', params),

  get: (id: string) =>
    api.get<Invoice>(`/invoices/${id}`),

  previewDocument: (orderIds: string[]) =>
    api.post<InvoiceDocumentPayload>('/invoices/preview', { orderIds }),

  saveDocument: (id: string, documentPayload: InvoiceDocumentPayload) =>
    api.patch<Invoice>(`/invoices/${id}/document`, { documentPayload }),

  confirmSeamstress: (id: string) =>
    api.post<{ bothConfirmed: boolean }>(`/invoices/${id}/confirm-seamstress`, {}),

  confirmWarehouse: (id: string) =>
    api.post<{ bothConfirmed: boolean }>(`/invoices/${id}/confirm-warehouse`, {}),

  reject: (id: string, reason: string) =>
    api.post<{ ok: boolean }>(`/invoices/${id}/reject`, { reason }),

  archive: (id: string) =>
    api.post<{ ok: boolean }>(`/invoices/${id}/archive`, {}),
};

// ── Change Requests ───────────────────────────────────────────────────────────

export const changeRequestsApi = {
  list: () =>
    api.get<ChangeRequest[]>('/orders/change-requests'),

  approve: (crId: string) =>
    api.post<{ ok: boolean }>(`/orders/change-requests/${crId}/approve`, {}),

  reject: (crId: string, rejectReason: string) =>
    api.post<{ ok: boolean }>(`/orders/change-requests/${crId}/reject`, { rejectReason }),
};

// ── Settings ──────────────────────────────────────────────────────────────────

export const operationsSettingsApi = {
  getProfile: () =>
    api.get<OperationsSettings>('/settings/operations/defaults'),

  updateProfile: (data: Partial<OperationsSettings>) =>
    api.patch<OperationsSettings>('/settings/operations/defaults', data),

  updateBankCommission: (percent: number) =>
    api.patch<{ bankCommissionPercent: number }>('/settings/operations/bank-commission', { bankCommissionPercent: percent }),

  getCatalogs: () =>
    api.get<OperationsCatalogs>('/settings/operations/catalogs'),

  // Full replace — send entire new arrays
  saveCatalogs: (data: Partial<OperationsCatalogs>) =>
    api.put<{ ok: boolean }>('/settings/operations/catalogs', data),

  getClients: () =>
    api.get<ListResponse<Customer>>('/settings/operations/clients'),

  createClient: (data: { fullName: string; phone: string; email?: string; company?: string; notes?: string }) =>
    api.post<Customer>('/settings/operations/clients', data),
};

// ── Attachments ───────────────────────────────────────────────────────────────

export const attachmentsApi = {
  list: (orderId: string) =>
    api.get<OrderAttachment[]>(`/orders/${orderId}/attachments`),

  upload: (orderId: string, file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiClient
      .post<OrderAttachment>(`/orders/${orderId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data);
  },

  download: (orderId: string, attachmentId: string) =>
    `/api/v1/orders/${orderId}/attachments/${attachmentId}/file`,

  delete: (orderId: string, attachmentId: string) =>
    api.delete<{ ok: boolean }>(`/orders/${orderId}/attachments/${attachmentId}`),
};

// ── Returns (Акты возврата) ───────────────────────────────────────────────────

export const returnsApi = {
  list: (params?: { orderId?: string; status?: string }) =>
    api.get<{ count: number; results: Return[] }>('/returns', params),

  get: (id: string) =>
    api.get<Return>(`/returns/${id}`),

  create: (dto: CreateReturnDto) =>
    api.post<Return>('/returns', dto),

  confirm: (id: string) =>
    api.post<Return>(`/returns/${id}/confirm`, {}),

  deleteDraft: (id: string) =>
    api.delete<{ ok: boolean }>(`/returns/${id}`),
};

// ── Clients API ───────────────────────────────────────────────────────────────
export const clientsApi = {
  list: (params?: CustomersListParams) =>
    api.get<{ count: number; results: CustomerAggregated[] }>('/clients', { params }),

  get: (id: string) =>
    api.get<CustomerDetail>(`/clients/${id}`),

  update: (
    id: string,
    data: Partial<Pick<CustomerAggregated, 'fullName' | 'phone' | 'email' | 'company' | 'notes'>>,
  ) => api.patch<CustomerAggregated>(`/clients/${id}`, data),
};

// ── Users / account API ───────────────────────────────────────────────────────
export const usersApi = {
  changeEmail: (new_email: string, current_password: string) =>
    api.post<{ ok: boolean; requires_relogin: boolean }>('/users/me/change-email', { new_email, current_password }),
};
