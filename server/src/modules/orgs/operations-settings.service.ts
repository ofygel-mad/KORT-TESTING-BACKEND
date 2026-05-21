import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';

// ── Operations defaults (delivery fees, bank commission) ─────────────

export async function getOperationsSettings(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new NotFoundError('Organization');

  return {
    kazpostDeliveryFee: org.kazpostDeliveryFee,
    railDeliveryFee: org.railDeliveryFee,
    airDeliveryFee: org.airDeliveryFee,
    bankCommissionPercent: org.bankCommissionPercent,
  };
}

export async function updateOperationsSettings(orgId: string, data: Record<string, unknown>) {
  const org = await prisma.organization.update({
    where: { id: orgId },
    data: {
      kazpostDeliveryFee: data.kazpostDeliveryFee as number | undefined,
      railDeliveryFee: data.railDeliveryFee as number | undefined,
      airDeliveryFee: data.airDeliveryFee as number | undefined,
    },
  });

  return {
    kazpostDeliveryFee: org.kazpostDeliveryFee,
    railDeliveryFee: org.railDeliveryFee,
    airDeliveryFee: org.airDeliveryFee,
    bankCommissionPercent: org.bankCommissionPercent,
  };
}

export async function updateBankCommission(orgId: string, percent: number) {
  const org = await prisma.organization.update({
    where: { id: orgId },
    data: { bankCommissionPercent: percent },
  });
  return { bankCommissionPercent: org.bankCommissionPercent };
}

// ── Catalogs ────────────────────────────────────────────

// ── Size sort helpers ──────────────────────────────────
const LETTER_SORT_ORDER: Record<string, number> = {
  'XS': 142, 'xs': 142,
  'S': 144,  's': 144,
  'M': 146,  'm': 146,
  'L': 148,  'l': 148,
  'XL': 150, 'xl': 150,
  'XXL': 152, 'xxl': 152, '2XL': 152, '2xl': 152,
  'XXXL': 154, 'xxxl': 154, '3XL': 154, '3xl': 154,
};

function sizeToSortOrder(name: string): number {
  const n = parseInt(name, 10);
  if (!isNaN(n) && String(n) === name.trim()) return n; // pure numeric: 38, 40...
  return LETTER_SORT_ORDER[name.trim()] ?? 999;
}

export async function getCatalogs(orgId: string) {
  const [products, sizes, workers, paymentMethods] = await Promise.all([
    prisma.warehouseProductCatalog.findMany({ where: { orgId }, select: { name: true } }),
    prisma.productSize.findMany({ where: { orgId }, select: { name: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.worker.findMany({ where: { orgId }, select: { name: true } }),
    prisma.paymentMethod.findMany({ where: { orgId }, select: { name: true }, orderBy: { name: 'asc' } }),
  ]);

  return {
    productCatalog: products.map((p) => p.name),
    sizeCatalog: sizes.map((s) => s.name), // already sorted by sortOrder asc
    workers: workers.map((w) => w.name),
    paymentMethodCatalog: paymentMethods.map((m) => m.name),
  };
}

export async function saveCatalogs(orgId: string, data: {
  productCatalog?: string[];
  sizeCatalog?: string[];
  workers?: string[];
  paymentMethodCatalog?: string[];
}) {
  await prisma.$transaction(async (tx) => {
    if (data.productCatalog) {
      await tx.warehouseProductCatalog.deleteMany({ where: { orgId } });
      const unique = [...new Set(data.productCatalog.map((n) => n.trim()).filter(Boolean))];
      if (unique.length > 0) {
        await tx.warehouseProductCatalog.createMany({
          data: unique.map((name) => ({ orgId, name, normalizedName: name.toLowerCase() })),
        });
      }
    }

    if (data.sizeCatalog) {
      await tx.productSize.deleteMany({ where: { orgId } });
      const unique = [...new Set(data.sizeCatalog.map((n) => n.trim()).filter(Boolean))];
      if (unique.length > 0) {
        await tx.productSize.createMany({
          data: unique.map((name) => ({ orgId, name, sortOrder: sizeToSortOrder(name) })),
        });
      }
    }

    if (data.workers) {
      await tx.worker.deleteMany({ where: { orgId } });
      const unique = [...new Set(data.workers.map((n) => n.trim()).filter(Boolean))];
      if (unique.length > 0) {
        await tx.worker.createMany({
          data: unique.map((name) => ({ orgId, name })),
        });
      }
    }

    if (data.paymentMethodCatalog) {
      await tx.paymentMethod.deleteMany({ where: { orgId } });
      const unique = [...new Set(data.paymentMethodCatalog.map((n) => n.trim()).filter(Boolean))];
      if (unique.length > 0) {
        await tx.paymentMethod.createMany({
          data: unique.map((name) => ({ orgId, name })),
        });
      }
    }
  });
}

// ── Clients (org customer reference) ────────────────────

export async function getClients(orgId: string) {
  return prisma.customer.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createClient(orgId: string, data: {
  fullName: string;
  phone: string;
  email?: string;
  company?: string;
  notes?: string;
}) {
  return prisma.customer.create({
    data: {
      orgId,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      companyName: data.company,
      notes: data.notes,
    },
  });
}
