import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { addMovement } from '../warehouse/warehouse.service.js';

// ── attributesJson helpers (P0 multi-business cleanup) ────────────────────────
// ReturnItem no longer has per-attribute columns (size/color/gender). The
// canonical source for those values is the linked OrderItem.attributesJson.
// Frontend callers still expect `size`, `color`, `gender` on ReturnItem rows,
// so we hydrate them on the way out by batch-fetching the relevant OrderItems.

function readAttrFromJson(value: Prisma.JsonValue | null | undefined, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>)[key];
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  return str ? str : null;
}

async function loadAttributesByOrderItemId(
  orderItemIds: Array<string | null | undefined>,
): Promise<Map<string, Prisma.JsonValue | null>> {
  const ids = Array.from(new Set(orderItemIds.filter((id): id is string => typeof id === 'string' && id.length > 0)));
  if (ids.length === 0) return new Map();
  const rows = await prisma.orderItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, attributesJson: true },
  });
  return new Map(rows.map((row) => [row.id, row.attributesJson ?? null]));
}

type HydratableItem = { orderItemId: string | null };

function hydrateItem<T extends HydratableItem>(
  item: T,
  attrsById: Map<string, Prisma.JsonValue | null>,
): T & { size: string; color: string | null; gender: string | null } {
  const attrs = item.orderItemId ? attrsById.get(item.orderItemId) ?? null : null;
  return {
    ...item,
    size: readAttrFromJson(attrs, 'size') ?? '',
    color: readAttrFromJson(attrs, 'color'),
    gender: readAttrFromJson(attrs, 'gender'),
  };
}

async function hydrateReturn<R extends { items: HydratableItem[] }>(ret: R) {
  const attrsById = await loadAttributesByOrderItemId(ret.items.map((i) => i.orderItemId));
  return { ...ret, items: ret.items.map((item) => hydrateItem(item, attrsById)) };
}

async function hydrateReturns<R extends { items: HydratableItem[] }>(rets: R[]) {
  const attrsById = await loadAttributesByOrderItemId(
    rets.flatMap((r) => r.items.map((i) => i.orderItemId)),
  );
  return rets.map((ret) => ({
    ...ret,
    items: ret.items.map((item) => hydrateItem(item, attrsById)),
  }));
}

// ── Return number generation ──────────────────────────────────────────────────

async function nextReturnNumber(orgId: string): Promise<string> {
  const last = await prisma.return.findFirst({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    select: { returnNumber: true },
  });

  if (!last) return 'RET-0001';

  const match = last.returnNumber.match(/^RET-(\d+)$/);
  const seq = match?.[1] ? parseInt(match[1], 10) + 1 : 1;
  return `RET-${String(seq).padStart(4, '0')}`;
}

// ── Selects ───────────────────────────────────────────────────────────────────

const returnWithItems = {
  id: true,
  orgId: true,
  returnNumber: true,
  orderId: true,
  status: true,
  reason: true,
  reasonNotes: true,
  createdById: true,
  createdByName: true,
  confirmedAt: true,
  confirmedBy: true,
  totalRefundAmount: true,
  refundMethod: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      clientName: true,
      clientPhone: true,
      status: true,
    },
  },
  items: {
    select: {
      id: true,
      returnId: true,
      orderItemId: true,
      productName: true,
      qty: true,
      unitPrice: true,
      refundAmount: true,
      condition: true,
      warehouseItemId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateReturnItemDto {
  orderItemId?: string;
  productName: string;
  // P0: ReturnItem dropped size/color/gender columns. The wire-format DTO
  // still accepts them for backward-compat with the frontend, but the values
  // live on the linked OrderItem.attributesJson and are ignored here.
  size?: string;
  color?: string;
  gender?: string;
  qty: number;
  unitPrice: number;
  refundAmount: number;
  condition: 'good' | 'defective' | 'damaged';
  warehouseItemId?: string;
}

export interface CreateReturnDto {
  orderId: string;
  reason: 'defect' | 'wrong_size' | 'wrong_item' | 'customer_refusal' | 'other';
  reasonNotes?: string;
  refundMethod: 'cash' | 'bank';
  items: CreateReturnItemDto[];
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function list(
  orgId: string,
  filters: { orderId?: string; status?: string } = {},
) {
  const rows = await prisma.return.findMany({
    where: {
      orgId,
      ...(filters.orderId ? { orderId: filters.orderId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    select: returnWithItems,
    orderBy: { createdAt: 'desc' },
  });
  return hydrateReturns(rows);
}

export async function getById(orgId: string, id: string) {
  const ret = await prisma.return.findFirst({
    where: { id, orgId },
    select: returnWithItems,
  });
  if (!ret) throw new NotFoundError('Акт возврата не найден');
  return hydrateReturn(ret);
}

export async function create(
  orgId: string,
  userId: string,
  userName: string,
  dto: CreateReturnDto,
) {
  const order = await prisma.order.findFirst({
    where: { id: dto.orderId, orgId },
    select: { id: true, status: true },
  });
  if (!order) throw new NotFoundError('Заказ не найден');

  if (!['shipped', 'completed'].includes(order.status)) {
    throw new AppError(
      400,
      'Возврат можно оформить только для отправленных или завершённых заказов',
      'INVALID_ORDER_STATUS',
    );
  }

  if (dto.items.length === 0) {
    throw new AppError(400, 'Укажите хотя бы одну позицию для возврата', 'EMPTY_ITEMS');
  }

  const totalRefundAmount = dto.items.reduce((sum, i) => sum + i.refundAmount, 0);
  const returnNumber = await nextReturnNumber(orgId);

  const created = await prisma.return.create({
    data: {
      orgId,
      returnNumber,
      orderId: dto.orderId,
      status: 'draft',
      reason: dto.reason,
      reasonNotes: dto.reasonNotes,
      createdById: userId,
      createdByName: userName,
      totalRefundAmount,
      refundMethod: dto.refundMethod,
      items: {
        // P0: per-attribute columns (size/color/gender) dropped from
        // ReturnItem. Attribute values flow through the linked
        // OrderItem.attributesJson; we don't persist them on the return row.
        create: dto.items.map((item) => ({
          orderItemId: item.orderItemId,
          productName: item.productName,
          qty: item.qty,
          unitPrice: item.unitPrice,
          refundAmount: item.refundAmount,
          condition: item.condition,
          warehouseItemId: item.warehouseItemId,
        })),
      },
    },
    select: returnWithItems,
  });
  return await hydrateReturn(created);
}

export async function confirm(
  orgId: string,
  id: string,
  userId: string,
  userName: string,
) {
  const ret = await prisma.return.findFirst({
    where: { id, orgId },
    include: { items: true },
  });
  if (!ret) throw new NotFoundError('Акт возврата не найден');
  if (ret.status !== 'draft') {
    throw new AppError(400, 'Возврат уже подтверждён', 'ALREADY_CONFIRMED');
  }

  // Confirm the return record
  const updated = await prisma.$transaction(async (tx) => {
    const confirmed = await tx.return.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: userName,
      },
      select: returnWithItems,
    });

    // Mark order as having returns
    await tx.order.update({
      where: { id: ret.orderId },
      data: { hasReturns: true },
    });

    // Log activity on the order
    await tx.orderActivity.create({
      data: {
        orderId: ret.orderId,
        type: 'return_confirmed',
        content: `Оформлен возврат ${ret.returnNumber}: ${ret.items.length} поз. на ${ret.totalRefundAmount.toLocaleString('ru')} ₸`,
        authorId: userId,
        authorName: userName,
      },
    });

    return confirmed;
  });

  // Replenish warehouse stock for each returned item.
  // If warehouseItemId is not set, try to resolve it via orderItemId -> variantKey -> WarehouseItem.
  // Try both old and new variantKey formats for compatibility during migration.
  // Run outside main transaction so warehouse errors don't rollback the return confirmation.
  const warehouseErrors: Array<{ itemId: string; productName: string; error: string }> = [];

  for (const item of ret.items) {
    let warehouseItemId = item.warehouseItemId;

    if (!warehouseItemId && item.orderItemId) {
      const orderItem = await prisma.orderItem.findUnique({
        where: { id: item.orderItemId },
        select: { variantKey: true, productName: true, attributesJson: true },
      });

      if (orderItem?.variantKey) {
        // Try exact variantKey match first (new format)
        let warehouseItem = await prisma.warehouseItem.findFirst({
          where: { orgId, variantKey: orderItem.variantKey },
          select: { id: true },
        });

        // Fallback: if old variantKey format exists (contains '=' and not '|'), rebuild in new format
        if (!warehouseItem && orderItem.variantKey.includes('=') && !orderItem.variantKey.includes('|')) {
          // Old format: товар:цвет=синий:размер=44
          // Build new format: товар|цвет:синий|размер:44
          // P0: legacy per-column attrs (color/gender/size) collapsed into attributesJson.
          const attrs: Record<string, string> = {};
          const json = orderItem.attributesJson;
          if (json && typeof json === 'object' && !Array.isArray(json)) {
            for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
              if (v === undefined || v === null) continue;
              const str = String(v).trim();
              if (str) attrs[k] = str;
            }
          }

          // Reconstruct with new format
          const base = orderItem.productName.trim().toLowerCase().replace(/\s+/g, ' ');
          const parts = Object.entries(attrs)
            .filter(([, v]) => v.trim())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v.toLowerCase().replace(/\s+/g, ' ')}`);
          const newFormatKey = [base, ...parts].join('|');

          warehouseItem = await prisma.warehouseItem.findFirst({
            where: { orgId, variantKey: newFormatKey },
            select: { id: true },
          });
        }

        warehouseItemId = warehouseItem?.id ?? null;
      }
    }

    if (!warehouseItemId) {
      warehouseErrors.push({
        itemId: item.id,
        productName: item.productName,
        error: 'Warehouse item not found',
      });
      continue;
    }

    try {
      await addMovement(orgId, {
        itemId: warehouseItemId,
        type: 'return',
        qty: item.qty,
        sourceId: id,
        sourceType: 'customer_return',
        reason: `Возврат ${ret.returnNumber} — ${item.productName} (${item.condition})`,
        author: userName,
      });
    } catch (err) {
      // Track warehouse errors but don't fail the confirmation
      const errorMsg = err instanceof Error ? err.message : String(err);
      warehouseErrors.push({
        itemId: item.id,
        productName: item.productName,
        error: errorMsg,
      });
      console.error(`[returns] Failed to create warehouse movement for item ${item.id}:`, err);
    }
  }

  // Return with warnings if there were warehouse errors
  const hydratedUpdated = await hydrateReturn(updated);
  return {
    ...hydratedUpdated,
    warnings: warehouseErrors.length > 0 ? {
      warehouseMovementsFailed: true,
      failedItems: warehouseErrors,
      message: `Warning: Stock replenishment failed for ${warehouseErrors.length} item(s). Warehouse team should be notified.`,
    } : undefined,
  };
}

export async function deleteDraft(orgId: string, id: string) {
  const ret = await prisma.return.findFirst({
    where: { id, orgId },
    select: { id: true, status: true },
  });
  if (!ret) throw new NotFoundError('Акт возврата не найден');
  if (ret.status !== 'draft') {
    throw new AppError(400, 'Нельзя удалить подтверждённый возврат', 'CANNOT_DELETE_CONFIRMED');
  }

  await prisma.return.delete({ where: { id } });
  return { ok: true };
}
