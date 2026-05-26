/**
 * P10e integration tests for `auth.service.ts`.
 *
 * Covers the login/register surfaces that the rest of the suite never touches:
 *   - registerCompany() happy path provisions user + org + active owner
 *     membership (via provisionOrganization) and signs a usable token pair.
 *   - Duplicate email on registerCompany surfaces ConflictError (409 mapping).
 *   - login() happy: returns a session with capabilities and a JWT whose
 *     payload carries the userId in `sub`.
 *   - login() rejects wrong password / unknown email with UnauthorizedError
 *     and a Russian error message (avoid leaking which field was wrong).
 *   - hashPassword/verifyPassword wraps bcrypt: hash differs from plain,
 *     and verifyPassword returns true only for the matching plaintext.
 *   - JWT round-trip: signAccessToken → verifyAccessToken yields the userId
 *     back on the `sub` claim. (The session-level token is generated through
 *     this same code path.)
 */

import jwt from 'jsonwebtoken';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../../lib/hash.js';
import { signAccessToken, verifyAccessToken } from '../../../lib/jwt.js';
import { config } from '../../../config.js';
import { login, registerCompany } from '../auth.service.js';

type TestUser = {
  email: string;
  fullName: string;
  password: string;
  company: string;
};

function uniqueUser(): TestUser {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `owner-${token}@example.test`,
    fullName: `Owner ${token}`,
    password: 'SuperSecret123!',
    company: `Authco ${token}`,
  };
}

const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];

async function trackResult(result: Awaited<ReturnType<typeof registerCompany>>) {
  createdUserIds.push(result.user.id);
  if (result.org?.id) createdOrgIds.push(result.org.id);
}

describe('auth.service — register + login (integration)', () => {
  afterEach(async () => {
    // Orgs cascade-delete memberships, refresh tokens, etc. Users that own no
    // org also need to be removed because the User table has no cascade up.
    if (createdOrgIds.length > 0) {
      await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
      createdOrgIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('registerCompany() provisions the owner, the org, and an active owner membership', async () => {
    const data = uniqueUser();
    const session = await registerCompany({
      full_name: data.fullName,
      email: data.email,
      password: data.password,
      company_name: data.company,
    });
    await trackResult(session);

    expect(session.user.email).toBe(data.email.toLowerCase());
    expect(session.user.is_owner).toBe(true);
    expect(session.org).not.toBeNull();
    expect(session.org!.name).toBe(data.company);
    expect(session.access).toMatch(/^eyJ/); // JWT
    expect(session.refresh).toMatch(/^eyJ/);

    // The owner membership is active + flagged isOwner.
    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id, orgId: session.org!.id },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      isOwner: true,
      status: 'active',
      source: 'company_registration',
    });

    // Stored password must be hashed (never plaintext).
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
    });
    expect(stored.password).not.toBe(data.password);
    expect(stored.password.startsWith('$2')).toBe(true);
  });

  it('registerCompany() rejects a duplicate email with ConflictError (409)', async () => {
    const data = uniqueUser();
    const first = await registerCompany({
      full_name: data.fullName,
      email: data.email,
      password: data.password,
      company_name: data.company,
    });
    await trackResult(first);

    await expect(
      registerCompany({
        full_name: 'Other Person',
        email: data.email.toUpperCase(), // normalizeEmail lowercases → still a dup
        password: 'OtherPass987!',
        company_name: `${data.company} two`,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('login() happy path returns the session + an access token carrying the userId', async () => {
    const data = uniqueUser();
    const provisioned = await registerCompany({
      full_name: data.fullName,
      email: data.email,
      password: data.password,
      company_name: data.company,
    });
    await trackResult(provisioned);

    const session = await login({ email: data.email, password: data.password });

    // Type guard: this branch returns the full session (not the first-login
    // setup payload), so the `access` field exists.
    if (!('access' in session)) {
      throw new Error('Expected a session response, got the first-login payload');
    }
    expect(session.user.id).toBe(provisioned.user.id);
    expect(session.user.is_owner).toBe(true);
    expect(session.org!.id).toBe(provisioned.org!.id);
    expect(session.capabilities.length).toBeGreaterThan(0);

    const payload = verifyAccessToken(session.access);
    expect(payload.sub).toBe(provisioned.user.id);
    expect(payload.email).toBe(data.email.toLowerCase());
  });

  it('login() rejects a wrong password with UnauthorizedError (401)', async () => {
    const data = uniqueUser();
    const provisioned = await registerCompany({
      full_name: data.fullName,
      email: data.email,
      password: data.password,
      company_name: data.company,
    });
    await trackResult(provisioned);

    await expect(
      login({ email: data.email, password: 'wrong-password' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('login() rejects an unknown email with UnauthorizedError (401)', async () => {
    await expect(
      login({ email: 'nobody-here@example.test', password: 'whatever' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('hashPassword + verifyPassword form a working bcrypt pair', async () => {
    const plain = 'PaSSw0rd_strong!';
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
    expect(await verifyPassword(plain, hash)).toBe(true);
    expect(await verifyPassword('PaSSw0rd_wrong!', hash)).toBe(false);
  });

  it('signAccessToken yields a JWT whose payload carries `sub` (userId) and `email`', async () => {
    const token = signAccessToken({ sub: 'user-xyz', email: 'jwt-roundtrip@example.test' });

    // Round-trip via the public verifier.
    const verified = verifyAccessToken(token);
    expect(verified.sub).toBe('user-xyz');
    expect(verified.email).toBe('jwt-roundtrip@example.test');

    // And raw decode confirms the JWT really uses the configured secret.
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as Record<string, unknown>;
    expect(decoded.sub).toBe('user-xyz');
    expect(typeof decoded.exp).toBe('number');
  });
});
