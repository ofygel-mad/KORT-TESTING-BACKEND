// ЧАСТЬ X — Product Platform API: composition endpoints.
//
// Registered as a child of `platformRoutes` under `/platform/v1/composition`,
// so it inherits the IP-allowlist + Bearer service-token preHandlers and the
// contract error envelope `{ error: { code, message } }`.
// See server/COMPOSABILITY_CONTRACT.md.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as svc from '../composition/composition.service.js';

const configValue = z
  .unknown()
  .refine((value) => value !== undefined && value !== null, {
    message: 'Поле config обязательно.',
  });

export async function compositionPlatformRoutes(app: FastifyInstance) {
  // ── GET /platform/v1/composition/manifest ───────────────────────────────
  app.get('/manifest', async () => svc.getManifest());

  // ── GET /platform/v1/composition/config ─────────────────────────────────
  app.get('/config', async (request) => {
    const { tenantId } = z
      .object({ tenantId: z.string().min(1) })
      .parse(request.query);
    return svc.getActiveConfig(tenantId);
  });

  // ── POST /platform/v1/composition/publish ───────────────────────────────
  app.post('/publish', async (request, reply) => {
    const body = z
      .object({
        tenantId: z.string().min(1),
        config: configValue,
        manifestVersion: z.string().min(1),
        note: z.string().trim().min(1).optional(),
      })
      .parse(request.body);
    const result = await svc.publishConfig(
      body.tenantId,
      { config: body.config, note: body.note ?? null },
      request.platformActor,
    );
    return reply.status(201).send(result);
  });

  // ── POST /platform/v1/composition/preview ───────────────────────────────
  app.post('/preview', async (request) => {
    const body = z
      .object({
        tenantId: z.string().min(1),
        config: configValue,
        manifestVersion: z.string().min(1),
        ttlSec: z.coerce.number().int().min(60).max(3600).optional(),
      })
      .parse(request.body);
    return svc.stagePreview(
      body.tenantId,
      { config: body.config, ttlSec: body.ttlSec },
      request.platformActor,
    );
  });

  // ── DELETE /platform/v1/composition/preview ─────────────────────────────
  app.delete('/preview', async (request) => {
    const { tenantId } = z
      .object({ tenantId: z.string().min(1) })
      .parse(request.query);
    return svc.clearPreview(tenantId);
  });

  // ── GET /platform/v1/composition/revisions ──────────────────────────────
  app.get('/revisions', async (request) => {
    const query = z
      .object({
        tenantId: z.string().min(1),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query);
    return svc.listRevisions(query.tenantId, { page: query.page, limit: query.limit });
  });

  // ── POST /platform/v1/composition/rollback ──────────────────────────────
  app.post('/rollback', async (request) => {
    const body = z
      .object({
        tenantId: z.string().min(1),
        revision: z.coerce.number().int().min(1),
        reason: z.string().trim().min(1).optional(),
      })
      .parse(request.body);
    return svc.rollbackConfig(
      body.tenantId,
      { revision: body.revision, reason: body.reason ?? null },
      request.platformActor,
    );
  });
}
