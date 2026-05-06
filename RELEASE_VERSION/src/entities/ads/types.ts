export type AdChannel = 'target' | 'instagram' | 'partner' | 'other';

export interface ExchangeRate {
  id: string;
  base: string;
  quote: string;
  rate: number;
  source: string;
  rateDate: string;
  fetchedAt: string;
  isFallback?: boolean;
}

export interface AdSummary {
  spendUsd: number;
  spendKzt: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  sales: number;
  averageRate: number;
  ctr: number;
  cpcUsd: number;
  cpcKzt: number;
  clickToLeadCr: number;
  cplUsd: number;
  cplKzt: number;
  leadToSaleCr: number;
  customerCostUsd: number;
  customerCostKzt: number;
}

export interface AdDailyMetric {
  id: string;
  orgId: string;
  campaignId: string;
  date: string;
  spendUsd: number;
  exchangeRate: number;
  spendKzt: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  sales: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdCampaignReport {
  id: string;
  orgId: string;
  name: string;
  channel: AdChannel;
  status: string;
  managerName?: string | null;
  creativeUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  metrics: AdDailyMetric[];
  summary: AdSummary;
}

export interface AdsDashboard {
  period: string;
  channel: AdChannel;
  sourceNotes: string[];
  exchangeRate: ExchangeRate;
  summary: AdSummary;
  campaigns: AdCampaignReport[];
}

export interface CreateAdCampaignDto {
  name: string;
  channel: AdChannel;
  managerName?: string;
  creativeUrl?: string;
  notes?: string;
}

export interface UpsertAdMetricDto {
  campaignId: string;
  date: string;
  spendUsd?: number;
  exchangeRate?: number;
  impressions?: number;
  reach?: number;
  clicks?: number;
  leads?: number;
  sales?: number;
  notes?: string;
}

export interface UpdateAdCampaignDto {
  name?: string;
  managerName?: string | null;
  creativeUrl?: string | null;
}

export interface AdsExportRow {
  date: string;
  channel: string;
  campaign: string;
  managerName: string;
  spendUsd: number;
  exchangeRate: number;
  spendKzt: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  leads: number;
  clickToLeadCr: number;
  cplUsd: number;
  cplKzt: number;
  sales: number;
  leadToSaleCr: number;
  customerCostUsd: number;
  customerCostKzt: number;
  notes: string;
}
