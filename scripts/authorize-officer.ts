/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Authorized Emergency Officer Provisioning Script for FloodSense
 * ---------------------------------------------------------------------------
 * Provisions an authorized Emergency Officer account by:
 *   1. Setting the signed Firebase Auth custom claim `{ role: 'officer' }`
 *   2. Upserting `/officers/{uid}` in Cloud Firestore
 *   3. Updating `/users/{uid}` with `role: 'officer'` (with strictly two app roles: citizen & officer)
 *
 * Security Principle:
 *   Emergency Officer accounts are NEVER created automatically via client sign-up
 *   or hardcoded plaintext credentials. They must be explicitly provisioned
 *   server-side by running this script with Firebase Admin credentials.
 *
 * Usage:
 *   npx tsx scripts/authorize-officer.ts --email officer@cmc.lk [--name "Officer Name"] [--badge "CMC-EOC-01"] [--department "CMC Drainage Division"]
 *   npx tsx scripts/authorize-officer.ts --uid <firebase-uid> [--name "Officer Name"]
 *   npx tsx scripts/authorize-officer.ts --revoke --email officer@cmc.lk
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth, type Auth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  buildOfficerAuthorizationWrites,
  buildRevokeOfficerWrites,
  parseAuthorizeOfficerArgs,
} from './officerBootstrapCore.ts';

function printUsageAndExit(code = 1): never {
  console.log(`
FloodSense Emergency Officer Authorization CLI
==============================================
Usage:
  npx tsx scripts/authorize-officer.ts --email <user-email> [options]
  npx tsx scripts/authorize-officer.ts --uid <firebase-uid> [options]

Options:
  --email <email>         Look up Firebase Auth user by email
  --uid <uid>             Look up Firebase Auth user by UID
  --name <full name>      Display name to record on the officer profile
  --badge <badge code>    Official badge number (e.g., CMC-EOC-01)
  --department <dept>     Department name (default: "Colombo Municipal Disaster Operations Center")
  --sector <sector>       Assigned operating sector (default: "Colombo Central Basin")
  --revoke                Revoke officer privileges and downgrade user back to citizen
  --create-password <pw>  Create the Firebase Auth user with this password if email does not yet exist
  --help                  Show this help message

Prerequisites:
  Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS in .env / environment.
`);
  process.exit(code);
}

function resolveProjectAndDatabase(): {
  projectId: string;
  databaseId?: string;
} {
  let configProjectId: string | undefined;
  let configDatabaseId: string | undefined;
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      configProjectId = parsed?.projectId;
      configDatabaseId = parsed?.firestoreDatabaseId;
    } catch {
      // Ignore invalid config file
    }
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    configProjectId ||
    'floodsense-72e55';

  const envDbId = process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID;
  const rawDbId =
    envDbId || (configProjectId === projectId ? configDatabaseId : undefined);
  const databaseId = rawDbId && rawDbId !== '(default)' ? rawDbId : undefined;

  return { projectId, databaseId };
}

function initializeFirebaseAdmin(): {
  db: Firestore;
  auth: Auth;
  projectId: string;
} {
  const { projectId, databaseId } = resolveProjectAndDatabase();

  if (getApps().length === 0) {
    const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (rawSa && rawSa.trim().startsWith('{')) {
      const sa = JSON.parse(rawSa);
      initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || projectId,
      });
    } else if (gacPath && fs.existsSync(gacPath)) {
      const sa = JSON.parse(fs.readFileSync(gacPath, 'utf-8'));
      initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || projectId,
      });
    } else {
      initializeApp({
        credential: applicationDefault(),
        projectId,
      });
    }
  }

  const app = getApp();
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  const auth = getAuth(app);

  return { db, auth, projectId };
}

async function main() {
  const parsed = parseAuthorizeOfficerArgs(process.argv.slice(2));
  if (parsed.help || (!parsed.email && !parsed.uid)) {
    printUsageAndExit(parsed.help ? 0 : 1);
  }

  const { db, auth, projectId } = initializeFirebaseAdmin();
  console.log(`[FloodSense] Connected Firebase Admin SDK to project: ${projectId}`);

  let userRecord: UserRecord;
  try {
    if (parsed.uid) {
      userRecord = await auth.getUser(parsed.uid);
    } else if (parsed.email) {
      try {
        userRecord = await auth.getUserByEmail(parsed.email);
      } catch (lookupErr: any) {
        if (lookupErr?.code === 'auth/user-not-found' && parsed.createPassword && !parsed.revoke) {
          userRecord = await auth.createUser({
            email: parsed.email,
            password: parsed.createPassword,
            displayName: parsed.name || parsed.email.split('@')[0],
            emailVerified: true,
          });
          console.log(`[FloodSense] Created Firebase Auth user ${userRecord.email} (${userRecord.uid})`);
        } else {
          throw lookupErr;
        }
      }
    } else {
      throw new Error('Either --email or --uid is required.');
    }
  } catch (err: any) {
    console.error(`[FloodSense ERROR] Could not locate Firebase Auth user:`, err?.message || err);
    process.exit(1);
  }

  const existingClaims = (userRecord.customClaims || {}) as Record<string, unknown>;

  if (parsed.revoke) {
    const revPlan = buildRevokeOfficerWrites({
      uid: userRecord.uid,
      existingClaims,
    });
    await auth.setCustomUserClaims(userRecord.uid, revPlan.customClaims);
    await auth.revokeRefreshTokens(userRecord.uid);
    await db.collection('officers').doc(userRecord.uid).delete();
    await db
      .collection('users')
      .doc(userRecord.uid)
      .set(
        {
          uid: userRecord.uid,
          email: userRecord.email || parsed.email || '',
          role: 'citizen',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    console.log(
      `[FloodSense SUCCESS] Revoked officer privileges for ${userRecord.email || userRecord.uid} (${userRecord.uid}). Downgraded to 'citizen'.`
    );
    return;
  }

  const writePlan = buildOfficerAuthorizationWrites({
    uid: userRecord.uid,
    email: userRecord.email || parsed.email || '',
    displayName: userRecord.displayName || undefined,
    existingClaims,
    name: parsed.name,
    badgeNumber: parsed.badge,
    department: parsed.department,
    sector: parsed.sector,
  });

  await auth.setCustomUserClaims(userRecord.uid, writePlan.customClaims);
  await db.collection('officers').doc(userRecord.uid).set(writePlan.officerDoc, { merge: true });
  await db.collection('users').doc(userRecord.uid).set(writePlan.userDoc, { merge: true });

  console.log(`
[FloodSense SUCCESS] Emergency Officer Authorized!
--------------------------------------------------
  UID        : ${userRecord.uid}
  Email      : ${writePlan.officerDoc.email}
  Name       : ${writePlan.officerDoc.name}
  Badge      : ${writePlan.officerDoc.badgeNumber}
  Department : ${writePlan.officerDoc.department}
  CustomClaim: role = "officer"
  Firestore  : /officers/${userRecord.uid} and /users/${userRecord.uid} updated

Note: If this user is currently signed into the browser, have them sign out and sign back in to refresh their Firebase ID token claims.
`);
}

main().catch((err) => {
  console.error('[FloodSense FATAL]', err);
  process.exit(1);
});
