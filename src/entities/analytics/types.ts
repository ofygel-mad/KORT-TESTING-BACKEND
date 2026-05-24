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
    /** P4: number of completed (closed) orders for this manager. */
    completedCount: number;
    totalAmount: number;
    paidAmount: number;
    /** P4: revenue from completed orders only — the payroll-critical metric. */
    completedRevenue: number;
    /** P4: average ticket size (totalAmount / count). */
    avgTicket: number;
  }>;
  /** P4: same shape as managers, aggregated by OrderTemplate. */
  byTemplate: Array<AnalyticsGroupRow>;
  /** P4: same shape, aggregated by Order.lifecycleStage. */
  byLifecycleStage: Array<AnalyticsGroupRow>;
}

export interface AnalyticsGroupRow {
  id: string;
  name: string;
  count: number;
  completedCount: number;
  totalAmount: number;
  paidAmount: number;
  completedRevenue: number;
  avgTicket: number;
}
