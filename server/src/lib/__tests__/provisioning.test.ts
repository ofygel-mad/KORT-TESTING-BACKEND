/**
 * P10f integration tests for `lib/provisioning.ts`.
 *
 * provisionOrganization() is the shared primitive used by both public company
 * registration (auth.service.registerCompany) and Control Plane tenant
 * creation (platform.service.createTenant). It must:
 *   1. Create User + Organization + Subscription + owner Membership atomically.
 *   2. Seed the default TenantConfig (composition).
 *   3. Seed the system OrderTemplates (Blank + Clothing + others).
 *   4. Derive a unique slug; uniqueness is enforced via generateUniqueSlug().
 *
 * generateUniqueSlug() is exercised directly to pin the suffix algorithm.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disconnectDatabase, prisma } from '../../lib/prisma.js';
import {
  generateUniqueSlug,
  provisionOrganization,
} from '../provisioning.js';

const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];

async function uniqueInput(overrides: Partial<Parameters<typeof provisionOrganization>[1]> = {}) {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return {
    ownerEmail: `prov-${token}@example.test`,
    ownerFullName: `Prov Owner ${token}`,
    ownerPasswordHash: 'hashedpassword',
    ownerStatus: 'active',
    ownerPhone: null,
    companyName: `Prov Co ${token}`,
    planCode: 'free',
    membershipSource: 'company_registration',
    ...overrides,
  };
}

describe('lib/provisioning — provisionOrganization (integration)', () => {
  beforeEach(() => {
    createdUserIds.length = 0;
    createdOrgIds.length = 0;
  });

  afterEach(async () => {
    if (createdOrgIds.length > 0) {
      await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('creates User + Organization + Subscription + owner Membership atomically', async () => {
    const input = await uniqueInput();
    const result = await prisma.$transaction((tx) => provisionOrganization(tx, input));
    createdUserIds.push(result.user.id);
    createdOrgIds.push(result.org.id);

    expect(result.user.email).toBe(input.ownerEmail);
    expect(result.user.status).toBe('active');
    expect(result.org.name).toBe(input.companyName);
    expect(result.org.currency).toBe('KZT'); // default
    expect(result.org.mode).toBe(input.planCode); // denormalized cache

    const sub = await prisma.subscription.findUnique({ where: { orgId: result.org.id } });
    expect(sub?.planCode).toBe(input.planCode);

    expect(result.membership.isOwner).toBe(true);
    expect(result.membership.status).toBe('active');
    expect(result.membership.source).toBe(input.membershipSource);
    expect(result.membership.employeeAccountStatus).toBe('active');
  });

  it('seeds the default TenantConfig (revision 1) for the new org', async () => {
    const input = await uniqueInput();
    const result = await prisma.$transaction((tx) => provisionOrganization(tx, input));
    createdUserIds.push(result.user.id);
    createdOrgIds.push(result.org.id);

    const tenantConfig = await prisma.tenantConfig.findUnique({
      where: { orgId: result.org.id },
    });
    expect(tenantConfig).not.toBeNull();
    expect(tenantConfig?.revision).toBe(1);
    expect(tenantConfig?.source).toBe('default');

    // Revision journal has the matching row.
    const rev = await prisma.tenantConfigRevision.findFirst({
      where: { orgId: result.org.id, revision: 1 },
    });
    expect(rev).not.toBeNull();
  });

  it('seeds system OrderTemplates (Blank + Clothing at minimum)', async () => {
    const input = await uniqueInput();
    const result = await prisma.$transaction((tx) => provisionOrganization(tx, input));
    createdUserIds.push(result.user.id);
    createdOrgIds.push(result.org.id);

    const templates = await prisma.orderTemplate.findMany({
      where: { orgId: result.org.id, isSystem: true },
      select: { name: true },
    });
    const names = templates.map((t) => t.name);
    expect(names).toContain('Чистый шаблон'); // BLANK_TEMPLATE
    expect(names.some((n) => /одежд/i.test(n))).toBe(true); // CLOTHING_TEMPLATE
    expect(templates.length).toBeGreaterThanOrEqual(2);
  });

  it('derives a unique slug per org name and disambiguates duplicates with a -N suffix', async () => {
    const sharedName = `Slug Coll ${Date.now().toString(36)}`;

    const firstInput = { ...(await uniqueInput()), companyName: sharedName };
    const first = await prisma.$transaction((tx) => provisionOrganization(tx, firstInput));
    createdUserIds.push(first.user.id);
    createdOrgIds.push(first.org.id);

    const secondInput = { ...(await uniqueInput()), companyName: sharedName };
    const second = await prisma.$transaction((tx) => provisionOrganization(tx, secondInput));
    createdUserIds.push(second.user.id);
    createdOrgIds.push(second.org.id);

    expect(first.org.slug).not.toBe(second.org.slug);
    // The base slug claims index 1; collisions fall back to base-2, base-3...
    expect(second.org.slug.endsWith('-2')).toBe(true);
  });

  it('generateUniqueSlug() returns the base slug when no row claims it', async () => {
    const slug = await prisma.$transaction((tx) =>
      generateUniqueSlug('Unique Co ' + Date.now().toString(36), tx),
    );
    expect(slug).toMatch(/^unique-co-/);
    expect(slug.length).toBeLessThanOrEqual(48);
  });
});
