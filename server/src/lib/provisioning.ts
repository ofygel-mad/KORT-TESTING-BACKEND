// R5 — shared organization provisioning. One primitive used by both public
// company registration (auth) and Control Plane tenant provisioning
// (platform), so the create-org logic lives in exactly one place.

import { Prisma } from '@prisma/client';
import { createDefaultConfigRecords } from '../modules/composition/composition.service.js';
import { ensureSystemTemplatesForOrg } from '../modules/orders/templates.js';

const SLUG_MAX = 48;

function sanitizeSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9а-яё\s-]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, SLUG_MAX) || `company-${Date.now()}`
  );
}

function appendSlugSuffix(base: string, suffix: number): string {
  const label = `-${suffix}`;
  return `${base.slice(0, Math.max(1, SLUG_MAX - label.length))}${label}`;
}

/** Derives an org slug from a company name, unique within the given tx. */
export async function generateUniqueSlug(
  companyName: string,
  tx: Prisma.TransactionClient,
): Promise<string> {
  const base = sanitizeSlug(companyName);
  const existing = await tx.organization.findMany({
    where: { OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] },
    select: { slug: true },
  });
  const used = new Set(existing.map((o) => o.slug));
  if (!used.has(base)) return base;

  let n = 2;
  let next = appendSlugSuffix(base, n);
  while (used.has(next)) {
    n += 1;
    next = appendSlugSuffix(base, n);
  }
  return next;
}

export interface ProvisionOrganizationInput {
  ownerEmail: string;
  ownerFullName: string;
  ownerPasswordHash: string;
  ownerStatus: string; // 'active' (registration) | 'pending' (CP provisioning)
  ownerPhone?: string | null;
  companyName: string;
  planCode: string;
  membershipSource: string;
}

/**
 * Creates an owner user, an organization, its subscription and the owner
 * membership inside the given transaction. The caller hashes the password and
 * owns everything around it — pre-checks, retry, tokens, response.
 */
export async function provisionOrganization(
  tx: Prisma.TransactionClient,
  input: ProvisionOrganizationInput,
) {
  const user = await tx.user.create({
    data: {
      fullName: input.ownerFullName.trim(),
      email: input.ownerEmail,
      password: input.ownerPasswordHash,
      phone: input.ownerPhone ?? null,
      status: input.ownerStatus,
    },
  });

  const slug = await generateUniqueSlug(input.companyName, tx);
  const org = await tx.organization.create({
    data: {
      name: input.companyName.trim(),
      slug,
      mode: input.planCode, // denormalized cache of Subscription.planCode
      currency: 'KZT',
    },
  });

  await tx.subscription.create({
    data: { orgId: org.id, planCode: input.planCode },
  });

  const membership = await tx.membership.create({
    data: {
      userId: user.id,
      orgId: org.id,
      isOwner: true,
      status: 'active',
      source: input.membershipSource,
      joinedAt: new Date(),
      employeeAccountStatus: 'active',
    },
  });

  // ЧАСТЬ X — seed the default composition config so a tenant is never config-less.
  await createDefaultConfigRecords(tx, org.id);

  // P3 — seed system OrderTemplates (Blank + Clothing) so every org has a
  // working form from day one.
  await ensureSystemTemplatesForOrg(org.id, tx);

  return { user, org, membership };
}
