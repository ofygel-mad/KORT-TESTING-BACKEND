import { api } from '../../shared/api/client';

export type WorkzoneProfile = {
  displayName: string;
  descriptor: string;
  orderPrefix: string;
  publicIntakeTitle: string;
  publicIntakeDescription: string;
  publicIntakeEnabled: boolean;
  supportLabel: string;
};

export type ClientRequest = {
  id: string;
  requestNumber: string;
  customerName: string;
  phone: string;
  messengers?: Array<'whatsapp' | 'telegram'>;
  city?: string;
  deliveryMethod?: string;
  leadSource?: string;
  preferredContact: 'phone' | 'whatsapp' | 'telegram';
  desiredDate?: string;
  notes?: string;
  source: 'public_form' | 'manager' | 'whatsapp';
  status: 'new' | 'reviewed' | 'converted' | 'archived';
  items: Array<{
    id: string;
    productName: string;
    fabricPreference?: string;
    size?: string;
    quantity: number;
    notes?: string;
  }>;
  createdOrderId?: string;
  createdAt: string;
  updatedAt: string;
};

export const PRODUCT_CATALOG = ['Костюм', 'Платье', 'Рубашка'];
export const FABRIC_CATALOG = ['Хлопок', 'Шелк', 'Лен'];
export const SIZE_OPTIONS = ['42', '44', '46', '48', '50', '52'];

type ListResponse<T> = { count: number; results: T[] };

export const chapanApi = {
  getProfile: () => api.get<WorkzoneProfile>('/chapan/settings/profile'),
  getCatalogs: () =>
    api.get<{
      productCatalog: string[];
      fabricCatalog: string[];
      sizeCatalog: string[];
      workers: string[];
    }>('/chapan/settings/catalogs'),
  submitClientRequest: (data: {
    customerName: string;
    phone: string;
    messengers?: Array<'whatsapp' | 'telegram'>;
    city?: string;
    deliveryMethod?: string;
    leadSource?: string;
    preferredContact: 'phone' | 'whatsapp' | 'telegram';
    desiredDate?: string;
    notes?: string;
    source?: ClientRequest['source'];
    items: Array<{
      productName: string;
      fabricPreference?: string;
      size?: string;
      quantity: number;
      notes?: string;
    }>;
  }) => api.post<ClientRequest>('/chapan/requests', data),
};

