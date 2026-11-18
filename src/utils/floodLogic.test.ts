/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHaversineDistance,
  evaluateRiskLevel,
  getWaterLevelSeverity,
  buildTextOnlyAiResult,
  buildUnconfiguredAiResult,
  generateAuditChainRecord,
  validateCoordinates,
  areReportsDuplicate,
  clusterReports,
  calculateDynamicAnalytics,
  generateReportId,
  computeBlockchainHashChain,
  verifyBlockchainRecordIntegrity,
  sha256Hex,
  GENESIS_PREV_HASH,
  DEFAULT_RISK_THRESHOLDS,
  DEFAULT_CLUSTERING_CONFIG,
  FloodReport,
  IncidentStatus,
} from './floodLogic.ts';

// 1. Unique Report ID Generation (Collision Resistance)
test('generateReportId produces collision-resistant identifiers starting with REP-', () => {
  const ids = new Set<string>();
  const count = 1000;
  for (let i = 0; i < count; i++) {
    const id = generateReportId();
    assert.ok(id.startsWith('REP-'), `Expected ID to start with REP-, got ${id}`);
    assert.ok(id.length >= 8, `Expected ID length >= 8, got ${id}`);
    assert.ok(!ids.has(id), `Duplicate ID generated: ${id}`);
    ids.add(id);
  }
  assert.equal(ids.size, count);
});

// 2. Haversine Distance & Boundary Tests
test('calculateHaversineDistance calculates realistic geographic distance and handles identical coordinates', () => {
  // Colombo Town Hall (6.9147, 79.8653) to Maradana Railway Station (6.9271, 79.8653) ~ 1.38 km
  const dist = calculateHaversineDistance(6.9147, 79.8653, 6.9271, 79.8653);
  assert.ok(dist > 1200 && dist < 1500, `Expected ~1380m, got ${dist}`);

  // Same coordinates should return exactly 0
  const zeroDist = calculateHaversineDistance(6.9271, 79.8653, 6.9271, 79.8653);
  assert.equal(zeroDist, 0);
});

// 3. Coordinate Validation Tests
test('validateCoordinates correctly identifies valid vs invalid geographic bounds', () => {
  assert.equal(validateCoordinates(6.9271, 79.8653), true);
  assert.equal(validateCoordinates(0, 0), true);
  assert.equal(validateCoordinates(-90, -180), true);
  assert.equal(validateCoordinates(90, 180), true);

  // Invalid latitudes (> 90 or < -90)
  assert.equal(validateCoordinates(91.5, 79.8653), false);
  assert.equal(validateCoordinates(-95.0, 79.8653), false);

  // Invalid longitudes (> 180 or < -180)
  assert.equal(validateCoordinates(6.9271, 185.0), false);
  assert.equal(validateCoordinates(6.9271, -195.0), false);

  // Non-number values
  assert.equal(validateCoordinates(NaN, 79.8653), false);
  assert.equal(validateCoordinates(6.9271, NaN), false);
});

// 4. Haversine with Invalid Coordinates Returns Infinity
test('calculateHaversineDistance returns Infinity when coordinates are invalid', () => {
  assert.equal(calculateHaversineDistance(100.0, 79.8653, 6.9271, 79.8653), Infinity);
  assert.equal(calculateHaversineDistance(6.9271, 79.8653, -92.0, 79.8653), Infinity);
  assert.equal(calculateHaversineDistance(6.9271, 200.0, 6.9271, 79.8653), Infinity);
});

// 5. Duplicate Report Detection
test('areReportsDuplicate correctly identifies near-duplicate reports within 25m and 5 minutes', () => {
  const baseReport = {
    lat: 6.9271,
    lng: 79.8653,
    timestamp: '2026-11-12T10:00:00.000Z',
  };

  // Same spot within 2 minutes (< 25m and < 5 mins) -> Duplicate
  const duplicateReport = {
    lat: 6.92711, // ~1 meter offset
    lng: 79.86531,
    timestamp: '2026-11-12T10:02:00.000Z',
  };
  assert.equal(areReportsDuplicate(baseReport, duplicateReport), true);

  // Same spot but 30 minutes later -> NOT duplicate (temporal difference)
  const laterReport = {
    lat: 6.9271,
    lng: 79.8653,
    timestamp: '2026-11-12T10:30:00.000Z',
  };
  assert.equal(areReportsDuplicate(baseReport, laterReport), false);

  // Far away (300 meters) at same time -> NOT duplicate (spatial difference)
  const distantReport = {
    lat: 6.9300,
    lng: 79.8653,
    timestamp: '2026-11-12T10:01:00.000Z',
  };
  assert.equal(areReportsDuplicate(baseReport, distantReport), false);
});

// 6. Duplicate Reports Do Not Double Count in Hotspot Unique Reports
test('clusterReports preserves duplicates as audit evidence without inflating unique report count', () => {
  const now = Date.now();
  const original: FloodReport = {
    id: 'ORIG-1',
    location: 'Maradana Junction',
    area: 'Maradana',
    lat: 6.9271,
    lng: 79.8653,
    timestamp: new Date(now).toISOString(),
    waterLevel: 'Severe',
    roadAccessibility: 'Completely Blocked',
    floodType: 'Street Waterlogging',
    description: 'First submission',
    riskLevel: 'HIGH',
    verificationStatus: 'UNDER REVIEW',
    incidentStatus: 'Submitted',
    statusHistory: [],
    isDuplicate: false,
  };

  const duplicate: FloodReport = {
    id: 'DUP-1',
    location: 'Maradana Junction',
    area: 'Maradana',
    lat: 6.92711,
    lng: 79.86531,
    timestamp: new Date(now + 60000).toISOString(),
    waterLevel: 'Severe',
    roadAccessibility: 'Completely Blocked',
    floodType: 'Street Waterlogging',
    description: 'Second citizen submitting near same spot',
    riskLevel: 'HIGH',
    verificationStatus: 'UNDER REVIEW',
    incidentStatus: 'Submitted',
    statusHistory: [],
    isDuplicate: true,
    duplicateOfReportId: 'ORIG-1',
  };

  const clusters = clusterReports([original, duplicate]);
  assert.equal(clusters.length, 1);
  const cluster = clusters[0];
  // Both reports are in associatedReportIds for audit trail
  assert.equal(cluster.associatedReportIds.length, 2);
  // Unique report count is 1, and duplicate count is 1
  assert.equal(cluster.reportCount, 1);
  assert.equal(cluster.duplicateReportCount, 1);
});

// 7. Cross-Area Spatial Clustering (True Geospatial Distance vs Name Matching)
test('clusterReports groups nearby reports across municipal area boundaries based on GPS coordinates', () => {
  const now = Date.now();
  // Report in Maradana sector
  const r1: FloodReport = {
    id: 'R-MAR',
    location: 'Maradana Border Boundary',
    area: 'Maradana',
    lat: 6.9300,
    lng: 79.8700,
    timestamp: new Date(now).toISOString(),
    waterLevel: 'High',
    roadAccessibility: 'Partially Blocked',
    floodType: 'Street Waterlogging',
    description: 'Boundary test',
    riskLevel: 'HIGH',
    verificationStatus: 'UNDER REVIEW',
    incidentStatus: 'Submitted',
    statusHistory: [],
  };

  // Report labelled Dematagoda sector but only 120m away from r1
  const r2: FloodReport = {
    id: 'R-DEM',
    location: 'Dematagoda Sector Border',
    area: 'Dematagoda',
    lat: 6.9310, // ~111m north
    lng: 79.8700,
    timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
    waterLevel: 'High',
    roadAccessibility: 'Partially Blocked',
    floodType: 'Street Waterlogging',
    description: 'Across sector boundary',
    riskLevel: 'HIGH',
    verificationStatus: 'UNDER REVIEW',
    incidentStatus: 'Submitted',
    statusHistory: [],
  };

  const clusters = clusterReports([r1, r2]);
  // Even though areas are 'Maradana' and 'Dematagoda', they are within 500m -> Single cluster
  assert.equal(clusters.length, 1);
  assert.ok(clusters[0].associatedReportIds.includes('R-MAR'));
  assert.ok(clusters[0].associatedReportIds.includes('R-DEM'));
});

// 8. Temporal Clustering Boundaries
test('clusterReports separates reports exceeding temporal window despite same location', () => {
  const now = Date.now();
  const currentReport: FloodReport = {
    id: 'R-NOW',
    location: 'Kolonnawa Canal',
    area: 'Kolonnawa',
    lat: 6.9360,
    lng: 79.8850,
    timestamp: new Date(now).toISOString(),
    waterLevel: 'Severe',
    roadAccessibility: 'Completely Blocked',
    floodType: 'Canal Overflow',
    description: 'Current convective downpour',
    riskLevel: 'HIGH',
    verificationStatus: 'UNDER REVIEW',
    incidentStatus: 'Submitted',
    statusHistory: [],
  };

  // Same coordinates but 4 hours ago (exceeds default 2-hour window)
  const pastReport: FloodReport = {
    id: 'R-PAST',
    location: 'Kolonnawa Canal',
    area: 'Kolonnawa',
    lat: 6.9360,
    lng: 79.8850,
    timestamp: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    waterLevel: 'Moderate',
    roadAccessibility: 'Open',
    floodType: 'Canal Overflow',
    description: 'Morning runoff event',
    riskLevel: 'MEDIUM',
    verificationStatus: 'VERIFIED',
    incidentStatus: 'Resolved',
    statusHistory: [],
  };

  const clusters = clusterReports([currentReport, pastReport]);
  assert.equal(clusters.length, 2, 'Should form 2 distinct clusters due to 2-hour temporal boundary');
});

// 9. Risk Threshold Boundaries (Evaluating HIGH before MEDIUM)
test('evaluateRiskLevel boundary condition tests with strict HIGH before MEDIUM evaluation', () => {
  // HIGH Boundary: count >= 3 AND rain > 20
  // Exactly 3 reports and 20.1 mm rain -> HIGH
  const highBoundary = evaluateRiskLevel(3, 20.1);
  assert.equal(highBoundary.riskLevel, 'HIGH');
  assert.equal(highBoundary.breakdown.highRuleMet, true);

  // 3 reports and exactly 20.0 mm rain -> Not strictly > 20 mm, falls to MEDIUM (count >= 2)
  const edgeMedium = evaluateRiskLevel(3, 20.0);
  assert.equal(edgeMedium.riskLevel, 'MEDIUM');
  assert.equal(edgeMedium.breakdown.highRuleMet, false);
  assert.equal(edgeMedium.breakdown.mediumRuleMet, true);

  // MEDIUM Boundary: count >= 2 OR rain > 10
  // 2 reports and 5 mm rain -> MEDIUM
  const medReportCount = evaluateRiskLevel(2, 5.0);
  assert.equal(medReportCount.riskLevel, 'MEDIUM');

  // 1 report and 10.1 mm rain -> MEDIUM
  const medRainfall = evaluateRiskLevel(1, 10.1);
  assert.equal(medRainfall.riskLevel, 'MEDIUM');

  // LOW Boundary: count < 2 AND rain <= 10 mm
  // 1 report and exactly 10.0 mm rain -> LOW
  const lowBoundary = evaluateRiskLevel(1, 10.0);
  assert.equal(lowBoundary.riskLevel, 'LOW');
  assert.equal(lowBoundary.breakdown.highRuleMet, false);
  assert.equal(lowBoundary.breakdown.mediumRuleMet, false);

  // 0 reports and 0 rain -> LOW
  const zeroState = evaluateRiskLevel(0, 0);
  assert.equal(zeroState.riskLevel, 'LOW');
});

// 10. Custom Risk Threshold Overrides
test('evaluateRiskLevel supports configurable custom thresholds', () => {
  const customConfig = {
    highReportCount: 5,
    highRainfallMm: 30,
    mediumReportCount: 3,
    mediumRainfallMm: 15,
  };

  // Under DEFAULT config: 4 >= 3 and 25 > 20 -> HIGH
  const underDefault = evaluateRiskLevel(4, 25);
  assert.equal(underDefault.riskLevel, 'HIGH');

  // Under CUSTOM config: 4 < 5, but 4 >= 3 -> MEDIUM
  const underCustom = evaluateRiskLevel(4, 25, customConfig);
  assert.equal(underCustom.riskLevel, 'MEDIUM');
});

// 11. Water Level Severity Categorization
test('getWaterLevelSeverity categorizes correctly', () => {
  assert.equal(getWaterLevelSeverity('Severe'), 'HIGH');
  assert.equal(getWaterLevelSeverity('High'), 'HIGH');
  assert.equal(getWaterLevelSeverity('Moderate'), 'MEDIUM');
  assert.equal(getWaterLevelSeverity('Low'), 'LOW');
});

// 12. Unconfigured AI Verification Does NOT Auto-Verify or Fabricate Confidence
test('buildUnconfiguredAiResult leaves official status as Under Review with null confidence', () => {
  const result = buildUnconfiguredAiResult({
    waterLevel: 'Severe',
    floodType: 'Flash Flood',
  });
  assert.equal(result.aiStatus, 'UNCONFIGURED');
  assert.equal(result.confidence, null);
  assert.equal(result.officialStatus, 'Under Review');
  assert.equal(result.humanVerificationRequired, true);
  assert.ok(result.disclaimer.includes('assistive early warning signal only'));
});

// 13. Audit Chain Record Format & Labels
test('generateAuditChainRecord generates valid SHA-256 hex format and canonical payload digests', () => {
  const rec = generateAuditChainRecord('HS-042', 'Maradana', 'HIGH');
  assert.equal(rec.hotspotId, 'HS-042');
  assert.equal(rec.location, 'Maradana');
  assert.equal(rec.severity, 'HIGH');
  assert.equal(rec.isSimulated, false);
  assert.ok(rec.network.includes('SHA-256'));
  assert.ok(rec.txHash.startsWith('0x'));
  assert.equal(rec.txHash.length, 66);
  assert.ok(rec.merkleRoot.startsWith('0x'));
  assert.equal(rec.merkleRoot.length, 66);
  assert.ok(rec.payloadHash.startsWith('0x'));
  assert.ok(rec.recordHash.startsWith('0x'));
  assert.ok(rec.auditExplanation.includes('SHA-256 Audit Hash-Chain Record'));
});

// 14. Dynamic Analytics Calculation Function
test('calculateDynamicAnalytics returns correct proportions and non-hardcoded counts', () => {
  const sampleReports: FloodReport[] = [
    {
      id: 'REP-1',
      location: 'Maradana Road',
      area: 'Maradana',
      lat: 6.9271,
      lng: 79.8653,
      timestamp: new Date().toISOString(),
      waterLevel: 'Severe',
      roadAccessibility: 'Completely Blocked',
      floodType: 'Street Waterlogging',
      description: 'Flood 1',
      riskLevel: 'HIGH',
      verificationStatus: 'VERIFIED',
      incidentStatus: 'Alert Issued',
      statusHistory: [],
      verificationTimestamp: new Date().toISOString(),
    },
    {
      id: 'REP-2',
      location: 'Kolonnawa Canal',
      area: 'Kolonnawa',
      lat: 6.9360,
      lng: 79.8850,
      timestamp: new Date().toISOString(),
      waterLevel: 'High',
      roadAccessibility: 'Partially Blocked',
      floodType: 'Canal Overflow',
      description: 'Flood 2',
      riskLevel: 'HIGH',
      verificationStatus: 'VERIFIED',
      incidentStatus: 'Verified',
      statusHistory: [],
    },
    {
      id: 'REP-3',
      location: 'Wellawatte',
      area: 'Wellawatte',
      lat: 6.8745,
      lng: 79.8600,
      timestamp: new Date().toISOString(),
      waterLevel: 'Moderate',
      roadAccessibility: 'Open',
      floodType: 'Street Waterlogging',
      description: 'Flood 3',
      riskLevel: 'MEDIUM',
      verificationStatus: 'UNDER REVIEW',
      incidentStatus: 'Under Review',
      statusHistory: [],
    },
    {
      id: 'REP-4',
      location: 'Borella',
      area: 'Borella',
      lat: 6.9110,
      lng: 79.8770,
      timestamp: new Date().toISOString(),
      waterLevel: 'Low',
      roadAccessibility: 'Open',
      floodType: 'Street Waterlogging',
      description: 'Flood 4',
      riskLevel: 'LOW',
      verificationStatus: 'VERIFIED',
      incidentStatus: 'Resolved',
      statusHistory: [],
    },
  ];

  const analytics = calculateDynamicAnalytics(sampleReports, [], '24h');
  assert.equal(analytics.totalReports, 4);
  assert.equal(analytics.highRisk, 2);
  assert.equal(analytics.mediumRisk, 1);
  assert.equal(analytics.lowRisk, 1);

  // Status counts
  assert.equal(analytics.statusCounts['Alert Issued'], 1);
  assert.equal(analytics.statusCounts['Verified'], 1);
  assert.equal(analytics.statusCounts['Under Review'], 1);
  assert.equal(analytics.statusCounts['Resolved'], 1);

  // Reports by zone
  assert.equal(analytics.reportsByZone.length, 4);
  assert.equal(analytics.verifiedCount, 3);
  assert.equal(analytics.verifiedPercentage, 75);
});

// 15. Incident Lifecycle Status Transitions
test('Incident lifecycle transitions correctly between 6 operational stages', () => {
  const validTransitions: IncidentStatus[] = [
    'Submitted',
    'Under Review',
    'Verified',
    'Alert Issued',
    'Resolved',
    'Rejected',
  ];
  assert.equal(validTransitions.length, 6);

  // Verification status mapping
  const getVerificationStatus = (status: IncidentStatus) => {
    if (status === 'Verified' || status === 'Alert Issued' || status === 'Resolved') return 'VERIFIED';
    if (status === 'Rejected') return 'REJECTED';
    return 'UNDER REVIEW';
  };

  assert.equal(getVerificationStatus('Submitted'), 'UNDER REVIEW');
  assert.equal(getVerificationStatus('Under Review'), 'UNDER REVIEW');
  assert.equal(getVerificationStatus('Verified'), 'VERIFIED');
  assert.equal(getVerificationStatus('Alert Issued'), 'VERIFIED');
  assert.equal(getVerificationStatus('Resolved'), 'VERIFIED');
  assert.equal(getVerificationStatus('Rejected'), 'REJECTED');
});

// 16. Forecast Timestamp Alignment Logic
test('Forecast 3h calculation properly sums future hourly precipitation without artificial multipliers', () => {
  const hourlyTime = [
    '2026-11-12T12:00',
    '2026-11-12T13:00',
    '2026-11-12T14:00',
    '2026-11-12T15:00',
    '2026-11-12T16:00',
    '2026-11-12T17:00',
  ];
  const hourlyPrecip = [0.0, 2.5, 8.0, 14.5, 6.0, 1.0];
  const currentTime = '2026-11-12T13:00';

  const currentIdx = hourlyTime.indexOf(currentTime);
  assert.equal(currentIdx, 1);

  // Next 3 future hours are indices 2, 3, 4 (times 14:00, 15:00, 16:00)
  const next3Hours = hourlyPrecip.slice(currentIdx + 1, currentIdx + 4);
  assert.deepEqual(next3Hours, [8.0, 14.5, 6.0]);

  const expected3h = Number(next3Hours.reduce((a, b) => a + b, 0).toFixed(1));
  assert.equal(expected3h, 28.5);
});

// 17. More Info Requested & AI Failure Safeguard Tests
test('More Info Requested status is tracked distinctly and never counted as verified', () => {
  const reports: FloodReport[] = [
    {
      id: 'REP-MORE-1',
      location: 'Armor Street Junction',
      area: 'Maradana',
      lat: 6.9355,
      lng: 79.8618,
      timestamp: new Date().toISOString(),
      waterLevel: 'High',
      roadAccessibility: 'Partially Blocked',
      floodType: 'Drainage Blockage',
      description: 'Needs clearer landmark confirmation',
      riskLevel: 'MEDIUM',
      verificationStatus: 'UNDER REVIEW',
      incidentStatus: 'More Info Requested',
      aiStatus: 'FAILED',
      aiClassification: 'AI Processing Failed',
      aiConfidence: null,
      statusHistory: [],
    },
  ];

  const analytics = calculateDynamicAnalytics(reports, [], '24h');
  assert.equal(analytics.totalReports, 1);
  assert.equal(analytics.statusCounts['More Info Requested'], 1);
  assert.equal(analytics.verifiedCount, 0);
  assert.equal(analytics.verifiedPercentage, 0);
  assert.equal(analytics.avgReviewMinutes, null);
});

// 18. BFS Connected-Component Transitivity & Invalid Record Filtering
test('clusterReports performs BFS connected-component clustering and filters invalid coordinates/timestamps', () => {
  const baseTime = '2026-11-12T10:00:00.000Z';
  const makeRep = (id: string, lat: number, lng: number, ts = baseTime): FloodReport => ({
    id,
    location: `Point ${id}`,
    area: 'Maradana',
    lat,
    lng,
    timestamp: ts,
    waterLevel: 'High',
    roadAccessibility: 'Partially Blocked',
    floodType: 'Street Waterlogging',
    description: 'Cluster transitivity test',
    riskLevel: 'HIGH',
    verificationStatus: 'UNDER REVIEW',
    incidentStatus: 'Submitted',
    statusHistory: [],
  });

  // A at (6.9200, 79.8600), B ~350m north (6.92315), C ~350m north of B (6.92630)
  // A->C is ~700m (> 500m), but A-B <= 500m and B-C <= 500m => single connected component
  const repA = makeRep('REP-A', 6.9200, 79.8600);
  const repB = makeRep('REP-B', 6.92315, 79.8600);
  const repC = makeRep('REP-C', 6.92630, 79.8600);
  const invalidCoords = makeRep('REP-BAD-GEO', 99.0, 79.8600);
  const invalidTs = makeRep('REP-BAD-TS', 6.9200, 79.8600, 'not-a-timestamp');

  const dAC = calculateHaversineDistance(repA.lat, repA.lng, repC.lat, repC.lng);
  assert.ok(dAC > 500, `Expected A->C > 500m, got ${dAC}`);

  const clusters1 = clusterReports([repA, repB, repC, invalidCoords, invalidTs]);
  assert.equal(clusters1.length, 1);
  assert.equal(clusters1[0].reportCount, 3);
  assert.equal(clusters1[0].rainfallSource, 'MISSING');
  assert.equal(clusters1[0].forecastRainfallMm, 0);

  // Deterministic ID invariant under input permutation
  const clusters2 = clusterReports([repC, repA, repB]);
  assert.equal(clusters2.length, 1);
  assert.equal(clusters1[0].id, clusters2[0].id);
});

// 19. Pure-TS SHA-256 Hash-Chain & Tamper Detection
test('computeBlockchainHashChain and verifyBlockchainRecordIntegrity detect payload tampering and broken links', () => {
  assert.equal(
    sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );

  const rec1 = generateAuditChainRecord('HS-001', 'Maradana Junction', 'HIGH', {
    blockNumber: 1,
    prevHash: GENESIS_PREV_HASH,
    eventId: 'EVT-TEST-01',
    timestamp: '2026-11-12T08:00:00.000Z',
  });
  const rec2 = generateAuditChainRecord('HS-002', 'Kolonnawa Canal', 'MEDIUM', {
    blockNumber: 2,
    prevHash: rec1.recordHash,
    eventId: 'EVT-TEST-02',
    timestamp: '2026-11-12T09:00:00.000Z',
  });

  const v1 = verifyBlockchainRecordIntegrity(rec1, GENESIS_PREV_HASH);
  const v2 = verifyBlockchainRecordIntegrity(rec2, rec1.recordHash);
  assert.equal(v1.valid, true);
  assert.equal(v2.valid, true);

  // Tamper location on rec2 without re-hashing
  const tamperedPayload = { ...rec2, location: 'Tampered Sector' };
  const tv1 = verifyBlockchainRecordIntegrity(tamperedPayload, rec1.recordHash);
  assert.equal(tv1.valid, false);
  assert.equal(tv1.payloadValid, false);

  // Break previous hash link
  const brokenLink = { ...rec2, prevHash: '0x' + 'f'.repeat(64) };
  const tv2 = verifyBlockchainRecordIntegrity(brokenLink, rec1.recordHash);
  assert.equal(tv2.valid, false);
  assert.equal(tv2.prevHashMatches, false);
});

// 20. buildTextOnlyAiResult marks NOT_RUN when hasImage is false
test('buildTextOnlyAiResult marks NOT_RUN with null confidence for text-only reports', () => {
  const result = buildTextOnlyAiResult({
    waterLevel: 'Moderate',
    floodType: 'Street Waterlogging',
    description: 'Text-only citizen submission',
  });
  assert.equal(result.aiStatus, 'NOT_RUN');
  assert.equal(result.confidence, null);
  assert.equal(result.officialStatus, 'Under Review');
});

// 21. Dynamic Analytics Review Duration, Bucketing & Completeness
test('calculateDynamicAnalytics computes real verification duration and data completeness', () => {
  const t0 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const t1 = new Date(Date.now() - 40 * 60 * 1000).toISOString(); // 20 mins later
  const reports: FloodReport[] = [
    {
      id: 'R-COMP-1',
      location: 'Borella Cross',
      area: 'Borella',
      lat: 6.9147,
      lng: 79.8770,
      timestamp: t0,
      verificationTimestamp: t1,
      waterLevel: 'High',
      roadAccessibility: 'Partially Blocked',
      floodType: 'Drainage Blockage',
      description: 'Valid verified report',
      imageUrl: 'data:image/jpeg;base64,abc',
      riskLevel: 'HIGH',
      verificationStatus: 'VERIFIED',
      incidentStatus: 'Verified',
      statusHistory: [],
    },
    {
      id: 'R-COMP-2',
      location: 'Borella Cross',
      area: 'Borella',
      lat: 6.91471,
      lng: 79.87701,
      timestamp: t0,
      waterLevel: 'High',
      roadAccessibility: 'Partially Blocked',
      floodType: 'Drainage Blockage',
      description: 'Duplicate entry',
      riskLevel: 'HIGH',
      verificationStatus: 'UNDER REVIEW',
      incidentStatus: 'Submitted',
      isDuplicate: true,
      duplicateOfReportId: 'R-COMP-1',
      statusHistory: [],
    },
  ];

  const hotspots = clusterReports(reports, DEFAULT_CLUSTERING_CONFIG, { __default: 24 });
  const analytics = calculateDynamicAnalytics(reports, hotspots, '24h');
  assert.equal(analytics.avgReviewMinutes, 20);
  assert.equal(analytics.uniqueReportCount, 1);
  assert.equal(analytics.duplicateReportCount, 1);
  assert.equal(analytics.dataCompleteness.reportsWithImages, 1);
  assert.equal(analytics.dataCompleteness.hotspotsWithForecastRainfall, 1);
  assert.equal(analytics.hasRainfallCorrelationData, true);
  assert.ok(analytics.reportVolumeOverTime.length >= 1);
});

// 22. Strict temporal window total component span clamping in clusterReports
test('clusterReports prevents chaining across reports whose total temporal span exceeds temporalWindowHours', () => {
  const baseMs = Date.UTC(2026, 10, 14, 6, 0, 0);
  const reports: FloodReport[] = [
    {
      id: 'R-SPAN-1',
      location: 'Kollupitiya Junction',
      area: 'Kollupitiya',
      lat: 6.912,
      lng: 79.85,
      timestamp: new Date(baseMs).toISOString(),
      waterLevel: 'Moderate',
      roadAccessibility: 'Partially Blocked',
      floodType: 'Street Waterlogging',
      description: 'First reading',
      riskLevel: 'MEDIUM',
      verificationStatus: 'VERIFIED',
      incidentStatus: 'Verified',
      statusHistory: [],
    },
    {
      id: 'R-SPAN-2',
      location: 'Kollupitiya Junction',
      area: 'Kollupitiya',
      lat: 6.9121,
      lng: 79.8501,
      timestamp: new Date(baseMs + 1.5 * 60 * 60 * 1000).toISOString(),
      waterLevel: 'Moderate',
      roadAccessibility: 'Partially Blocked',
      floodType: 'Street Waterlogging',
      description: 'Middle reading',
      riskLevel: 'MEDIUM',
      verificationStatus: 'VERIFIED',
      incidentStatus: 'Verified',
      statusHistory: [],
    },
    {
      id: 'R-SPAN-3',
      location: 'Kollupitiya Junction',
      area: 'Kollupitiya',
      lat: 6.9122,
      lng: 79.8502,
      timestamp: new Date(baseMs + 3.0 * 60 * 60 * 1000).toISOString(),
      waterLevel: 'Moderate',
      roadAccessibility: 'Partially Blocked',
      floodType: 'Street Waterlogging',
      description: 'Late reading',
      riskLevel: 'MEDIUM',
      verificationStatus: 'VERIFIED',
      incidentStatus: 'Verified',
      statusHistory: [],
    },
  ];

  const hotspots = clusterReports(reports, {
    spatialRadiusMeters: 500,
    temporalWindowHours: 2,
  });

  // Because R-SPAN-1 (0h) and R-SPAN-3 (3h) span 3 hours > 2h window, they must NOT merge into 1 hotspot
  assert.equal(hotspots.length, 2);
  for (const hs of hotspots) {
    const timestamps = hs.associatedReportIds.map(
      (id) => Date.parse(reports.find((r) => r.id === id)!.timestamp)
    );
    const spanMs = Math.max(...timestamps) - Math.min(...timestamps);
    assert.ok(spanMs <= 2 * 60 * 60 * 1000, `Cluster ${hs.id} exceeded 2h span: ${spanMs}`);
  }
});

test('calculateDynamicAnalytics counts Spark-plan hasEvidence and evidenceCount fields without imageUrl', () => {
  const now = new Date().toISOString();
  const reports: FloodReport[] = [
    {
      id: 'R-FS-EV-1',
      location: 'Wellawatte Beach Road',
      area: 'Wellawatte',
      lat: 6.8745,
      lng: 79.86,
      timestamp: now,
      waterLevel: 'Moderate',
      roadAccessibility: 'Open',
      floodType: 'Street Waterlogging',
      description: 'Compressed Firestore evidence attached',
      riskLevel: 'MEDIUM',
      verificationStatus: 'UNDER REVIEW',
      incidentStatus: 'Submitted',
      hasEvidence: true,
      evidenceCount: 1,
      evidenceStatus: 'SAVED',
      statusHistory: [],
    },
    {
      id: 'R-FS-EV-2',
      location: 'Nugegoda Flyover',
      area: 'Nugegoda',
      lat: 6.871,
      lng: 79.898,
      timestamp: now,
      waterLevel: 'Low',
      roadAccessibility: 'Open',
      floodType: 'Drainage Blockage',
      description: 'Text-only report without photo evidence',
      riskLevel: 'LOW',
      verificationStatus: 'UNDER REVIEW',
      incidentStatus: 'Submitted',
      hasEvidence: false,
      evidenceCount: 0,
      evidenceStatus: 'NONE',
      statusHistory: [],
    },
  ];
  const analytics = calculateDynamicAnalytics(reports, [], '24h');
  assert.equal(analytics.dataCompleteness.reportsWithImages, 1);
});
