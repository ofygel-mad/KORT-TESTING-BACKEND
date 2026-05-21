import { prisma } from '../../lib/prisma.js';
import { ValidationError } from '../../lib/errors.js';
import { SYSTEM_PLANS, PLAN_CODES, DEFAULT_PLAN_CODE, fallbackPlan, type PlanDef } from './plans.js';

type SubscriptionRow = {
  id: string;
  planCode: string;
  status: string;
  periodStart: Date;
  periodEnd: Date | null;
  trialEndsAt: Date | null;
};

function serializePlan(plan: PlanDef) {
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description,
    rank: plan.rank,
    max_users: plan.maxUsers,
    features: plan.features,
  };
}

function serializeSubscription(sub: SubscriptionRow, plan: PlanDef) {
  return {
    id: sub.id,
    plan_code: sub.planCode,
    status: sub.status,
    period_start: sub.periodStart.toISOString(),
    period_end: sub.periodEnd?.toISOString() ?? null,
    trial_ends_at: sub.trialEndsAt?.toISOString() ?? null,
    plan: serializePlan(plan),
  };
}

/** Resolves a planCode to its definition — DB row, or the seeded fallback. */
export async function getPlanDef(code: string): Promise<PlanDef> {
  const row = await prisma.planDefinition.findUnique({ where: { code } });
  if (!row) return fallbackPlan(code);
  return {
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    rank: row.rank,
    maxUsers: row.maxUsers,
    features: row.features,
  };
}

/** Lists every plan the platform offers (DB rows, or the seeded catalog). */
export async function listPlans() {
  const rows = await prisma.planDefinition.findMany({ orderBy: { rank: 'asc' } });
  const plans: PlanDef[] = rows.length
    ? rows.map((r) => ({
        code: r.code,
        name: r.name,
        description: r.description ?? '',
        rank: r.rank,
        maxUsers: r.maxUsers,
        features: r.features,
      }))
    : SYSTEM_PLANS;
  return plans.map(serializePlan);
}

/**
 * Returns the org's subscription, lazily creating one from Organization.mode
 * for orgs that predate the subscription model.
 */
export async function ensureSubscription(orgId: string) {
  const existing = await prisma.subscription.findUnique({ where: { orgId } });
  if (existing) return existing;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { mode: true },
  });
  const planCode = org && PLAN_CODES.includes(org.mode) ? org.mode : DEFAULT_PLAN_CODE;
  return prisma.subscription.create({ data: { orgId, planCode } });
}

export async function getSubscription(orgId: string) {
  const sub = await ensureSubscription(orgId);
  const plan = await getPlanDef(sub.planCode);
  return serializeSubscription(sub, plan);
}

/**
 * Changes the org's plan. Subscription.planCode is authoritative;
 * Organization.mode is kept as a denormalized cache in the same transaction.
 */
export async function changePlan(orgId: string, planCode: string) {
  if (!PLAN_CODES.includes(planCode)) {
    const known = await prisma.planDefinition.findUnique({ where: { code: planCode } });
    if (!known) throw new ValidationError(`Неизвестный тарифный план: «${planCode}».`);
  }

  await ensureSubscription(orgId);
  const [sub] = await prisma.$transaction([
    prisma.subscription.update({ where: { orgId }, data: { planCode } }),
    prisma.organization.update({ where: { id: orgId }, data: { mode: planCode } }),
  ]);

  return serializeSubscription(sub, await getPlanDef(planCode));
}

/**
 * Enforces the plan's seat limit before a new member is added.
 * Owner and active/pending employees count; dismissed ones do not.
 */
export async function assertWithinUserLimit(orgId: string) {
  const sub = await ensureSubscription(orgId);
  const plan = await getPlanDef(sub.planCode);
  if (plan.maxUsers == null) return;

  const seats = await prisma.membership.count({
    where: { orgId, status: 'active', NOT: { employeeAccountStatus: 'dismissed' } },
  });
  if (seats >= plan.maxUsers) {
    throw new ValidationError(
      `Достигнут лимит сотрудников для плана «${plan.name}» (${plan.maxUsers}). `
        + 'Перейдите на более высокий тариф, чтобы добавить ещё.',
    );
  }
}
