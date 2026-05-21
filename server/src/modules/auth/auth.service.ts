import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/hash.js';
import {
  signAccessToken,
  signRefreshToken,
  signFirstLoginToken,
  verifyFirstLoginToken,
  verifyRefreshToken,
} from '../../lib/jwt.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../lib/errors.js';
import { sendPasswordResetEmail } from '../../lib/email.js';
import { normalizeOrgCurrency } from '../../lib/currency.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const DUPLICATE_EMAIL_MESSAGE =
  'Этот email уже привязан к существующему аккаунту.';
const DUPLICATE_PHONE_MESSAGE =
  'Этот номер телефона уже привязан к существующему аккаунту.';

// ─── Permission model ─────────────────────────────────────────────────────────

/**
 * Canonical scope.action permission catalog.
 * Owners (and members holding 'company.admin') implicitly hold all of these.
 */
export const ALL_PERMISSIONS = [
  'orders.read', 'orders.write', 'orders.admin',
  'invoices.read', 'invoices.write', 'invoices.confirm',
  'warehouse.read', 'warehouse.write', 'warehouse.admin',
  'production.read', 'production.write', 'production.manage',
  'logistics.read', 'logistics.write',
  'customers.read', 'customers.write',
  'products.read', 'products.write', 'products.admin',
  'purchase.read', 'purchase.write',
  'returns.read', 'returns.write',
  'reports.read',
  'documents.read', 'documents.write',
  'company.admin',
] as const;

export interface PermissionOverride {
  permission: string;
  effect: string; // 'allow' | 'deny'
}

/**
 * Resolves the effective scope.action permission set for a membership:
 *   effective = role.permissions + allow-overrides − deny-overrides
 * Owners and holders of 'company.admin' implicitly hold every permission.
 */
export function resolveEffectivePermissions(
  isOwner: boolean,
  rolePermissions: string[] = [],
  overrides: PermissionOverride[] = [],
): string[] {
  if (isOwner || rolePermissions.includes('company.admin')) {
    return [...ALL_PERMISSIONS];
  }
  const set = new Set(rolePermissions);
  for (const o of overrides) {
    if (o.effect === 'allow') set.add(o.permission);
    else if (o.effect === 'deny') set.delete(o.permission);
  }
  if (set.has('company.admin')) return [...ALL_PERMISSIONS];
  return [...set];
}

/**
 * Builds the effective capability list for a user session.
 * Inactive memberships get nothing; otherwise the resolved permission set.
 */
export function buildCapabilities(
  isOwner: boolean,
  active: boolean,
  rolePermissions: string[] = [],
  overrides: PermissionOverride[] = [],
): string[] {
  if (!active) return [];
  return resolveEffectivePermissions(isOwner, rolePermissions, overrides);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9а-яё\s-]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 48) || `company-${Date.now()}`
  );
}

function appendSlugSuffix(base: string, suffix: number) {
  const label = `-${suffix}`;
  return `${base.slice(0, Math.max(1, 48 - label.length))}${label}`;
}

function isUniqueConstraint(error: unknown, field: string) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  return typeof target === 'string' ? target.includes(field) : false;
}

async function generateUniqueSlug(
  companyName: string,
  tx: Prisma.TransactionClient,
) {
  const base = sanitizeSlug(companyName);
  const existing = await tx.organization.findMany({
    where: { OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] },
    select: { slug: true },
  });
  const used = new Set(existing.map((o) => o.slug));
  if (!used.has(base)) return base;
  let n = 2;
  let next = appendSlugSuffix(base, n);
  while (used.has(next)) {
    n += 1;
    next = appendSlugSuffix(base, n);
  }
  return next;
}

async function createTokenPair(userId: string, email: string) {
  const jti = nanoid();
  const access = signAccessToken({ sub: userId, email: email ?? '' });
  const refresh = signRefreshToken({ sub: userId, jti });

  await prisma.refreshToken.create({
    data: {
      id: jti,
      token: refresh,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { access, refresh };
}

// ─── Session builder ──────────────────────────────────────────────────────────

async function listActiveMembershipsForAuth(userId: string) {
  return prisma.membership.findMany({
    where: { userId, status: 'active' },
    include: { org: true, role: true, permissionOverrides: true },
    orderBy: { joinedAt: 'desc' },
  });
}

function pickAuthMembership<T extends { employeeAccountStatus: string }>(
  memberships: T[],
) {
  const activeMemberships = memberships.filter(
    (membership) => membership.employeeAccountStatus !== 'dismissed',
  );

  if (activeMemberships.length === 0) {
    return null;
  }

  return (
    activeMemberships.find(
      (membership) => membership.employeeAccountStatus === 'pending_first_login',
    ) ?? activeMemberships[0]
  );
}

type MembershipRow = {
  orgId: string | null;
  isOwner: boolean;
  status: string;
  source: string | null;
  joinedAt?: Date | null;
  updatedAt?: Date;
  rolePermissions?: string[];
  permissionOverrides?: PermissionOverride[];
  employeeAccountStatus?: string;
};

type UserRow = {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  status: string;
};

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  mode: string;
  currency: string;
  onboardingCompleted: boolean;
} | null;

function buildSessionResponse(
  user: UserRow,
  tokens: { access: string; refresh: string },
  membership: MembershipRow | null,
  org: OrgRow,
) {
  const isActive = membership?.status === 'active';
  const isOwner = isActive ? (membership!.isOwner ?? false) : false;
  const capabilities = buildCapabilities(
    isOwner,
    isActive,
    membership?.rolePermissions ?? [],
    membership?.permissionOverrides ?? [],
  );

  return {
    access: tokens.access,
    refresh: tokens.refresh,
    user: {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatarUrl,
      status: user.status,
      // New fields consumed by frontend useEmployeePermissions
      is_owner: isOwner,
      employee_permissions: capabilities,
      account_status: membership?.employeeAccountStatus ?? 'active',
    },
    org: org
      ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
          mode: org.mode,
          currency: normalizeOrgCurrency(org.currency),
          onboarding_completed: org.onboardingCompleted,
        }
      : null,
    capabilities,
    membership: {
      companyId: membership?.orgId ?? null,
      companyName: org?.name ?? null,
      companySlug: org?.slug ?? null,
      status: membership?.status ?? 'none',
      source: membership?.source ?? null,
      requestId: null,
      inviteToken: null,
      joinedAt: membership?.joinedAt?.toISOString() ?? null,
      updatedAt:
        membership?.updatedAt?.toISOString() ?? new Date().toISOString(),
    },
  };
}

// ─── login ────────────────────────────────────────────────────────────────────

export async function login(identifier: {
  email?: string;
  phone?: string;
  password: string;
}) {
  // Find user by email OR phone
  let user;
  if (identifier.email) {
    user = await prisma.user.findUnique({
      where: { email: normalizeEmail(identifier.email) },
    });
  } else if (identifier.phone) {
    user = await prisma.user.findUnique({
      where: { phone: identifier.phone },
    });
  }

  if (!user) {
    throw new UnauthorizedError(
      identifier.email
        ? 'Аккаунт с таким email не найден.'
        : 'Аккаунт с таким номером телефона не найден.',
    );
  }

  // Find the active membership for this user
  const memberships = await listActiveMembershipsForAuth(user.id);
  const membership = pickAuthMembership(memberships);

  // Block dismissed employees BEFORE password check (don't leak timing)
  if (
    !membership
    && memberships.some((item) => item.employeeAccountStatus === 'dismissed')
  ) {
    throw new ForbiddenError(
      'Ваш аккаунт деактивирован. Обратитесь к администратору.',
    );
  }

  const valid = await verifyPassword(identifier.password, user.password);
  if (!valid) {
    throw new UnauthorizedError('Неверный пароль. Проверьте раскладку и попробуйте ещё раз.');
  }

  // ── First-login flow: phone+phone ─────────────────────────────────────────
  // Employee enters their phone as both login and password.
  // We detect this: they logged in by phone AND the password IS the phone number.
  if (
    identifier.phone &&
    membership?.employeeAccountStatus === 'pending_first_login'
  ) {
    const tempToken = signFirstLoginToken(user.id);
    return {
      requires_password_setup: true as const,
      temp_token: tempToken,
      user: {
        id: user.id,
        full_name: user.fullName,
        phone: user.phone,
      },
    };
  }

  const tokens = await createTokenPair(user.id, user.email ?? '');
  return buildSessionResponse(
    user,
    tokens,
    membership
      ? {
          orgId: membership.orgId,
          isOwner: membership.isOwner,
          status: membership.status,
          source: membership.source,
          joinedAt: membership.joinedAt,
          updatedAt: membership.updatedAt,
          rolePermissions: membership.role?.permissions ?? [],
          permissionOverrides: membership.permissionOverrides ?? [],
          employeeAccountStatus: membership.employeeAccountStatus,
        }
      : null,
    membership?.org ?? null,
  );
}

// ─── setPassword ──────────────────────────────────────────────────────────────

/**
 * Called on POST /auth/set-password/ with a first-login temp_token in the
 * Authorization header. Sets the employee's real password and marks the
 * account as active.
 */
export async function setPassword(tempToken: string, newPassword: string) {
  let payload;
  try {
    payload = verifyFirstLoginToken(tempToken);
  } catch {
    throw new UnauthorizedError(
      'Недействительный или просроченный токен установки пароля.',
    );
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new NotFoundError('User', payload.sub);

  // Hash new password and activate the account
  const hashedPassword = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, status: 'active' },
    });

    // Update all pending_first_login memberships for this user to active
    await tx.membership.updateMany({
      where: { userId: user.id, employeeAccountStatus: 'pending_first_login' },
      data: { employeeAccountStatus: 'active' },
    });
  });

  // Password set — do NOT auto-login.
  // Employee must re-login with phone + new password.
  return { ok: true, requires_login: true };
}


// ─── registerCompany ─────────────────────────────────────────────────────────

export async function registerCompany(data: {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  company_name: string;
}) {
  const email = normalizeEmail(data.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
  const phone = data.phone?.trim();
  if (phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) throw new ConflictError(DUPLICATE_PHONE_MESSAGE);
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: data.full_name.trim(),
            email,
            password: await hashPassword(data.password),
            phone: phone || null,
            status: 'active',
          },
        });

        const slug = await generateUniqueSlug(data.company_name, tx);
        const org = await tx.organization.create({
          data: { name: data.company_name.trim(), slug, currency: 'KZT' },
        });

        const membership = await tx.membership.create({
          data: {
            userId: user.id,
            orgId: org.id,
            isOwner: true,
            status: 'active',
            source: 'company_registration',
            joinedAt: new Date(),
            employeeAccountStatus: 'active',
          },
        });

        return { user, org, membership };
      });

      const tokens = await createTokenPair(
        result.user.id,
        result.user.email ?? '',
      );
      return buildSessionResponse(
        result.user,
        tokens,
        {
          orgId: result.membership.orgId,
          isOwner: result.membership.isOwner,
          status: result.membership.status,
          source: result.membership.source,
          joinedAt: result.membership.joinedAt,
          updatedAt: result.membership.updatedAt,
          rolePermissions: [],
          permissionOverrides: [],
          employeeAccountStatus: result.membership.employeeAccountStatus,
        },
        result.org,
      );
    } catch (error) {
      if (isUniqueConstraint(error, 'email')) {
        throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
      }
      if (isUniqueConstraint(error, 'phone')) {
        throw new ConflictError(DUPLICATE_PHONE_MESSAGE);
      }
      if (isUniqueConstraint(error, 'slug') && attempt < 3) continue;
      throw error;
    }
  }

  throw new ConflictError('Не удалось создать компанию. Попробуйте ещё раз.');
}

// ─── refreshTokens ────────────────────────────────────────────────────────────

export async function refreshTokens(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Недействительный refresh-токен.');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { id: payload.jti },
  });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new UnauthorizedError('Refresh-токен истёк или был отозван.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new UnauthorizedError('Пользователь не найден.');

  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const tokens = await createTokenPair(user.id, user.email ?? '');
  return { access: tokens.access, refresh: tokens.refresh };
}

// ─── bootstrap ────────────────────────────────────────────────────────────────

export async function bootstrap(userId: string, selectedOrgId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const memberships = await prisma.membership.findMany({
    where: { userId, status: 'active' },
    include: { org: true, role: true, permissionOverrides: true },
    orderBy: { joinedAt: 'desc' },
  });

  let active = memberships[0] ?? null;
  if (selectedOrgId) {
    const found = memberships.find((m) => m.orgId === selectedOrgId);
    if (found) active = found;
  }

  // Block dismissed employees even on bootstrap
  if (active?.employeeAccountStatus === 'dismissed') {
    active = null;
  }

  const isOwner = active ? (active.isOwner ?? false) : false;
  const capabilities = buildCapabilities(
    isOwner,
    active !== null,
    active?.role?.permissions ?? [],
    active?.permissionOverrides ?? [],
  );

  return {
    user: {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatarUrl,
      status: user.status,
      is_owner: isOwner,
      employee_permissions: capabilities,
      account_status: active?.employeeAccountStatus ?? 'active',
    },
    org: active?.org
      ? {
          id: active.org.id,
          name: active.org.name,
          slug: active.org.slug,
          mode: active.org.mode,
          currency: normalizeOrgCurrency(active.org.currency),
          onboarding_completed: active.org.onboardingCompleted,
        }
      : null,
    capabilities,
    membership: {
      companyId: active?.orgId ?? null,
      companyName: active?.org?.name ?? null,
      companySlug: active?.org?.slug ?? null,
      status: active?.status ?? 'none',
      source: active?.source ?? null,
      requestId: null,
      inviteToken: null,
      joinedAt: active?.joinedAt?.toISOString() ?? null,
      updatedAt: active?.updatedAt?.toISOString() ?? null,
    },
    orgs: memberships.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      slug: m.org.slug,
      mode: m.org.mode,
      currency: normalizeOrgCurrency(m.org.currency),
      onboarding_completed: m.org.onboardingCompleted,
      is_owner: m.isOwner,
    })),
  };
}

// ─── acceptInvite ─────────────────────────────────────────────────────────────

export async function acceptInviteAndBuildSession(
  userId: string,
  token: string,
) {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) throw new NotFoundError('Invite');
  if (invite.usedAt) throw new ValidationError('Это приглашение уже было использовано.');
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new ValidationError('Срок действия приглашения истёк.');
  }

  // Resolve the role the invite grants — system role or this org's custom role.
  const inviteRole = invite.role
    ? await prisma.role.findFirst({
        where: { key: invite.role, OR: [{ orgId: null }, { orgId: invite.orgId }] },
      })
    : null;

  let membership: Awaited<ReturnType<typeof prisma.membership.upsert>> & {
    role?: { permissions: string[] } | null;
    permissionOverrides?: PermissionOverride[];
  };

  await prisma.$transaction(async (tx) => {
    await tx.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date(), usedBy: userId },
    });

    membership = await tx.membership.upsert({
      where: { userId_orgId: { userId, orgId: invite.orgId } },
      create: {
        userId,
        orgId: invite.orgId,
        roleId: inviteRole?.id ?? null,
        status: invite.autoApprove ? 'active' : 'pending',
        source: 'invite',
        joinedAt: invite.autoApprove ? new Date() : null,
        employeeAccountStatus: 'active',
      },
      update: {
        status: invite.autoApprove ? 'active' : 'pending',
        source: 'invite',
        joinedAt: invite.autoApprove ? new Date() : undefined,
        roleId: inviteRole?.id ?? undefined,
      },
      include: { role: true, permissionOverrides: true },
    });

    await tx.user.update({
      where: { id: userId },
      data: { status: invite.autoApprove ? 'active' : 'pending' },
    });
  });

  const [user, org] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.organization.findUniqueOrThrow({ where: { id: invite.orgId } }),
  ]);

  const tokens = await createTokenPair(user.id, user.email ?? '');
  return buildSessionResponse(
    user,
    tokens,
    {
      orgId: membership!.orgId,
      isOwner: membership!.isOwner,
      status: membership!.status,
      source: membership!.source,
      joinedAt: membership!.joinedAt,
      updatedAt: membership!.updatedAt,
      rolePermissions: membership!.role?.permissions ?? [],
      permissionOverrides: membership!.permissionOverrides ?? [],
      employeeAccountStatus: membership!.employeeAccountStatus,
    },
    org,
  );
}

// ─── requestPasswordReset ─────────────────────────────────────────────────────

export async function requestPasswordReset(email: string) {
  const normalized = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  // Отвечаем всегда успешно — не раскрываем существование аккаунта
  if (!user || !user.email) return { ok: true };

  // Удаляем старые неиспользованные токены
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const token = nanoid(48);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 час

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  await sendPasswordResetEmail(user.email, token);

  return { ok: true };
}

// ─── confirmPasswordReset ─────────────────────────────────────────────────────

export async function confirmPasswordReset(token: string, newPassword: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record) throw new ValidationError('Ссылка для сброса пароля недействительна или уже была использована.');
  if (record.usedAt) throw new ValidationError('Эта ссылка уже была использована. Запросите новую.');
  if (record.expiresAt < new Date()) throw new ValidationError('Срок действия ссылки истёк. Запросите новую.');

  const hashedPassword = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { password: hashedPassword, status: 'active' },
    });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await tx.refreshToken.deleteMany({ where: { userId: record.userId } });
  });

  return { ok: true };
}

// ── changePassword (self-service for all users) ───────────────────────────────
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError('Пользователь не найден.');

  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) throw new ForbiddenError('Неверный текущий пароль.');

  if (newPassword.length < 6) {
    throw new ValidationError('Новый пароль должен содержать не менее 6 символов.');
  }

  const hashed = await hashPassword(newPassword);
  // Revoke only this user's own refresh tokens — employee sessions are untouched
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { password: hashed } });
    await tx.refreshToken.deleteMany({ where: { userId } });
  });

  return { ok: true, requires_relogin: true };
}

// ── lookupEmployee (pre-auth phone lookup for employee login flow) ─────────────
export async function lookupEmployee(phone: string) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return { found: false as const };

  const memberships = await listActiveMembershipsForAuth(user.id);
  const membership = pickAuthMembership(memberships);

  if (!membership) {
    return { found: false as const };
  }

  if (membership.employeeAccountStatus === 'pending_first_login') {
    const tempToken = signFirstLoginToken(user.id);
    return {
      found: true as const,
      account_status: 'pending_first_login' as const,
      requires_password: false,
      full_name: user.fullName,
      temp_token: tempToken,
    };
  }

  return {
    found: true as const,
    account_status: 'active' as const,
    requires_password: true,
    full_name: user.fullName,
  };
}
