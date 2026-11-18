/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

export const MIN_BOOTSTRAP_SECRET_LENGTH = 16;

export const FORBIDDEN_PROFILE_ELEVATION_KEYS = new Set([
  'role',
  'isOfficer',
  'officer',
  'admin',
  'isAdmin',
  'claims',
  'customClaims',
  'permissions',
  'roleName',
  'uid',
  'email',
]);

export function verifyBootstrapSecretMatch(
  configuredSecret: string | undefined | null,
  providedSecret: string | undefined | null
): { valid: boolean; reason?: string } {
  const expected = typeof configuredSecret === 'string' ? configuredSecret.trim() : '';
  const provided = typeof providedSecret === 'string' ? providedSecret.trim() : '';

  if (expected.length < MIN_BOOTSTRAP_SECRET_LENGTH) {
    return {
      valid: false,
      reason: `OFFICER_BOOTSTRAP_SECRET must be set in environment variables with at least ${MIN_BOOTSTRAP_SECRET_LENGTH} characters.`,
    };
  }
  if (!provided) {
    return { valid: false, reason: 'Provided bootstrap secret is empty.' };
  }

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return { valid: false, reason: 'Invalid OFFICER_BOOTSTRAP_SECRET.' };
  }

  return { valid: true };
}

export function detectProfileElevationAttempt(payload: Record<string, any> | null | undefined): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }
  const flagged: string[] = [];
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_PROFILE_ELEVATION_KEYS.has(key) && payload[key] !== undefined) {
      flagged.push(key);
    }
  }
  return flagged;
}

export function sanitizeEditableProfileUpdates(payload: Record<string, any>): {
  displayName?: string;
  name?: string;
  phone?: string;
  department?: string;
  emergencySector?: string;
  avatarUrl?: string;
} {
  const clean: Record<string, string> = {};
  if (typeof payload.name === 'string' && payload.name.trim()) {
    const trimmed = payload.name.trim().slice(0, 120);
    clean.name = trimmed;
    clean.displayName = trimmed;
  } else if (typeof payload.displayName === 'string' && payload.displayName.trim()) {
    const trimmed = payload.displayName.trim().slice(0, 120);
    clean.name = trimmed;
    clean.displayName = trimmed;
  }
  if (typeof payload.phone === 'string') {
    clean.phone = payload.phone.trim().slice(0, 40);
  }
  if (typeof payload.department === 'string') {
    clean.department = payload.department.trim().slice(0, 120);
  }
  if (typeof payload.emergencySector === 'string') {
    clean.emergencySector = payload.emergencySector.trim().slice(0, 120);
  }
  if (typeof payload.avatarUrl === 'string' && payload.avatarUrl.trim()) {
    clean.avatarUrl = payload.avatarUrl.trim().slice(0, 500);
  }
  return clean;
}

export interface BootstrapUserRecord {
  uid: string;
  email?: string;
  displayName?: string;
  customClaims?: Record<string, any>;
}

export interface BootstrapAdapter {
  configuredSecret: string | undefined;
  providedSecret?: string | undefined;
  targetEmail?: string;
  targetUid?: string;
  targetPassword?: string;
  targetName?: string;
  department?: string;
  sector?: string;
  createIfMissing?: boolean;
  getUserByUid: (uid: string) => Promise<BootstrapUserRecord>;
  getUserByEmail: (email: string) => Promise<BootstrapUserRecord>;
  createUser?: (params: {
    email: string;
    password: string;
    displayName: string;
    emailVerified: boolean;
  }) => Promise<BootstrapUserRecord>;
  hasAnyExistingOfficerClaim: () => Promise<boolean>;
  hasAnyExistingOfficerDoc: () => Promise<boolean>;
  setCustomUserClaims: (uid: string, claims: Record<string, any>) => Promise<void>;
  writeOfficerRecord: (uid: string, data: Record<string, any>) => Promise<unknown>;
  writeUserProfileRecord: (uid: string, data: Record<string, any>) => Promise<unknown>;
}

export async function executeFirstOfficerBootstrap(adapter: BootstrapAdapter): Promise<{
  ok: boolean;
  status: number;
  uid?: string;
  email?: string;
  error?: string;
}> {
  const secretCheck = verifyBootstrapSecretMatch(
    adapter.configuredSecret,
    adapter.providedSecret ?? adapter.configuredSecret
  );
  if (!secretCheck.valid) {
    return { ok: false, status: 403, error: secretCheck.reason };
  }

  if (!adapter.targetUid && !adapter.targetEmail) {
    return { ok: false, status: 400, error: 'Provide a target email or UID for the first Emergency Officer.' };
  }

  const [hasDoc, hasClaim] = await Promise.all([
    adapter.hasAnyExistingOfficerDoc(),
    adapter.hasAnyExistingOfficerClaim(),
  ]);
  if (hasDoc || hasClaim) {
    return {
      ok: false,
      status: 409,
      error:
        'An Emergency Officer account already exists. First-officer bootstrap is permanently locked to prevent unauthorized elevation.',
    };
  }

  let userRecord: BootstrapUserRecord | null = null;
  try {
    if (adapter.targetUid) {
      userRecord = await adapter.getUserByUid(adapter.targetUid);
    } else if (adapter.targetEmail) {
      userRecord = await adapter.getUserByEmail(adapter.targetEmail.trim());
    }
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found' && adapter.createIfMissing && adapter.targetEmail && adapter.createUser) {
      if (!adapter.targetPassword || adapter.targetPassword.length < 8) {
        return {
          ok: false,
          status: 400,
          error: 'Creating the first officer account requires a password of at least 8 characters.',
        };
      }
      userRecord = await adapter.createUser({
        email: adapter.targetEmail.trim(),
        password: adapter.targetPassword,
        displayName: adapter.targetName?.trim() || 'Emergency Management Officer',
        emailVerified: true,
      });
    } else {
      return {
        ok: false,
        status: 404,
        error: `Unable to locate target Firebase Auth user: ${err?.message || err}`,
      };
    }
  }

  if (!userRecord) {
    return { ok: false, status: 404, error: 'Target Firebase Auth user not found.' };
  }

  const updatedClaims = {
    ...(userRecord.customClaims || {}),
    role: 'officer',
    officer: true,
  };
  await adapter.setCustomUserClaims(userRecord.uid, updatedClaims);

  const displayName = adapter.targetName?.trim() || userRecord.displayName || 'Emergency Management Officer';
  const nowIso = new Date().toISOString();

  await adapter.writeOfficerRecord(userRecord.uid, {
    uid: userRecord.uid,
    email: userRecord.email || adapter.targetEmail || '',
    displayName,
    role: 'officer',
    active: true,
    department: adapter.department || 'Colombo Municipal Flood Operations',
    emergencySector: adapter.sector || 'Sector 04 — Colombo Municipal Basin',
    authorizedAt: nowIso,
    authorizedMethod: 'bootstrap_secret_cli',
  });

  await adapter.writeUserProfileRecord(userRecord.uid, {
    uid: userRecord.uid,
    email: userRecord.email || adapter.targetEmail || '',
    displayName,
    name: displayName,
    role: 'officer',
    isOfficer: true,
    department: adapter.department || 'Colombo Municipal Flood Operations',
    emergencySector: adapter.sector || 'Sector 04 — Colombo Municipal Basin',
  });

  return {
    ok: true,
    status: 200,
    uid: userRecord.uid,
    email: userRecord.email || adapter.targetEmail || '',
  };
}

export interface ParsedAuthorizeOfficerArgs {
  email?: string;
  uid?: string;
  name?: string;
  badge?: string;
  department?: string;
  sector?: string;
  revoke: boolean;
  createPassword?: string;
  help: boolean;
}

export function parseAuthorizeOfficerArgs(argv: string[]): ParsedAuthorizeOfficerArgs {
  const result: ParsedAuthorizeOfficerArgs = {
    revoke: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--revoke') {
      result.revoke = true;
    } else if (arg === '--email' && i + 1 < argv.length) {
      result.email = argv[++i];
    } else if (arg === '--uid' && i + 1 < argv.length) {
      result.uid = argv[++i];
    } else if (arg === '--name' && i + 1 < argv.length) {
      result.name = argv[++i];
    } else if (arg === '--badge' && i + 1 < argv.length) {
      result.badge = argv[++i];
    } else if (arg === '--department' && i + 1 < argv.length) {
      result.department = argv[++i];
    } else if (arg === '--sector' && i + 1 < argv.length) {
      result.sector = argv[++i];
    } else if (arg === '--create-password' && i + 1 < argv.length) {
      result.createPassword = argv[++i];
    }
  }

  return result;
}

export function buildOfficerAuthorizationWrites(params: {
  uid: string;
  email: string;
  displayName?: string;
  existingClaims?: Record<string, unknown>;
  name?: string;
  badgeNumber?: string;
  department?: string;
  sector?: string;
}) {
  const nowIso = new Date().toISOString();
  const resolvedName =
    params.name?.trim() ||
    params.displayName?.trim() ||
    params.email.split('@')[0] ||
    'Emergency Management Officer';
  const resolvedBadge = params.badgeNumber?.trim() || `EOC-${params.uid.slice(0, 6).toUpperCase()}`;
  const resolvedDept =
    params.department?.trim() || 'Colombo Municipal Disaster Operations Center';
  const resolvedSector = params.sector?.trim() || 'Colombo Central Basin';

  const safeExistingClaims: Record<string, unknown> = { ...(params.existingClaims || {}) };
  delete safeExistingClaims.admin;
  delete safeExistingClaims.isAdmin;

  const customClaims = {
    ...safeExistingClaims,
    role: 'officer',
    officer: true,
  };

  const officerDoc = {
    uid: params.uid,
    email: params.email,
    name: resolvedName,
    displayName: resolvedName,
    badgeNumber: resolvedBadge,
    department: resolvedDept,
    emergencySector: resolvedSector,
    role: 'officer' as const,
    active: true,
    authorizedAt: nowIso,
    updatedAt: nowIso,
    authorizedMethod: 'cli_admin_sdk',
  };

  const userDoc = {
    uid: params.uid,
    email: params.email,
    name: resolvedName,
    displayName: resolvedName,
    role: 'officer' as const,
    isOfficer: true,
    department: resolvedDept,
    emergencySector: resolvedSector,
    updatedAt: nowIso,
  };

  return { customClaims, officerDoc, userDoc };
}

export function buildRevokeOfficerWrites(params: {
  uid: string;
  existingClaims?: Record<string, unknown>;
}) {
  const safeExistingClaims: Record<string, unknown> = { ...(params.existingClaims || {}) };
  delete safeExistingClaims.admin;
  delete safeExistingClaims.isAdmin;

  return {
    customClaims: {
      ...safeExistingClaims,
      role: 'citizen',
      officer: false,
    },
  };
}

