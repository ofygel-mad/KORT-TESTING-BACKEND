import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/hash.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors.js';
import { ALL_PERMISSIONS, resolveEffectivePermissions } from '../auth/auth.service.js';

// ─── Validation schemas ───────────────────────────────────────────────────────

const VALID_PERMISSIONS = ALL_PERMISSIONS as readonly [string, ...string[]];

const overrideSchema = z.object({
  permission: z.enum(VALID_PERMISSIONS),
  effect: z.enum(['allow', 'deny']),
});

export const createEmployeeSchema = z.object({
  phone: z
    .string()
    .min(7)
    .regex(/^\+7\d{10}$/, 'Телефон должен быть в формате +7XXXXXXXXXX'),
  full_name: z.string().min(2).max(120),
  department: z.string().min(1).max(80),
  roleId: z.string().min(1, 'Выберите роль сотрудника'),
  overrides: z.array(overrideSchema).optional(),
});

export const updateEmployeeSchema = z.object({
  department: z.string().min(1).max(80).optional(),
  roleId: z.string().min(1).optional(),
  overrides: z.array(overrideSchema).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

// ─── Serializer ───────────────────────────────────────────────────────────────

type EmployeeMembership = {
  userId: string;
  department: string;
  employeeAccountStatus: string;
  addedByName: string | null;
  createdAt: Date;
  isOwner: boolean;
  roleId: string | null;
  role: { name: string; permissions: string[] } | null;
  permissionOverrides: { permission: string; effect: string }[];
  user: { fullName: string; phone: string | null };
};

function serializeEmployee(membership: EmployeeMembership) {
  return {
    id: membership.userId,
    full_name: membership.user.fullName,
    phone: membership.user.phone ?? '',
    department: membership.department,
    role_id: membership.roleId,
    role_name: membership.role?.name ?? null,
    overrides: membership.permissionOverrides.map((o) => ({
      permission: o.permission,
      effect: o.effect,
    })),
    permissions: resolveEffectivePermissions(
      membership.isOwner,
      membership.role?.permissions ?? [],
      membership.permissionOverrides,
    ),
    // 'pending_first_login' counts as active for display purposes
    status: membership.employeeAccountStatus === 'dismissed' ? 'dismissed' : 'active',
    isPendingFirstLogin: membership.employeeAccountStatus === 'pending_first_login',
    addedByName: membership.addedByName ?? '',
    joinedAt: membership.createdAt.toISOString(),
  };
}

const EMPLOYEE_MEMBERSHIP_INCLUDE = {
  role: true,
  permissionOverrides: true,
  user: { select: { fullName: true, phone: true } },
} as const;

/** Verifies the role belongs to this org (or is a shared system role). */
async function assertRoleBelongsToOrg(roleId: string, orgId: string) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, OR: [{ orgId: null }, { orgId }] },
  });
  if (!role) throw new ValidationError('Указанная роль недоступна в этой организации.');
  return role;
}

// ─── List employees ───────────────────────────────────────────────────────────

export async function listEmployees(orgId: string) {
  const memberships = await prisma.membership.findMany({
    where: {
      orgId,
      status: 'active',
      // Only show employees added by admin (not the owner themselves)
      source: { in: ['admin_added', 'invite', 'request', 'manual'] },
      // Don't show the org owner in the employee list — they're the boss
      isOwner: false,
    },
    include: EMPLOYEE_MEMBERSHIP_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });

  return memberships.map(serializeEmployee);
}

// ─── Create employee ──────────────────────────────────────────────────────────

export async function createEmployee(
  orgId: string,
  addedByUserId: string,
  addedByName: string,
  data: CreateEmployeeInput,
) {
  await assertRoleBelongsToOrg(data.roleId, orgId);
  const overrideRows = (data.overrides ?? []).map((o) => ({
    permission: o.permission,
    effect: o.effect,
  }));

  // Verify the phone isn't already registered
  const existingUser = await prisma.user.findUnique({
    where: { phone: data.phone },
  });

  if (existingUser) {
    const existingMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: existingUser.id, orgId } },
    });
    if (existingMembership) {
      throw new ConflictError(
        'Сотрудник с таким номером телефона уже добавлен в эту компанию.',
      );
    }
    const membership = await prisma.membership.create({
      data: {
        userId: existingUser.id,
        orgId,
        status: 'active',
        source: 'admin_added',
        joinedAt: new Date(),
        department: data.department,
        roleId: data.roleId,
        addedById: addedByUserId,
        addedByName,
        employeeAccountStatus: 'pending_first_login',
        permissionOverrides: { create: overrideRows },
      },
      include: EMPLOYEE_MEMBERSHIP_INCLUDE,
    });
    return serializeEmployee(membership);
  }

  // Create a brand-new user.
  // Initial password = hashed phone number (enables the phone+phone first-login).
  const hashedPhone = await hashPassword(data.phone);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: data.full_name.trim(),
          phone: data.phone,
          password: hashedPhone,
          status: 'pending',
        },
      });

      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          orgId,
          status: 'active',
          source: 'admin_added',
          joinedAt: new Date(),
          department: data.department,
          roleId: data.roleId,
          addedById: addedByUserId,
          addedByName,
          employeeAccountStatus: 'pending_first_login',
          permissionOverrides: { create: overrideRows },
        },
        include: EMPLOYEE_MEMBERSHIP_INCLUDE,
      });

      return membership;
    });

    return serializeEmployee(result);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new ConflictError(
        'Сотрудник с таким номером телефона уже существует.',
      );
    }
    throw error;
  }
}

// ─── Update employee ──────────────────────────────────────────────────────────

export async function updateEmployee(
  orgId: string,
  userId: string,
  data: UpdateEmployeeInput,
) {
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!membership) throw new NotFoundError('Employee');

  // Protect the owner: their access cannot be changed through this endpoint
  if (membership.isOwner) {
    throw new ForbiddenError(
      'Права руководителя не редактируются через интерфейс управления сотрудниками.',
    );
  }

  if (membership.employeeAccountStatus === 'dismissed') {
    throw new ForbiddenError(
      'Нельзя изменить данные уволенного сотрудника.',
    );
  }

  if (data.roleId !== undefined) {
    await assertRoleBelongsToOrg(data.roleId, orgId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (data.overrides !== undefined) {
      // Full replace of per-member overrides
      await tx.memberPermissionOverride.deleteMany({
        where: { membershipId: membership.id },
      });
      if (data.overrides.length > 0) {
        await tx.memberPermissionOverride.createMany({
          data: data.overrides.map((o) => ({
            membershipId: membership.id,
            permission: o.permission,
            effect: o.effect,
          })),
        });
      }
    }

    return tx.membership.update({
      where: { userId_orgId: { userId, orgId } },
      data: {
        ...(data.department !== undefined && { department: data.department }),
        ...(data.roleId !== undefined && { roleId: data.roleId }),
      },
      include: EMPLOYEE_MEMBERSHIP_INCLUDE,
    });
  });

  return serializeEmployee(updated);
}

// ─── Reset employee password ──────────────────────────────────────────────────

/**
 * Admin resets an employee's password.
 * Sets password back to hashed phone number and status back to pending_first_login.
 */
export async function resetEmployeePassword(orgId: string, userId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
    include: { user: true },
  });

  if (!membership) throw new NotFoundError('Employee');
  if (membership.isOwner) {
    throw new ForbiddenError(
      'Нельзя сбросить пароль руководителя через этот интерфейс.',
    );
  }
  if (membership.employeeAccountStatus === 'dismissed') {
    throw new ValidationError(
      'Нельзя сбросить пароль уволенного сотрудника.',
    );
  }

  const phone = membership.user.phone;
  if (!phone) {
    throw new ValidationError(
      'У этого сотрудника нет привязанного телефона. Смена пароля невозможна.',
    );
  }

  const hashedPhone = await hashPassword(phone);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { password: hashedPhone, status: 'pending' },
    });

    await tx.membership.update({
      where: { userId_orgId: { userId, orgId } },
      data: { employeeAccountStatus: 'pending_first_login' },
    });

    // Invalidate all refresh tokens for this user
    await tx.refreshToken.deleteMany({ where: { userId } });
  });

  return { ok: true, message: 'Пароль сброшен. Сотрудник должен войти через номер телефона.' };
}

// ─── Remove employee (permanent — deletes membership) ────────────────────────

export async function removeEmployee(orgId: string, userId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });

  if (!membership) throw new NotFoundError('Employee');
  if (membership.isOwner) {
    throw new ForbiddenError('Нельзя удалить руководителя.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({ where: { userId_orgId: { userId, orgId } } });
    await tx.refreshToken.deleteMany({ where: { userId } });
  });

  return { ok: true };
}

// ─── Dismiss employee ─────────────────────────────────────────────────────────

export async function dismissEmployee(orgId: string, userId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });

  if (!membership) throw new NotFoundError('Employee');
  if (membership.isOwner) {
    throw new ForbiddenError('Нельзя уволить руководителя.');
  }
  if (membership.employeeAccountStatus === 'dismissed') {
    throw new ValidationError('Сотрудник уже уволен.');
  }

  await prisma.$transaction(async (tx) => {
    // Mark as dismissed — login is blocked in auth.service.ts login()
    await tx.membership.update({
      where: { userId_orgId: { userId, orgId } },
      data: { employeeAccountStatus: 'dismissed' },
    });

    // Revoke all active refresh tokens immediately
    await tx.refreshToken.deleteMany({ where: { userId } });
  });

  return { ok: true, message: 'Сотрудник уволен. Доступ к аккаунту заблокирован.' };
}
