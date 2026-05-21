// R4.2 — Product Platform API: service-to-service authentication.
//
// Two independent gates, per `server/PLATFORM_API_CONTRACT.md`:
//   1. IP allowlist  — checked FIRST; a request from outside the list is
//      rejected (403 forbidden_ip) before the token is ever inspected.
//   2. Bearer service-token — an HMAC-SHA256 JWT signed by the Control Plane
//      with the shared PLATFORM_SERVICE_SECRET, `iss=control-plane`,
//      `aud=<product code>`, short TTL.
//
// Client (end-user) JWT secrets are deliberately NOT used here.

import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config.js';
import { ForbiddenError, UnauthorizedError } from '../../lib/errors.js';

// ─── IP allowlist (exact match + IPv4 CIDR) ───────────────────────────────────

/** Strips the IPv4-mapped IPv6 prefix so `::ffff:1.2.3.4` compares as `1.2.3.4`. */
function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  return trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
}

/** Parses dotted-quad IPv4 into an unsigned 32-bit int, or null if malformed. */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let acc = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    acc = (acc << 8) | octet;
  }
  return acc >>> 0;
}

/** True if `ip` satisfies a single allowlist rule (exact IP or IPv4 CIDR). */
function ruleMatches(ip: string, rule: string): boolean {
  const cleanRule = rule.trim();
  if (!cleanRule) return false;
  const cleanIp = normalizeIp(ip);

  if (!cleanRule.includes('/')) {
    return normalizeIp(cleanRule) === cleanIp;
  }

  const slashParts = cleanRule.split('/');
  const base = slashParts[0];
  const bitsRaw = slashParts[1];
  if (base === undefined || bitsRaw === undefined) return false;

  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const ipInt = ipv4ToInt(cleanIp);
  const baseInt = ipv4ToInt(normalizeIp(base));
  if (ipInt === null || baseInt === null) return false;
  if (bits === 0) return true;

  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

/** True if `ip` matches any rule in the allowlist. */
export function ipAllowed(ip: string, rules: string[]): boolean {
  return rules.some((rule) => ruleMatches(ip, rule));
}

/** Parsed PLATFORM_ALLOWED_IPS — empty array means the IP gate is disabled. */
export const PLATFORM_ALLOWED_IPS: string[] = config.PLATFORM_ALLOWED_IPS
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

// ─── preHandlers ──────────────────────────────────────────────────────────────

/**
 * First gate: rejects requests whose source IP is not in PLATFORM_ALLOWED_IPS.
 * When the list is empty the gate is off (the service token is then the only
 * line of defence). NB: behind a reverse proxy `request.ip` is the proxy IP
 * unless Fastify `trustProxy` is enabled — tune at deploy time.
 */
export async function enforceIpAllowlist(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (PLATFORM_ALLOWED_IPS.length === 0) return;
  if (!ipAllowed(request.ip, PLATFORM_ALLOWED_IPS)) {
    throw new ForbiddenError(`Source IP ${request.ip} is not allowed.`);
  }
}

/**
 * Second gate: verifies the Bearer service-token. On success the operator id
 * (token `sub`, if any) is stashed on `request.platformActor` for audit.
 */
export async function verifyServiceToken(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const secret = config.PLATFORM_SERVICE_SECRET;
  if (!secret) {
    // Defensive: routes are not mounted without the secret (see app.ts).
    throw new UnauthorizedError('Platform API is not configured.');
  }

  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing platform service token.');
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(header.slice(7), secret, {
      algorithms: ['HS256'],
      issuer: 'control-plane',
      audience: config.PLATFORM_PRODUCT_CODE,
    }) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired platform service token.');
  }

  request.platformActor = typeof decoded.sub === 'string' ? decoded.sub : null;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Control Plane operator id from the service token (R4.2). */
    platformActor: string | null;
  }
}
