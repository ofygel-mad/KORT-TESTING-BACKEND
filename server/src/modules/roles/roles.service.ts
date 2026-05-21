import { z } from 'zod';
import { nanoid } from 'nanoid';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { ALL_PERMISSIONS } from '../auth/auth.service.js';

const VALID_PERMISSIONS = ALL_PERMISSIONS as readonly [string, ...string[]];

export const createRoleSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(240).optional(),
  permissions: z.array(z.enum(VALID_PERMISSIONS)).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(240).optional(),
  permissions: z.array(z.enum(VALID_PERMISSIONS)).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

type RoleRow = {
  id: string;
  orgId: string | null;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
};

function serializeRole(role: RoleRow) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description ?? '',
    is_system: role.isSystem,
    scope: role.orgId ? 'custom' : 'system',
    permissions: role.permissions,
  };
}

/** Lists shared system roles plus this org's custom roles. */
export async function listRoles(orgId: string) {
  const roles = await prisma.role.findMany({
    where: { OR: [{ orgId: null }, { orgId }] },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });
  return roles.map(serializeRole);
}

export async function createRole(orgId: string, data: CreateRoleInput) {
  const role = await prisma.role.create({
    data: {
      orgId,
      key: `custom-${nanoid(10)}`,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      isSystem: false,
      permissions: data.permissions,
    },
  });
  return serializeRole(role);
}

async function assertEditableRole(orgId: string, id: string) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role || (role.orgId !== orgId)) throw new NotFoundError('Role', id);
  if (role.isSystem) {
    throw new ForbiddenError('Системные роли нельзя редактировать или удалять.');
  }
  return role;
}

export async function updateRole(orgId: string, id: string, data: UpdateRoleInput) {
  await assertEditableRole(orgId, id);
  const role = await prisma.role.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description.trim() || null }),
      ...(data.permissions !== undefined && { permissions: data.permissions }),
    },
  });
  return serializeRole(role);
}

export async function deleteRole(orgId: string, id: string) {
  await assertEditableRole(orgId, id);
  const inUse = await prisma.membership.count({ where: { roleId: id } });
  if (inUse > 0) {
    throw new ValidationError(
      `Роль назначена ${inUse} сотрудник(ам). Переназначьте их перед удалением.`,
    );
  }
  await prisma.role.delete({ where: { id } });
  return { ok: true };
}
