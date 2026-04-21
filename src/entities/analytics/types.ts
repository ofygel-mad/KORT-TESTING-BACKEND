export interface AnalyticsOverview {
  period: {
    from: string | null;
    to: string | null;
    ordersCount: number;
  };
  revenue: {
    total: number;
    paid: number;
    unpaid: number;
    completed: number;
  };
  orders: {
    total: number;
    byStatus: Record<string, number>;
    avgAmount: number;
    completionRate: number;
  };
  timeline: Array<{ date: string; count: number; revenue: number }>;
  managers: Array<{
    id: string;
    name: string;
    count: number;
    totalAmount: number;
    paidAmount: number;
  }>;
}
