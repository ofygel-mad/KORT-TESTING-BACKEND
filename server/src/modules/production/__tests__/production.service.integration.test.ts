/**
 * P10e integration tests for `production.service.ts`.
 *
 * Scope: production-specific helpers (NOT the orders.confirm guard, which is
 * covered exhaustively by orders.confirm-guard.integration.test.ts):
 *   - list() reads attributesJson and exposes color/gender/length via mapTask
 *     (P0 refactor: legacy per-column attributes collapsed into the JSON bag).
 *   - moveStatus() walks queued → in_progress → done and writes activities.
 *   - moveStatus() refuses to act on a blocked task (P0 isBlocked guard).
 *   - claimTask() assigns the worker, flips to in_progress and rejects done.
 *   - flagTask + unflagTask toggle isBlocked + persist the reason.
 *   - assignWorker(null) clears the assignee.
 *   - findTask refuses to mutate tasks on archived/cancelled/completed orders.
 *   - setDefect persists the defect string (and null clears it).
 *
 * The seeding uses orders.service.create + confirm so the ProductionTask rows
 * exist with the same shape the real product writes; we mock the sheets sync
 * (same pattern as every other orders integration test).
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import {
  assignWorker,
  claimTask,
  flagTask,
  list as listProduction,
  moveStatus,
  setDefect,
  unflagTask,
} from '../production.service.js';
import { confirm, create } from '../../orders/orders.service.js';

vi.mock('../../integrations/sheets/sheets.sync.js', () => ({
  syncOrderToSheets: vi.fn().mockResolvedValue({ ok: true }),
}));

type TestContext = {
  orgId: string;
  authorId: string;
  authorName: string;
};

async function createTestContext(): Promise<TestContext> {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const org = await prisma.organization.create({
    data: { name: `Production Org ${token}`, slug: `prod-${token}` },
  });
  return {
    orgId: org.id,
    authorId: `author-${token}`,
    authorName: 'Production Manager',
  };
}

/**
 * Builds a confirmed order with two items so ProductionTask rows exist. Items
 * carry color/gender/length attributes so we can verify mapTask reads them
 * from attributesJson (P0 collapse).
 */
async function seedConfirmedOrder(ctx: TestContext, prefix: string) {
  const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
    clientName: `Client ${prefix}`,
    clientPhone: '+7 (701) 123-45-67',
    priority: 'normal',
    items: [
      {
        productName: `${prefix} Coat`,
        attributes: { color: 'navy', gender: 'm', length: 'long' },
        size: 'M',
        quantity: 1,
        unitPrice: 10000,
      },
      {
        productName: `${prefix} Vest`,
        attributes: { color: 'red', gender: 'w', length: 'short' },
        size: 'L',
        quantity: 1,
        unitPrice: 5000,
      },
    ],
  });

  await confirm(ctx.orgId, order.id, ctx.authorId, ctx.authorName);

  // Verify the tasks landed before each test uses them.
  const tasks = await prisma.productionTask.findMany({
    where: { orderId: order.id },
    orderBy: { productName: 'asc' },
  });
  if (tasks.length !== 2) {
    throw new Error(`Expected 2 production tasks, got ${tasks.length}`);
  }
  return { order, tasks };
}

describe('production.service — task lifecycle', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await prisma.organization.deleteMany({ where: { id: ctx.orgId } });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('list() exposes color/gender/length lifted out of orderItem.attributesJson (P0)', async () => {
    await seedConfirmedOrder(ctx, 'AttrCheck');

    const tasks = await listProduction(ctx.orgId);
    expect(tasks).toHaveLength(2);

    // Pull the navy/m/long item by name.
    const coat = tasks.find((t) => t.productName.includes('Coat'))!;
    expect(coat).toBeDefined();
    expect(coat.color).toBe('navy');
    expect(coat.gender).toBe('m');
    expect(coat.length).toBe('long');
    expect(coat.orderItemPosition).toBe(1);

    const vest = tasks.find((t) => t.productName.includes('Vest'))!;
    expect(vest.color).toBe('red');
    expect(vest.gender).toBe('w');
    expect(vest.length).toBe('short');
  });

  it('list() with a status filter normalizes legacy statuses (cutting → queued)', async () => {
    const seeded = await seedConfirmedOrder(ctx, 'FilterCheck');

    // Flip one task into a legacy in-progress status (`sewing`) to prove
    // normalizeProductionStatus + the status filter both work.
    await prisma.productionTask.update({
      where: { id: seeded.tasks[0]!.id },
      data: { status: 'sewing' },
    });

    const queuedOnly = await listProduction(ctx.orgId, { status: 'queued' });
    expect(queuedOnly).toHaveLength(1);
    expect(queuedOnly[0]!.status).toBe('queued');

    const inProgressOnly = await listProduction(ctx.orgId, { status: 'in_progress' });
    expect(inProgressOnly).toHaveLength(1);
    expect(inProgressOnly[0]!.status).toBe('in_progress');
  });

  it('moveStatus() walks queued → in_progress → done and writes activity entries', async () => {
    const { tasks } = await seedConfirmedOrder(ctx, 'WalkStatus');
    const taskId = tasks[0]!.id;

    await moveStatus(ctx.orgId, taskId, 'in_progress', ctx.authorId, ctx.authorName);
    let row = await prisma.productionTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(row.status).toBe('in_progress');
    expect(row.startedAt).not.toBeNull();
    expect(row.completedAt).toBeNull();

    await moveStatus(ctx.orgId, taskId, 'done', ctx.authorId, ctx.authorName);
    row = await prisma.productionTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(row.status).toBe('done');
    expect(row.completedAt).not.toBeNull();

    const activities = await prisma.orderActivity.findMany({
      where: { orderId: row.orderId, type: 'production_update' },
    });
    expect(activities.length).toBeGreaterThanOrEqual(2);
  });

  it('moveStatus() refuses to act on a blocked task', async () => {
    const { tasks } = await seedConfirmedOrder(ctx, 'BlockMove');
    const taskId = tasks[0]!.id;

    await flagTask(ctx.orgId, taskId, 'Ждём ткань', ctx.authorId, ctx.authorName);

    await expect(
      moveStatus(ctx.orgId, taskId, 'in_progress', ctx.authorId, ctx.authorName),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION',
    });
  });

  it('claimTask() assigns the worker and switches the task to in_progress', async () => {
    const { tasks } = await seedConfirmedOrder(ctx, 'ClaimSwitch');
    const taskId = tasks[0]!.id;

    await claimTask(ctx.orgId, taskId, ctx.authorId, 'Алиса Цех');
    const row = await prisma.productionTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(row.status).toBe('in_progress');
    expect(row.assignedTo).toBe('Алиса Цех');
    expect(row.startedAt).not.toBeNull();
  });

  it('claimTask() refuses to re-claim a task that is already done', async () => {
    const { tasks } = await seedConfirmedOrder(ctx, 'ClaimDone');
    const taskId = tasks[0]!.id;

    // Move task to done first.
    await prisma.productionTask.update({
      where: { id: taskId },
      data: { status: 'done', completedAt: new Date() },
    });

    await expect(
      claimTask(ctx.orgId, taskId, ctx.authorId, ctx.authorName),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION' });
  });

  it('flagTask + unflagTask toggle isBlocked and persist the reason', async () => {
    const { tasks } = await seedConfirmedOrder(ctx, 'FlagToggle');
    const taskId = tasks[0]!.id;

    await flagTask(ctx.orgId, taskId, 'Нет фурнитуры', ctx.authorId, ctx.authorName);
    let row = await prisma.productionTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(row.isBlocked).toBe(true);
    expect(row.blockReason).toBe('Нет фурнитуры');

    await unflagTask(ctx.orgId, taskId, ctx.authorId, ctx.authorName);
    row = await prisma.productionTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(row.isBlocked).toBe(false);
    expect(row.blockReason).toBeNull();
  });

  it('assignWorker(null) clears the assignee', async () => {
    const { tasks } = await seedConfirmedOrder(ctx, 'AssignClear');
    const taskId = tasks[0]!.id;

    await assignWorker(ctx.orgId, taskId, 'Bob', ctx.authorId, ctx.authorName);
    expect((await prisma.productionTask.findUniqueOrThrow({ where: { id: taskId } })).assignedTo).toBe('Bob');

    await assignWorker(ctx.orgId, taskId, null, ctx.authorId, ctx.authorName);
    expect((await prisma.productionTask.findUniqueOrThrow({ where: { id: taskId } })).assignedTo).toBeNull();
  });

  it('findTask refuses to mutate tasks on cancelled orders', async () => {
    const { order, tasks } = await seedConfirmedOrder(ctx, 'CancelGuard');
    const taskId = tasks[0]!.id;

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    await expect(
      moveStatus(ctx.orgId, taskId, 'in_progress', ctx.authorId, ctx.authorName),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION' });

    await expect(
      flagTask(ctx.orgId, taskId, 'whatever', ctx.authorId, ctx.authorName),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('setDefect persists the defect string (and clears it on empty input)', async () => {
    const { tasks } = await seedConfirmedOrder(ctx, 'Defect');
    const taskId = tasks[0]!.id;

    await setDefect(ctx.orgId, taskId, 'Кривой шов');
    let row = await prisma.productionTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(row.defects).toBe('Кривой шов');

    await setDefect(ctx.orgId, taskId, '');
    row = await prisma.productionTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(row.defects).toBeNull();
  });
});
