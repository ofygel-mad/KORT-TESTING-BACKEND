import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as service from './kaspi.service.js';

export async function kaspiIntegrationRoutes(app: FastifyInstance) {
  const orgAdminOnly = { preHandler: [app.authenticate, app.resolveOrg, app.requireRole('admin', 'owner')] };
  const orgManagerPlus = { preHandler: [app.authenticate, app.resolveOrg, app.requireRole('manager', 'admin', 'owner')] };

  app.get('/connection', orgManagerPlus, async (request) => {
    return service.getConnection(request.orgId);
  });

  app.put('/connection', orgAdminOnly, async (request) => {
    const body = z.object({
      apiToken: z.string().min(1),
      sellerName: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(request.body);

    return service.saveConnection(request.orgId, body);
  });

  app.post('/connection/test', orgAdminOnly, async (request) => {
    return service.testConnection(request.orgId);
  });

  app.post('/sync', orgAdminOnly, async (request) => {
    return service.syncOrders(request.orgId);
  });

  app.get('/orders', orgManagerPlus, async (request) => {
    const query = z.object({
      state: z.string().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }).parse(request.query);

    return service.listOrders(request.orgId, query);
  });

  app.get('/orders/summary', orgManagerPlus, async (request) => {
    return service.getOrdersSummary(request.orgId);
  });

  app.get('/orders/:externalOrderId', orgManagerPlus, async (request) => {
    const { externalOrderId } = z.object({
      externalOrderId: z.string().min(1),
    }).parse(request.params);

    return service.getOrderDetail(request.orgId, externalOrderId);
  });

  app.post('/orders/:externalOrderId/complete/send-code', orgManagerPlus, async (request) => {
    const { externalOrderId } = z.object({
      externalOrderId: z.string().min(1),
    }).parse(request.params);

    return service.sendCompletionCode(request.orgId, externalOrderId);
  });

  app.post('/orders/:externalOrderId/complete/confirm', orgManagerPlus, async (request) => {
    const { externalOrderId } = z.object({
      externalOrderId: z.string().min(1),
    }).parse(request.params);

    const body = z.object({
      securityCode: z.string().min(1).max(32),
    }).parse(request.body);

    return service.confirmCompletionCode(request.orgId, externalOrderId, body);
  });
}
