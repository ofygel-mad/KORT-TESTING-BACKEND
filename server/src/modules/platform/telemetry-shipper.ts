// R4.4 — telemetry shipper. Push side of the Control Plane integration:
// KORT writes audit events to the local `AuditEvent` outbox (R4.1); this
// worker batches the unshipped rows and POSTs them to the Control Plane
// ingestion endpoint, then marks them `shippedAt`. CP keeps the canonical
// long-horizon audit; KORT only needs a short local window.

import type { FastifyBaseLogger } from 'fastify';
import { config } from '../../config.js';
import { prisma } from '../../lib/prisma.js';

let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

/** Ships one batch of unshipped audit events. Returns the count shipped. */
async function shipBatch(): Promise<number> {
  const url = config.PLATFORM_INGEST_URL;
  const secret = config.PLATFORM_INGEST_SECRET;
  if (!url || !secret) return 0;

  const batch = await prisma.auditEvent.findMany({
    where: { shippedAt: null },
    orderBy: { occurredAt: 'asc' },
    take: config.PLATFORM_INGEST_BATCH,
  });
  if (batch.length === 0) return 0;

  // Envelope per server/PLATFORM_API_CONTRACT.md § Телеметрия.
  const events = batch.map((event) => ({
    eventId: event.id,
    productCode: config.PLATFORM_PRODUCT_CODE,
    tenantId: event.orgId,
    userId: event.userId,
    type: event.type,
    action: event.action,
    ip: event.ip,
    userAgent: event.userAgent,
    metadata: event.metadata ?? {},
    occurredAt: event.occurredAt.toISOString(),
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ productCode: config.PLATFORM_PRODUCT_CODE, events }),
  });
  if (!response.ok) {
    throw new Error(`ingestion responded ${response.status}`);
  }

  await prisma.auditEvent.updateMany({
    where: { id: { in: batch.map((event) => event.id) } },
    data: { shippedAt: new Date() },
  });
  return batch.length;
}

/**
 * Starts the periodic shipper. No-op (with a log line) when ingestion is not
 * configured. Every failure is swallowed — a delivery problem must never
 * crash KORT; the rows simply stay unshipped and retry next tick.
 */
export function startTelemetryShipper(log: FastifyBaseLogger): { stop: () => void } {
  if (!config.PLATFORM_INGEST_URL || !config.PLATFORM_INGEST_SECRET) {
    log.info('Telemetry shipper disabled — PLATFORM_INGEST_URL / _SECRET not set.');
    return { stop: () => {} };
  }

  const tick = async () => {
    if (inFlight) return; // skip if the previous tick is still draining
    inFlight = true;
    try {
      let shipped = 0;
      // Drain in batches so a backlog clears without waiting many intervals.
      for (;;) {
        const count = await shipBatch();
        shipped += count;
        if (count < config.PLATFORM_INGEST_BATCH) break;
      }
      if (shipped > 0) log.info(`Telemetry shipper: shipped ${shipped} event(s).`);
    } catch (error) {
      log.warn(`Telemetry shipper: ${(error as Error).message}`);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(() => void tick(), config.PLATFORM_INGEST_INTERVAL_MS);
  timer.unref();
  log.info(
    `Telemetry shipper started (every ${config.PLATFORM_INGEST_INTERVAL_MS}ms, `
      + `batch ${config.PLATFORM_INGEST_BATCH}).`,
  );
  return {
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
