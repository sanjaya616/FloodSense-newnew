/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { createApiApp, detectImageMimeFromBuffer, extractNext3HourForecast, ServerTestOverrides } from './server.ts';
import {
  calculateGeminiRetryDelayMs,
  extractRetryAfterMs,
  getGeminiMaxRetries,
  getGeminiRetryBaseDelayMs,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
  DEFAULT_GEMINI_RETRY_MAX_DELAY_MS,
  MAX_GEMINI_RETRY_AFTER_MS,
  runGeminiFloodAssessment,
} from './serverGemini.ts';

async function withTestServer(
  overrides: ServerTestOverrides,
  fn: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = createApiApp({ forceSkipAuthCheck: true, ...overrides });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// Valid minimal 40-byte JPEG header buffer (passes magic byte & >= 32 byte length check)
function makeFakeJpegBase64(extraBytes = 0): string {
  const buf = Buffer.alloc(48 + extraBytes, 0);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  return buf.toString('base64');
}

test('detectImageMimeFromBuffer validates JPEG, PNG, and WEBP magic bytes accurately', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const webp = Buffer.from('RIFF1234WEBP', 'ascii');
  const txt = Buffer.from('PLAIN_TEXT_NOT_AN_IMAGE', 'ascii');

  assert.equal(detectImageMimeFromBuffer(jpeg), 'image/jpeg');
  assert.equal(detectImageMimeFromBuffer(png), 'image/png');
  assert.equal(detectImageMimeFromBuffer(webp), 'image/webp');
  assert.equal(detectImageMimeFromBuffer(txt), null);
});

test('extractNext3HourForecast sums future Asia/Colombo hourly slots cleanly', () => {
  const times = [
    '2026-11-13T10:00',
    '2026-11-13T11:00',
    '2026-11-13T12:00',
    '2026-11-13T13:00',
    '2026-11-13T14:00',
  ];
  const precip = [1.2, 3.0, 5.5, 10.2, 4.3];
  const res = extractNext3HourForecast(times, precip, '2026-11-13T10:45');
  assert.equal(res.forecastAvailable, true);
  assert.deepEqual(res.values, [3.0, 5.5, 10.2]);
  assert.equal(res.totalMm, 18.7);
});

test('POST /api/ai/verify returns NOT_RUN with null confidence when no image is sent', async () => {
  await withTestServer({ geminiApiKey: null }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/ai/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waterLevel: 'Moderate', description: 'Water rising' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.aiStatus, 'NOT_RUN');
    assert.equal(body.confidence, null);
    assert.equal(body.officialStatus, 'Under Review');
  });
});

test('POST /api/ai/verify rejects corrupt magic bytes with 400 and oversized images with 413', async () => {
  await withTestServer({ geminiApiKey: null }, async (baseUrl) => {
    // Fake text payload disguised as JPEG
    const badRes = await fetch(`${baseUrl}/api/ai/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: Buffer.from('THIS_IS_NOT_A_REAL_JPEG_FILE_AT_ALL_12345').toString('base64'),
        mimeType: 'image/jpeg',
      }),
    });
    assert.equal(badRes.status, 400);

    // > 5 MB payload
    const largeRes = await fetch(`${baseUrl}/api/ai/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: makeFakeJpegBase64(5.2 * 1024 * 1024),
        mimeType: 'image/jpeg',
      }),
    });
    assert.equal(largeRes.status, 413);
  });
});

test('POST /api/ai/verify returns UNCONFIGURED with null confidence without API key and ignores client simulateFailure', async () => {
  await withTestServer({ geminiApiKey: null }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/ai/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: makeFakeJpegBase64(),
        mimeType: 'image/jpeg',
        waterLevel: 'Severe',
        simulateFailure: true,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.aiStatus, 'UNCONFIGURED');
    assert.equal(body.confidence, null);
    assert.equal(body.officialStatus, 'Under Review');
  });
});

test('POST /api/ai/verify returns COMPLETED on valid Gemini JSON and 502 FAILED with null confidence on error', async () => {
  // Valid Gemini JSON response — also verifies model, LOW thinking level, and abortSignal
  let capturedArgs: any = null;
  await withTestServer(
    {
      geminiApiKey: 'test-key-123',
      aiClientFactory: () => ({
        models: {
          generateContent: async (args: any) => {
            capturedArgs = args;
            return {
              text: JSON.stringify({
                hasVisibleFlooding: true,
                confidenceScore: 87.5,
                assessment: 'Possible Flooding Detected',
                observedWaterLevel: 'High',
                observedAccessibility: 'Partially Blocked',
                detailedExplanation: 'Visible standing water across junction lanes.',
                uncertaintyNotes: 'Evening glare on wet pavement.',
              }),
            };
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: makeFakeJpegBase64(),
          mimeType: 'image/jpeg',
          waterLevel: 'High',
        }),
      });
      assert.equal(res.status, 200);
      assert.equal(capturedArgs?.model, 'gemini-3.8-flash');
      assert.equal(capturedArgs?.config?.thinkingConfig?.thinkingLevel, 'LOW');
      assert.ok(capturedArgs?.config?.abortSignal instanceof AbortSignal);
      const body = await res.json();
      assert.equal(body.aiStatus, 'COMPLETED');
      assert.equal(body.modelName, 'gemini-3.8-flash');
      assert.equal(body.confidence, 87.5);
      assert.equal(body.officialStatus, 'Under Review');
    }
  );

  // Malformed JSON -> 502 FAILED, confidence null (never returns 75%)
  await withTestServer(
    {
      geminiApiKey: 'test-key-123',
      aiClientFactory: () => ({
        models: {
          generateContent: async () => ({ text: 'not valid json {' }),
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: makeFakeJpegBase64(),
          mimeType: 'image/jpeg',
        }),
      });
      assert.equal(res.status, 502);
      const body = await res.json();
      assert.equal(body.aiStatus, 'FAILED');
      assert.equal(body.confidence, null);
    }
  );
});

test('GET /api/weather/colombo forwards coordinates and surfaces live vs fallback status honestly', async () => {
  let requestedUrl = '';
  const mockFetch = (async (url: string | URL | Request) => {
    requestedUrl = String(url);
    return new Response(
      JSON.stringify({
        current: {
          time: '2026-11-13T12:00',
          temperature_2m: 29.2,
          relative_humidity_2m: 84,
          precipitation: 4.5,
          wind_speed_10m: 14,
          wind_direction_10m: 225,
        },
        hourly: {
          time: [
            '2026-11-13T12:00',
            '2026-11-13T13:00',
            '2026-11-13T14:00',
            '2026-11-13T15:00',
          ],
          precipitation: [4.5, 6.0, 9.0, 5.0],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  await withTestServer({ fetchImpl: mockFetch }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/weather/colombo?lat=6.8745&lng=79.8600`);
    assert.equal(res.status, 200);
    assert.ok(requestedUrl.includes('latitude=6.8745'));
    assert.ok(requestedUrl.includes('longitude=79.8600'));
    const body = await res.json();
    assert.equal(body.isLive, true);
    assert.equal(body.isUsingDemonstrationFallback, false);
    assert.equal(body.expected3hRainfallMm, 20.0);
    assert.equal(body.forecastAvailable, true);
  });

  // Upstream failure -> honest unavailable null telemetry (never fabricates weather numbers)
  const failFetch = (async () => new Response('Upstream error', { status: 503 })) as typeof fetch;
  await withTestServer({ fetchImpl: failFetch }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/weather/colombo`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.isLive, false);
    assert.equal(body.unavailable, true);
    assert.equal(body.currentTempC, null);
    assert.equal(body.currentRainfallMm, null);
    assert.equal(body.forecastAvailable, false);
  });
});

test('GET /api/health exposes honest service states and rulesConfigured: null', async () => {
  const okTileFetch = (async () => new Response('', { status: 200 })) as typeof fetch;
  await withTestServer({ geminiApiKey: null, fetchImpl: okTileFetch }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.services.geminiAi.state, 'NOT_CONFIGURED');
    assert.equal(body.services.firebase.rulesConfigured, null);
    assert.equal(body.services.blockchain.state, 'LOCAL_AUDIT_CHAIN');
    assert.equal(body.services.mapTileService.state, 'CONNECTED');
  });
});

test('extractNext3HourForecast returns null totalMm and INCOMPLETE/UNAVAILABLE when slots are missing or null', () => {
  const times = ['2026-11-13T10:00', '2026-11-13T11:00', '2026-11-13T12:00', '2026-11-13T13:00'];
  const partialNullPrecip = [1.0, 2.5, null, 4.0];
  const incompleteRes = extractNext3HourForecast(times, partialNullPrecip, '2026-11-13T10:30');
  assert.equal(incompleteRes.forecastAvailable, false);
  assert.equal(incompleteRes.totalMm, null);
  assert.equal(incompleteRes.forecastCompleteness, 'INCOMPLETE');

  const shortRes = extractNext3HourForecast(
    ['2026-11-13T10:00', '2026-11-13T11:00'],
    [1.0, 2.0],
    '2026-11-13T10:30'
  );
  assert.equal(shortRes.forecastAvailable, false);
  assert.equal(shortRes.totalMm, null);
  assert.equal(shortRes.forecastCompleteness, 'INCOMPLETE');

  const emptyRes = extractNext3HourForecast([], [], '2026-11-13T10:30');
  assert.equal(emptyRes.forecastAvailable, false);
  assert.equal(emptyRes.totalMm, null);
  assert.equal(emptyRes.forecastCompleteness, 'UNAVAILABLE');
});

test('GET /api/weather/colombo caches by coordinate sector and retries once on transient 503', async () => {
  let fetchCount = 0;
  const mockFetch = (async () => {
    fetchCount += 1;
    // First call returns 503 transient failure -> retry should succeed on second call
    if (fetchCount === 1) {
      return new Response('Busy', { status: 503 });
    }
    return new Response(
      JSON.stringify({
        current: {
          time: '2026-11-13T12:00',
          temperature_2m: 30,
          relative_humidity_2m: 82,
          precipitation: 2.0,
          wind_speed_10m: 12,
          wind_direction_10m: 180,
        },
        hourly: {
          time: ['2026-11-13T12:00', '2026-11-13T13:00', '2026-11-13T14:00', '2026-11-13T15:00'],
          precipitation: [2.0, 3.0, 4.0, 5.0],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  await withTestServer({ fetchImpl: mockFetch }, async (baseUrl) => {
    // 1st request: 503 + 1 retry -> 2 fetches
    const r1 = await fetch(`${baseUrl}/api/weather/colombo?lat=6.9210&lng=79.8610`);
    const b1 = await r1.json();
    assert.equal(b1.isLive, true);
    assert.equal(b1.cached, false);
    assert.equal(fetchCount, 2);

    // 2nd request in same 0.01-deg sector -> cache hit, fetchCount stays 2
    const r2 = await fetch(`${baseUrl}/api/weather/colombo?lat=6.9240&lng=79.8640`);
    const b2 = await r2.json();
    assert.equal(b2.cached, true);
    assert.equal(fetchCount, 2);

    // 3rd request in distant sector -> cache miss, fetchCount becomes 3
    const r3 = await fetch(`${baseUrl}/api/weather/colombo?lat=6.8500&lng=79.9200`);
    const b3 = await r3.json();
    assert.equal(b3.cached, false);
    assert.equal(fetchCount, 3);
  });
});

test('FLOODSENSE_MODE=LIVE fails closed without Admin SDK or Bearer token', async () => {
  // No Admin SDK -> 503 on AI verify and public-sync
  const appNoAdmin = createApiApp({
    floodsenseMode: 'LIVE',
    adminOverride: null,
    forceSkipAuthCheck: false,
  });
  const srv1 = http.createServer(appNoAdmin);
  await new Promise<void>((r) => srv1.listen(0, '127.0.0.1', () => r()));
  const url1 = `http://127.0.0.1:${(srv1.address() as AddressInfo).port}`;
  try {
    const aiRes = await fetch(`${url1}/api/ai/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waterLevel: 'Low' }),
    });
    assert.equal(aiRes.status, 503);

    const syncRes = await fetch(`${url1}/api/reports/public-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId: 'REP-1' }),
    });
    assert.equal(syncRes.status, 503);
  } finally {
    await new Promise<void>((r) => srv1.close(() => r()));
  }

  // With Admin SDK present, missing Bearer token -> 401
  const mockDb = {
    collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }),
  };
  const appWithAdmin = createApiApp({
    floodsenseMode: 'LIVE',
    forceSkipAuthCheck: false,
    adminOverride: {
      verifyIdToken: async () => ({ uid: 'citizen-1' }),
      firestore: mockDb,
    },
  });
  const srv2 = http.createServer(appWithAdmin);
  await new Promise<void>((r) => srv2.listen(0, '127.0.0.1', () => r()));
  const url2 = `http://127.0.0.1:${(srv2.address() as AddressInfo).port}`;
  try {
    const unauthAi = await fetch(`${url2}/api/ai/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waterLevel: 'Low' }),
    });
    assert.equal(unauthAi.status, 401);

    const unauthSync = await fetch(`${url2}/api/reports/public-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId: 'REP-1' }),
    });
    assert.equal(unauthSync.status, 401);
  } finally {
    await new Promise<void>((r) => srv2.close(() => r()));
  }
});

test('POST /api/reports/public-sync enforces ownership/officer role, strips PII, generalizes coordinates, and syncs', async () => {
  const storedTimestamp = new Date().toISOString();
  const storedReports: Record<string, any> = {
    'REP-SERVER-1': {
      id: 'REP-SERVER-1',
      reporterId: 'citizen-owner',
      reporterName: 'Nimal Perera',
      reporterEmail: 'nimal@example.com',
      reporterPhone: '+94771234567',
      officerNotes: ['Internal tactical note'],
      imageUrl: 'https://firebasestorage.example.com/private.jpg',
      location: 'Wellawatte Canal Bank',
      area: 'Wellawatte',
      lat: 6.874589,
      lng: 79.860432,
      timestamp: storedTimestamp,
      waterLevel: 'High',
      roadAccessibility: 'Partially Blocked',
      floodType: 'Canal Overflow',
      description: 'Canal overflowing onto side lane',
      riskLevel: 'HIGH',
      verificationStatus: 'UNDER REVIEW',
      incidentStatus: 'Under Review',
      publicSyncStatus: 'PENDING',
    },
    'REP-PRIOR-1': {
      id: 'REP-PRIOR-1',
      reporterId: 'another-citizen',
      location: 'Wellawatte Canal Bank',
      area: 'Wellawatte',
      lat: 6.874595,
      lng: 79.860438,
      timestamp: storedTimestamp,
      waterLevel: 'High',
      roadAccessibility: 'Partially Blocked',
      floodType: 'Canal Overflow',
      riskLevel: 'HIGH',
      verificationStatus: 'VERIFIED',
      incidentStatus: 'Verified',
    },
  };

  const batchWrites: Array<{ col: string; id: string; data: any }> = [];
  let committed = false;

  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        _col: colName,
        _id: docId,
        get: async () => {
          if (colName === 'reports' && storedReports[docId]) {
            return { exists: true, id: docId, data: () => storedReports[docId] };
          }
          if (colName === 'officers' && docId === 'officer-1') {
            return { exists: true, id: docId, data: () => ({ active: true }) };
          }
          return { exists: false, id: docId, data: () => undefined };
        },
      }),
      where: () => ({
        get: async () => ({
          docs: Object.values(storedReports).map((r) => ({ id: r.id, data: () => r })),
        }),
      }),
    }),
    batch: () => ({
      set: (ref: any, data: any) => {
        batchWrites.push({ col: ref._col || 'reports', id: ref._id || data.id || 'target', data });
      },
      commit: async () => {
        committed = true;
      },
    }),
  };

  const app = createApiApp({
    floodsenseMode: 'LIVE',
    forceSkipAuthCheck: false,
    adminOverride: {
      verifyIdToken: async (token: string) => {
        if (token === 'token-intruder') return { uid: 'intruder-user' };
        if (token === 'token-owner') return { uid: 'citizen-owner' };
        if (token === 'token-officer') return { uid: 'officer-1' };
        throw new Error('Bad token');
      },
      firestore: mockFirestore,
    },
  });

  const srv = http.createServer(app);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const baseUrl = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;

  try {
    // 1. Intruder (non-owner, not in officers collection) -> 403 Forbidden
    const forbidRes = await fetch(`${baseUrl}/api/reports/public-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-intruder',
      },
      body: JSON.stringify({ reportId: 'REP-SERVER-1' }),
    });
    assert.equal(forbidRes.status, 403);

    // 2. Owner succeeds; client overrides ignored; PII stripped; lat/lng rounded to 3 decimals
    const ownerRes = await fetch(`${baseUrl}/api/reports/public-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-owner',
      },
      body: JSON.stringify({
        reportId: 'REP-SERVER-1',
        riskLevel: 'LOW',
        verificationStatus: 'VERIFIED',
      }),
    });
    assert.equal(ownerRes.status, 200);
    const body = await ownerRes.json();
    assert.equal(body.ok, true);
    assert.equal(committed, true);
    // Server duplicate check detects REP-PRIOR-1 within 25m / 5m
    assert.equal(body.isDuplicate, true);
    assert.equal(body.duplicateOfReportId, 'REP-PRIOR-1');
    // Public payload checks
    assert.equal(body.publicReport.coordinatePrecision, 'APPROX_100M_GRID');
    assert.equal(body.publicReport.isPublicRedacted, true);
    assert.equal(body.publicReport.lat, 6.875);
    assert.equal(body.publicReport.lng, 79.86);
    assert.equal(body.publicReport.riskLevel, 'HIGH'); // Kept Firestore truth, ignored client 'LOW'
    assert.equal(body.publicReport.verificationStatus, 'UNDER REVIEW'); // Ignored client 'VERIFIED'
    assert.equal(body.publicReport.reporterName, undefined);
    assert.equal(body.publicReport.reporterEmail, undefined);
    assert.equal(body.publicReport.reporterPhone, undefined);
    assert.equal(body.publicReport.reporterId, undefined);
    assert.equal(body.publicReport.officerNotes, undefined);
    assert.equal(body.publicReport.imageUrl, undefined);

    const pubWrite = batchWrites.find((w) => w.col === 'public_reports');
    const reportStatusWrite = batchWrites.find((w) => w.data.publicSyncStatus === 'SYNCED');
    assert.ok(pubWrite, 'Expected public_reports batch write');
    assert.ok(reportStatusWrite, 'Expected reports.publicSyncStatus = SYNCED batch write');

    // 3. Officer (via authoritative /officers/{uid} lookup) can also sync another citizen's report
    const officerRes = await fetch(`${baseUrl}/api/reports/public-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-officer',
      },
      body: JSON.stringify({ reportId: 'REP-SERVER-1' }),
    });
    assert.equal(officerRes.status, 200);
  } finally {
    await new Promise<void>((r) => srv.close(() => r()));
  }
});

test('POST /api/auth/verify-officer verifies Firebase tokens server-side and rejects citizens, admins, inactive officers, and spoofed bodies', async () => {
  // 1. Admin SDK verifier unavailable -> 503 fail closed
  await withTestServer(
    { forceSkipAuthCheck: false, adminOverride: null },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/auth/verify-officer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer any-token' },
        body: JSON.stringify({ role: 'officer' }),
      });
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.authorized, false);
    }
  );

  // 2. With verifier + mock Firestore /officers collection
  const officersDb: Record<string, any> = {
    'officer-doc-active': { active: true, role: 'officer' },
    'officer-doc-disabled': { active: false, role: 'officer' },
  };

  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          if (colName === 'officers' && officersDb[docId]) {
            return { exists: true, id: docId, data: () => officersDb[docId] };
          }
          return { exists: false, id: docId, data: () => undefined };
        },
      }),
    }),
  };

  const app = createApiApp({
    forceSkipAuthCheck: false,
    adminOverride: {
      verifyIdToken: async (token: string) => {
        if (token === 'token-citizen') return { uid: 'citizen-1', email: 'c@colombo.lk', role: 'citizen' };
        if (token === 'token-admin-claim') return { uid: 'admin-fake', email: 'a@colombo.lk', role: 'admin' };
        if (token === 'token-officer-claim') return { uid: 'officer-claim-1', email: 'off1@dmc.gov.lk', role: 'officer' };
        if (token === 'token-officer-bool') return { uid: 'officer-bool-1', email: 'off2@dmc.gov.lk', officer: true };
        if (token === 'token-officer-doc') return { uid: 'officer-doc-active', email: 'off3@dmc.gov.lk' };
        if (token === 'token-officer-disabled') return { uid: 'officer-doc-disabled', email: 'off4@dmc.gov.lk' };
        throw new Error('Token expired or invalid');
      },
      firestore: mockFirestore,
    },
  });

  const srv = http.createServer(app);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const baseUrl = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;

  try {
    // Missing Bearer token -> 401
    const noTokenRes = await fetch(`${baseUrl}/api/auth/verify-officer`, { method: 'POST' });
    assert.equal(noTokenRes.status, 401);

    // Invalid token -> 401
    const badTokenRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { Authorization: 'Bearer corrupted-jwt' },
    });
    assert.equal(badTokenRes.status, 401);

    // Citizen even with spoofed body { role: 'officer' } -> 403
    const citizenRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-citizen' },
      body: JSON.stringify({ role: 'officer', isOfficer: true }),
    });
    assert.equal(citizenRes.status, 403);
    const citizenBody = await citizenRes.json();
    assert.equal(citizenBody.authorized, false);
    assert.equal(citizenBody.role, 'citizen');

    // No System Administrator role bypass -> 403
    const adminClaimRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-admin-claim' },
    });
    assert.equal(adminClaimRes.status, 403);

    // Inactive officer in /officers/{uid} -> 403
    const disabledRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-officer-disabled' },
    });
    assert.equal(disabledRes.status, 403);

    // Valid custom claim { role: 'officer' } -> 200
    const claimRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-officer-claim' },
    });
    assert.equal(claimRes.status, 200);
    const claimBody = await claimRes.json();
    assert.equal(claimBody.authorized, true);
    assert.equal(claimBody.role, 'officer');
    assert.equal(claimBody.verificationSource, 'custom_claims');

    // Valid custom claim { officer: true } -> 200
    const boolClaimRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-officer-bool' },
    });
    assert.equal(boolClaimRes.status, 200);
    const boolClaimBody = await boolClaimRes.json();
    assert.equal(boolClaimBody.authorized, true);
    assert.equal(boolClaimBody.verificationSource, 'custom_claims');

    // Valid active /officers/{uid} document -> 200
    const docRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-officer-doc' },
    });
    assert.equal(docRes.status, 200);
    const docBody = await docRes.json();
    assert.equal(docBody.authorized, true);
    assert.equal(docBody.role, 'officer');
    assert.equal(docBody.verificationSource, 'officers_collection');

    // GET /api/auth/session distinguishes citizen vs officer
    const sessCitizen = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer token-citizen' },
    });
    assert.equal(sessCitizen.status, 200);
    assert.equal((await sessCitizen.json()).role, 'citizen');

    const sessOfficer = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer token-officer-doc' },
    });
    assert.equal(sessOfficer.status, 200);
    const sessOfficerBody = await sessOfficer.json();
    assert.equal(sessOfficerBody.role, 'officer');
    assert.equal(sessOfficerBody.verificationSource, 'officers_collection');
  } finally {
    await new Promise<void>((r) => srv.close(() => r()));
  }
});

test('POST /api/auth/bootstrap-first-officer authorizes only the first officer with a strong secret and locks afterwards', async () => {
  const officersStore: Record<string, any> = {};
  const usersStore: Record<string, any> = {};
  const customClaimsLog: Array<{ uid: string; claims: Record<string, any> }> = [];

  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          const store = colName === 'officers' ? officersStore : usersStore;
          return store[docId]
            ? { exists: true, id: docId, data: () => store[docId] }
            : { exists: false, id: docId, data: () => undefined };
        },
        set: async (data: any) => {
          const store = colName === 'officers' ? officersStore : usersStore;
          store[docId] = { ...(store[docId] || {}), ...data };
        },
      }),
      limit: (n: number) => ({
        get: async () => {
          const entries = Object.entries(colName === 'officers' ? officersStore : usersStore).slice(0, n);
          return {
            empty: entries.length === 0,
            docs: entries.map(([id, data]) => ({ id, data: () => data })),
          };
        },
      }),
    }),
  };

  // Unconfigured secret -> 403 disabled
  const disabledApp = createApiApp({
    forceSkipAuthCheck: false,
    officerBootstrapSecret: '',
    adminOverride: {
      verifyIdToken: async () => ({ uid: 'u1', email: 'first@dmc.gov.lk' }),
      firestore: mockFirestore,
      setCustomUserClaims: async () => {},
    },
  });
  const s1 = http.createServer(disabledApp);
  await new Promise<void>((r) => s1.listen(0, '127.0.0.1', () => r()));
  const u1 = `http://127.0.0.1:${(s1.address() as AddressInfo).port}`;
  try {
    const res = await fetch(`${u1}/api/auth/bootstrap-first-officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t1' },
      body: JSON.stringify({ bootstrapSecret: 'any-secret-here-1234' }),
    });
    assert.equal(res.status, 403);
  } finally {
    await new Promise<void>((r) => s1.close(() => r()));
  }

  // Configured secret -> authorizes first officer, blocks wrong secret, blocks second attempt with 409
  const secret = 'ColomboEOCBootstrap#2026';
  const enabledApp = createApiApp({
    forceSkipAuthCheck: false,
    officerBootstrapSecret: secret,
    adminOverride: {
      verifyIdToken: async (token: string) => ({
        uid: token === 'token-first' ? 'first-uid' : 'second-uid',
        email: token === 'token-first' ? 'chief@dmc.gov.lk' : 'other@gmail.com',
        name: 'Colombo EOC Chief',
      }),
      firestore: mockFirestore,
      setCustomUserClaims: async (uid: string, claims: Record<string, any>) => {
        customClaimsLog.push({ uid, claims });
      },
    },
  });
  const s2 = http.createServer(enabledApp);
  await new Promise<void>((r) => s2.listen(0, '127.0.0.1', () => r()));
  const u2 = `http://127.0.0.1:${(s2.address() as AddressInfo).port}`;
  try {
    // Wrong secret -> 403
    const badSecretRes = await fetch(`${u2}/api/auth/bootstrap-first-officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-first' },
      body: JSON.stringify({ bootstrapSecret: 'wrong-secret-value-1' }),
    });
    assert.equal(badSecretRes.status, 403);

    // Valid first officer bootstrap -> 200
    const okRes = await fetch(`${u2}/api/auth/bootstrap-first-officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-first' },
      body: JSON.stringify({ bootstrapSecret: secret }),
    });
    assert.equal(okRes.status, 200);
    const okBody = await okRes.json();
    assert.equal(okBody.ok, true);
    assert.equal(okBody.role, 'officer');
    assert.deepEqual(customClaimsLog[0], { uid: 'first-uid', claims: { role: 'officer', officer: true } });
    assert.equal(officersStore['first-uid']?.active, true);
    assert.equal(officersStore['first-uid']?.role, 'officer');

    // Second user attempt -> 409 Conflict (permanently locked once first officer exists)
    const secondRes = await fetch(`${u2}/api/auth/bootstrap-first-officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-second' },
      body: JSON.stringify({ bootstrapSecret: secret }),
    });
    assert.equal(secondRes.status, 409);
  } finally {
    await new Promise<void>((r) => s2.close(() => r()));
  }
});

test('GET /api/officer/authorize and PATCH /api/users/profile enforce officer custom claims and block role elevation', async () => {
  const officersStore: Record<string, any> = {
    'revoked-officer-uid': { active: false, role: 'citizen' },
  };
  const usersStore: Record<string, any> = {
    'citizen-1': { uid: 'citizen-1', email: 'c@colombo.lk', role: 'citizen' },
  };

  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          const store = colName === 'officers' ? officersStore : usersStore;
          return store[docId]
            ? { exists: true, id: docId, data: () => store[docId] }
            : { exists: false, id: docId, data: () => undefined };
        },
        set: async (data: any) => {
          const store = colName === 'officers' ? officersStore : usersStore;
          store[docId] = { ...(store[docId] || {}), ...data };
        },
      }),
    }),
  };

  const app = createApiApp({
    forceSkipAuthCheck: false,
    adminOverride: {
      verifyIdToken: async (token: string) => {
        if (token === 'token-citizen') return { uid: 'citizen-1', email: 'c@colombo.lk', role: 'citizen' };
        if (token === 'token-revoked-claim') return { uid: 'revoked-officer-uid', email: 'ex@dmc.gov.lk', role: 'officer' };
        if (token === 'token-officer-claim') return { uid: 'officer-1', email: 'off@dmc.gov.lk', role: 'officer' };
        throw new Error('Invalid token');
      },
      firestore: mockFirestore,
    },
  });

  const srv = http.createServer(app);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const baseUrl = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;

  try {
    // Unauthenticated /api/officer/authorize -> 401
    const unauth = await fetch(`${baseUrl}/api/officer/authorize`);
    assert.equal(unauth.status, 401);

    // Citizen on /api/officer/authorize -> 403
    const citizenRes = await fetch(`${baseUrl}/api/officer/authorize`, {
      headers: { Authorization: 'Bearer token-citizen' },
    });
    assert.equal(citizenRes.status, 403);

    // Revoked officer with unexpired JWT claim -> 403
    const revokedRes = await fetch(`${baseUrl}/api/officer/authorize`, {
      headers: { Authorization: 'Bearer token-revoked-claim' },
    });
    assert.equal(revokedRes.status, 403);

    // Active officer with custom claim -> 200
    const officerRes = await fetch(`${baseUrl}/api/officer/authorize`, {
      headers: { Authorization: 'Bearer token-officer-claim' },
    });
    assert.equal(officerRes.status, 200);
    const officerBody = await officerRes.json();
    assert.equal(officerBody.authorized, true);
    assert.equal(officerBody.role, 'officer');
    assert.equal(officerBody.verificationSource, 'custom_claims');

    // Profile update attempting role elevation -> 403 and Firestore untouched
    const elevationRes = await fetch(`${baseUrl}/api/users/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-citizen',
      },
      body: JSON.stringify({ name: 'Escalator', role: 'officer', isOfficer: true }),
    });
    assert.equal(elevationRes.status, 403);
    assert.equal(usersStore['citizen-1'].role, 'citizen');

    // Legitimate editable profile fields succeed
    const cleanProfileRes = await fetch(`${baseUrl}/api/users/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-citizen',
      },
      body: JSON.stringify({ name: 'Amali Silva', phone: '+94 77 999 0000', emergencySector: 'Sector 03' }),
    });
    assert.equal(cleanProfileRes.status, 200);
    assert.equal(usersStore['citizen-1'].name, 'Amali Silva');
    assert.equal(usersStore['citizen-1'].role, 'citizen');
  } finally {
    await new Promise<void>((r) => srv.close(() => r()));
  }
});

test('POST /api/reports/:reportId/retry-ai enforces auth/ownership/SSRF and runs Gemini with abortSignal', async () => {
  const reportsDb: Record<string, any> = {
    'REP-CIT-1': {
      id: 'REP-CIT-1',
      reporterId: 'citizen-owner',
      waterLevel: 'High',
      floodType: 'Street Waterlogging',
      description: 'Flooded road',
      incidentStatus: 'Submitted',
      imageUrl: `data:image/jpeg;base64,${makeFakeJpegBase64()}`,
      statusHistory: [],
    },
    'REP-SSRF-1': {
      id: 'REP-SSRF-1',
      reporterId: 'citizen-owner',
      waterLevel: 'High',
      floodType: 'Street Waterlogging',
      description: 'Evil host test',
      incidentStatus: 'Submitted',
      imageUrl: 'https://evil.internal.example.com/secret.jpg',
      statusHistory: [],
    },
  };
  const officersDb: Record<string, any> = {
    'officer-1': { active: true, role: 'officer' },
  };
  const statusHistoryStore: Record<string, any> = {};

  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          const store = colName === 'reports' ? reportsDb : colName === 'officers' ? officersDb : statusHistoryStore;
          return store[docId]
            ? { exists: true, id: docId, data: () => store[docId] }
            : { exists: false, id: docId, data: () => undefined };
        },
        set: async (data: any) => {
          const store = colName === 'reports' ? reportsDb : colName === 'officers' ? officersDb : statusHistoryStore;
          store[docId] = { ...(store[docId] || {}), ...data };
        },
      }),
    }),
  };

  let retryAiArgs: any = null;
  const app = createApiApp({
    forceSkipAuthCheck: false,
    geminiApiKey: 'retry-test-key',
    aiClientFactory: () => ({
      models: {
        generateContent: async (args: any) => {
          retryAiArgs = args;
          return {
            text: JSON.stringify({
              hasVisibleFlooding: true,
              confidenceScore: 91.2,
              assessment: 'Possible Flooding Detected',
              observedWaterLevel: 'High',
              observedAccessibility: 'Partially Blocked',
              detailedExplanation: 'Retried Gemini vision confirms flooded street surface.',
              uncertaintyNotes: 'Shallow reflections near curb.',
            }),
          };
        },
      },
    }),
    adminOverride: {
      verifyIdToken: async (token: string) => {
        if (token === 'token-owner') return { uid: 'citizen-owner', role: 'citizen' };
        if (token === 'token-other') return { uid: 'other-citizen', role: 'citizen' };
        if (token === 'token-officer') return { uid: 'officer-1', role: 'officer' };
        throw new Error('Bad token');
      },
      firestore: mockFirestore,
    },
  });

  const srv = http.createServer(app);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const baseUrl = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;

  try {
    // 1. Missing token -> 401
    const unauth = await fetch(`${baseUrl}/api/reports/REP-CIT-1/retry-ai`, { method: 'POST' });
    assert.equal(unauth.status, 401);

    // 2. Different citizen cannot retry owner's report -> 403
    const otherRes = await fetch(`${baseUrl}/api/reports/REP-CIT-1/retry-ai`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-other' },
    });
    assert.equal(otherRes.status, 403);

    // 3. Untrusted external image host blocked -> 400 SSRF prevention
    const ssrfRes = await fetch(`${baseUrl}/api/reports/REP-SSRF-1/retry-ai`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-owner' },
    });
    assert.equal(ssrfRes.status, 400);

    // 4. Owner retry succeeds, sets COMPLETED + timeout AbortSignal + updates statusHistory
    const ownerRes = await fetch(`${baseUrl}/api/reports/REP-CIT-1/retry-ai`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-owner' },
    });
    assert.equal(ownerRes.status, 200);
    const ownerBody = await ownerRes.json();
    assert.equal(ownerBody.ok, true);
    assert.equal(ownerBody.report.aiStatus, 'COMPLETED');
    assert.equal(ownerBody.report.aiConfidence, 91.2);
    assert.equal(ownerBody.report.incidentStatus, 'Under Review');
    assert.ok(retryAiArgs?.config?.abortSignal instanceof AbortSignal);

    // 5. Authorized officer can also retry another citizen's report -> 200
    const officerRes = await fetch(`${baseUrl}/api/reports/REP-CIT-1/retry-ai`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-officer' },
    });
    assert.equal(officerRes.status, 200);
  } finally {
    await new Promise<void>((r) => srv.close(() => r()));
  }
});

test('POST /api/reports/:reportId/retry-ai reads compressed evidence from Firestore subcollection and COOP header is set', async () => {
  const reportsDb: Record<string, any> = {
    'REP-SUB-1': {
      id: 'REP-SUB-1',
      reporterId: 'citizen-owner',
      waterLevel: 'High',
      floodType: 'Street Waterlogging',
      description: 'Submerged junction',
      incidentStatus: 'Submitted',
      hasEvidence: true,
      evidenceCount: 1,
      primaryEvidenceId: 'primary',
      statusHistory: [],
    },
  };
  const evidenceDb: Record<string, Record<string, any>> = {
    'REP-SUB-1': {
      primary: {
        ownerUid: 'citizen-owner',
        mimeType: 'image/jpeg',
        base64Data: makeFakeJpegBase64(),
        byteSize: 48,
        width: 800,
        height: 600,
      },
    },
  };
  const statusHistoryStore: Record<string, any> = {};

  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          const store = colName === 'reports' ? reportsDb : statusHistoryStore;
          return store[docId]
            ? { exists: true, id: docId, data: () => store[docId] }
            : { exists: false, id: docId, data: () => undefined };
        },
        set: async (data: any) => {
          const store = colName === 'reports' ? reportsDb : statusHistoryStore;
          store[docId] = { ...(store[docId] || {}), ...data };
        },
        collection: (subName: string) => ({
          doc: (subId: string) => ({
            get: async () => {
              const ev = subName === 'evidence' ? evidenceDb[docId]?.[subId] : undefined;
              return ev
                ? { exists: true, id: subId, data: () => ev }
                : { exists: false, id: subId, data: () => undefined };
            },
          }),
          limit: () => ({
            get: async () => {
              const items = subName === 'evidence' ? Object.entries(evidenceDb[docId] || {}) : [];
              return {
                empty: items.length === 0,
                docs: items.map(([id, data]) => ({ id, data: () => data })),
              };
            },
          }),
        }),
      }),
    }),
  };

  const app = createApiApp({
    forceSkipAuthCheck: false,
    geminiApiKey: 'subcollection-ai-key',
    aiClientFactory: () => ({
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            hasVisibleFlooding: true,
            confidenceScore: 88,
            assessment: 'Possible Flooding Detected',
            observedWaterLevel: 'High',
            observedAccessibility: 'Partially Blocked',
            detailedExplanation: 'Subcollection Base64 evidence analyzed successfully.',
            uncertaintyNotes: 'Clear daylight view.',
          }),
        }),
      },
    }),
    adminOverride: {
      verifyIdToken: async () => ({ uid: 'citizen-owner', role: 'citizen' }),
      firestore: mockFirestore,
    },
  });

  const srv = http.createServer(app);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const baseUrl = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;

  try {
    const res = await fetch(`${baseUrl}/api/reports/REP-SUB-1/retry-ai`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-owner' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.report.aiStatus, 'COMPLETED');
    assert.equal(body.report.aiConfidence, 88);
  } finally {
    await new Promise<void>((r) => srv.close(() => r()));
  }
});

test('POST /api/reports/check-duplicate returns graceful 200 LOCAL_ONLY when Admin Firestore is unavailable', async () => {
  await withTestServer(
    {
      forceSkipAuthCheck: false,
      adminOverride: {
        verifyIdToken: null,
        firestore: null,
        initError: 'No server service account credentials configured.',
      },
    },
    async (baseUrl) => {
      // Invalid coords still return 400
      const badRes = await fetch(`${baseUrl}/api/reports/check-duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 999, lng: 79.86 }),
      });
      assert.equal(badRes.status, 400);

      // Valid coords gracefully fall back to LOCAL_ONLY instead of crashing with 503
      const okRes = await fetch(`${baseUrl}/api/reports/check-duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 6.9271, lng: 79.8653, timestamp: new Date().toISOString() }),
      });
      assert.equal(okRes.status, 200);
      const body = await okRes.json();
      assert.equal(body.ok, true);
      assert.equal(body.checkedCitywide, false);
      assert.equal(body.duplicateCheckStatus, 'LOCAL_ONLY');
    }
  );
});

test('DELETE /api/reports/:reportId enforces owner/officer authorization and deletes evidence subcollection', async () => {
  const reportsDb: Record<string, any> = {
    'REP-OWN-OPEN': {
      id: 'REP-OWN-OPEN',
      reporterId: 'citizen-1',
      incidentStatus: 'Submitted',
    },
    'REP-OWN-VERIFIED': {
      id: 'REP-OWN-VERIFIED',
      reporterId: 'citizen-1',
      incidentStatus: 'Verified',
    },
  };
  const publicReportsDb: Record<string, any> = {
    'REP-OWN-OPEN': { id: 'REP-OWN-OPEN' },
    'REP-OWN-VERIFIED': { id: 'REP-OWN-VERIFIED' },
  };
  const evidenceDb: Record<string, Record<string, any>> = {
    'REP-OWN-OPEN': { primary: { ownerUid: 'citizen-1', base64Data: makeFakeJpegBase64() } },
    'REP-OWN-VERIFIED': { primary: { ownerUid: 'citizen-1', base64Data: makeFakeJpegBase64() } },
  };
  const officersDb: Record<string, any> = {
    'officer-1': { active: true, role: 'officer' },
  };

  const makeRef = (col: string, id: string, subId?: string) => ({ col, id, subId });
  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        ...makeRef(colName, docId),
        get: async () => {
          const store =
            colName === 'reports' ? reportsDb : colName === 'officers' ? officersDb : publicReportsDb;
          return store[docId]
            ? { exists: true, id: docId, data: () => store[docId] }
            : { exists: false, id: docId, data: () => undefined };
        },
        collection: (subName: string) => ({
          get: async () => {
            const entries = subName === 'evidence' ? Object.entries(evidenceDb[docId] || {}) : [];
            return {
              size: entries.length,
              docs: entries.map(([subId]) => ({
                ref: makeRef(`${colName}/${docId}/${subName}`, docId, subId),
              })),
            };
          },
        }),
      }),
    }),
    batch: () => {
      const ops: Array<() => void> = [];
      return {
        delete: (ref: any) => {
          ops.push(() => {
            if (ref.subId) {
              delete evidenceDb[ref.id]?.[ref.subId];
            } else if (ref.col === 'reports') {
              delete reportsDb[ref.id];
            } else if (ref.col === 'public_reports') {
              delete publicReportsDb[ref.id];
            }
          });
        },
        commit: async () => {
          ops.forEach((fn) => fn());
        },
      };
    },
  };

  const app = createApiApp({
    forceSkipAuthCheck: false,
    adminOverride: {
      verifyIdToken: async (token: string) => {
        if (token === 'token-citizen-1') return { uid: 'citizen-1', role: 'citizen' };
        if (token === 'token-citizen-2') return { uid: 'citizen-2', role: 'citizen' };
        if (token === 'token-officer') return { uid: 'officer-1', role: 'officer' };
        throw new Error('Bad token');
      },
      firestore: mockFirestore,
    },
  });

  const srv = http.createServer(app);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const baseUrl = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;

  try {
    // 1. Intruder citizen cannot delete citizen-1's report -> 403
    const intruderRes = await fetch(`${baseUrl}/api/reports/REP-OWN-OPEN`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-citizen-2' },
    });
    assert.equal(intruderRes.status, 403);

    // 2. Citizen cannot delete an already-Verified report -> 403
    const verifiedCitizenRes = await fetch(`${baseUrl}/api/reports/REP-OWN-VERIFIED`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-citizen-1' },
    });
    assert.equal(verifiedCitizenRes.status, 403);

    // 3. Owner deletes Submitted report -> 200 and cascades to evidence + public_reports
    const ownerDelRes = await fetch(`${baseUrl}/api/reports/REP-OWN-OPEN`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-citizen-1' },
    });
    assert.equal(ownerDelRes.status, 200);
    const ownerDelBody = await ownerDelRes.json();
    assert.equal(ownerDelBody.deletedEvidenceCount, 1);
    assert.equal(reportsDb['REP-OWN-OPEN'], undefined);
    assert.equal(publicReportsDb['REP-OWN-OPEN'], undefined);
    assert.equal(evidenceDb['REP-OWN-OPEN']?.primary, undefined);

    // 4. Emergency Officer can delete even a Verified report -> 200
    const officerDelRes = await fetch(`${baseUrl}/api/reports/REP-OWN-VERIFIED`, {
      method: 'POST'.replace('POST', 'DELETE'),
      headers: { Authorization: 'Bearer token-officer' },
    });
    assert.equal(officerDelRes.status, 200);
    assert.equal(reportsDb['REP-OWN-VERIFIED'], undefined);
    assert.equal(evidenceDb['REP-OWN-VERIFIED']?.primary, undefined);
  } finally {
    await new Promise<void>((r) => srv.close(() => r()));
  }
});

test('POST /api/ai/verify honors GEMINI_MODEL override and omits thinkingConfig for non-3.x/4.x models', async () => {
  let capturedModel25Args: any = null;
  await withTestServer(
    {
      geminiApiKey: 'test-key-25',
      geminiModel: 'gemini-2.5-flash',
      aiClientFactory: () => ({
        models: {
          generateContent: async (args: any) => {
            capturedModel25Args = args;
            return {
              text: JSON.stringify({
                hasVisibleFlooding: false,
                confidenceScore: 81,
                assessment: 'No Clear Flooding Detected',
                observedWaterLevel: 'None',
                observedAccessibility: 'Open',
                detailedExplanation: 'Dry road asphalt visible.',
                uncertaintyNotes: 'Clear daylight lighting.',
              }),
            };
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: makeFakeJpegBase64(),
          mimeType: 'image/jpeg',
        }),
      });
      assert.equal(res.status, 200);
      assert.equal(capturedModel25Args?.model, 'gemini-2.5-flash');
      assert.equal(capturedModel25Args?.config?.thinkingConfig, undefined);
      const body = await res.json();
      assert.equal(body.modelName, 'gemini-2.5-flash');
      assert.equal(body.aiStatus, 'COMPLETED');
    }
  );
});

test('POST /api/ai/verify classifies 404 invalid model, 400/401 invalid API key (with redaction), and 403 permission denied without retrying', async () => {
  // 1. 404 INVALID_MODEL fails fast in 1 attempt
  let attempts404 = 0;
  await withTestServer(
    {
      geminiApiKey: 'test-key',
      geminiModel: 'gemini-nonexistent-99',
      geminiMaxRetries: 2,
      geminiRetryBaseDelayMs: 0,
      aiClientFactory: () => ({
        models: {
          generateContent: async () => {
            attempts404 += 1;
            const err: any = new Error('models/gemini-nonexistent-99 is not found for API version v1beta');
            err.status = 404;
            throw err;
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: makeFakeJpegBase64(), mimeType: 'image/jpeg' }),
      });
      assert.equal(res.status, 502);
      assert.equal(attempts404, 1);
      const body = await res.json();
      assert.equal(body.aiStatus, 'FAILED');
      assert.equal(body.aiAssessment, 'AI Processing Failed');
      assert.equal(body.diagnosticCode, 'INVALID_MODEL');
      assert.equal(body.upstreamStatus, 404);
      assert.equal(body.retryable, false);
    }
  );

  // 2. 400 API_KEY_INVALID fails fast in 1 attempt and strips any leaked AIza key
  let attempts401 = 0;
  await withTestServer(
    {
      geminiApiKey: 'AIzaSyTestSecretKeyNeverLeak123456789',
      geminiMaxRetries: 2,
      geminiRetryBaseDelayMs: 0,
      aiClientFactory: () => ({
        models: {
          generateContent: async () => {
            attempts401 += 1;
            const err: any = new Error('API_KEY_INVALID for key AIzaSyTestSecretKeyNeverLeak123456789');
            err.status = 400;
            throw err;
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: makeFakeJpegBase64(), mimeType: 'image/jpeg' }),
      });
      assert.equal(res.status, 502);
      assert.equal(attempts401, 1);
      const body = await res.json();
      assert.equal(body.diagnosticCode, 'INVALID_API_KEY');
      assert.equal(JSON.stringify(body).includes('AIzaSyTestSecretKeyNeverLeak'), false);
    }
  );

  // 3. 403 PERMISSION_DENIED fails fast
  await withTestServer(
    {
      geminiApiKey: 'test-key',
      geminiMaxRetries: 2,
      geminiRetryBaseDelayMs: 0,
      aiClientFactory: () => ({
        models: {
          generateContent: async () => {
            const err: any = new Error('PERMISSION_DENIED: Caller does not have permission');
            err.status = 403;
            throw err;
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: makeFakeJpegBase64(), mimeType: 'image/jpeg' }),
      });
      assert.equal(res.status, 502);
      const body = await res.json();
      assert.equal(body.diagnosticCode, 'PERMISSION_DENIED');
      assert.equal(body.upstreamStatus, 403);
    }
  );
});

test('POST /api/ai/verify retries transient 429/503 with bounded backoff and returns 504 TIMEOUT after exhausting timeout retries', async () => {
  // 1. Transient 429 then 503 then 200 success on attempt 3
  let transientAttempts = 0;
  await withTestServer(
    {
      geminiApiKey: 'test-key',
      geminiMaxRetries: 2,
      geminiRetryBaseDelayMs: 5,
      aiClientFactory: () => ({
        models: {
          generateContent: async () => {
            transientAttempts += 1;
            if (transientAttempts === 1) {
              throw Object.assign(new Error('429 Too Many Requests'), { status: 429 });
            }
            if (transientAttempts === 2) {
              throw Object.assign(new Error('503 Service Unavailable'), { status: 503 });
            }
            return {
              text: JSON.stringify({
                hasVisibleFlooding: true,
                confidenceScore: 90,
                assessment: 'Possible Flooding Detected',
                observedWaterLevel: 'High',
                observedAccessibility: 'Partially Blocked',
                detailedExplanation: 'Recovered on attempt 3 after transient 429/503.',
                uncertaintyNotes: 'None.',
              }),
            };
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: makeFakeJpegBase64(), mimeType: 'image/jpeg' }),
      });
      assert.equal(res.status, 200);
      assert.equal(transientAttempts, 3);
      const body = await res.json();
      assert.equal(body.aiStatus, 'COMPLETED');
      assert.equal(body.confidence, 90);
    }
  );

  // 2. Slow calls exceeding geminiTimeoutMs abort, retry once, and return HTTP 504 FAILED
  let timeoutAttempts = 0;
  await withTestServer(
    {
      geminiApiKey: 'test-key',
      geminiTimeoutMs: 60,
      geminiMaxRetries: 1,
      geminiRetryBaseDelayMs: 0,
      aiClientFactory: () => ({
        models: {
          generateContent: async (args: any) => {
            timeoutAttempts += 1;
            return new Promise((_resolve, reject) => {
              args.config.abortSignal.addEventListener('abort', () => {
                reject(args.config.abortSignal.reason || Object.assign(new Error('Aborted'), { name: 'AbortError' }));
              });
            });
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: makeFakeJpegBase64(), mimeType: 'image/jpeg' }),
      });
      assert.equal(res.status, 504);
      assert.equal(timeoutAttempts, 2);
      const body = await res.json();
      assert.equal(body.aiStatus, 'FAILED');
      assert.equal(body.aiAssessment, 'AI Processing Failed');
      assert.equal(body.diagnosticCode, 'TIMEOUT');
      assert.equal(body.confidence, null);
      assert.equal(body.retryable, true);
    }
  );
});

test('POST /api/reports/:reportId/retry-ai prevents concurrent duplicate retries (409) and strictly preserves official verificationStatus', async () => {
  const reportsDb: Record<string, any> = {
    'REP-LOCK-1': {
      id: 'REP-LOCK-1',
      reporterId: 'citizen-owner',
      waterLevel: 'Severe',
      floodType: 'Flash Flood',
      description: 'Major junction flooding',
      incidentStatus: 'Verified',
      verificationStatus: 'VERIFIED',
      hasEvidence: true,
      primaryEvidenceId: 'primary',
      statusHistory: [],
    },
  };
  const evidenceDb: Record<string, Record<string, any>> = {
    'REP-LOCK-1': {
      primary: {
        ownerUid: 'citizen-owner',
        mimeType: 'image/jpeg',
        base64Data: makeFakeJpegBase64(),
      },
    },
  };
  const statusHistoryStore: Record<string, any> = {};

  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          const store = colName === 'reports' ? reportsDb : statusHistoryStore;
          return store[docId]
            ? { exists: true, id: docId, data: () => store[docId] }
            : { exists: false, id: docId, data: () => undefined };
        },
        set: async (data: any) => {
          const store = colName === 'reports' ? reportsDb : statusHistoryStore;
          store[docId] = { ...(store[docId] || {}), ...data };
        },
        collection: (subName: string) => ({
          doc: (subId: string) => ({
            get: async () => {
              const ev = subName === 'evidence' ? evidenceDb[docId]?.[subId] : undefined;
              return ev
                ? { exists: true, id: subId, data: () => ev }
                : { exists: false, id: subId, data: () => undefined };
            },
          }),
        }),
      }),
    }),
  };

  let releaseFirstCall: (() => void) | null = null;
  let geminiInvocationCount = 0;
  const triggerRelease = () => {
    if (releaseFirstCall) {
      releaseFirstCall();
    }
  };

  const app = createApiApp({
    forceSkipAuthCheck: false,
    geminiApiKey: 'lock-test-key',
    aiClientFactory: () => ({
      models: {
        generateContent: async () => {
          geminiInvocationCount += 1;
          await new Promise<void>((resolve) => {
            releaseFirstCall = resolve;
          });
          return {
            text: JSON.stringify({
              hasVisibleFlooding: true,
              confidenceScore: 93,
              assessment: 'Possible Flooding Detected',
              observedWaterLevel: 'Severe',
              observedAccessibility: 'Completely Blocked',
              detailedExplanation: 'Retried AI confirms deep flooding.',
              uncertaintyNotes: 'Moderate rain spray.',
            }),
          };
        },
      },
    }),
    adminOverride: {
      verifyIdToken: async () => ({ uid: 'citizen-owner', role: 'citizen' }),
      firestore: mockFirestore,
    },
  });

  const srv = http.createServer(app);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const baseUrl = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;

  try {
    // Launch first retry request (pauses inside generateContent)
    const firstPromise = fetch(`${baseUrl}/api/reports/REP-LOCK-1/retry-ai`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-owner' },
    });

    // Wait briefly until first request enters Gemini call
    while (!releaseFirstCall) {
      await new Promise((r) => setTimeout(r, 10));
    }

    // Simultaneous second retry for the same reportId -> 409 RETRY_IN_PROGRESS
    const secondRes = await fetch(`${baseUrl}/api/reports/REP-LOCK-1/retry-ai`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-owner' },
    });
    assert.equal(secondRes.status, 409);
    const secondBody = await secondRes.json();
    assert.equal(secondBody.code, 'RETRY_IN_PROGRESS');

    // Release first request and verify it completes with official verificationStatus preserved
    triggerRelease();
    const firstRes = await firstPromise;
    assert.equal(firstRes.status, 200);
    const firstBody = await firstRes.json();
    assert.equal(geminiInvocationCount, 1);
    assert.equal(firstBody.report.id, 'REP-LOCK-1');
    assert.equal(firstBody.report.aiStatus, 'COMPLETED');
    assert.equal(firstBody.report.verificationStatus, 'VERIFIED');
    assert.equal(firstBody.report.incidentStatus, 'Verified');
    assert.equal(Object.keys(reportsDb).length, 1);
  } finally {
    await new Promise<void>((r) => srv.close(() => r()));
  }
});

function makeMockModelList(models: Array<{ name: string; supportedActions?: string[] }>) {
  return async () => ({
    async *[Symbol.asyncIterator]() {
      for (const m of models) {
        yield { name: `models/${m.name}`, supportedActions: m.supportedActions };
      }
    },
  });
}

test('calculateGeminiRetryDelayMs and extractRetryAfterMs enforce equal jitter, bounds, and Retry-After headers', () => {
  assert.equal(DEFAULT_GEMINI_MODEL, 'gemini-3.8-flash');
  assert.ok(DEFAULT_GEMINI_RETRY_BASE_DELAY_MS >= 2000, 'Base delay must be meaningful (>= 2000ms)');

  // Retry 1 with default base=4000: equal jitter stays in [2000, 4000] ms
  const r1Min = calculateGeminiRetryDelayMs({
    attempt: 1,
    baseDelayMs: DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
    randomFn: () => 0,
  });
  const r1Max = calculateGeminiRetryDelayMs({
    attempt: 1,
    baseDelayMs: DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
    randomFn: () => 1,
  });
  assert.equal(r1Min, 2000);
  assert.equal(r1Max, 4000);

  // Retry 2 with default base=4000: equal jitter stays in [4000, 8000] ms (~5-8s)
  const r2Min = calculateGeminiRetryDelayMs({
    attempt: 2,
    baseDelayMs: DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
    randomFn: () => 0,
  });
  const r2Max = calculateGeminiRetryDelayMs({
    attempt: 2,
    baseDelayMs: DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
    randomFn: () => 1,
  });
  assert.equal(r2Min, 4000);
  assert.equal(r2Max, 8000);

  // Attempt 5 is strictly capped by maxDelayMs
  const rCapped = calculateGeminiRetryDelayMs({
    attempt: 5,
    baseDelayMs: DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
    maxDelayMs: DEFAULT_GEMINI_RETRY_MAX_DELAY_MS,
    randomFn: () => 1,
  });
  assert.equal(rCapped, DEFAULT_GEMINI_RETRY_MAX_DELAY_MS);

  // Retry-After extraction from numeric header, Headers.get(), HTTP-date, and Google RetryInfo
  assert.equal(extractRetryAfterMs({ response: { headers: new Headers({ 'retry-after': '6' }) } }), 6000);
  assert.equal(extractRetryAfterMs({ headers: { 'Retry-After': '3' } }), 3000);
  assert.equal(
    extractRetryAfterMs({ error: { details: [{ retryDelay: '7s' }] } }),
    7000
  );

  // Valid Retry-After larger than computed backoff is honored, while extreme Retry-After is capped safely
  assert.equal(
    calculateGeminiRetryDelayMs({
      attempt: 1,
      baseDelayMs: 4000,
      retryAfterMs: 9000,
      randomFn: () => 0,
    }),
    9000
  );
  assert.equal(
    calculateGeminiRetryDelayMs({
      attempt: 1,
      baseDelayMs: 4000,
      retryAfterMs: 300_000,
      randomFn: () => 0,
    }),
    MAX_GEMINI_RETRY_AFTER_MS
  );

  // Retries clamp bounds cleanly
  assert.equal(getGeminiMaxRetries(99), 4);
  assert.equal(getGeminiMaxRetries(-5), 0);
  assert.equal(getGeminiRetryBaseDelayMs(999_999), 30_000);
});

test('Primary model gemini-3.8-flash succeeds on retry after upstream 503 and honors Retry-After cleanly', async () => {
  const sleepCalls: number[] = [];
  const calledModels: string[] = [];
  let attemptCount = 0;

  const result = await runGeminiFloodAssessment({
    geminiKey: 'test-key-503-recover',
    cleanBase64: makeFakeJpegBase64(),
    detectedMime: 'image/jpeg',
    waterLevel: 'High',
    floodType: 'Flash Flood',
    description: 'Water surging across junction',
    endpointLabel: 'POST /api/ai/verify',
    maxRetriesOverride: 2,
    retryBaseDelayMsOverride: 2500,
    sleepFn: async (ms) => {
      sleepCalls.push(ms);
    },
    aiClientFactory: () => ({
      models: {
        generateContent: async (args: any) => {
          attemptCount += 1;
          calledModels.push(args.model);
          assert.equal(args.config?.httpOptions?.retryOptions?.attempts, 1);
          if (attemptCount === 1) {
            const err: any = new Error('503 Service Unavailable: The model is currently experiencing high demand.');
            err.status = 503;
            err.response = { headers: new Headers({ 'Retry-After': '5' }) };
            throw err;
          }
          return {
            text: JSON.stringify({
              hasVisibleFlooding: true,
              confidenceScore: 92,
              assessment: 'Possible Flooding Detected',
              observedWaterLevel: 'High',
              observedAccessibility: 'Partially Blocked',
              detailedExplanation: 'Floodwater visible across road lanes.',
              uncertaintyNotes: 'Light rain glare.',
            }),
          };
        },
      },
    }),
  });

  assert.equal(result.statusCode, 200);
  assert.equal(attemptCount, 2);
  assert.deepEqual(calledModels, ['gemini-3.8-flash', 'gemini-3.8-flash']);
  assert.equal(sleepCalls.length, 1);
  assert.ok(sleepCalls[0] >= 5000, `Expected honored Retry-After >= 5000ms, got ${sleepCalls[0]}`);
  assert.equal(result.payload.aiStatus, 'COMPLETED');
  assert.equal(result.payload.modelName, 'gemini-3.8-flash');
  assert.equal(result.payload.officialStatus, 'Under Review');
});

test('Repeated 503 fails over once to confirmed GEMINI_FALLBACK_MODEL (gemini-3.7-flash), skips unconfirmed fallback, and returns 503 when both fail', async () => {
  // 1. Primary returns repeated 503; models.list confirms gemini-3.7-flash supports generateContent -> fallback succeeds once
  const calls1: string[] = [];
  await withTestServer(
    {
      geminiApiKey: 'test-key-fallback-ok',
      geminiModel: 'gemini-3.8-flash',
      geminiFallbackModel: 'gemini-3.7-flash',
      geminiMaxRetries: 2,
      geminiRetryBaseDelayMs: 0,
      aiClientFactory: () => ({
        models: {
          list: makeMockModelList([
            { name: 'gemini-3.8-flash', supportedActions: ['generateContent'] },
            { name: 'gemini-3.7-flash', supportedActions: ['generateContent'] },
          ]),
          generateContent: async (args: any) => {
            calls1.push(args.model);
            if (args.model === 'gemini-3.8-flash') {
              throw Object.assign(new Error('503: The model is currently experiencing high demand.'), { status: 503 });
            }
            return {
              text: JSON.stringify({
                hasVisibleFlooding: true,
                confidenceScore: 84,
                assessment: 'Possible Flooding Detected',
                observedWaterLevel: 'Moderate',
                observedAccessibility: 'Partially Blocked',
                detailedExplanation: 'Fallback model confirmed street flooding.',
                uncertaintyNotes: 'Overcast conditions.',
              }),
            };
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: makeFakeJpegBase64(), mimeType: 'image/jpeg' }),
      });
      assert.equal(res.status, 200);
      assert.deepEqual(calls1, [
        'gemini-3.8-flash',
        'gemini-3.8-flash',
        'gemini-3.8-flash',
        'gemini-3.7-flash',
      ]);
      const body = await res.json();
      assert.equal(body.aiStatus, 'COMPLETED');
      assert.equal(body.modelName, 'gemini-3.7-flash');
      assert.equal(body.officialStatus, 'Under Review');
    }
  );

  // 2. Fallback NOT confirmed in official Gemini model list -> never switches models, returns HTTP 503
  const calls2: string[] = [];
  await withTestServer(
    {
      geminiApiKey: 'test-key-unconfirmed-fallback',
      geminiModel: 'gemini-3.8-flash',
      geminiFallbackModel: 'gemini-3.7-flash',
      geminiMaxRetries: 2,
      geminiRetryBaseDelayMs: 0,
      aiClientFactory: () => ({
        models: {
          list: makeMockModelList([{ name: 'gemini-3.8-flash', supportedActions: ['generateContent'] }]),
          generateContent: async (args: any) => {
            calls2.push(args.model);
            throw Object.assign(new Error('503: The model is currently experiencing high demand.'), { status: 503 });
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: makeFakeJpegBase64(), mimeType: 'image/jpeg' }),
      });
      assert.equal(res.status, 503);
      assert.deepEqual(calls2, ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash']);
      const body = await res.json();
      assert.equal(body.aiStatus, 'FAILED');
      assert.equal(body.diagnosticCode, 'UPSTREAM_UNAVAILABLE');
      assert.equal(body.upstreamStatus, 503);
      assert.equal(body.officialStatus, 'Under Review');
    }
  );

  // 3. Both primary and confirmed fallback return 503 -> bounded total attempts (3 + 1), returns HTTP 503 FAILED
  const calls3: string[] = [];
  await withTestServer(
    {
      geminiApiKey: 'test-key-both-fail',
      geminiModel: 'gemini-3.8-flash',
      geminiFallbackModel: 'gemini-3.7-flash',
      geminiMaxRetries: 2,
      geminiRetryBaseDelayMs: 0,
      aiClientFactory: () => ({
        models: {
          list: makeMockModelList([
            { name: 'gemini-3.8-flash', supportedActions: ['generateContent'] },
            { name: 'gemini-3.7-flash', supportedActions: ['generateContent'] },
          ]),
          generateContent: async (args: any) => {
            calls3.push(args.model);
            throw Object.assign(new Error('503: Service overloaded.'), { status: 503 });
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: makeFakeJpegBase64(), mimeType: 'image/jpeg' }),
      });
      assert.equal(res.status, 503);
      assert.deepEqual(calls3, [
        'gemini-3.8-flash',
        'gemini-3.8-flash',
        'gemini-3.8-flash',
        'gemini-3.7-flash',
      ]);
      const body = await res.json();
      assert.equal(body.aiStatus, 'FAILED');
      assert.equal(body.diagnosticCode, 'UPSTREAM_UNAVAILABLE');
      assert.equal(body.upstreamStatus, 503);
      assert.equal(body.confidence, null);
      assert.equal(body.retryable, true);
      assert.equal(body.officialStatus, 'Under Review');
    }
  );
});

test('HTTP 429 rate-limit/quota does NOT trigger fallback failover and exhausted daily quota is not retried', async () => {
  // 1. Transient 429 retries up to primary bound and NEVER fails over to fallback model
  const callsTransient429: string[] = [];
  await withTestServer(
    {
      geminiApiKey: 'test-key-429-transient',
      geminiModel: 'gemini-3.8-flash',
      geminiFallbackModel: 'gemini-3.7-flash',
      geminiMaxRetries: 2,
      geminiRetryBaseDelayMs: 0,
      aiClientFactory: () => ({
        models: {
          list: makeMockModelList([
            { name: 'gemini-3.8-flash', supportedActions: ['generateContent'] },
            { name: 'gemini-3.7-flash', supportedActions: ['generateContent'] },
          ]),
          generateContent: async (args: any) => {
            callsTransient429.push(args.model);
            throw Object.assign(new Error('429 RESOURCE_EXHAUSTED: Per-minute rate limit reached'), { status: 429 });
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: makeFakeJpegBase64(), mimeType: 'image/jpeg' }),
      });
      assert.equal(res.status, 502);
      assert.deepEqual(callsTransient429, ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash']);
      const body = await res.json();
      assert.equal(body.diagnosticCode, 'RATE_LIMITED_OR_QUOTA');
      assert.equal(body.upstreamStatus, 429);
      assert.equal(body.retryable, true);
    }
  );

  // 2. Exhausted daily quota (limit: 0 / daily limit) stops immediately on attempt 1 without retry or failover
  const callsDaily429: string[] = [];
  await withTestServer(
    {
      geminiApiKey: 'test-key-429-daily',
      geminiModel: 'gemini-3.8-flash',
      geminiFallbackModel: 'gemini-3.7-flash',
      geminiMaxRetries: 2,
      geminiRetryBaseDelayMs: 0,
      aiClientFactory: () => ({
        models: {
          list: makeMockModelList([
            { name: 'gemini-3.8-flash', supportedActions: ['generateContent'] },
            { name: 'gemini-3.7-flash', supportedActions: ['generateContent'] },
          ]),
          generateContent: async (args: any) => {
            callsDaily429.push(args.model);
            throw Object.assign(new Error('429 RESOURCE_EXHAUSTED: Quota exceeded, daily limit reached (limit: 0)'), {
              status: 429,
            });
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: makeFakeJpegBase64(), mimeType: 'image/jpeg' }),
      });
      assert.equal(res.status, 502);
      assert.deepEqual(callsDaily429, ['gemini-3.8-flash']);
      const body = await res.json();
      assert.equal(body.diagnosticCode, 'RATE_LIMITED_OR_QUOTA');
      assert.equal(body.upstreamStatus, 429);
      assert.equal(body.retryable, false);
    }
  );
});

test('POST /api/reports/:reportId/retry-ai preserves existing report, report ID, verificationStatus, and diagnostics when Gemini returns repeated 503', async () => {
  const reportsDb: Record<string, any> = {
    'REP-503-SAVE-1': {
      id: 'REP-503-SAVE-1',
      reporterId: 'citizen-owner',
      location: 'Maradana Flyover Underpass',
      area: 'Maradana',
      lat: 6.9292,
      lng: 79.8659,
      waterLevel: 'High',
      floodType: 'Flash Flood',
      description: 'Water rising past curb',
      incidentStatus: 'Submitted',
      verificationStatus: 'UNDER REVIEW',
      hasEvidence: true,
      primaryEvidenceId: 'primary',
      statusHistory: [
        {
          status: 'Submitted',
          timestamp: '2026-11-17T20:00:00.000Z',
          authorName: 'Citizen Reporter',
          note: 'Report registered.',
        },
      ],
    },
  };
  const evidenceDb: Record<string, Record<string, any>> = {
    'REP-503-SAVE-1': {
      primary: {
        ownerUid: 'citizen-owner',
        mimeType: 'image/jpeg',
        base64Data: makeFakeJpegBase64(),
      },
    },
  };
  const statusHistoryStore: Record<string, any> = {};

  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          const store = colName === 'reports' ? reportsDb : statusHistoryStore;
          return store[docId]
            ? { exists: true, id: docId, data: () => store[docId] }
            : { exists: false, id: docId, data: () => undefined };
        },
        set: async (data: any) => {
          const store = colName === 'reports' ? reportsDb : statusHistoryStore;
          store[docId] = { ...(store[docId] || {}), ...data };
        },
        collection: (subName: string) => ({
          doc: (subId: string) => ({
            get: async () => {
              const ev = subName === 'evidence' ? evidenceDb[docId]?.[subId] : undefined;
              return ev
                ? { exists: true, id: subId, data: () => ev }
                : { exists: false, id: subId, data: () => undefined };
            },
          }),
        }),
      }),
    }),
  };

  let attemptNumber = 0;
  const app = createApiApp({
    forceSkipAuthCheck: false,
    geminiApiKey: 'test-key-retry-503',
    geminiFallbackModel: 'gemini-3.7-flash',
    geminiMaxRetries: 2,
    geminiRetryBaseDelayMs: 0,
    aiClientFactory: () => ({
      models: {
        list: makeMockModelList([
          { name: 'gemini-3.8-flash', supportedActions: ['generateContent'] },
          { name: 'gemini-3.7-flash', supportedActions: ['generateContent'] },
        ]),
        generateContent: async () => {
          attemptNumber += 1;
          // Fails on all 4 attempts during 1st retry-ai call; succeeds when retried later
          if (attemptNumber <= 4) {
            throw Object.assign(new Error('503: The model is currently experiencing high demand.'), { status: 503 });
          }
          return {
            text: JSON.stringify({
              hasVisibleFlooding: true,
              confidenceScore: 89.5,
              assessment: 'Possible Flooding Detected',
              observedWaterLevel: 'High',
              observedAccessibility: 'Partially Blocked',
              detailedExplanation: 'Subsequent retry succeeded once capacity returned.',
              uncertaintyNotes: 'None.',
            }),
          };
        },
      },
    }),
    adminOverride: {
      verifyIdToken: async () => ({ uid: 'citizen-owner', role: 'citizen' }),
      firestore: mockFirestore,
    },
  });

  const srv = http.createServer(app);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const baseUrl = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;

  try {
    // 1. First retry fails with repeated 503 -> existing report remains saved, FAILED recorded cleanly, no duplicates
    const failRes = await fetch(`${baseUrl}/api/reports/REP-503-SAVE-1/retry-ai`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-owner' },
    });
    assert.equal(failRes.status, 200);
    const failBody = await failRes.json();
    assert.equal(failBody.ok, true);
    assert.equal(failBody.aiSucceeded, false);
    assert.equal(failBody.diagnosticCode, 'UPSTREAM_UNAVAILABLE');
    assert.equal(failBody.upstreamStatus, 503);
    assert.equal(Object.keys(reportsDb).length, 1);
    assert.equal(reportsDb['REP-503-SAVE-1'].id, 'REP-503-SAVE-1');
    assert.equal(reportsDb['REP-503-SAVE-1'].aiStatus, 'FAILED');
    assert.equal(reportsDb['REP-503-SAVE-1'].verificationStatus, 'UNDER REVIEW');
    assert.equal(reportsDb['REP-503-SAVE-1'].incidentStatus, 'Submitted');
    assert.equal(reportsDb['REP-503-SAVE-1'].aiVerificationDetails.diagnosticCode, 'UPSTREAM_UNAVAILABLE');
    assert.equal(reportsDb['REP-503-SAVE-1'].aiVerificationDetails.upstreamStatus, 503);
    assert.ok(evidenceDb['REP-503-SAVE-1'].primary.base64Data, 'Evidence photo must remain intact');

    // 2. Subsequent retry-ai processes the SAME report & image and succeeds without auto-verifying
    const recoverRes = await fetch(`${baseUrl}/api/reports/REP-503-SAVE-1/retry-ai`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-owner' },
    });
    assert.equal(recoverRes.status, 200);
    const recoverBody = await recoverRes.json();
    assert.equal(recoverBody.aiSucceeded, true);
    assert.equal(Object.keys(reportsDb).length, 1);
    assert.equal(reportsDb['REP-503-SAVE-1'].aiStatus, 'COMPLETED');
    assert.equal(reportsDb['REP-503-SAVE-1'].aiConfidence, 89.5);
    assert.equal(reportsDb['REP-503-SAVE-1'].verificationStatus, 'UNDER REVIEW');
  } finally {
    await new Promise<void>((r) => srv.close(() => r()));
  }
});





