import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SYSTEM_ROLES } from '../src/modules/auth/system-roles.js';
import { SYSTEM_PLANS } from '../src/modules/subscriptions/plans.js';

const prisma = new PrismaClient();

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? 'admin@kort.local';
const OWNER_PHONE = '+77010000001';
const OWNER_ID = 'u-owner';
const ORG_ID = 'org-workspace';
const ORG_SLUG = 'workspace';
const EMPLOYEE_ID = 'u-employee-pending';
const EMPLOYEE_PHONE = '+77010000003';

const OWNER_PASSWORD = await bcrypt.hash(process.env.SEED_OWNER_PASSWORD ?? 'demo1234', 10);
const EMPLOYEE_PASSWORD = await bcrypt.hash(EMPLOYEE_PHONE, 10);

function ago(days: number, hours = 0): Date {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

type SeedUserInput = {
  id: string;
  email?: string | null;
  phone?: string | null;
  fullName: string;
  password: string;
  status: string;
};

async function upsertSeedUser(data: SeedUserInput) {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { id: data.id },
        ...(data.email ? [{ email: data.email }] : []),
        ...(data.phone ? [{ phone: data.phone }] : []),
      ],
    },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        email: data.email ?? null,
        phone: data.phone ?? null,
        fullName: data.fullName,
        password: data.password,
        status: data.status,
      },
    });
  }

  return prisma.user.create({ data });
}

async function upsertSeedOrganization() {
  const existing = await prisma.organization.findFirst({
    where: {
      OR: [
        { id: ORG_ID },
        { slug: ORG_SLUG },
      ],
    },
  });

  const data = {
    name: 'Workspace',
    slug: ORG_SLUG,
    mode: 'industrial',
    onboardingCompleted: true,
    currency: 'KZT',
    industry: 'Operations',
    legalForm: 'Workspace',
    legalName: 'Workspace',
    city: 'Remote',
    director: 'Owner',
  } as const;

  if (existing) {
    return prisma.organization.update({ where: { id: existing.id }, data });
  }

  return prisma.organization.create({ data: { id: ORG_ID, ...data } });
}

/** Seeds (or refreshes) the shared system roles — orgId = null, isSystem = true. */
async function seedSystemRoles(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const def of SYSTEM_ROLES) {
    const existing = await prisma.role.findFirst({
      where: { orgId: null, key: def.key },
    });
    if (existing) {
      const updated = await prisma.role.update({
        where: { id: existing.id },
        data: { name: def.name, description: def.description, permissions: def.permissions, isSystem: true },
      });
      ids[def.key] = updated.id;
    } else {
      const created = await prisma.role.create({
        data: {
          orgId: null,
          key: def.key,
          name: def.name,
          description: def.description,
          permissions: def.permissions,
          isSystem: true,
        },
      });
      ids[def.key] = created.id;
    }
  }
  return ids;
}

/** Seeds (or refreshes) the platform plan catalog. */
async function seedPlans() {
  for (const plan of SYSTEM_PLANS) {
    await prisma.planDefinition.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        rank: plan.rank,
        maxUsers: plan.maxUsers,
        features: plan.features,
      },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        rank: plan.rank,
        maxUsers: plan.maxUsers,
        features: plan.features,
      },
    });
  }
}

async function main() {
  console.log('Seeding database...');

  await seedPlans();
  console.log(`  Plans: ${SYSTEM_PLANS.length}`);

  const roleIds = await seedSystemRoles();
  console.log(`  System roles: ${Object.keys(roleIds).length}`);

  const owner = await upsertSeedUser({
    id: OWNER_ID,
    email: OWNER_EMAIL,
    phone: OWNER_PHONE,
    fullName: 'Owner',
    password: OWNER_PASSWORD,
    status: 'active',
  });

  const org = await upsertSeedOrganization();

  // Subscription — Organization.mode is the denormalized cache of planCode.
  await prisma.subscription.upsert({
    where: { orgId: org.id },
    update: { planCode: org.mode },
    create: { orgId: org.id, planCode: org.mode },
  });

  // Owner — isOwner bypasses every permission check; no role needed.
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: owner.id, orgId: org.id } },
    update: {
      isOwner: true,
      roleId: null,
      status: 'active',
      source: 'company_registration',
      joinedAt: ago(90),
      employeeAccountStatus: 'active',
      department: '',
    },
    create: {
      userId: owner.id,
      orgId: org.id,
      isOwner: true,
      status: 'active',
      source: 'company_registration',
      joinedAt: ago(90),
      employeeAccountStatus: 'active',
      department: '',
    },
  });

  const employee = await upsertSeedUser({
    id: EMPLOYEE_ID,
    phone: EMPLOYEE_PHONE,
    fullName: 'Demo Employee',
    password: EMPLOYEE_PASSWORD,
    status: 'active',
  });

  // Demo employee — Warehouse Manager system role.
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: employee.id, orgId: org.id } },
    update: {
      isOwner: false,
      roleId: roleIds.warehouse_manager ?? null,
      status: 'active',
      source: 'admin_added',
      joinedAt: ago(15),
      department: 'Склад',
      employeeAccountStatus: 'pending_first_login',
      addedById: owner.id,
      addedByName: owner.fullName,
    },
    create: {
      userId: employee.id,
      orgId: org.id,
      isOwner: false,
      roleId: roleIds.warehouse_manager ?? null,
      status: 'active',
      source: 'admin_added',
      joinedAt: ago(15),
      department: 'Склад',
      employeeAccountStatus: 'pending_first_login',
      addedById: owner.id,
      addedByName: owner.fullName,
    },
  });

  await prisma.productSize.createMany({
    data: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '44', '46', '48', '50', '52', '54'].map((name) => ({
      orgId: org.id,
      name,
    })),
    skipDuplicates: true,
  });

  const existingCustomer = await prisma.customer.findFirst({
    where: { orgId: org.id, email: 'aidana@example.kz' },
  });

  if (existingCustomer) {
    await prisma.customer.update({
      where: { id: existingCustomer.id },
      data: {
        fullName: 'Aidana Demo',
        phone: '+77015554433',
        companyName: 'Workspace',
        source: 'seed',
      },
    });
  } else {
    await prisma.customer.create({
      data: {
        orgId: org.id,
        fullName: 'Aidana Demo',
        phone: '+77015554433',
        email: 'aidana@example.kz',
        companyName: 'Workspace',
        source: 'seed',
      },
    });
  }

  console.log('Seed complete.');
  console.log('');
  console.log('  Owner login:');
  console.log(`    Email:    ${OWNER_EMAIL}`);
  console.log(`    Password: ${process.env.SEED_OWNER_PASSWORD ?? 'demo1234'}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
