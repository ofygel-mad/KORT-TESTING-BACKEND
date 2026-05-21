import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors.js';

export const transferOwnershipSchema = z.object({
  target_user_id: z.string().min(1),
});

export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

export async function transferOwnership(
  currentOwnerUserId: string,
  orgId: string,
  input: TransferOwnershipInput,
) {
  if (input.target_user_id === currentOwnerUserId) {
    throw new ValidationError('Нельзя передать владение самому себе.');
  }

  const [currentOwnerMembership, targetMembership, activeOwners, organization] =
    await Promise.all([
      prisma.membership.findUnique({
        where: { userId_orgId: { userId: currentOwnerUserId, orgId } },
        include: { user: true },
      }),
      prisma.membership.findUnique({
        where: { userId_orgId: { userId: input.target_user_id, orgId } },
        include: { user: true },
      }),
      prisma.membership.findMany({
        where: {
          orgId,
          isOwner: true,
          status: 'active',
          NOT: { employeeAccountStatus: 'dismissed' },
        },
        select: { userId: true },
      }),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, slug: true },
      }),
    ]);

  if (!organization) {
    throw new NotFoundError('Organization', orgId);
  }

  if (!currentOwnerMembership || !currentOwnerMembership.isOwner) {
    throw new ForbiddenError('Передавать владение может только текущий владелец организации.');
  }

  if (activeOwners.length !== 1 || activeOwners[0]?.userId !== currentOwnerUserId) {
    throw new ConflictError(
      'Передача владения невозможна: в организации должен быть ровно один активный владелец.',
    );
  }

  if (!targetMembership) {
    throw new NotFoundError('Target member', input.target_user_id);
  }

  if (targetMembership.status !== 'active') {
    throw new ValidationError('Новый владелец должен быть активным участником организации.');
  }

  if (targetMembership.employeeAccountStatus === 'dismissed') {
    throw new ValidationError('Нельзя передать владение уволенному сотруднику.');
  }

  if (targetMembership.isOwner) {
    throw new ConflictError('Этот участник уже является владельцем организации.');
  }

  // Demoted owner keeps company-admin access so they aren't locked out.
  const adminRole = await prisma.role.findFirst({
    where: { key: 'admin', OR: [{ orgId: null }, { orgId }] },
  });

  await prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: targetMembership.id },
      data: {
        isOwner: true,
        status: 'active',
        employeeAccountStatus: 'active',
      },
    });

    await tx.membership.update({
      where: { id: currentOwnerMembership.id },
      data: {
        isOwner: false,
        status: 'active',
        employeeAccountStatus: 'active',
        roleId: adminRole?.id ?? null,
      },
    });

    await tx.refreshToken.deleteMany({
      where: {
        userId: {
          in: [currentOwnerUserId, input.target_user_id],
        },
      },
    });
  });

  return {
    ok: true,
    org: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    previous_owner: {
      id: currentOwnerMembership.userId,
      full_name: currentOwnerMembership.user.fullName,
      email: currentOwnerMembership.user.email,
    },
    new_owner: {
      id: targetMembership.userId,
      full_name: targetMembership.user.fullName,
      email: targetMembership.user.email,
    },
    revoked_sessions: [currentOwnerUserId, input.target_user_id],
  };
}
