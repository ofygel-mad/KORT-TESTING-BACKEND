import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import { resolveEffectivePermissions } from '../modules/auth/auth.service.js';

function isBlockedEmployeeStatus(status: string | null | undefined) {
  return status === 'dismissed' || status === 'pending_first_login';
}

// Grants full company-management access. Owner bypasses everything.
const COMPANY_ADMIN = 'company.admin';

async function orgScopePlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('orgId', '');
  fastify.decorateRequest('isOwner', false);
  fastify.decorateRequest('permissions', null);

  /**
   * Resolves the user's active organization from their membership.
   * Blocks dismissed employees from accessing protected routes.
   * Must run AFTER authenticate.
   */
  fastify.decorate('resolveOrg', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.userId) {
      throw new ForbiddenError('Authentication required before org resolution');
    }

    const xOrgId =
      typeof request.headers['x-org-id'] === 'string'
        ? request.headers['x-org-id']
        : null;

    if (xOrgId) {
      const requested = await prisma.membership.findUnique({
        where: { userId_orgId: { userId: request.userId, orgId: xOrgId } },
        include: { user: true, role: true, permissionOverrides: true },
      });

      if (requested && requested.status === 'active' && !isBlockedEmployeeStatus(requested.employeeAccountStatus)) {
        request.orgId = requested.orgId;
        request.isOwner = requested.isOwner;
        request.permissions = resolveEffectivePermissions(
          requested.isOwner,
          requested.role?.permissions ?? [],
          requested.permissionOverrides,
        );
        request.userFullName = requested.user.fullName;
        return;
      }

      if (requested && requested.status === 'active' && requested.employeeAccountStatus === 'pending_first_login') {
        throw new UnauthorizedError('Password reset requires a new login.');
      }
    }

    const membership = await prisma.membership.findFirst({
      where: {
        userId: request.userId,
        status: 'active',
        NOT: { employeeAccountStatus: { in: ['dismissed', 'pending_first_login'] } },
      },
      include: { user: true, role: true, permissionOverrides: true },
      orderBy: { joinedAt: 'desc' },
    });

    if (!membership) {
      const pendingMembership = await prisma.membership.findFirst({
        where: {
          userId: request.userId,
          status: 'active',
          employeeAccountStatus: 'pending_first_login',
        },
        select: { userId: true },
      });

      if (pendingMembership) {
        throw new UnauthorizedError('Password reset requires a new login.');
      }

      throw new ForbiddenError('No active organization membership');
    }

    request.orgId = membership.orgId;
    request.isOwner = membership.isOwner;
    request.permissions = resolveEffectivePermissions(
      membership.isOwner,
      membership.role?.permissions ?? [],
      membership.permissionOverrides,
    );
    request.userFullName = membership.user.fullName;
  });

  /**
   * Requires that the user holds at least one of the given scope.action
   * permissions. Owners and company admins bypass the check.
   */
  fastify.decorate('requirePermission', (...perms: string[]) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (request.isOwner) return;
      const granted = request.permissions ?? [];
      if (granted.includes(COMPANY_ADMIN)) return;
      if (perms.some((p) => granted.includes(p))) return;
      throw new ForbiddenError(`Requires one of: ${perms.join(', ')}`);
    };
  });

  /**
   * Requires company-management access (owner or company.admin permission).
   */
  fastify.decorate('requireCompanyAdmin', () => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (request.isOwner) return;
      if ((request.permissions ?? []).includes(COMPANY_ADMIN)) return;
      throw new ForbiddenError('Requires company administrator access');
    };
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    isOwner: boolean;
    permissions: string[] | null;
  }
  interface FastifyInstance {
    resolveOrg: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (
      ...perms: string[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireCompanyAdmin: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(orgScopePlugin, { name: 'org-scope', dependencies: ['auth'] });
