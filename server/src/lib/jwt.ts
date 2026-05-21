import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config.js';

// ─── Payload types ────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string;    // userId
  email: string;  // may be empty string for phone-only employees
  type?: never;   // standard access tokens do NOT have a type field
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;    // refresh token id (for revocation)
}

/**
 * Short-lived token issued when an employee does phone+phone login.
 * Used exclusively on POST /auth/set-password/.
 * The `type: 'first_login'` discriminator prevents it from being used
 * as a regular access token.
 */
export interface FirstLoginTokenPayload {
  sub: string;   // userId
  type: 'first_login';
}

// ─── Signing ──────────────────────────────────────────────────────────────────

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_TTL as SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_TTL as SignOptions['expiresIn'],
  });
}

/**
 * Signs a first-login temp token with a short TTL (30 min).
 * Signed with JWT_ACCESS_SECRET so it can be verified with verifyAccessToken,
 * but the `type` field distinguishes it.
 */
export function signFirstLoginToken(userId: string): string {
  const payload: FirstLoginTokenPayload = { sub: userId, type: 'first_login' };
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, { expiresIn: '30m' });
}

/**
 * Impersonation token — issued by the Product Platform API (R4.2) so a
 * Control Plane operator can act inside a tenant. It works as a regular
 * access token (no `type` field, signed with JWT_ACCESS_SECRET, so the auth
 * plugin verifies it transparently) but carries `impersonated: true` plus the
 * operator id in `act` for downstream enforcement (UI banner / destructive-op
 * blocking — landed later, R4.5+).
 */
export interface ImpersonationTokenPayload {
  sub: string;        // userId being impersonated (the tenant owner)
  email: string;
  orgId: string;      // tenant org id
  act: string;        // Control Plane operator (platform user id)
  impersonated: true;
}

/** Signs a short-lived impersonation token; ttlSec is the lifetime in seconds. */
export function signImpersonationToken(
  claims: Omit<ImpersonationTokenPayload, 'impersonated'>,
  ttlSec: number,
): string {
  const payload: ImpersonationTokenPayload = { ...claims, impersonated: true };
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: ttlSec as SignOptions['expiresIn'],
  });
}

// ─── Verification ─────────────────────────────────────────────────────────────

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload & { type?: string };

  // Block first_login tokens from being used as regular access tokens
  if (payload.type === 'first_login') {
    throw new Error('First-login token cannot be used as an access token');
  }

  return payload as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

export function verifyFirstLoginToken(token: string): FirstLoginTokenPayload {
  const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as FirstLoginTokenPayload;

  if (payload.type !== 'first_login') {
    throw new Error('Not a first-login token');
  }

  return payload;
}
