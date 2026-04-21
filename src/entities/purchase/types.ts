export type PurchaseType = 'workshop' | 'market';

export interface ManualInvoiceItem {
  id: string;
  productName: string;
  color?: string | null;
  size?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface ManualInvoice {
  id: string;
  orgId: string;
  type: PurchaseType;
  invoiceNum: string;
  title: string;
  notes?: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  items: ManualInvoiceItem[];
}

export interface CreateManualInvoiceDto {
  type: PurchaseType;
  title: string;
  notes?: string;
  items: Array<{
    productName: string;
    color?: string;
    size?: string;
    quantity: number;
    unitPrice: number;
  }>;
}
