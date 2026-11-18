/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { floodService } from './floodService';

test('firestore.indexes.json declares composite indexes for citizen-scoped queries', () => {
  const indexPath = path.resolve(process.cwd(), 'firestore.indexes.json');
  const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  assert.ok(Array.isArray(raw.indexes), 'Expected indexes array in firestore.indexes.json');

  const hasIndex = (group: string, f1: string, f2: string) =>
    raw.indexes.some(
      (idx: any) =>
        idx.collectionGroup === group &&
        Array.isArray(idx.fields) &&
        idx.fields.length >= 2 &&
        idx.fields[0].fieldPath === f1 &&
        idx.fields[0].order === 'ASCENDING' &&
        idx.fields[1].fieldPath === f2 &&
        idx.fields[1].order === 'DESCENDING'
    );

  assert.equal(hasIndex('reports', 'reporterId', 'timestamp'), true, 'Missing reports(reporterId, timestamp) index');
  assert.equal(
    hasIndex('notifications', 'recipientUid', 'createdAt'),
    true,
    'Missing notifications(recipientUid, createdAt) index'
  );
  assert.equal(
    hasIndex('status_history', 'citizenUid', 'timestamp'),
    true,
    'Missing status_history(citizenUid, timestamp) index'
  );
});

test('firestore.rules enforces privilege boundaries, PENDING sync on create, and zero PII on public_reports', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  // Authoritative officer check relies on custom claims or /officers/{uid}, NOT /users/{uid}
  assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/officers\/\$\(request\.auth\.uid\)\)/);
  assert.match(rules, /match \/officers\/\{officerId\}[\s\S]*allow write: if false;/);

  // /users/{userId} prevents citizen self-escalation on create and update
  assert.match(rules, /!?\('role' in incoming\(\)\) \|\| incoming\(\)\.role == 'citizen'/);
  assert.match(rules, /!?\('role' in incoming\(\)\) \|\| incoming\(\)\.role == existing\(\)\.role/);
  assert.match(rules, /!incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasAny\(/);
  assert.match(rules, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(/);

  // Citizen /reports create enforces publicSyncStatus == 'PENDING' if supplied
  assert.match(rules, /incoming\(\)\.publicSyncStatus == 'PENDING'/);

  // Reports disallow inline base64Data / legacy imageUrl / storagePath
  assert.ok(rules.includes("!('base64Data' in data)"));
  assert.ok(rules.includes("!('imageUrl' in data)"));
  assert.ok(rules.includes("!('storagePath' in data)"));

  // Private evidence subcollection allows owner/officer read and enforces < 850 KiB compressed payload
  assert.match(rules, /match \/evidence\/\{evidenceId\}/);
  assert.ok(rules.includes('incoming().byteSize <= 870400'));
  assert.ok(rules.includes('incoming().base64Data.size() <= 750000'));
  assert.ok(rules.includes('incoming().width <= 1280'));

  // /public_reports excludes PII & evidence image fields
  for (const piiField of ['reporterName', 'reporterPhone', 'reporterEmail', 'reporterId', 'officerNotes', 'imageUrl', 'base64Data', 'primaryEvidenceId']) {
    assert.ok(rules.includes(`!('${piiField}' in incoming())`), `Expected ${piiField} blocked in public_reports`);
  }

  // firestore.indexes.json exempts base64Data from single-field indexing
  const indexPath = path.resolve(process.cwd(), 'firestore.indexes.json');
  const indexesRaw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const hasBase64Exemption = (indexesRaw.fieldOverrides || []).some(
    (ov: any) => ov.collectionGroup === 'evidence' && ov.fieldPath === 'base64Data' && Array.isArray(ov.indexes) && ov.indexes.length === 0
  );
  assert.equal(hasBase64Exemption, true, 'Missing fieldOverrides exemption for evidence.base64Data');
});

test('Zero firebase/storage or GCS bucket upload calls remain in src/ or server.ts', () => {
  const filesToScan: string[] = [path.resolve(process.cwd(), 'server.ts')];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
        filesToScan.push(full);
      }
    }
  };
  walk(path.resolve(process.cwd(), 'src'));

  for (const filePath of filesToScan) {
    const content = fs.readFileSync(filePath, 'utf8');
    assert.equal(/firebase\/storage/.test(content), false, `Forbidden firebase/storage import in ${filePath}`);
    assert.equal(/\b(getStorage|uploadBytes|uploadBytesResumable|getDownloadURL|deleteObject)\b/.test(content), false, `Forbidden Storage API call in ${filePath}`);
  }
});

test('floodService.fetchLiveWeather preserves expected3hRainfallMm: null when unavailable or incomplete', async () => {
  const originalFetch = globalThis.fetch;
  try {
    // Case 1: Backend returns unavailable telemetry with null values
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          isLive: false,
          unavailable: true,
          forecastAvailable: false,
          forecastCompleteness: 'UNAVAILABLE',
          expected3hRainfallMm: null,
          currentTempC: null,
          currentRainfallMm: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    const unavailable = await floodService.fetchLiveWeather(6.9271, 79.8653);
    assert.equal(unavailable.expected3hRainfallMm, null);
    assert.equal(unavailable.forecastAvailable, false);
    assert.equal(unavailable.unavailable, true);
    assert.equal(unavailable.currentTempC, null);

    // Case 2: Network failure -> catches cleanly and preserves null metrics
    globalThis.fetch = (async () => {
      throw new Error('Network unreachable');
    }) as typeof fetch;

    const offline = await floodService.fetchLiveWeather(6.9271, 79.8653);
    assert.equal(offline.expected3hRainfallMm, null);
    assert.equal(offline.isLive, false);
    assert.equal(offline.unavailable, true);
    assert.equal(offline.forecastCompleteness, 'UNAVAILABLE');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('floodService handles unconfigured Firebase, blocks profile role elevation, and fails closed without officer token', async () => {
  const syncRes = await floodService.retryPublicSync('REP-ANY');
  assert.equal(syncRes.ok, false);

  await assert.rejects(
    () => floodService.updateUserProfileInFirestore('uid-1', { name: 'Test' }),
    /not configured|Incomplete Firebase client configuration|permission-denied|Missing or insufficient permissions/i
  );

  await assert.rejects(
    () => floodService.updateUserProfileInFirestore('uid-1', { name: 'Test', role: 'officer' }),
    /Forbidden: "role" cannot be modified/i
  );

  const noTokenRes = await floodService.verifyOfficerWithBackend(null);
  assert.equal(noTokenRes.authorized, false);
});

test('firestore.rules permits owner AI retry metadata update while strictly forbidding verificationStatus self-approval', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  assert.match(rules, /function isValidReportOwnerAiUpdate\(\)/);
  assert.ok(rules.includes('resource.data.verificationStatus == \'UNDER REVIEW\''));
  assert.ok(rules.includes('request.resource.data.verificationStatus == resource.data.verificationStatus'));
  assert.ok(rules.includes("request.resource.data.incidentStatus in ['Submitted', 'Under Review']"));
});

test('floodService.verifyImageWithAi preserves diagnostic FAILED payload on HTTP 502/504 without crashing submission', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          method: 'Gemini Vision (gemini-3.8-flash)',
          modelName: 'gemini-3.8-flash',
          aiStatus: 'FAILED',
          hasVisibleFlooding: false,
          aiAssessment: 'AI Processing Failed',
          officialStatus: 'Under Review',
          confidence: null,
          explanation: 'Gemini multimodal verification timed out after 75s.',
          uncertainty: 'Live AI model failed to return a valid structured assessment.',
          waterLevelEstimated: 'High',
          roadAccessibilityEstimated: 'Uncertain',
          humanVerificationRequired: true,
          timestamp: new Date().toISOString(),
          disclaimer: 'Assistive signal only.',
          diagnosticCode: 'TIMEOUT',
          upstreamStatus: 504,
          retryable: true,
        }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    const result = await floodService.verifyImageWithAi({
      imageBase64: Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(48).fill(0)]).toString('base64'),
      mimeType: 'image/jpeg',
      description: 'Knee-deep standing water near junction',
      waterLevel: 'High',
      floodType: 'Street Waterlogging',
    });

    assert.equal(result.aiStatus, 'FAILED');
    assert.equal(result.aiAssessment, 'AI Processing Failed');
    assert.equal(result.officialStatus, 'Under Review');
    assert.equal(result.confidence, null);
    assert.match(result.explanation, /timed out/i);

    await assert.rejects(
      () => floodService.retryAiVerification('REP-TEST-1'),
      /Authentication required/i
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});


