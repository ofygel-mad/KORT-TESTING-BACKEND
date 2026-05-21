// R4.2 — Product Platform API: routes.
//
// Mounted at `/platform/v1` (see app.ts) — a separate service-to-service
// surface, deliberately NOT under `/api/v1`. Every route sits behind the IP
// allowlist + Bearer service-token gates and answers with the contract error
// envelope `{ error: { code, message } }` instead of KORT's app-wide shape.

import type { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { AppError } from '../../lib/errors.js';
import { enforceIpAllowlist, verifyServiceToken } from './platform.auth.js';
import * as svc from './platform.service.js';

// HTTP status → contract error code (PLATFORM_API_CONTRACT.md § Модель ошибок).
const ERROR_CODE: Record<number, string> = {
  401: 'unauthorized',
  403: 'forbidden_ip',
  404: 'not_found',
  409: 'conflict',
  422: 'validation',
  503: 'unavailable',
};

export async function platformRoutes(app: FastifyInstance) {
  app.decorateRequest('platformActor', null);

  // Contract error envelope — scoped to this plugin only.
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      const message =
        error.issues.map((issue) => issue.message).join('; ') || 'Validation failed';
      return reply.status(422).send({ error: { code: 'validation', message } });
    }
    if (error instanceof AppError) {
      // KORT's ValidationError is HTTP 400; the contract models it as 422.
      const status = error.statusCode === 400 ? 422 : error.statusCode;
      return reply.status(status).send({
        error: { code: ERROR_CODE[status] ?? 'error', message: error.message },
      });
    }
    if (typeof error === 'object' && error !== null && 'validation' in error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      return reply.status(422).send({ error: { code: 'validation', message } });
    }
    app.log.error(error);
    return reply
      .status(500)
      .send({ error: { code: 'internal', message: 'Internal server error' } });
  });

  // Service-to-service auth: IP allowlist BEFORE token, per the contract.
  app.addHook('preHandler', enforceIpAllowlist);
  app.addHook('preHandler', verifyServiceToken);

  // ── GET /platform/v1/health ─────────────────────────────────────────────
  app.get('/health', async () => svc.getHealth());

  // ── GET /platform/v1/tenants ────────────────────────────────────────────
  app.get('/tenants', async (request) => {
    const query = z
      .object({
        search: z.string().trim().min(1).optional(),
        status: z.string().trim().min(1).optional(),
        plan: z.string().trim().min(1).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query);
    return svc.listTenants(query);
  });

  // ── GET /platform/v1/tenants/:id ────────────────────────────────────────
  app.get('/tenants/:id', async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    return svc.getTenant(id);
  });

  // ── PATCH /platform/v1/tenants/:id ──────────────────────────────────────
  app.patch('/tenants/:id', async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z
      .object({
        planCode: z.string().trim().min(1).optional(),
        status: z.enum(['active', 'suspended']).optional(),
      })
      .refine((value) => value.planCode !== undefined || value.status !== undefined, {
        message: 'Укажите planCode и/или status.',
      })
      .parse(request.body);
    return svc.patchTenant(id, body, request.platformActor);
  });

  // ── POST /platform/v1/tenants ───────────────────────────────────────────
  app.post('/tenants', async (request, reply) => {
    const body = z
      .object({
        companyName: z.string().trim().min(1),
        ownerEmail: z.string().trim().email(),
        ownerFullName: z.string().trim().min(1),
        planCode: z.string().trim().min(1).optional(),
      })
      .parse(request.body);
    const result = await svc.createTenant(body, request.platformActor);
    return reply.status(201).send(result);
  });

  // ── POST /platform/v1/tenants/:id/impersonate ───────────────────────────
  app.post('/tenants/:id/impersonate', async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z
      .object({
        actorPlatformUserId: z.string().trim().min(1),
        reason: z.string().trim().min(1),
        ttlSec: z.coerce.number().int().min(60).max(3600).optional(),
      })
      .parse(request.body);
    return svc.impersonateTenant(id, body);
  });

  // ── GET /platform/v1/metrics ────────────────────────────────────────────
  app.get('/metrics', async (request) => {
    const query = z
      .object({ from: z.string().optional(), to: z.string().optional() })
      .parse(request.query);
    return svc.getMetrics(query.from, query.to);
  });
}
