import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as svc from './operations-settings.service.js';

export async function operationsSettingsRoutes(app: FastifyInstance) {
  // ── Operations defaults ───────────────────────────────
  // GET /api/v1/settings/operations/defaults
  app.get('/defaults', { preHandler: [app.authenticate, app.resolveOrg] }, async (request) => {
    return svc.getOperationsSettings(request.orgId);
  });

  // PATCH /api/v1/settings/operations/defaults
  app.patch('/defaults', { preHandler: [app.authenticate, app.resolveOrg, app.requireCompanyAdmin()] }, async (request) => {
    return svc.updateOperationsSettings(request.orgId, request.body as Record<string, unknown>);
  });

  // PATCH /api/v1/settings/operations/bank-commission
  app.patch('/bank-commission', { preHandler: [app.authenticate, app.resolveOrg] }, async (request) => {
    const body = z.object({ bankCommissionPercent: z.number().min(0).max(100) }).parse(request.body);
    return svc.updateBankCommission(request.orgId, body.bankCommissionPercent);
  });

  // ── Catalogs ──────────────────────────────────────────
  // GET /api/v1/settings/operations/catalogs
  app.get('/catalogs', { preHandler: [app.authenticate, app.resolveOrg] }, async (request) => {
    return svc.getCatalogs(request.orgId);
  });

  // PUT /api/v1/settings/operations/catalogs
  app.put('/catalogs', { preHandler: [app.authenticate, app.resolveOrg, app.requireCompanyAdmin()] }, async (request, reply) => {
    const body = z.object({
      productCatalog: z.array(z.string()).optional(),
      sizeCatalog: z.array(z.string()).optional(),
      workers: z.array(z.string()).optional(),
      paymentMethodCatalog: z.array(z.string()).optional(),
    }).parse(request.body);

    await svc.saveCatalogs(request.orgId, body);
    return reply.send({ ok: true });
  });

  // ── Clients ───────────────────────────────────────────
  // GET /api/v1/settings/operations/clients
  app.get('/clients', { preHandler: [app.authenticate, app.resolveOrg] }, async (request) => {
    const clients = await svc.getClients(request.orgId);
    return { count: clients.length, results: clients };
  });

  // POST /api/v1/settings/operations/clients
  app.post('/clients', { preHandler: [app.authenticate, app.resolveOrg] }, async (request, reply) => {
    const body = z.object({
      fullName: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().optional(),
      company: z.string().optional(),
      notes: z.string().optional(),
    }).parse(request.body);

    const client = await svc.createClient(request.orgId, body);
    return reply.status(201).send(client);
  });
}
