import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';

async function nextRequestNumber(orgId: string): Promise<string> {
  const org = await prisma.organization.update({
    where: { id: orgId },
    data: { requestCounter: { increment: 1 } },
    select: { requestCounter: true },
  });

  return `RQ-${String(org.requestCounter).padStart(3, '0')}`;
}

// ── List requests ───────────────────────────────────────

export async function list(orgId: string, statusFilter?: string) {
  const where: Record<string, unknown> = { orgId };
  if (statusFilter && statusFilter !== 'all') {
    where.status = statusFilter;
  }

  return prisma.materialRequest.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Submit request (public or internal) ─────────────────

export async function submit(orgId: string, data: {
  customerName: string;
  phone: string;
  messengers?: string[];
  city?: string;
  deliveryMethod?: string;
  leadSource?: string;
  preferredContact: string;
  desiredDate?: string;
  notes?: string;
  source?: string;
  items: Array<{
    productName: string;
    attributes?: Record<string, string>;
    quantity: number;
    notes?: string;
  }>;
}) {
  const requestNumber = await nextRequestNumber(orgId);

  return prisma.materialRequest.create({
    data: {
      orgId,
      requestNumber,
      customerName: data.customerName.trim(),
      phone: data.phone.trim(),
      messengers: data.messengers ?? [],
      city: data.city?.trim(),
      deliveryMethod: data.deliveryMethod?.trim(),
      leadSource: data.leadSource?.trim(),
      preferredContact: data.preferredContact,
      desiredDate: data.desiredDate ? new Date(data.desiredDate) : undefined,
      notes: data.notes?.trim(),
      source: data.source ?? 'public_form',
      items: {
        create: data.items.map((item) => ({
          productName: item.productName.trim(),
          attributesJson: item.attributes && Object.keys(item.attributes).length > 0
            ? item.attributes
            : undefined,
          quantity: Math.max(1, item.quantity),
          notes: item.notes?.trim(),
        })),
      },
    },
    include: { items: true },
  });
}

// ── Update request status ───────────────────────────────

export async function updateStatus(orgId: string, id: string, status: string, createdOrderId?: string) {
  const request = await prisma.materialRequest.findFirst({ where: { id, orgId } });
  if (!request) throw new NotFoundError('MaterialRequest', id);

  return prisma.materialRequest.update({
    where: { id },
    data: {
      status,
      createdOrderId: createdOrderId ?? undefined,
    },
  });
}

// ── Get profile for public form ─────────────────────────

export async function getPublicProfile(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return null;

  // Also fetch catalogs for the form
  const [products, sizes] = await Promise.all([
    prisma.warehouseProductCatalog.findMany({ where: { orgId }, select: { name: true } }),
    prisma.productSize.findMany({ where: { orgId }, select: { name: true } }),
  ]);

  return {
    displayName: org.name,
    publicIntakeTitle: 'Оставьте заявку',
    publicIntakeDescription: '',
    supportLabel: '',
    catalogs: {
      products: products.map((p) => p.name),
      sizes: sizes.map((s) => s.name),
    },
  };
}
