import { readStorage, removeStorage, writeStorage } from '../shared/lib/browser';
import type { AuthSessionResponse } from '../shared/api/contracts';
import { useAuthStore } from '../shared/stores/auth';
import { buildConsoleAuthSession, isConsoleAccessToken } from './devSession';
import type { AuthSnapshot } from './store';

const PASSWORD_RECORD_KEY = 'kort.console:access-record:v2';
const LEGACY_PASSWORD_HASH_KEY = 'kort.console:admin-password-hash:v1';
const PASSWORD_CHANGED_AT_KEY = 'kort.console:admin-password-changed-at:v1';
const ACTIVE_SESSION_KEY = 'kort.console:service-session-active:v1';
const DEFAULT_CONSOLE_PASSWORD = '1234';
const PBKDF2_ITERATIONS = 210_000;
const SERVICE_ACCESS_URL = `${(import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/+$/, '')}/service/access/`;

type Pbkdf2PasswordRecord = {
  version: 'pbkdf2-sha256-v1';
  salt: string;
  iterations: number;
  hash: string;
};

type LegacyPasswordRecord = {
  version: 'legacy-sha256-v1';
  hash: string;
};

type PasswordRecord = Pbkdf2PasswordRecord | LegacyPasswordRecord;

function fallbackHash(secret: string) {
  let hash = 2166136261;

  for (let index = 0; index < secret.length; index += 1) {
    hash ^= secret.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a:${(hash >>> 0).toString(16)}`;
}

function encodeBytes(bytes: Uint8Array) {
  if (typeof btoa === 'function') {
    let binary = '';
    bytes.forEach((value) => {
      binary += String.fromCharCode(value);
    });
    return btoa(binary);
  }

  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function decodeBytes(value: string) {
  if (typeof atob === 'function') {
    const binary = atob(value);
    return new Uint8Array(Array.from(binary, (char) => char.charCodeAt(0)));
  }

  const bytes = value.match(/.{1,2}/g)?.map((chunk) => Number.parseInt(chunk, 16)) ?? [];
  return new Uint8Array(bytes);
}

function readPasswordRecord(): PasswordRecord | null {
  const raw = readStorage(PASSWORD_RECORD_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PasswordRecord;
      if (parsed?.version === 'pbkdf2-sha256-v1') {
        return parsed;
      }
    } catch {
      // ignore malformed records and continue with migration/default
    }
  }

  const legacyHash = readStorage(LEGACY_PASSWORD_HASH_KEY);
  if (legacyHash) {
    return {
      version: 'legacy-sha256-v1',
      hash: legacyHash,
    };
  }

  return null;
}

async function hashLegacySecret(secret: string) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    return fallbackHash(secret);
  }

  const encoded = new TextEncoder().encode(secret);
  const digest = await cryptoApi.subtle.digest('SHA-256', encoded);

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function derivePasswordHash(secret: string, salt: string, iterations: number) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    return fallbackHash(`${salt}:${iterations}:${secret}`);
  }

  const baseKey = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await cryptoApi.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: decodeBytes(salt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    256,
  );

  return Array.from(new Uint8Array(bits))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function createSalt() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    return fallbackHash(`${Date.now()}:${Math.random()}`);
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  return encodeBytes(bytes);
}

async function createPasswordRecord(secret: string): Promise<Pbkdf2PasswordRecord> {
  const salt = createSalt();
  const hash = await derivePasswordHash(secret, salt, PBKDF2_ITERATIONS);

  return {
    version: 'pbkdf2-sha256-v1',
    salt,
    iterations: PBKDF2_ITERATIONS,
    hash,
  };
}

function writePasswordRecord(record: Pbkdf2PasswordRecord) {
  writeStorage(PASSWORD_RECORD_KEY, JSON.stringify(record));
  removeStorage(LEGACY_PASSWORD_HASH_KEY);
}

async function ensurePasswordRecord() {
  const existing = readPasswordRecord();
  if (existing) {
    return existing;
  }

  const record = await createPasswordRecord(DEFAULT_CONSOLE_PASSWORD);
  writePasswordRecord(record);
  return record;
}

export function canUseLocalConsoleAccess() {
  return import.meta.env.DEV;
}

// ── Backend service session ────────────────────────────────────────────────

export type ServiceAccessResult =
  | { type: 'ok'; session: AuthSessionResponse }
  | { type: 'denied' }
  | { type: 'offline' };

export async function requestBackendServiceSession(password: string): Promise<ServiceAccessResult> {
  try {
    const response = await fetch(SERVICE_ACCESS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      const session = await response.json() as AuthSessionResponse;
      return { type: 'ok', session };
    }

    // 401 or other error = wrong password or backend disabled
    return { type: 'denied' };
  } catch {
    // Network error = backend offline
    return { type: 'offline' };
  }
}

export function activateConsoleAccessFromResponse(session: AuthSessionResponse) {
  const state = useAuthStore.getState();

  state.setAuth(
    session.user,
    session.org,
    session.access,
    session.refresh,
    session.capabilities,
    session.role,
    {
      membership: session.membership,
      inviteContext: null,
    },
  );
  state.unlock();
  markConsoleSessionActive(true);
}

export async function verifyConsolePassword(secret: string) {
  const record = await ensurePasswordRecord();

  if (record.version === 'legacy-sha256-v1') {
    const accepted = (await hashLegacySecret(secret)) === record.hash;
    if (accepted) {
      const migrated = await createPasswordRecord(secret);
      writePasswordRecord(migrated);
    }
    return accepted;
  }

  const incoming = await derivePasswordHash(secret, record.salt, record.iterations);
  return incoming === record.hash;
}

export async function updateConsolePassword(secret: string) {
  const record = await createPasswordRecord(secret);
  writePasswordRecord(record);
  writeStorage(PASSWORD_CHANGED_AT_KEY, new Date().toISOString());
}

export function getConsolePasswordChangedAt() {
  return readStorage(PASSWORD_CHANGED_AT_KEY);
}

export function markConsoleSessionActive(active: boolean) {
  if (active) {
    writeStorage(ACTIVE_SESSION_KEY, '1');
    return;
  }

  removeStorage(ACTIVE_SESSION_KEY);
}

export function hasPersistedConsoleSession() {
  return readStorage(ACTIVE_SESSION_KEY) === '1';
}

export function captureAuthSnapshot(): AuthSnapshot {
  const state = useAuthStore.getState();

  return structuredClone({
    user: state.user,
    org: state.org,
    token: state.token,
    refreshToken: state.refreshToken,
    role: state.role,
    capabilities: state.capabilities,
    membership: state.membership,
    inviteContext: state.inviteContext,
    isUnlocked: state.isUnlocked,
  });
}

export function restoreAuthSnapshot(snapshot: AuthSnapshot | null) {
  const state = useAuthStore.getState();

  if (!snapshot?.user || !snapshot.token || !snapshot.refreshToken) {
    state.clearAuth();
    return;
  }

  state.setAuth(
    snapshot.user,
    snapshot.org,
    snapshot.token,
    snapshot.refreshToken,
    snapshot.capabilities,
    snapshot.role,
    {
      membership: snapshot.membership,
      inviteContext: snapshot.inviteContext,
    },
  );

  if (snapshot.isUnlocked) {
    state.unlock();
  } else {
    state.lock();
  }
}

export function activateConsoleAccess() {
  const state = useAuthStore.getState();
  const session = buildConsoleAuthSession();

  state.setAuth(
    session.user,
    session.org,
    session.access,
    session.refresh,
    session.capabilities,
    session.role,
    {
      membership: session.membership,
      inviteContext: null,
    },
  );
  state.unlock();
  markConsoleSessionActive(true);

  return session;
}

export function deactivateConsoleAccess(snapshot: AuthSnapshot | null) {
  const state = useAuthStore.getState();

  if (snapshot) {
    restoreAuthSnapshot(snapshot);
  } else if (isConsoleAccessToken(state.token)) {
    state.clearAuth();
  } else {
    state.lock();
  }

  markConsoleSessionActive(false);
}
