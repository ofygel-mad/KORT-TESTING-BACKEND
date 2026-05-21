import { prisma } from '../../lib/prisma.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

export async function createUnpaidAlert(
  orgId: string,
  orderId: string,
  orderNumber: string,
  createdBy: string
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, orgId },
  });

  if (!order) throw new NotFoundError('Order', orderId);
  if (order.paymentStatus === 'paid') {
    throw new ValidationError('Заказ полностью оплачен');
  }

  // Check if alert already exists and not resolved
  const existingAlert = await prisma.unpaidAlert.findFirst({
    where: {
      orderId,
      resolvedAt: null,
    },
  });

  if (existingAlert) {
    return existingAlert;
  }

  const alert = await prisma.unpaidAlert.create({
    data: {
      orgId,
      orderId,
      orderNumber,
      createdBy,
    },
  });

  return alert;
}

export async function getUnpaidAlerts(orgId: string) {
  const alerts = await prisma.unpaidAlert.findMany({
    where: {
      orgId,
      resolvedAt: null,
    },
    include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            paidAmount: true,
            orderDiscount: true,
            deliveryFee: true,
            bankCommissionPercent: true,
            bankCommissionAmount: true,
            clientName: true,
            paymentStatus: true,
          },
        },
      },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return alerts;
}

export async function resolveAlert(orgId: string, alertId: string, resolvedBy: string) {
  const alert = await prisma.unpaidAlert.findFirst({
    where: { id: alertId, orgId },
  });

  if (!alert) throw new NotFoundError('UnpaidAlert', alertId);

  const updated = await prisma.unpaidAlert.update({
    where: { id: alertId },
    data: {
      resolvedAt: new Date(),
      resolvedBy,
    },
  });

  return updated;
}

export async function getAlertForOrder(orderId: string) {
  return prisma.unpaidAlert.findFirst({
    where: {
      orderId,
      resolvedAt: null,
    },
  });
}
