import { prisma } from '../../lib/prisma.js';
import { calculateOrderFinancials } from '../orders/financials.js';

export type AnalyticsGroupBy = 'managerId' | 'templateId' | 'lifecycleStage';

export async function getOverview(orgId: string, dateFrom?: Date, dateTo?: Date) {
  const dateFilter =
    dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {};

  const orders = await prisma.order.findMany({
    where: { orgId, deletedAt: null, ...dateFilter },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      paidAmount: true,
      orderDiscount: true,
      deliveryFee: true,
      bankCommissionPercent: true,
      bankCommissionAmount: true,
      managerId: true,
      managerName: true,
      createdAt: true,
      // P4: groupBy dimensions
      templateId: true,
      lifecycleStage: true,
      template: { select: { name: true } },
    },
  });

  const orderDueAmounts = orders.map((o) => calculateOrderFinancials({
    itemsSubtotal: o.totalAmount,
    orderDiscount: o.orderDiscount,
    deliveryFee: o.deliveryFee,
    bankCommissionPercent: o.bankCommissionPercent,
    bankCommissionAmount: o.bankCommissionAmount,
  }).totalDue);
  const totalRevenue = orderDueAmounts.reduce((s, amount) => s + amount, 0);
  const totalPaid = orders.reduce((s, o) => s + o.paidAmount, 0);
  const completed = orders.filter((o) => o.status === 'completed');
  const orderDueById = new Map(orders.map((o, index) => [o.id ?? String(index), orderDueAmounts[index] ?? 0] as const));

  const byStatus: Record<string, number> = {};
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  }

  const timelineMap = new Map<string, { count: number; revenue: number }>();
  for (const [index, o] of orders.entries()) {
    const day = o.createdAt.toISOString().slice(0, 10);
    const cur = timelineMap.get(day) ?? { count: 0, revenue: 0 };
    timelineMap.set(day, { count: cur.count + 1, revenue: cur.revenue + (orderDueAmounts[index] ?? 0) });
  }
  const timeline = [...timelineMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, ...d }));

  // P4: per-manager aggregation augmented with the metrics required by the
  // future payroll module: completedRevenue, completedCount, avgTicket.
  // Until salary rules ship in a later session, these read-only stats simply
  // appear in Analytics; they don't drive any payout calculation yet.
  const managerMap = new Map<
    string,
    {
      id: string;
      name: string;
      count: number;
      completedCount: number;
      totalAmount: number;
      paidAmount: number;
      completedRevenue: number;
    }
  >();
  for (const [index, o] of orders.entries()) {
    if (!o.managerId) continue;
    const due = orderDueAmounts[index] ?? 0;
    const isCompleted = o.status === 'completed';
    const cur = managerMap.get(o.managerId) ?? {
      id: o.managerId,
      name: o.managerName ?? '—',
      count: 0,
      completedCount: 0,
      totalAmount: 0,
      paidAmount: 0,
      completedRevenue: 0,
    };
    managerMap.set(o.managerId, {
      ...cur,
      count: cur.count + 1,
      completedCount: cur.completedCount + (isCompleted ? 1 : 0),
      totalAmount: cur.totalAmount + due,
      paidAmount: cur.paidAmount + o.paidAmount,
      completedRevenue: cur.completedRevenue + (isCompleted ? due : 0),
    });
  }
  const managers = [...managerMap.values()]
    .map((m) => ({
      ...m,
      avgTicket: m.count > 0 ? m.totalAmount / m.count : 0,
    }))
    .sort((a, b) => b.completedRevenue - a.completedRevenue);

  // P4: generic groupBy aggregator — same shape across managerId/templateId/
  // lifecycleStage so the frontend renders any axis with the same component.
  function aggregateBy(getKey: (i: number) => { id: string; name: string } | null) {
    const map = new Map<string, {
      id: string;
      name: string;
      count: number;
      completedCount: number;
      totalAmount: number;
      paidAmount: number;
      completedRevenue: number;
    }>();
    for (let i = 0; i < orders.length; i += 1) {
      const o = orders[i];
      if (!o) continue;
      const key = getKey(i);
      if (!key) continue;
      const due = orderDueAmounts[i] ?? 0;
      const isCompleted = o.status === 'completed';
      const cur = map.get(key.id) ?? {
        id: key.id,
        name: key.name,
        count: 0,
        completedCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        completedRevenue: 0,
      };
      map.set(key.id, {
        ...cur,
        count: cur.count + 1,
        completedCount: cur.completedCount + (isCompleted ? 1 : 0),
        totalAmount: cur.totalAmount + due,
        paidAmount: cur.paidAmount + o.paidAmount,
        completedRevenue: cur.completedRevenue + (isCompleted ? due : 0),
      });
    }
    return [...map.values()]
      .map((row) => ({ ...row, avgTicket: row.count > 0 ? row.totalAmount / row.count : 0 }))
      .sort((a, b) => b.completedRevenue - a.completedRevenue);
  }

  const byTemplate = aggregateBy((i) => {
    const o = orders[i];
    if (!o?.templateId) return null;
    return { id: o.templateId, name: o.template?.name ?? 'Без шаблона' };
  });
  const byLifecycleStage = aggregateBy((i) => {
    const o = orders[i];
    const stage = o?.lifecycleStage ?? null;
    if (!stage) return null;
    return { id: stage, name: stage };
  });

  return {
    period: {
      from: dateFrom?.toISOString() ?? null,
      to: dateTo?.toISOString() ?? null,
      ordersCount: orders.length,
    },
    revenue: {
      total: totalRevenue,
      paid: totalPaid,
      unpaid: totalRevenue - totalPaid,
      completed: completed.reduce((s, o) => s + (orderDueById.get(o.id) ?? 0), 0),
    },
    orders: {
      total: orders.length,
      byStatus,
      avgAmount: orders.length > 0 ? totalRevenue / orders.length : 0,
      completionRate: orders.length > 0 ? (completed.length / orders.length) * 100 : 0,
    },
    timeline,
    managers,
    byTemplate,
    byLifecycleStage,
  };
}
