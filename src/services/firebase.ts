/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  collection,
  getDocs,
  limit,
  query,
  Firestore,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import type { Analytics } from 'firebase/analytics';

/**
 * FloodSense Firebase Client Initialization (Spark-Plan Architecture)
 * - Reads Web SDK configuration strictly from VITE_FIREBASE_* environment variables (.env).
 * - Targets project `floodsense-72e55` (`floodsense-72e55.firebaseapp.com`) by default.
 * - Initializes Cloud Firestore and Firebase Auth on a single FirebaseApp.
 * - Does NOT initialize or depend on Firebase Cloud Storage (report evidence is stored compressed in Firestore).
 * - Keeps Firebase Analytics lazy and strictly guarded for browser environments.
 */

const cleanEnv = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return trimmed;
};

const hasViteEnv = typeof import.meta !== 'undefined' && Boolean((import.meta as any).env);

const envApiKey = cleanEnv(hasViteEnv ? import.meta.env.VITE_FIREBASE_API_KEY : process.env?.VITE_FIREBASE_API_KEY);
const envAuthDomain = cleanEnv(hasViteEnv ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN : process.env?.VITE_FIREBASE_AUTH_DOMAIN);
const envProjectId = cleanEnv(hasViteEnv ? import.meta.env.VITE_FIREBASE_PROJECT_ID : process.env?.VITE_FIREBASE_PROJECT_ID);
const envMessagingSenderId = cleanEnv(hasViteEnv ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID : process.env?.VITE_FIREBASE_MESSAGING_SENDER_ID);
const envAppId = cleanEnv(hasViteEnv ? import.meta.env.VITE_FIREBASE_APP_ID : process.env?.VITE_FIREBASE_APP_ID);
const envMeasurementId = cleanEnv(hasViteEnv ? import.meta.env.VITE_FIREBASE_MEASUREMENT_ID : process.env?.VITE_FIREBASE_MEASUREMENT_ID);
const envDatabaseId = cleanEnv(hasViteEnv ? import.meta.env.VITE_FIREBASE_DATABASE_ID : process.env?.VITE_FIREBASE_DATABASE_ID);

const resolvedProjectId = envProjectId || 'floodsense-72e55';
const resolvedAuthDomain = envAuthDomain || `${resolvedProjectId}.firebaseapp.com`;

export const activeFirebaseProjectId = resolvedProjectId;
export const activeFirestoreDatabaseId =
  envDatabaseId && envDatabaseId !== '(default)' ? envDatabaseId : undefined;

const missingConfigKeys: string[] = [];
if (!envApiKey) missingConfigKeys.push('VITE_FIREBASE_API_KEY');
if (!envProjectId) missingConfigKeys.push('VITE_FIREBASE_PROJECT_ID');
if (!envAppId) missingConfigKeys.push('VITE_FIREBASE_APP_ID');

const placeholderPattern = /your-firebase-|replace-with|example/i;
const hasPlaceholderValues = Boolean(
  (envApiKey && placeholderPattern.test(envApiKey)) ||
    (envAppId && placeholderPattern.test(envAppId)) ||
    (envMessagingSenderId && placeholderPattern.test(envMessagingSenderId))
);

export const missingFirebaseConfigKeys = missingConfigKeys;

export const isFirebaseConfigured = Boolean(
  envApiKey &&
    resolvedProjectId &&
    envAppId &&
    !hasPlaceholderValues
);

export const firebaseConfigError: string | null = !isFirebaseConfigured
  ? hasPlaceholderValues
    ? 'Firebase client configuration contains template placeholder values. Update `.env` with your floodsense-72e55 Firebase Web App credentials.'
    : `Incomplete Firebase client configuration in .env. Missing: ${missingConfigKeys.join(', ')}.`
  : null;

const firebaseConfig = {
  apiKey: envApiKey,
  authDomain: resolvedAuthDomain,
  projectId: resolvedProjectId,
  ...(envMessagingSenderId ? { messagingSenderId: envMessagingSenderId } : {}),
  appId: envAppId,
  ...(envMeasurementId ? { measurementId: envMeasurementId } : {}),
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let analyticsInstance: Analytics | null = null;
let firebaseInitError: string | null = firebaseConfigError;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    try {
      db = activeFirestoreDatabaseId
        ? initializeFirestore(app, {}, activeFirestoreDatabaseId)
        : getFirestore(app);
    } catch {
      db = activeFirestoreDatabaseId ? getFirestore(app, activeFirestoreDatabaseId) : getFirestore(app);
    }
    auth = getAuth(app);
  } catch (err: any) {
    firebaseInitError = err?.message || 'Failed to initialize Firebase Web SDK.';
    console.error('[FloodSense Firebase] Initialization error:', err);
  }
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { app, db, auth, firebaseInitError };

/**
 * Initializes Firebase Analytics strictly in supported browser environments.
 */
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined' || !app || !envMeasurementId) {
    return null;
  }
  if (analyticsInstance) {
    return analyticsInstance;
  }
  try {
    const { isSupported, getAnalytics } = await import('firebase/analytics');
    if (await isSupported()) {
      analyticsInstance = getAnalytics(app);
      return analyticsInstance;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Probes Cloud Firestore connectivity safely without crashing when unconfigured.
 */
export async function testFirestoreConnection(): Promise<boolean> {
  if (!isFirebaseConfigured || !db) {
    return false;
  }
  try {
    await getDocs(query(collection(db, 'public_reports'), limit(1)));
    return true;
  } catch {
    return false;
  }
}
