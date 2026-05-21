import type { FastifyInstance } from 'fastify';
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  createRoleSchema,
  updateRoleSchema,
} from './roles.service.js';

export async function rolesRoutes(app: FastifyInstance) {
  // GET /api/v1/roles — system roles + this org's custom roles
  app.get('/', { preHandler: [app.authenticate, app.resolveOrg] }, async (request) => {
    const roles = await listRoles(request.orgId);
    return { count: roles.length, results: roles };
  });

  // POST /api/v1/roles — create a custom role
  app.post('/', {
    preHandler: [app.authenticate, app.resolveOrg, app.requireCompanyAdmin()],
  }, async (request, reply) => {
    const body = createRoleSchema.parse(request.body);
    const role = await createRole(request.orgId, body);
    return reply.status(201).send(role);
  });

  // PATCH /api/v1/roles/:id — update a custom role
  app.patch<{ Params: { id: string } }>('/:id', {
    preHandler: [app.authenticate, app.resolveOrg, app.requireCompanyAdmin()],
  }, async (request) => {
    const body = updateRoleSchema.parse(request.body);
    return updateRole(request.orgId, request.params.id, body);
  });

  // DELETE /api/v1/roles/:id — delete a custom role
  app.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [app.authenticate, app.resolveOrg, app.requireCompanyAdmin()],
  }, async (request) => {
    return deleteRole(request.orgId, request.params.id);
  });
}
