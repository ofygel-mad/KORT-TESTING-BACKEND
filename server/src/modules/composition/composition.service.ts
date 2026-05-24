// ЧАСТЬ X — composition service: the active TenantConfig, its append-only
// revision journal, and the staged preview. KORT owns and autonomously applies
// the active config; the Control Plane drives it only through the platform
// composition endpoints. See server/COMPOSABILITY_CONTRACT.md.

import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { COMPOSITION_MANIFEST, MANIFEST_VERSION } from './manifest.js';
import { tenantConfigSchema, type TenantConfigData } from './composition.schema.js';
import { buildDefaultConfig } from './composition.defaults.js';

/** Prisma's Json input type is strict about `undefined`; the config is plain JSON. */
function asJson(config: TenantConfigData): Prisma.InputJsonValue {
  return config as unknown as Prisma.InputJsonValue;
}

/** Validates raw config against the current manifest. Throws on any violation. */
export function validateConfigData(raw: unknown): TenantConfigData {
  const result = tenantConfigSchema.safeParse(raw);
  if (!result.success) {
    const message =
      result.error.issues.map((issue) => issue.message).join('; ') ||
      'Невалидная конфигурация';
    throw new ValidationError(message);
  }
  return result.data;
}

async function assertTenantExists(tenantId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });
  if (!org) throw new NotFoundError('Организация', tenantId);
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

export function getManifest() {
  return COMPOSITION_MANIFEST;
}

// ─── Default config seeding ───────────────────────────────────────────────────

/**
 * Creates the default TenantConfig + revision 1 inside the given transaction.
 * Used by provisioning, where the org is guaranteed fresh.
 */
export async function createDefaultConfigRecords(
  tx: Prisma.TransactionClient,
  orgId: string,
) {
  const config = buildDefaultConfig();
  const appliedAt = new Date();
  await tx.tenantConfigRevision.create({
    data: {
      orgId,
      revision: 1,
      schemaVersion: config.schemaVersion,
      config: asJson(config),
      manifestVersion: MANIFEST_VERSION,
      source: 'default',
      note: 'Дефолтная конфигурация (создана при провижининге).',
      actor: 'system',
      appliedAt,
    },
  });
  return tx.tenantConfig.create({
    data: {
      orgId,
      revision: 1,
      schemaVersion: config.schemaVersion,
      config: asJson(config),
      manifestVersion: MANIFEST_VERSION,
      source: 'default',
      appliedAt,
    },
  });
}

/**
 * Returns the org's TenantConfig, lazily seeding the default if absent.
 * Tolerates a concurrent-bootstrap race via the org_id unique constraint.
 */
export async function ensureDefaultConfig(orgId: string) {
  const existing = await prisma.tenantConfig.findUnique({ where: { orgId } });
  if (existing) return existing;
  try {
    return await prisma.$transaction((tx) => createDefaultConfigRecords(tx, orgId));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const row = await prisma.tenantConfig.findUnique({ where: { orgId } });
      if (row) return row;
    }
    throw error;
  }
}

/** Config payload delivered to the KORT frontend at bootstrap. */
export interface BootstrapConfigPayload {
  data: TenantConfigData;
  revision: number;
  manifestVersion: string;
  source: string;
  preview: boolean;
}

/**
 * Resolves the config the frontend should apply. A preview-flagged operator
 * session (X-Config-Preview) gets a non-expired staged preview; everyone else
 * gets the active config.
 */
export async function resolveConfigForBootstrap(
  orgId: string,
  opts: { preview: boolean },
): Promise<BootstrapConfigPayload> {
  const active = await ensureDefaultConfig(orgId);
  if (opts.preview) {
    const preview = await prisma.tenantConfigPreview.findUnique({ where: { orgId } });
    if (preview && preview.expiresAt.getTime() > Date.now()) {
      return {
        data: preview.config as unknown as TenantConfigData,
        revision: active.revision,
        manifestVersion: preview.manifestVersion,
        source: 'preview',
        preview: true,
      };
    }
  }
  return {
    data: active.config as unknown as TenantConfigData,
    revision: active.revision,
    manifestVersion: active.manifestVersion,
    source: active.source,
    preview: false,
  };
}

// ─── Platform endpoints: read ─────────────────────────────────────────────────

export async function getActiveConfig(tenantId: string) {
  await assertTenantExists(tenantId);
  const row = await ensureDefaultConfig(tenantId);
  return {
    tenantId,
    revision: row.revision,
    schemaVersion: row.schemaVersion,
    manifestVersion: row.manifestVersion,
    source: row.source,
    config: row.config,
    appliedAt: row.appliedAt.toISOString(),
  };
}

export async function listRevisions(
  tenantId: string,
  query: { page: number; limit: number },
) {
  await assertTenantExists(tenantId);
  const skip = (query.page - 1) * query.limit;
  const [count, rows] = await Promise.all([
    prisma.tenantConfigRevision.count({ where: { orgId: tenantId } }),
    prisma.tenantConfigRevision.findMany({
      where: { orgId: tenantId },
      orderBy: { revision: 'desc' },
      skip,
      take: query.limit,
    }),
  ]);
  return {
    count,
    results: rows.map((row) => ({
      revision: row.revision,
      schemaVersion: row.schemaVersion,
      manifestVersion: row.manifestVersion,
      source: row.source,
      note: row.note,
      actor: row.actor,
      appliedAt: row.appliedAt.toISOString(),
    })),
  };
}

// ─── Platform endpoints: write ────────────────────────────────────────────────

/** Writes a new revision and promotes it to the active config (one transaction). */
async function applyConfig(
  orgId: string,
  config: TenantConfigData,
  source: 'platform' | 'rollback',
  note: string | null,
  actor: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.tenantConfig.findUnique({ where: { orgId } });
    const nextRevision = (existing?.revision ?? 0) + 1;
    const appliedAt = new Date();
    await tx.tenantConfigRevision.create({
      data: {
        orgId,
        revision: nextRevision,
        schemaVersion: config.schemaVersion,
        config: asJson(config),
        manifestVersion: MANIFEST_VERSION,
        source,
        note,
        actor,
        appliedAt,
      },
    });
    const row = await tx.tenantConfig.upsert({
      where: { orgId },
      create: {
        orgId,
        revision: nextRevision,
        schemaVersion: config.schemaVersion,
        config: asJson(config),
        manifestVersion: MANIFEST_VERSION,
        source,
        appliedAt,
      },
      update: {
        revision: nextRevision,
        schemaVersion: config.schemaVersion,
        config: asJson(config),
        manifestVersion: MANIFEST_VERSION,
        source,
        appliedAt,
      },
    });
    await tx.tenantConfigPreview.deleteMany({ where: { orgId } });
    return row;
  });
}

export async function publishConfig(
  tenantId: string,
  input: { config: unknown; note?: string | null },
  actor: string | null,
) {
  await assertTenantExists(tenantId);
  const config = validateConfigData(input.config);
  const saved = await applyConfig(tenantId, config, 'platform', input.note ?? null, actor);
  recordAuditEvent({
    type: 'business',
    action: 'composition.publish',
    orgId: tenantId,
    metadata: { revision: saved.revision, actor },
  });
  return { tenantId, revision: saved.revision, appliedAt: saved.appliedAt.toISOString() };
}

export async function rollbackConfig(
  tenantId: string,
  input: { revision: number; reason?: string | null },
  actor: string | null,
) {
  await assertTenantExists(tenantId);
  const target = await prisma.tenantConfigRevision.findUnique({
    where: { orgId_revision: { orgId: tenantId, revision: input.revision } },
  });
  if (!target) {
    throw new NotFoundError('Ревизия конфигурации', String(input.revision));
  }
  // Re-validate the target against the CURRENT manifest — a removed block must
  // surface as 422 rather than a broken render.
  const config = validateConfigData(target.config);
  const note = input.reason
    ? `Откат на ревизию ${input.revision}: ${input.reason}`
    : `Откат на ревизию ${input.revision}.`;
  const saved = await applyConfig(tenantId, config, 'rollback', note, actor);
  recordAuditEvent({
    type: 'business',
    action: 'composition.rollback',
    orgId: tenantId,
    metadata: { revision: saved.revision, fromRevision: input.revision, actor },
  });
  return { tenantId, revision: saved.revision, appliedAt: saved.appliedAt.toISOString() };
}

export async function stagePreview(
  tenantId: string,
  input: { config: unknown; ttlSec?: number },
  actor: string | null,
) {
  await assertTenantExists(tenantId);
  const config = validateConfigData(input.config);
  const ttlSec = input.ttlSec ?? 1800;
  const expiresAt = new Date(Date.now() + ttlSec * 1000);
  await prisma.tenantConfigPreview.upsert({
    where: { orgId: tenantId },
    create: {
      orgId: tenantId,
      config: asJson(config),
      manifestVersion: MANIFEST_VERSION,
      stagedBy: actor ?? 'system',
      expiresAt,
    },
    update: {
      config: asJson(config),
      manifestVersion: MANIFEST_VERSION,
      stagedBy: actor ?? 'system',
      expiresAt,
    },
  });
  recordAuditEvent({
    type: 'business',
    action: 'composition.preview',
    orgId: tenantId,
    metadata: { actor, expiresAt: expiresAt.toISOString() },
  });
  return { tenantId, expiresAt: expiresAt.toISOString() };
}

export async function clearPreview(tenantId: string) {
  await assertTenantExists(tenantId);
  const deleted = await prisma.tenantConfigPreview.deleteMany({
    where: { orgId: tenantId },
  });
  return { tenantId, cleared: deleted.count > 0 };
}
