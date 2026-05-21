import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as svc from './subscriptions.service.js';

export async function subscriptionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.resolveOrg);

  // GET /api/v1/subscription — current org subscription + resolved plan
  app.get('/', async (request) => {
    return svc.getSubscription(request.orgId);
  });

  // GET /api/v1/subscription/plans — plan catalog
  app.get('/plans', async () => {
    const results = await svc.listPlans();
    return { count: results.length, results };
  });

  // PATCH /api/v1/subscription — change plan (owner / company.admin only)
  app.patch('/', { preHandler: [app.requireCompanyAdmin()] }, async (request) => {
    const { plan_code } = z.object({ plan_code: z.string().min(1) }).parse(request.body);
    return svc.changePlan(request.orgId, plan_code);
  });
}
