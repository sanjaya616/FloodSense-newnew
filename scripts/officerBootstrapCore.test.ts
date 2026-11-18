/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyBootstrapSecretMatch,
  detectProfileElevationAttempt,
  sanitizeEditableProfileUpdates,
  executeFirstOfficerBootstrap,
} from './officerBootstrapCore.ts';

test('verifyBootstrapSecretMatch enforces >= 16-char OFFICER_BOOTSTRAP_SECRET and rejects mismatches', () => {
  assert.equal(verifyBootstrapSecretMatch(undefined, 'ColomboSecret#2026').valid, false);
  assert.equal(verifyBootstrapSecretMatch('too-short', 'too-short').valid, false);
  assert.equal(verifyBootstrapSecretMatch('ColomboEOCSecret#2026', 'wrong-secret-value-1').valid, false);
  assert.equal(verifyBootstrapSecretMatch('ColomboEOCSecret#2026', 'ColomboEOCSecret#2026').valid, true);
});

test('executeFirstOfficerBootstrap assigns officer custom claim only to the very first responder account', async () => {
  const officers: Record<string, any> = {};
  const users: Record<string, any> = {};
  const claimsByUid: Record<string, any> = {};
  let hasOfficerClaimFlag = false;

  const baseAdapter = {
    configuredSecret: 'ColomboEOCSecret#2026',
    providedSecret: 'ColomboEOCSecret#2026',
    targetEmail: 'commander@dmc.gov.lk',
    targetPassword: 'StrongPassword#2026',
    targetName: 'Commander Silva',
    createIfMissing: true,
    getUserByUid: async (uid: string) => ({ uid, email: 'commander@dmc.gov.lk' }),
    getUserByEmail: async () => {
      const err: any = new Error('Not found');
      err.code = 'auth/user-not-found';
      throw err;
    },
    createUser: async ({ email, displayName }: { email: string; displayName: string }) => ({
      uid: 'first-officer-uid',
      email,
      displayName,
      customClaims: {},
    }),
    hasAnyExistingOfficerClaim: async () => hasOfficerClaimFlag,
    hasAnyExistingOfficerDoc: async () => Object.keys(officers).length > 0,
    setCustomUserClaims: async (uid: string, claims: Record<string, any>) => {
      claimsByUid[uid] = claims;
      if (claims.role === 'officer') hasOfficerClaimFlag = true;
    },
    writeOfficerRecord: async (uid: string, data: Record<string, any>) => {
      officers[uid] = data;
    },
    writeUserProfileRecord: async (uid: string, data: Record<string, any>) => {
      users[uid] = data;
    },
  };

  // First responder succeeds and gets { role: 'officer', officer: true }
  const firstRes = await executeFirstOfficerBootstrap(baseAdapter);
  assert.equal(firstRes.ok, true);
  assert.equal(firstRes.status, 200);
  assert.deepEqual(claimsByUid['first-officer-uid'], { role: 'officer', officer: true });
  assert.equal(officers['first-officer-uid']?.active, true);

  // Second attempt fails with 409 Conflict (even with valid secret)
  const secondRes = await executeFirstOfficerBootstrap({
    ...baseAdapter,
    targetEmail: 'citizen2@gmail.com',
  });
  assert.equal(secondRes.ok, false);
  assert.equal(secondRes.status, 409);

  // Also blocks if Firestore /officers was manually cleared but another user retains officer custom claim
  delete officers['first-officer-uid'];
  const claimLockRes = await executeFirstOfficerBootstrap({
    ...baseAdapter,
    targetEmail: 'citizen3@gmail.com',
  });
  assert.equal(claimLockRes.ok, false);
  assert.equal(claimLockRes.status, 409);
});

test('detectProfileElevationAttempt and sanitizeEditableProfileUpdates block privilege fields cleanly', () => {
  assert.deepEqual(
    detectProfileElevationAttempt({ name: 'Nimal', phone: '+94771234567', emergencySector: 'Sector 01' }),
    []
  );
  assert.deepEqual(
    detectProfileElevationAttempt({ name: 'Attacker', role: 'officer', isOfficer: true, customClaims: { officer: true } }),
    ['role', 'isOfficer', 'customClaims']
  );

  const sanitized = sanitizeEditableProfileUpdates({
    name: '  Amali Perera  ',
    phone: '+94 77 222 3333',
    role: 'officer',
    isOfficer: true,
    uid: 'spoofed-uid',
  });
  assert.deepEqual(sanitized, {
    name: 'Amali Perera',
    displayName: 'Amali Perera',
    phone: '+94 77 222 3333',
  });
  assert.equal((sanitized as any).role, undefined);
  assert.equal((sanitized as any).uid, undefined);
});
