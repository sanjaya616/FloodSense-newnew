/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type IncidentStatus =
  | 'Submitted'
  | 'Under Review'
  | 'More Info Requested'
  | 'Verified'
  | 'Alert Issued'
  | 'Resolved'
  | 'Rejected';

export interface StatusHistoryEntry {
  status: IncidentStatus;
  timestamp: string; // ISO string
  authorName: string;
  note?: string;
}

export type AiStatus = 'NOT_RUN' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNCONFIGURED';

export interface AiVerificationDetails {
  method: string;
  modelName?: string;
  aiStatus?: AiStatus;
  hasVisibleFlooding?: boolean;
  aiAssessment?:
    | 'Possible Flooding Detected'
    | 'No Clear Flooding Detected'
    | 'Uncertain Image'
    | 'Invalid or Unusable Photograph'
    | 'AI Processing Failed'
    | 'AI Not Run (No Image)'
    | 'Uncertain'
    | 'Simulation Result'
    | string;
  officialStatus?: 'Under Review' | string;
  confidence: number | null;
  explanation: string;
  uncertainty?: string;
  waterLevelEstimated?: string;
  roadAccessibilityEstimated?: string;
  humanVerificationRequired: boolean;
  timestamp: string;
  disclaimer: string;
  assessment?: string;
  status?: string;
}

export interface FloodReport {
  id: string;
  submissionRequestId?: string;
  hotspotId?: string;
  location: string;
  area: 'Maradana' | 'Wellawatte' | 'Borella' | 'Kolonnawa' | 'Dematagoda' | 'Nugegoda' | string;
  lat: number;
  lng: number;
  timestamp: string; // ISO string
  waterLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
  roadAccessibility: 'Open' | 'Partially Blocked' | 'Completely Blocked';
  floodType: 'Flash Flood' | 'Street Waterlogging' | 'Canal Overflow' | 'Drainage Blockage';
  description: string;
  additionalObservations?: string;
  imageUrl?: string; // Legacy in-memory only; never persisted to Firestore
  hasEvidence?: boolean;
  evidenceCount?: number;
  primaryEvidenceId?: string;
  evidenceStatus?: 'NONE' | 'SAVED' | 'FAILED';
  evidenceError?: string;
  duplicateCheckStatus?: 'VERIFIED_CITYWIDE' | 'LOCAL_ONLY' | 'UNAVAILABLE';
  reporterName?: string;
  reporterPhone?: string;
  reporterEmail?: string;
  reporterId?: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  verificationStatus: 'VERIFIED' | 'UNDER REVIEW' | 'REJECTED';
  incidentStatus: IncidentStatus;
  statusHistory: StatusHistoryEntry[];
  officerNotes?: string[];
  verificationTimestamp?: string;
  verifiedBy?: string;
  aiConfidence?: number | null;
  aiClassification?: string;
  aiStatus?: AiStatus;
  aiVerificationDetails?: AiVerificationDetails;
  isDuplicate?: boolean;
  duplicateOfReportId?: string;
  duplicateCount?: number;
  publicSyncStatus?: 'PENDING' | 'SYNCED' | 'FAILED';
  publicSyncError?: string;
  coordinatePrecision?: 'EXACT' | 'APPROX_100M_GRID' | string;
  isPublicRedacted?: boolean;
}

export interface ReportEvidenceRecord {
  id: string;
  reportId: string;
  ownerUid: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64Data: string;
  fileName: string;
  byteSize: number;
  width: number;
  height: number;
  createdAt: string;
}

export interface FloodHotspot {
  id: string;
  location: string;
  area: string;
  lat: number;
  lng: number;
  reportCount: number; // Unique non-duplicate reports
  totalRecordCount?: number; // Unique + duplicate records
  duplicateReportCount?: number;
  independentConfirmations?: number;
  firstReportedTime: string;
  latestReportedTime: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number; // 0 - 100
  forecastRainfallMm: number; // next 3 hours
  rainfallSource?: 'FORECAST' | 'AREA_OVERRIDE' | 'MISSING';
  verificationStatus: 'VERIFIED' | 'UNDER REVIEW';
  precaution: string;
  associatedReportIds: string[];
  clusterRadiusMeters?: number;
  formationDetails?: {
    timeSpanMinutes: number;
    activeWindowHours: number;
    spatialRadiusMeters: number;
    centerLat: number;
    centerLng: number;
    reasoning: string;
  };
}

export interface BlockchainRecord {
  eventId: string;
  hotspotId: string;
  location: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  txHash: string;
  blockNumber: number;
  network: string;
  status: 'CONFIRMED' | 'PENDING';
  merkleRoot: string;
  prevHash: string;
  recordHash: string;
  canonicalPayload: string;
  validatorCount?: number;
  isSimulated?: boolean;
  payloadHash: string;
  contractAddress?: string;
  chainId?: number;
  auditExplanation: string;
}

export interface RiskThresholdConfig {
  highReportCount: number; // default: 3
  highRainfallMm: number;  // default: 20
  mediumReportCount: number; // default: 2
  mediumRainfallMm: number; // default: 10
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholdConfig = {
  highReportCount: 3,
  highRainfallMm: 20,
  mediumReportCount: 2,
  mediumRainfallMm: 10,
};

export interface ClusteringConfig {
  spatialRadiusMeters: number; // default 500m
  temporalWindowHours: number; // default 2 hours
}

export const DEFAULT_CLUSTERING_CONFIG: ClusteringConfig = {
  spatialRadiusMeters: 500,
  temporalWindowHours: 2,
};

export const GENESIS_PREV_HASH = '0x' + '0'.repeat(64);

/**
 * Pure TypeScript FIPS 180-4 SHA-256 implementation so canonical hashing
 * executes identically and synchronously in both Node.js and browser bundles.
 */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const SHA256_H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(paddedLen - 8, highBits, false);
  view.setUint32(paddedLen - 4, lowBits, false);

  const h = new Uint32Array(SHA256_H0);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  return Array.from(h)
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');
}

export function canonicalizeAuditPayload(payload: {
  eventId: string;
  hotspotId: string;
  location: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
}): string {
  return JSON.stringify({
    eventId: payload.eventId,
    hotspotId: payload.hotspotId,
    location: payload.location,
    severity: payload.severity,
    timestamp: payload.timestamp,
  });
}

export function computeBlockchainHashChain(params: {
  eventId: string;
  hotspotId: string;
  location: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  blockNumber: number;
  prevHash?: string;
}): {
  canonicalPayload: string;
  payloadHash: string;
  prevHash: string;
  recordHash: string;
  merkleRoot: string;
  txHash: string;
} {
  const prevHash = params.prevHash || GENESIS_PREV_HASH;
  const canonicalPayload = canonicalizeAuditPayload(params);
  const payloadHash = `0x${sha256Hex(canonicalPayload)}`;
  const recordHash = `0x${sha256Hex(`${prevHash}|${payloadHash}|${params.blockNumber}`)}`;
  const merkleRoot = `0x${sha256Hex(`MERKLE|${payloadHash}|${recordHash}`)}`;
  const txHash = `0x${sha256Hex(`TX|${recordHash}|${params.eventId}`)}`;

  return {
    canonicalPayload,
    payloadHash,
    prevHash,
    recordHash,
    merkleRoot,
    txHash,
  };
}

export function verifyBlockchainRecordIntegrity(
  record: BlockchainRecord,
  expectedPrevHash?: string
): {
  valid: boolean;
  payloadValid: boolean;
  chainValid: boolean;
  prevHashMatches: boolean;
  recomputedPayloadHash: string;
  recomputedRecordHash: string;
  reason: string;
} {
  const expectedCanonical = canonicalizeAuditPayload({
    eventId: record.eventId,
    hotspotId: record.hotspotId,
    location: record.location,
    severity: record.severity,
    timestamp: record.timestamp,
  });
  const canonical = record.canonicalPayload || expectedCanonical;
  const recomputedPayloadHash = `0x${sha256Hex(canonical)}`;
  const prevHash = record.prevHash || GENESIS_PREV_HASH;
  const recomputedRecordHash = `0x${sha256Hex(`${prevHash}|${recomputedPayloadHash}|${record.blockNumber}`)}`;

  const payloadValid =
    canonical === expectedCanonical && record.payloadHash?.toLowerCase() === recomputedPayloadHash.toLowerCase();
  const chainValid = record.recordHash?.toLowerCase() === recomputedRecordHash.toLowerCase();
  const prevHashMatches = expectedPrevHash ? prevHash.toLowerCase() === expectedPrevHash.toLowerCase() : true;

  const valid = payloadValid && chainValid && prevHashMatches;
  let reason = 'SHA-256 payload digest and previous-block hash link verified.';
  if (!payloadValid) {
    reason = 'Payload digest mismatch: record metadata does not match stored SHA-256 payloadHash.';
  } else if (!prevHashMatches) {
    reason = 'Broken hash chain: prevHash does not match preceding audit block recordHash.';
  } else if (!chainValid) {
    reason = 'Block seal mismatch: recomputed SHA-256 recordHash does not match stored recordHash.';
  }

  return {
    valid,
    payloadValid,
    chainValid,
    prevHashMatches,
    recomputedPayloadHash,
    recomputedRecordHash,
    reason,
  };
}

/**
 * Generates a collision-resistant report ID using crypto.randomUUID when available
 */
export function generateReportId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `REP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `REP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/**
 * Validates GPS latitude and longitude values
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/**
 * Calculates distance between two GPS coordinates in meters using the Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!validateCoordinates(lat1, lon1) || !validateCoordinates(lat2, lon2)) {
    return Infinity;
  }
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Determines water level risk weighting from citizen observation
 */
export function getWaterLevelSeverity(waterLevel: FloodReport['waterLevel']): 'HIGH' | 'MEDIUM' | 'LOW' {
  switch (waterLevel) {
    case 'Severe':
    case 'High':
      return 'HIGH';
    case 'Moderate':
      return 'MEDIUM';
    case 'Low':
    default:
      return 'LOW';
  }
}

/**
 * Risk evaluation based on project prototype rules:
 * HIGH: report count >= 3 AND forecast rainfall > 20 mm in the next 3h
 * MEDIUM: report count >= 2 OR forecast rainfall > 10 mm
 * LOW: otherwise
 * (Thresholds are configurable; HIGH is always evaluated strictly before MEDIUM)
 */
export function evaluateRiskLevel(
  reportCount: number,
  forecastRainfallMm: number,
  customThresholds?: Partial<RiskThresholdConfig>
): {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  reasoning: string;
  precaution: string;
  breakdown: {
    reportCount: number;
    rainfallMm: number;
    highRuleMet: boolean;
    mediumRuleMet: boolean;
    appliedRule: string;
  };
} {
  const config: RiskThresholdConfig = {
    ...DEFAULT_RISK_THRESHOLDS,
    ...customThresholds,
  };

  const count = Math.max(0, Math.floor(reportCount || 0));
  const rain = Math.max(0, Number(forecastRainfallMm || 0));

  const highRuleMet = count >= config.highReportCount && rain > config.highRainfallMm;
  const mediumRuleMet = count >= config.mediumReportCount || rain > config.mediumRainfallMm;

  if (highRuleMet) {
    const score = Math.min(98, Math.round(75 + (count - config.highReportCount) * 3 + (rain - config.highRainfallMm) * 0.5));
    return {
      riskLevel: 'HIGH',
      score,
      reasoning: `Deterministic Rule (HIGH Risk): ${count} unique citizen reports (threshold >= ${config.highReportCount}) AND ${rain.toFixed(1)} mm 3h forecast rainfall (threshold > ${config.highRainfallMm} mm). Note: Rule-based early warning indicator, not hydraulic flood modeling.`,
      precaution: 'Deploy immediate municipal drainage suckers, divert transit from low-lying arterial underpasses, and alert regional operations center.',
      breakdown: {
        reportCount: count,
        rainfallMm: rain,
        highRuleMet: true,
        mediumRuleMet: true,
        appliedRule: `HIGH: count (${count}) >= ${config.highReportCount} AND rain (${rain.toFixed(1)}mm) > ${config.highRainfallMm}mm`,
      },
    };
  }

  if (mediumRuleMet) {
    const score = Math.min(74, Math.round(45 + (count >= config.mediumReportCount ? 15 : 0) + (rain > config.mediumRainfallMm ? rain * 0.8 : 0)));
    const reasonParts = [];
    if (count >= config.mediumReportCount) reasonParts.push(`${count} reports (threshold >= ${config.mediumReportCount})`);
    if (rain > config.mediumRainfallMm) reasonParts.push(`${rain.toFixed(1)} mm 3h forecast rainfall (threshold > ${config.mediumRainfallMm} mm)`);

    return {
      riskLevel: 'MEDIUM',
      score,
      reasoning: `Deterministic Rule (MEDIUM Risk): ${reasonParts.join(' OR ')}.`,
      precaution: 'Issue municipal watch alert for vulnerable catch basins, inspect sluice gates, and monitor runoff accumulation velocity.',
      breakdown: {
        reportCount: count,
        rainfallMm: rain,
        highRuleMet: false,
        mediumRuleMet: true,
        appliedRule: `MEDIUM: count (${count}) >= ${config.mediumReportCount} OR rain (${rain.toFixed(1)}mm) > ${config.mediumRainfallMm}mm`,
      },
    };
  }

  const score = Math.min(44, Math.round(15 + count * 8 + rain * 1.2));
  return {
    riskLevel: 'LOW',
    score,
    reasoning: `Parameters remain within baseline monitoring: ${count} report(s) and ${rain.toFixed(1)} mm 3h rainfall.`,
    precaution: 'Routine surveillance active. Maintain standard runoff monitoring protocols across Colombo municipal sectors.',
    breakdown: {
      reportCount: count,
      rainfallMm: rain,
      highRuleMet: false,
      mediumRuleMet: false,
      appliedRule: `LOW: baseline runoff (< ${config.mediumReportCount} reports AND <= ${config.mediumRainfallMm}mm rain)`,
    },
  };
}

/**
 * Checks if two reports are potential duplicates
 * (reported within 25 meters and 5 minutes of each other)
 */
export function areReportsDuplicate(
  reportA: { lat: number; lng: number; timestamp: string },
  reportB: { lat: number; lng: number; timestamp: string }
): boolean {
  const distance = calculateHaversineDistance(reportA.lat, reportA.lng, reportB.lat, reportB.lng);
  if (distance > 25) return false;

  const tA = Date.parse(reportA.timestamp);
  const tB = Date.parse(reportB.timestamp);
  if (isNaN(tA) || isNaN(tB)) return false;

  const timeDiffMs = Math.abs(tA - tB);
  const fiveMinutesMs = 5 * 60 * 1000;
  return timeDiffMs <= fiveMinutesMs;
}

/**
 * Connected-component geospatial + temporal clustering (BFS):
 * Groups reports connected within spatialRadiusMeters (<= 500m default) and
 * temporalWindowHours (<= 2h default), purely using coordinates & timestamps.
 */
export function clusterReports(
  reports: FloodReport[],
  config: ClusteringConfig = DEFAULT_CLUSTERING_CONFIG,
  rainfallByArea?: Record<string, number>,
  riskThresholds?: Partial<RiskThresholdConfig>
): FloodHotspot[] {
  const validReports = reports.filter(
    (r) =>
      validateCoordinates(r.lat, r.lng) &&
      typeof r.timestamp === 'string' &&
      !isNaN(Date.parse(r.timestamp))
  );
  if (validReports.length === 0) return [];

  // Sort deterministically: newest first, tie-broken by report ID
  const sortedReports = [...validReports].sort((a, b) => {
    const diff = Date.parse(b.timestamp) - Date.parse(a.timestamp);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  const windowMs = config.temporalWindowHours * 60 * 60 * 1000;
  const visited = new Set<string>();
  const clusters: FloodReport[][] = [];

  for (const root of sortedReports) {
    if (visited.has(root.id)) continue;

    const component: FloodReport[] = [];
    const queue: FloodReport[] = [root];
    visited.add(root.id);
    let minClusterTime = Date.parse(root.timestamp);
    let maxClusterTime = minClusterTime;

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      const currentTime = Date.parse(current.timestamp);

      for (const candidate of sortedReports) {
        if (visited.has(candidate.id)) continue;

        const candidateTime = Date.parse(candidate.timestamp);
        if (Math.abs(currentTime - candidateTime) > windowMs) continue;

        // Enforce strict total cluster span so BFS chains never exceed temporalWindowHours
        const nextMinTime = Math.min(minClusterTime, candidateTime);
        const nextMaxTime = Math.max(maxClusterTime, candidateTime);
        if (nextMaxTime - nextMinTime > windowMs) continue;

        const distance = calculateHaversineDistance(
          current.lat,
          current.lng,
          candidate.lat,
          candidate.lng
        );
        if (distance <= config.spatialRadiusMeters) {
          visited.add(candidate.id);
          minClusterTime = nextMinTime;
          maxClusterTime = nextMaxTime;
          queue.push(candidate);
        }
      }
    }

    clusters.push(component);
  }

  const claimedIds = new Set<string>();

  return clusters.map((cluster) => {
    const uniqueReports = cluster.filter((r) => !r.isDuplicate);
    const duplicateCount = cluster.length - uniqueReports.length;
    const uniqueCount = uniqueReports.length > 0 ? uniqueReports.length : 0;
    const seed = uniqueReports[0] || cluster[0];

    const avgLat = cluster.reduce((sum, r) => sum + r.lat, 0) / cluster.length;
    const avgLng = cluster.reduce((sum, r) => sum + r.lng, 0) / cluster.length;

    const timestamps = cluster.map((r) => Date.parse(r.timestamp));
    const minTime = new Date(Math.min(...timestamps)).toISOString();
    const maxTime = new Date(Math.max(...timestamps)).toISOString();
    const timeSpanMinutes = Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / (60 * 1000));

    const area = seed.area || 'Colombo Basin';
    let forecastRainfallMm = 0;
    let rainfallSource: FloodHotspot['rainfallSource'] = 'MISSING';
    if (rainfallByArea) {
      if (typeof rainfallByArea[area] === 'number' && Number.isFinite(rainfallByArea[area])) {
        forecastRainfallMm = rainfallByArea[area];
        rainfallSource = 'AREA_OVERRIDE';
      } else if (typeof rainfallByArea['__default'] === 'number' && Number.isFinite(rainfallByArea['__default'])) {
        forecastRainfallMm = rainfallByArea['__default'];
        rainfallSource = 'FORECAST';
      }
    }

    const riskEval = evaluateRiskLevel(uniqueCount, forecastRainfallMm, riskThresholds);
    const hasVerified = cluster.some(
      (r) =>
        r.verificationStatus === 'VERIFIED' ||
        r.incidentStatus === 'Verified' ||
        r.incidentStatus === 'Alert Issued'
    );

    // Deterministic stable hotspot ID derived from existing unclaimed hotspotId or sorted report IDs
    const candidateExistingId = cluster
      .map((r) => r.hotspotId)
      .find((hid): hid is string => Boolean(hid && hid.trim() && !claimedIds.has(hid)));
    const sortedReportKey = [...cluster].map((r) => r.id).sort().join('|');
    const hotspotId = candidateExistingId || `HS-${sha256Hex(sortedReportKey).slice(0, 6).toUpperCase()}`;
    claimedIds.add(hotspotId);

    const rainfallNote =
      rainfallSource === 'MISSING'
        ? ' Rainfall telemetry unavailable (0.0 mm assumed without synthetic fallback).'
        : ` Forecast rainfall: ${forecastRainfallMm.toFixed(1)} mm (${rainfallSource}).`;

    return {
      id: hotspotId,
      location: cluster.length > 1 ? `${seed.location} Cluster (${uniqueCount} unique)` : seed.location,
      area,
      lat: Number(avgLat.toFixed(5)),
      lng: Number(avgLng.toFixed(5)),
      reportCount: uniqueCount,
      totalRecordCount: cluster.length,
      duplicateReportCount: duplicateCount,
      independentConfirmations: uniqueCount,
      firstReportedTime: minTime,
      latestReportedTime: maxTime,
      riskLevel: riskEval.riskLevel,
      riskScore: riskEval.score,
      forecastRainfallMm,
      rainfallSource,
      verificationStatus: hasVerified ? 'VERIFIED' : 'UNDER REVIEW',
      precaution: riskEval.precaution,
      associatedReportIds: cluster.map((r) => r.id),
      clusterRadiusMeters: config.spatialRadiusMeters,
      formationDetails: {
        timeSpanMinutes,
        activeWindowHours: config.temporalWindowHours,
        spatialRadiusMeters: config.spatialRadiusMeters,
        centerLat: Number(avgLat.toFixed(5)),
        centerLng: Number(avgLng.toFixed(5)),
        reasoning: `${uniqueCount} unique report(s) (and ${duplicateCount} duplicate records) connected within ${config.spatialRadiusMeters}m radius over ${timeSpanMinutes}m duration (window: ${config.temporalWindowHours}h).${rainfallNote}`,
      },
    };
  });
}

/**
 * Builds an honest AI verification status when no photograph is attached or when server AI is unconfigured.
 * Never fabricates synthetic confidence percentages and always requires human officer review.
 */
export function buildTextOnlyAiResult(params: {
  waterLevel: string;
  floodType: string;
  description: string;
}): AiVerificationDetails {
  const timestamp = new Date().toISOString();
  return {
    method: 'No Visual Analysis Run (Text-Only Report)',
    modelName: 'None',
    aiStatus: 'NOT_RUN',
    hasVisibleFlooding: false,
    aiAssessment: 'AI Not Run (No Image)',
    officialStatus: 'Under Review',
    confidence: null,
    explanation:
      'No photograph was attached to this submission. AI visual verification was not run; queued for officer field triage.',
    uncertainty: 'Visual confirmation unavailable: text-only submission.',
    waterLevelEstimated: params.waterLevel,
    roadAccessibilityEstimated: 'Uncertain',
    humanVerificationRequired: true,
    timestamp,
    disclaimer:
      'AI assessment is an assistive early warning signal only. Official verification requires authorized emergency officer confirmation.',
  };
}

export function buildUnconfiguredAiResult(params: {
  waterLevel: string;
  floodType: string;
  modelName?: string;
}): AiVerificationDetails {
  const timestamp = new Date().toISOString();
  return {
    method: 'Gemini AI (Unconfigured)',
    modelName: params.modelName || 'gemini-3.8-flash',
    aiStatus: 'UNCONFIGURED',
    hasVisibleFlooding: false,
    aiAssessment: 'AI Verification Not Configured',
    officialStatus: 'Under Review',
    confidence: null,
    explanation:
      'Server Gemini API key is not configured. Your flood photograph was saved safely and queued for manual emergency officer verification.',
    uncertainty:
      'Automated visual assessment is unavailable until GEMINI_API_KEY is configured on the server.',
    waterLevelEstimated: params.waterLevel,
    roadAccessibilityEstimated: 'Uncertain',
    humanVerificationRequired: true,
    timestamp,
    disclaimer:
      'AI assessment is an assistive early warning signal only. Official verification requires authorized emergency officer confirmation.',
  };
}

/**
 * Generates a tamper-evident hash-chain audit record using deterministic SHA-256 hashes.
 */
export function generateAuditChainRecord(
  hotspotId: string,
  location: string,
  severity: 'HIGH' | 'MEDIUM' | 'LOW',
  options?: {
    prevHash?: string;
    blockNumber?: number;
    eventId?: string;
    timestamp?: string;
  }
): BlockchainRecord {
  const timestamp = options?.timestamp || new Date().toISOString();
  const suffix = sha256Hex(`${hotspotId}|${timestamp}`).slice(0, 6).toUpperCase();
  const eventId = options?.eventId || `EVT-${suffix}`;
  const blockNumber = options?.blockNumber ?? 1;
  const prevHash = options?.prevHash || GENESIS_PREV_HASH;

  const hashes = computeBlockchainHashChain({
    eventId,
    hotspotId,
    location,
    severity,
    timestamp,
    blockNumber,
    prevHash,
  });

  return {
    eventId,
    hotspotId,
    location,
    severity,
    timestamp,
    txHash: hashes.txHash,
    blockNumber,
    network: 'Local SHA-256 Audit Chain',
    status: 'CONFIRMED',
    merkleRoot: hashes.merkleRoot,
    prevHash: hashes.prevHash,
    recordHash: hashes.recordHash,
    canonicalPayload: hashes.canonicalPayload,
    payloadHash: hashes.payloadHash,
    isSimulated: false,
    auditExplanation: `SHA-256 Audit Hash-Chain Record: Canonical JSON payload hashed and linked to previous record (${prevHash.slice(0, 14)}...) for tamper-evident verification.`,
  };
}

/**
 * Calculates dynamic analytics metrics strictly from active dataset (zero hardcoded metrics or synthetic multipliers)
 */
export function calculateDynamicAnalytics(
  reports: FloodReport[],
  hotspots: FloodHotspot[],
  timeRange: '24h' | '7d' | '30d' | 'all' = '24h'
) {
  const now = Date.now();
  const rangeMs =
    timeRange === '24h'
      ? 24 * 60 * 60 * 1000
      : timeRange === '7d'
      ? 7 * 24 * 60 * 60 * 1000
      : timeRange === '30d'
      ? 30 * 24 * 60 * 60 * 1000
      : Infinity;

  const filteredReports = reports.filter((r) => {
    if (rangeMs === Infinity) return true;
    const ts = Date.parse(r.timestamp);
    return !isNaN(ts) && now - ts <= rangeMs;
  });

  const totalReports = filteredReports.length;

  // Risk distribution
  const highRisk = filteredReports.filter((r) => r.riskLevel === 'HIGH').length;
  const mediumRisk = filteredReports.filter((r) => r.riskLevel === 'MEDIUM').length;
  const lowRisk = filteredReports.filter((r) => r.riskLevel === 'LOW').length;

  const riskDistribution = [
    { name: 'High Risk', value: totalReports > 0 ? Math.round((highRisk / totalReports) * 100) : 0, color: '#EF4444', count: highRisk },
    { name: 'Medium Risk', value: totalReports > 0 ? Math.round((mediumRisk / totalReports) * 100) : 0, color: '#F59E0B', count: mediumRisk },
    { name: 'Low Risk', value: totalReports > 0 ? Math.round((lowRisk / totalReports) * 100) : 0, color: '#22C55E', count: lowRisk },
  ];

  // Status breakdown
  const statusCounts: Record<IncidentStatus, number> = {
    Submitted: 0,
    'Under Review': 0,
    'More Info Requested': 0,
    Verified: 0,
    'Alert Issued': 0,
    Resolved: 0,
    Rejected: 0,
  };
  filteredReports.forEach((r) => {
    const st = r.incidentStatus || (r.verificationStatus === 'VERIFIED' ? 'Verified' : 'Under Review');
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  });

  // Reports by zone
  const zoneMap: Record<string, { zone: string; reports: number; uniqueReports: number; highRisk: number; mediumRisk: number; lowRisk: number }> = {};
  filteredReports.forEach((r) => {
    const z = r.area || 'Other';
    if (!zoneMap[z]) {
      zoneMap[z] = { zone: z, reports: 0, uniqueReports: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0 };
    }
    zoneMap[z].reports += 1;
    if (!r.isDuplicate) zoneMap[z].uniqueReports += 1;
    if (r.riskLevel === 'HIGH') zoneMap[z].highRisk += 1;
    else if (r.riskLevel === 'MEDIUM') zoneMap[z].mediumRisk += 1;
    else zoneMap[z].lowRisk += 1;
  });

  const reportsByZone = Object.values(zoneMap).sort((a, b) => b.reports - a.reports);

  // Average Review Time (strictly computed from verified timestamps; null if insufficient timestamps)
  const verifiedDurations = filteredReports
    .map((r) => {
      if (!r.verificationTimestamp || !r.timestamp) return null;
      const start = Date.parse(r.timestamp);
      const end = Date.parse(r.verificationTimestamp);
      if (isNaN(start) || isNaN(end) || end < start) return null;
      return (end - start) / (60 * 1000);
    })
    .filter((v): v is number => v !== null);

  const avgReviewMinutes: number | null =
    verifiedDurations.length > 0
      ? Number((verifiedDurations.reduce((a, b) => a + b, 0) / verifiedDurations.length).toFixed(1))
      : null;

  // Average Time to Alert Issued (computed from statusHistory transitions)
  const alertDurations = filteredReports
    .map((r) => {
      const alertEntry = r.statusHistory?.find((s) => s.status === 'Alert Issued');
      if (!alertEntry || !r.timestamp) return null;
      const start = Date.parse(r.timestamp);
      const end = Date.parse(alertEntry.timestamp);
      if (isNaN(start) || isNaN(end) || end < start) return null;
      return (end - start) / (60 * 1000);
    })
    .filter((v): v is number => v !== null);

  const avgAlertMinutes: number | null =
    alertDurations.length > 0
      ? Number((alertDurations.reduce((a, b) => a + b, 0) / alertDurations.length).toFixed(1))
      : null;

  // Verified vs Unverified
  const verifiedCount = filteredReports.filter(
    (r) => r.verificationStatus === 'VERIFIED' || r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued' || r.incidentStatus === 'Resolved'
  ).length;
  const unverifiedCount = Math.max(0, totalReports - verifiedCount);
  const verifiedPercentage = totalReports > 0 ? Math.round((verifiedCount / totalReports) * 100) : 0;

  // Unique vs Duplicate
  const duplicateReportCount = filteredReports.filter((r) => Boolean(r.isDuplicate)).length;
  const uniqueReportCount = Math.max(0, totalReports - duplicateReportCount);

  // Hotspot severity distribution
  const hotspotSeverityDistribution = [
    { name: 'HIGH', count: hotspots.filter((h) => h.riskLevel === 'HIGH').length, color: '#EF4444' },
    { name: 'MEDIUM', count: hotspots.filter((h) => h.riskLevel === 'MEDIUM').length, color: '#F59E0B' },
    { name: 'LOW', count: hotspots.filter((h) => h.riskLevel === 'LOW').length, color: '#22C55E' },
  ];

  // Report volume over time (real timestamp buckets, zero synthetic multipliers)
  const validTimestampReports = filteredReports
    .filter((r) => !isNaN(Date.parse(r.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const bucketMap = new Map<
    string,
    { label: string; timestamp: string; total: number; highRisk: number; mediumRisk: number; lowRisk: number; verified: number }
  >();

  validTimestampReports.forEach((r) => {
    const dt = new Date(r.timestamp);
    const key =
      timeRange === '24h'
        ? `${dt.toISOString().slice(0, 13)}:00`
        : dt.toISOString().slice(0, 10);
    const label =
      timeRange === '24h'
        ? `${dt.getUTCHours().toString().padStart(2, '0')}:00`
        : dt.toISOString().slice(5, 10);

    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        label,
        timestamp: key,
        total: 0,
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
        verified: 0,
      });
    }
    const entry = bucketMap.get(key)!;
    entry.total += 1;
    if (r.riskLevel === 'HIGH') entry.highRisk += 1;
    else if (r.riskLevel === 'MEDIUM') entry.mediumRisk += 1;
    else entry.lowRisk += 1;
    if (r.verificationStatus === 'VERIFIED' || r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued') {
      entry.verified += 1;
    }
  });

  const reportVolumeOverTime = Array.from(bucketMap.values());

  // Rainfall vs Volume comparison from real hotspots
  const rainfallBuckets = [
    { bucket: '0-10 mm', min: 0, max: 10 },
    { bucket: '10.1-20 mm', min: 10.0001, max: 20 },
    { bucket: '> 20 mm', min: 20.0001, max: Infinity },
  ].map((b) => {
    const matched = hotspots.filter(
      (h) => h.rainfallSource !== 'MISSING' && h.forecastRainfallMm >= b.min && h.forecastRainfallMm <= b.max
    );
    const repSum = matched.reduce((acc, h) => acc + h.reportCount, 0);
    const rainAvg =
      matched.length > 0
        ? Number((matched.reduce((acc, h) => acc + h.forecastRainfallMm, 0) / matched.length).toFixed(1))
        : 0;
    return {
      bucket: b.bucket,
      hotspotCount: matched.length,
      reportCount: repSum,
      avgRainfallMm: rainAvg,
    };
  });

  const hotspotsWithForecastRainfall = hotspots.filter((h) => h.rainfallSource !== 'MISSING').length;

  return {
    totalReports,
    highRisk,
    mediumRisk,
    lowRisk,
    riskDistribution,
    statusCounts,
    reportsByZone,
    avgProcessingMinutes: avgReviewMinutes,
    avgReviewMinutes,
    avgAlertMinutes,
    verifiedCount,
    unverifiedCount,
    verifiedPercentage,
    uniqueReportCount,
    duplicateReportCount,
    verifiedVsUnverified: [
      { name: 'Verified', count: verifiedCount, color: '#22C55E' },
      { name: 'Unverified / Review', count: unverifiedCount, color: '#F59E0B' },
    ],
    uniqueVsDuplicate: [
      { name: 'Unique', count: uniqueReportCount, color: '#0284C7' },
      { name: 'Duplicate', count: duplicateReportCount, color: '#64748B' },
    ],
    hotspotSeverityDistribution,
    reportVolumeOverTime,
    rainfallVsVolumeCorrelation: rainfallBuckets,
    hasRainfallCorrelationData: hotspotsWithForecastRainfall > 0,
    dataCompleteness: {
      reportsWithCoordinates: filteredReports.filter((r) => validateCoordinates(r.lat, r.lng)).length,
      reportsWithImages: filteredReports.filter((r) =>
        Boolean((r.evidenceCount && r.evidenceCount > 0) || r.hasEvidence || r.imageUrl)
      ).length,
      reportsWithValidTimestamps: validTimestampReports.length,
      hotspotsWithForecastRainfall,
      missingRainfallHotspots: hotspots.length - hotspotsWithForecastRainfall,
    },
    freshnessTimestamp: new Date().toISOString(),
  };
}
