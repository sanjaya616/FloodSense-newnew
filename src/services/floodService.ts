/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FloodReport,
  FloodHotspot,
  BlockchainRecord,
  ReportEvidenceRecord,
  buildTextOnlyAiResult,
  getWaterLevelSeverity,
  generateAuditChainRecord,
  clusterReports,
  ClusteringConfig,
  DEFAULT_CLUSTERING_CONFIG,
  RiskThresholdConfig,
  DEFAULT_RISK_THRESHOLDS,
  IncidentStatus,
  StatusHistoryEntry,
  AiVerificationDetails,
  areReportsDuplicate,
  validateCoordinates,
  generateReportId,
  GENESIS_PREV_HASH,
} from '../utils/floodLogic';
import {
  compressReportImage,
  CompressedReportImage,
  estimateFirestoreEvidenceDocBytes,
  MAX_FIRESTORE_EVIDENCE_DOC_BYTES,
  stripDataUrlPrefix,
} from '../utils/imageUtils';
import {
  db,
  auth,
  isFirebaseConfigured,
  firebaseConfigError,
  googleProvider,
} from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
} from 'firebase/firestore';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';

const PENDING_GOOGLE_PORTAL_KEY = 'floodsense_pending_google_portal';

type FirestoreOperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';

function handleFirestoreOperationError(
  error: unknown,
  operationType: FirestoreOperationType,
  path: string
): never {
  const errObj = error as any;
  const currentUser = auth?.currentUser;
  const structured = {
    error: errObj?.message || String(error),
    code: errObj?.code || null,
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: Boolean(currentUser?.emailVerified),
    },
  };
  if (errObj?.code === 'permission-denied' || /Missing or insufficient permissions/i.test(String(errObj?.message))) {
    console.error('[FloodSense Firestore Permission Error]', JSON.stringify(structured));
    throw new Error(
      `Permission denied (${operationType} on ${path}). Please verify your account session and Firestore security rules.`
    );
  }
  console.error('[FloodSense Firestore Error]', JSON.stringify(structured));
  throw new Error(errObj?.message || `Cloud Firestore ${operationType} failed on ${path}.`);
}

export interface WeatherData {
  currentTempC: number | null;
  condition: string;
  currentRainfallMm: number | null;
  expected3hRainfallMm: number | null;
  humidityPercent: number | null;
  windSpeedKmh: number | null;
  windDirection: string | null;
  updatedAt: string;
  source: string;
  provider?: string;
  forecastAvailable?: boolean;
  forecastCompleteness?: 'COMPLETE' | 'INCOMPLETE' | 'UNAVAILABLE';
  forecastTimeRange?: string;
  rainfallUnit?: string;
  isLive: boolean;
  unavailable?: boolean;
  cached?: boolean;
  fetchedAt?: string | null;
  cacheExpiresAt?: string | null;
  status: string;
  error?: string;
}

export interface ServiceState {
  isLoading: boolean;
  error: string | null;
  lastSyncTime: string | null;
}

class FloodService {
  private clusteringConfig: ClusteringConfig = { ...DEFAULT_CLUSTERING_CONFIG };
  private riskThresholds: RiskThresholdConfig = { ...DEFAULT_RISK_THRESHOLDS };

  public canUseFirebase(): boolean {
    return isFirebaseConfigured;
  }

  public getFirebaseConfigError(): string | null {
    return firebaseConfigError;
  }

  public setClusteringConfig(config: Partial<ClusteringConfig>): void {
    this.clusteringConfig = { ...this.clusteringConfig, ...config };
  }

  public getClusteringConfig(): ClusteringConfig {
    return { ...this.clusteringConfig };
  }

  public setRiskThresholds(thresholds: Partial<RiskThresholdConfig>): void {
    this.riskThresholds = { ...this.riskThresholds, ...thresholds };
  }

  public getRiskThresholds(): RiskThresholdConfig {
    return { ...this.riskThresholds };
  }

  private async getBearerHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {
        // Proceed without token; protected endpoints fail closed with 401
      }
    }
    return headers;
  }

  // --- Live Weather API (Open-Meteo Asia/Colombo) ---
  public async fetchLiveWeather(lat?: number, lng?: number): Promise<WeatherData> {
    try {
      const qs =
        typeof lat === 'number' && typeof lng === 'number'
          ? `?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
          : '';
      const res = await fetch(`/api/weather/colombo${qs}`);
      if (res.ok) {
        const data = await res.json();
        const isLive = Boolean(data.isLive);
        return {
          currentTempC: typeof data.currentTempC === 'number' ? data.currentTempC : null,
          condition: data.condition ?? (isLive ? 'Overcast' : 'Weather telemetry unavailable'),
          currentRainfallMm: typeof data.currentRainfallMm === 'number' ? data.currentRainfallMm : null,
          expected3hRainfallMm:
            typeof data.expected3hRainfallMm === 'number' && Number.isFinite(data.expected3hRainfallMm)
              ? data.expected3hRainfallMm
              : null,
          humidityPercent: typeof data.humidityPercent === 'number' ? data.humidityPercent : null,
          windSpeedKmh: typeof data.windSpeedKmh === 'number' ? data.windSpeedKmh : null,
          windDirection: typeof data.windDirection === 'string' ? data.windDirection : null,
          updatedAt: data.updatedAt ?? (isLive ? 'Live (Asia/Colombo)' : 'Unavailable'),
          source: data.source ?? 'Open-Meteo Forecast API',
          provider: data.provider ?? data.source ?? 'Open-Meteo Forecast API',
          forecastAvailable: Boolean(data.forecastAvailable),
          forecastCompleteness:
            data.forecastCompleteness ?? (data.forecastAvailable ? 'COMPLETE' : 'UNAVAILABLE'),
          forecastTimeRange: data.forecastTimeRange ?? (isLive ? 'Asia/Colombo +3h' : 'Unavailable'),
          rainfallUnit: data.rainfallUnit ?? 'mm',
          isLive,
          unavailable: !isLive,
          cached: Boolean(data.cached),
          fetchedAt: data.fetchedAt ?? null,
          cacheExpiresAt: data.cacheExpiresAt ?? null,
          status: data.status ?? (isLive ? 'Normal Conditions Monitoring' : 'Live Open-Meteo telemetry unavailable'),
          error: data.error,
        };
      }
    } catch (err: any) {
      console.warn('Weather API fetch failed:', err?.message);
    }
    return {
      currentTempC: null,
      condition: 'Weather telemetry unavailable',
      currentRainfallMm: null,
      expected3hRainfallMm: null,
      humidityPercent: null,
      windSpeedKmh: null,
      windDirection: null,
      updatedAt: 'Unavailable',
      source: 'Open-Meteo Forecast API',
      provider: 'Open-Meteo Forecast API',
      forecastAvailable: false,
      forecastCompleteness: 'UNAVAILABLE',
      forecastTimeRange: 'Unavailable',
      rainfallUnit: 'mm',
      isLive: false,
      unavailable: true,
      cached: false,
      fetchedAt: null,
      cacheExpiresAt: null,
      status: 'Live Open-Meteo telemetry unavailable',
    };
  }

  private inFlightAiRetryIds = new Set<string>();

  // --- Server-Side AI Image Verification ---
  public async verifyImageWithAi(params: {
    imageBase64?: string;
    mimeType?: string;
    description: string;
    waterLevel: string;
    floodType: string;
  }): Promise<AiVerificationDetails> {
    if (!params.imageBase64 || !params.imageBase64.trim()) {
      return buildTextOnlyAiResult({
        waterLevel: params.waterLevel,
        floodType: params.floodType,
        description: params.description,
      });
    }

    try {
      const headers = await this.getBearerHeaders();
      const res = await fetch('/api/ai/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageBase64: params.imageBase64,
          mimeType: params.mimeType,
          description: params.description,
          waterLevel: params.waterLevel,
          floodType: params.floodType,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        return data as AiVerificationDetails;
      }
      if (data && data.aiAssessment) {
        return data as AiVerificationDetails;
      }
      throw new Error(data?.error || `AI service returned HTTP ${res.status}`);
    } catch (err: any) {
      return {
        method: 'Gemini Multimodal AI',
        modelName: 'gemini-3.8-flash',
        aiStatus: 'FAILED',
        hasVisibleFlooding: false,
        aiAssessment: 'AI Processing Failed',
        officialStatus: 'Under Review',
        confidence: null,
        explanation: `AI vision verification failed (${err?.message || 'Service unavailable'}). Your report has been saved safely and queued for officer review.`,
        uncertainty: 'AI assessment could not be completed. Retry available.',
        waterLevelEstimated: params.waterLevel,
        roadAccessibilityEstimated: 'Uncertain',
        humanVerificationRequired: true,
        timestamp: new Date().toISOString(),
        disclaimer:
          'AI image assessment is an assistive early warning signal only. Official verification requires authorized emergency officer confirmation.',
      };
    }
  }

  // --- Reports ---
  public async getReports(options?: { role?: 'officer' | 'citizen'; uid?: string }): Promise<FloodReport[]> {
    if (!isFirebaseConfigured || !db) {
      return [];
    }

    const activeUid = options?.uid || auth?.currentUser?.uid;
    if (!activeUid) {
      const pubQ = query(collection(db, 'public_reports'), orderBy('timestamp', 'desc'));
      const pubSnap = await getDocs(pubQ);
      return pubSnap.docs.map((docSnap) => docSnap.data() as FloodReport);
    }

    const resolvedRole =
      options?.role || (await this.getAuthoritativeFirebaseRole(auth?.currentUser));

    if (resolvedRole === 'officer') {
      const officerQ = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(officerQ);
      return snapshot.docs.map((docSnap) => docSnap.data() as FloodReport);
    }

    // Citizens query strictly their own reports in /reports + public_reports separately
    const citizenOwnQ = query(
      collection(db, 'reports'),
      where('reporterId', '==', activeUid),
      orderBy('timestamp', 'desc')
    );
    const [ownSnap, pubSnap] = await Promise.all([
      getDocs(citizenOwnQ),
      getDocs(query(collection(db, 'public_reports'), orderBy('timestamp', 'desc'))),
    ]);
    const merged = new Map<string, FloodReport>();
    pubSnap.docs.forEach((docSnap) => {
      const d = docSnap.data() as FloodReport;
      if (d.id) merged.set(d.id, d);
    });
    ownSnap.docs.forEach((docSnap) => {
      const d = docSnap.data() as FloodReport;
      if (d.id) merged.set(d.id, d);
    });
    return Array.from(merged.values()).sort(
      (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
    );
  }

  // --- Firestore Image Evidence CRUD (Spark-plan compatible, zero Cloud Storage) ---
  public async saveReportEvidence(
    reportId: string,
    compressed: CompressedReportImage,
    evidenceId = 'primary'
  ): Promise<ReportEvidenceRecord> {
    if (!isFirebaseConfigured || !db) {
      throw new Error(firebaseConfigError || 'Cloud Firestore is not configured.');
    }
    const currentUser = auth?.currentUser;
    if (!currentUser?.uid) {
      throw new Error('Authentication required before saving photographic evidence.');
    }

    const cleanBase64 = stripDataUrlPrefix(compressed.base64Data || compressed.dataUrl);
    if (!cleanBase64) {
      throw new Error('Compressed photograph Base64 payload is empty.');
    }

    const createdAt = new Date().toISOString();
    const docPayload = {
      ownerUid: currentUser.uid,
      mimeType: compressed.mimeType || ('image/jpeg' as const),
      base64Data: cleanBase64,
      fileName: compressed.fileName || 'flood_evidence.jpg',
      byteSize: compressed.byteSize,
      width: Math.min(1280, Math.max(1, Math.round(compressed.width))),
      height: Math.min(1280, Math.max(1, Math.round(compressed.height))),
      createdAt,
    };

    const estimatedBytes = estimateFirestoreEvidenceDocBytes(docPayload);
    if (estimatedBytes >= MAX_FIRESTORE_EVIDENCE_DOC_BYTES) {
      throw new Error(
        `Evidence document payload (${Math.round(estimatedBytes / 1024)} KiB) exceeds the 850 KiB Firestore safety limit.`
      );
    }

    const evidencePath = `reports/${reportId}/evidence/${evidenceId}`;
    try {
      await setDoc(doc(db, 'reports', reportId, 'evidence', evidenceId), docPayload);
    } catch (err) {
      handleFirestoreOperationError(err, 'create', evidencePath);
    }

    return {
      id: evidenceId,
      reportId,
      ...docPayload,
    };
  }

  public async getReportEvidence(
    reportId: string,
    evidenceId = 'primary'
  ): Promise<ReportEvidenceRecord | null> {
    if (!isFirebaseConfigured || !db || !auth?.currentUser?.uid || !reportId) {
      return null;
    }
    const path = `reports/${reportId}/evidence/${evidenceId}`;
    try {
      const snap = await getDoc(doc(db, 'reports', reportId, 'evidence', evidenceId));
      if (!snap.exists()) return null;
      const data = snap.data() as Omit<ReportEvidenceRecord, 'id' | 'reportId'>;
      return {
        id: snap.id,
        reportId,
        ...data,
      };
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        handleFirestoreOperationError(err, 'get', path);
      }
      return null;
    }
  }

  public async getEvidenceForReport(reportId: string): Promise<ReportEvidenceRecord[]> {
    if (!isFirebaseConfigured || !db || !auth?.currentUser?.uid || !reportId) {
      return [];
    }
    const path = `reports/${reportId}/evidence`;
    try {
      const snap = await getDocs(collection(db, 'reports', reportId, 'evidence'));
      return snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          reportId,
          ...(docSnap.data() as Omit<ReportEvidenceRecord, 'id' | 'reportId'>),
        }))
        .sort((a, b) => Date.parse(a.createdAt || '') - Date.parse(b.createdAt || ''));
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        handleFirestoreOperationError(err, 'list', path);
      }
      return [];
    }
  }

  public async deleteReportEvidence(reportId: string, evidenceId?: string): Promise<void> {
    if (!isFirebaseConfigured || !db || !auth?.currentUser?.uid || !reportId) {
      return;
    }
    if (evidenceId) {
      const path = `reports/${reportId}/evidence/${evidenceId}`;
      try {
        await deleteDoc(doc(db, 'reports', reportId, 'evidence', evidenceId));
      } catch (err) {
        handleFirestoreOperationError(err, 'delete', path);
      }
      return;
    }
    const path = `reports/${reportId}/evidence`;
    try {
      const snap = await getDocs(collection(db, 'reports', reportId, 'evidence'));
      for (const docSnap of snap.docs) {
        await deleteDoc(docSnap.ref);
      }
    } catch (err) {
      handleFirestoreOperationError(err, 'delete', path);
    }
  }

  public async retryReportEvidenceUpload(
    reportId: string,
    fileOrCompressed: File | CompressedReportImage
  ): Promise<ReportEvidenceRecord> {
    if (!isFirebaseConfigured || !db || !auth?.currentUser?.uid) {
      throw new Error(firebaseConfigError || 'Authenticated Firebase session required.');
    }

    const compressed =
      'base64Data' in fileOrCompressed
        ? fileOrCompressed
        : await compressReportImage(fileOrCompressed);

    const savedEvidence = await this.saveReportEvidence(reportId, compressed, 'primary');
    const updatedAt = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        hasEvidence: true,
        evidenceCount: 1,
        primaryEvidenceId: savedEvidence.id,
        evidenceStatus: 'SAVED',
        evidenceError: '',
        updatedAt,
      });
    } catch (err) {
      handleFirestoreOperationError(err, 'update', `reports/${reportId}`);
    }
    return savedEvidence;
  }

  public async deleteReportAndEvidence(reportId: string): Promise<{ deletedEvidenceCount: number }> {
    if (!isFirebaseConfigured || !db || !auth?.currentUser?.uid) {
      throw new Error(firebaseConfigError || 'Authenticated Firebase session required.');
    }

    // Attempt atomic Admin SDK delete when available on server
    try {
      const headers = await this.getBearerHeaders();
      const apiRes = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
        method: 'DELETE',
        headers,
      });
      if (apiRes.ok) {
        const data = await apiRes.json().catch(() => null);
        return { deletedEvidenceCount: Number(data?.deletedEvidenceCount || 0) };
      }
      if (apiRes.status !== 501 && apiRes.status !== 503 && apiRes.status !== 404) {
        const errData = await apiRes.json().catch(() => null);
        throw new Error(errData?.error || `Delete rejected by server (HTTP ${apiRes.status})`);
      }
    } catch (err: any) {
      // Only fall back to client Firestore deletion if Admin endpoint was unavailable/501
      if (err?.message && /Delete rejected by server|Forbidden/i.test(err.message)) {
        throw err;
      }
    }

    // Client-side authorized Firestore deletion sequence:
    // 1) Delete public_reports/{reportId} FIRST while parent reports/{reportId} still exists for security rules check
    await deleteDoc(doc(db, 'public_reports', reportId)).catch(() => {});

    // 2) Delete evidence subcollection docs
    let deletedEvidenceCount = 0;
    try {
      const evSnap = await getDocs(collection(db, 'reports', reportId, 'evidence'));
      for (const d of evSnap.docs) {
        await deleteDoc(d.ref);
        deletedEvidenceCount += 1;
      }
    } catch (err) {
      handleFirestoreOperationError(err, 'delete', `reports/${reportId}/evidence`);
    }

    // 3) Delete private report document
    try {
      await deleteDoc(doc(db, 'reports', reportId));
    } catch (err) {
      handleFirestoreOperationError(err, 'delete', `reports/${reportId}`);
    }

    return { deletedEvidenceCount };
  }

  public async checkDuplicatesNearLocation(params: {
    lat: number;
    lng: number;
    timestamp: string;
    localReports?: FloodReport[];
  }): Promise<{
    isDuplicate: boolean;
    duplicateOfId?: string;
    status: 'VERIFIED_CITYWIDE' | 'LOCAL_ONLY' | 'UNAVAILABLE';
    warning?: string;
  }> {
    const localList = params.localReports || [];
    for (const existing of localList) {
      if (areReportsDuplicate(existing, { lat: params.lat, lng: params.lng, timestamp: params.timestamp })) {
        return {
          isDuplicate: true,
          duplicateOfId: existing.id,
          status: 'LOCAL_ONLY',
        };
      }
    }

    let status: 'VERIFIED_CITYWIDE' | 'LOCAL_ONLY' | 'UNAVAILABLE' = 'LOCAL_ONLY';
    let warning: string | undefined;

    try {
      const headers = await this.getBearerHeaders();
      const dupRes = await fetch('/api/reports/check-duplicate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ lat: params.lat, lng: params.lng, timestamp: params.timestamp }),
      });

      if (dupRes.ok) {
        const dupJson = await dupRes.json();
        if (dupJson.checkedCitywide) {
          return {
            isDuplicate: Boolean(dupJson.isDuplicate),
            duplicateOfId: dupJson.duplicateOfId || undefined,
            status: 'VERIFIED_CITYWIDE',
          };
        }
        status = 'LOCAL_ONLY';
        warning = dupJson.message || 'Server Admin duplicate index unavailable; local safety check applied.';
      } else {
        status = 'UNAVAILABLE';
        const errData = await dupRes.json().catch(() => null);
        warning =
          errData?.error ||
          `Citywide duplicate check returned HTTP ${dupRes.status}; local duplicate check applied.`;
      }
    } catch (err: any) {
      status = 'UNAVAILABLE';
      warning = `Citywide duplicate check unreachable (${err?.message || 'network error'}); local duplicate check applied.`;
    }

    // Secondary Spark-plan fallback: query public_reports directly in Firestore if server Admin wasn't configured
    if (isFirebaseConfigured && db) {
      try {
        const cutoffIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const pubRecentSnap = await getDocs(
          query(collection(db, 'public_reports'), where('timestamp', '>=', cutoffIso))
        );
        for (const d of pubRecentSnap.docs) {
          const data = d.data() as FloodReport;
          if (areReportsDuplicate(data, { lat: params.lat, lng: params.lng, timestamp: params.timestamp })) {
            return {
              isDuplicate: true,
              duplicateOfId: data.id || d.id,
              status,
              warning,
            };
          }
        }
      } catch {
        // Ignore query error and keep honest status/warning
      }
    }

    return {
      isDuplicate: false,
      status,
      warning,
    };
  }

  public async submitReport(
    reportInput: Omit<
      FloodReport,
      | 'id'
      | 'timestamp'
      | 'riskLevel'
      | 'verificationStatus'
      | 'incidentStatus'
      | 'statusHistory'
      | 'aiConfidence'
      | 'aiClassification'
      | 'aiVerificationDetails'
      | 'isDuplicate'
      | 'duplicateOfReportId'
    > & {
      imageFile?: File;
      compressedEvidence?: CompressedReportImage;
      customImage?: string;
      imageMimeType?: string;
      onUploadProgress?: (percent: number) => void;
    }
  ): Promise<{
    report: FloodReport;
    hotspot: FloodHotspot;
    blockchainRecord?: BlockchainRecord;
    isDuplicate?: boolean;
    duplicateOfId?: string;
    duplicateCheckStatus?: 'VERIFIED_CITYWIDE' | 'LOCAL_ONLY' | 'UNAVAILABLE';
    duplicateCheckWarning?: string;
    evidenceUploadFailed?: boolean;
    evidenceUploadError?: string;
  }> {
    if (!isFirebaseConfigured || !db) {
      throw new Error(firebaseConfigError || 'Firebase is not configured. Check your .env settings.');
    }
    const currentUser = auth?.currentUser;
    if (!currentUser?.uid) {
      throw new Error('Authentication required: please sign in before submitting a flood report.');
    }

    if (!validateCoordinates(reportInput.lat, reportInput.lng)) {
      throw new Error(`Invalid GPS coordinates: lat=${reportInput.lat}, lng=${reportInput.lng}`);
    }

    // Prepare & compress photographic evidence BEFORE creating report metadata
    let preparedEvidence: CompressedReportImage | undefined = reportInput.compressedEvidence;
    if (!preparedEvidence && reportInput.imageFile) {
      reportInput.onUploadProgress?.(20);
      preparedEvidence = await compressReportImage(reportInput.imageFile);
    }

    const existingReports = await this.getReports({ uid: currentUser.uid });

    // Idempotency guard against duplicate button clicks
    if (reportInput.submissionRequestId) {
      const prior = existingReports.find((r) => r.submissionRequestId === reportInput.submissionRequestId);
      if (prior) {
        const priorHotspot = clusterReports(
          [prior],
          this.clusteringConfig,
          undefined,
          this.riskThresholds
        )[0];
        return {
          report: prior,
          hotspot: priorHotspot,
          isDuplicate: prior.isDuplicate,
          duplicateOfId: prior.duplicateOfReportId,
          duplicateCheckStatus: prior.duplicateCheckStatus,
        };
      }
    }

    const timestamp = new Date().toISOString();
    const newId = generateReportId();
    const effectiveUid = currentUser.uid;

    // Duplicate check within 25m and 5 minutes (local + server citywide + public fallback)
    const dupOutcome = await this.checkDuplicatesNearLocation({
      lat: reportInput.lat,
      lng: reportInput.lng,
      timestamp,
      localReports: existingReports,
    });
    const isDuplicate = dupOutcome.isDuplicate;
    const duplicateOfId = dupOutcome.duplicateOfId;
    const duplicateCheckStatus = dupOutcome.status;

    reportInput.onUploadProgress?.(40);

    const aiBase64Payload = preparedEvidence?.base64Data || reportInput.customImage;
    const hasPhotoPayload = Boolean(aiBase64Payload && aiBase64Payload.trim());

    let aiResult: AiVerificationDetails = hasPhotoPayload
      ? {
          method: 'Gemini Multimodal AI',
          modelName: 'gemini-3.8-flash',
          aiStatus: 'PENDING',
          hasVisibleFlooding: false,
          aiAssessment: 'Pending AI Review',
          officialStatus: 'Under Review',
          confidence: null,
          explanation: 'Flood report saved. Starting multimodal AI visual assessment...',
          uncertainty: 'AI assessment in progress.',
          waterLevelEstimated: reportInput.waterLevel,
          roadAccessibilityEstimated: 'Uncertain',
          humanVerificationRequired: true,
          timestamp,
          disclaimer:
            'AI image assessment is an assistive early warning signal only. Official verification requires authorized emergency officer confirmation.',
        }
      : buildTextOnlyAiResult({
          waterLevel: reportInput.waterLevel,
          floodType: reportInput.floodType,
          description: reportInput.description,
        });

    const calculatedRisk = getWaterLevelSeverity(reportInput.waterLevel);

    const initialStatusHistory: StatusHistoryEntry[] = [
      {
        status: 'Submitted',
        timestamp,
        authorName: reportInput.reporterName || currentUser.displayName || 'Citizen Reporter',
        note: isDuplicate
          ? `Report submitted (Identified as near-duplicate of ${duplicateOfId}). Evidence preserved for audit.`
          : 'Report registered via FloodSense citizen reporting portal.',
      },
    ];

    const {
      imageFile: _imgFile,
      compressedEvidence: _compEv,
      customImage: _customImg,
      imageMimeType: _mime,
      imageUrl: _legacyImgUrl,
      onUploadProgress: _onProg,
      ...cleanReportFields
    } = reportInput;

    const createdReport: FloodReport = {
      ...cleanReportFields,
      id: newId,
      reporterId: effectiveUid,
      timestamp,
      riskLevel: calculatedRisk,
      verificationStatus: 'UNDER REVIEW',
      incidentStatus: 'Submitted',
      statusHistory: initialStatusHistory,
      aiConfidence: aiResult.confidence,
      aiClassification: aiResult.aiAssessment,
      aiStatus: aiResult.aiStatus || 'NOT_RUN',
      aiVerificationDetails: aiResult,
      hasEvidence: false,
      evidenceCount: 0,
      evidenceStatus: 'NONE',
      duplicateCheckStatus,
      publicSyncStatus: 'PENDING',
      isDuplicate,
      ...(duplicateOfId ? { duplicateOfReportId: duplicateOfId } : {}),
    };

    // Initial local clustering using live weather forecast if available
    const allReportsForClustering = [createdReport, ...existingReports];
    const rainfallByArea: Record<string, number> = {};
    try {
      const liveWeather = await this.fetchLiveWeather(reportInput.lat, reportInput.lng);
      if (
        liveWeather.isLive &&
        liveWeather.forecastAvailable &&
        typeof liveWeather.expected3hRainfallMm === 'number' &&
        Number.isFinite(liveWeather.expected3hRainfallMm)
      ) {
        rainfallByArea['__default'] = liveWeather.expected3hRainfallMm;
      }
    } catch {
      // Proceed honestly with MISSING rainfall source if weather fetch fails
    }

    const updatedHotspots = clusterReports(
      allReportsForClustering,
      this.clusteringConfig,
      rainfallByArea,
      this.riskThresholds
    );

    let matchedHotspot =
      updatedHotspots.find((h) => h.associatedReportIds.includes(newId)) ||
      clusterReports([createdReport], this.clusteringConfig, rainfallByArea, this.riskThresholds)[0];

    createdReport.hotspotId = matchedHotspot.id;

    // 1. Persist private report metadata document FIRST with AI status = PENDING (never contains Base64 strings)
    const firestoreReportPayload: Record<string, any> = {
      ...createdReport,
      createdAt: serverTimestamp(),
    };
    delete firestoreReportPayload.imageUrl;
    delete firestoreReportPayload.storagePath;
    delete firestoreReportPayload.base64Data;

    try {
      await setDoc(doc(db, 'reports', newId), firestoreReportPayload);
    } catch (err) {
      handleFirestoreOperationError(err, 'create', `reports/${newId}`);
    }

    reportInput.onUploadProgress?.(60);

    // 2. Persist compressed Base64 evidence into reports/{reportId}/evidence/primary (partial-failure safe!)
    let evidenceUploadFailed = false;
    let evidenceUploadError: string | undefined;

    if (preparedEvidence) {
      try {
        const savedEvidence = await this.saveReportEvidence(newId, preparedEvidence, 'primary');
        await updateDoc(doc(db, 'reports', newId), {
          hasEvidence: true,
          evidenceCount: 1,
          primaryEvidenceId: savedEvidence.id,
          evidenceStatus: 'SAVED',
          updatedAt: new Date().toISOString(),
        });
        createdReport.hasEvidence = true;
        createdReport.evidenceCount = 1;
        createdReport.primaryEvidenceId = savedEvidence.id;
        createdReport.evidenceStatus = 'SAVED';
      } catch (evErr: any) {
        evidenceUploadFailed = true;
        const fallbackErr = String(evErr?.message || 'Failed to save compressed photo evidence in Firestore.');
        evidenceUploadError = fallbackErr;
        createdReport.hasEvidence = false;
        createdReport.evidenceCount = 0;
        createdReport.evidenceStatus = 'FAILED';
        createdReport.evidenceError = fallbackErr;
        await updateDoc(doc(db, 'reports', newId), {
          hasEvidence: false,
          evidenceCount: 0,
          evidenceStatus: 'FAILED',
          evidenceError: fallbackErr.slice(0, 280),
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    }

    reportInput.onUploadProgress?.(75);

    // 3. Start Gemini visual assessment AFTER saving report + evidence; preserve official verificationStatus untouched
    if (hasPhotoPayload) {
      aiResult = await this.verifyImageWithAi({
        imageBase64: aiBase64Payload,
        mimeType: preparedEvidence?.mimeType || reportInput.imageMimeType || 'image/jpeg',
        description: reportInput.description,
        waterLevel: reportInput.waterLevel,
        floodType: reportInput.floodType,
      });

      const aiCompleted = aiResult.aiStatus === 'COMPLETED';
      const nextIncidentStatus = aiCompleted ? 'Under Review' : 'Submitted';
      const aiHistoryEntry: StatusHistoryEntry = {
        status: nextIncidentStatus,
        timestamp: new Date().toISOString(),
        authorName: aiResult.method,
        note: aiCompleted
          ? `AI Assessment: "${aiResult.aiAssessment}" (${aiResult.confidence ?? 'N/A'}% confidence). Field verification required by emergency officer.`
          : `AI Assessment (${aiResult.aiStatus}): ${aiResult.explanation}`,
      };

      createdReport.aiConfidence = aiResult.confidence;
      createdReport.aiClassification = aiResult.aiAssessment;
      createdReport.aiStatus = aiResult.aiStatus || 'FAILED';
      createdReport.aiVerificationDetails = aiResult;
      createdReport.incidentStatus = nextIncidentStatus;
      // Never auto-verify from AI
      createdReport.verificationStatus = 'UNDER REVIEW';
      createdReport.statusHistory = [...createdReport.statusHistory, aiHistoryEntry];

      await updateDoc(doc(db, 'reports', newId), {
        aiConfidence: createdReport.aiConfidence,
        aiClassification: createdReport.aiClassification,
        aiStatus: createdReport.aiStatus,
        aiVerificationDetails: createdReport.aiVerificationDetails,
        incidentStatus: createdReport.incidentStatus,
        verificationStatus: 'UNDER REVIEW',
        statusHistory: createdReport.statusHistory,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    reportInput.onUploadProgress?.(95);

    // 3. Persist status history and citizen confirmation notification
    for (let idx = 0; idx < createdReport.statusHistory.length; idx++) {
      const entry = createdReport.statusHistory[idx];
      await setDoc(doc(db, 'status_history', `${newId}_h_${idx}`), {
        reportId: newId,
        citizenUid: effectiveUid,
        ...entry,
      }).catch(() => {});
    }

    await setDoc(doc(db, 'notifications', `notif_${newId}`), {
      reportId: newId,
      recipientUid: effectiveUid,
      title: `Report ${newId} Submitted`,
      description: evidenceUploadFailed
        ? `Report metadata saved at ${createdReport.location}, but photo evidence upload failed and can be retried.`
        : aiResult.aiStatus === 'FAILED'
        ? `Report saved at ${createdReport.location}. AI verification failed; queued for officer review.`
        : aiResult.aiStatus === 'NOT_RUN'
        ? `Text report saved at ${createdReport.location}. Queued for manual officer inspection.`
        : aiResult.aiStatus === 'UNCONFIGURED'
        ? `Report & photo saved at ${createdReport.location}. Queued for manual officer inspection.`
        : `Report submitted at ${createdReport.location}. AI assessment: ${aiResult.aiAssessment}.`,
      status: createdReport.incidentStatus,
      severity: createdReport.riskLevel,
      type: 'NEW_REPORT',
      location: createdReport.location,
      createdAt: serverTimestamp(),
      unread: true,
    }).catch(() => {});

    // 4. Trusted server-side public_reports + hotspot sync (non-destructive if Admin SDK unavailable)
    try {
      const headers = await this.getBearerHeaders();
      const syncRes = await fetch('/api/reports/public-sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reportId: newId,
          submissionRequestId: reportInput.submissionRequestId,
        }),
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        createdReport.publicSyncStatus = 'SYNCED';
        if (syncData?.hotspot?.id) {
          matchedHotspot = syncData.hotspot as FloodHotspot;
          createdReport.hotspotId = matchedHotspot.id;
        }
        if (typeof syncData?.isDuplicate === 'boolean') {
          createdReport.isDuplicate = syncData.isDuplicate;
          createdReport.duplicateOfReportId = syncData.duplicateOfReportId || undefined;
        }
      } else {
        const errJson = await syncRes.json().catch(() => null);
        createdReport.publicSyncStatus = 'FAILED';
        createdReport.publicSyncError =
          errJson?.message || errJson?.error || `Server sync returned HTTP ${syncRes.status}`;
      }
    } catch (syncErr: any) {
      createdReport.publicSyncStatus = 'FAILED';
      createdReport.publicSyncError = syncErr?.message || 'Public map sync request failed.';
    }

    reportInput.onUploadProgress?.(100);

    return {
      report: createdReport,
      hotspot: matchedHotspot,
      isDuplicate: createdReport.isDuplicate,
      duplicateOfId: createdReport.duplicateOfReportId,
      duplicateCheckStatus,
      duplicateCheckWarning: dupOutcome.warning,
      evidenceUploadFailed,
      evidenceUploadError,
    };
  }

  // --- Retry Public Map Sync (Firebase Admin) ---
  public async retryPublicSync(reportId: string): Promise<{
    ok: boolean;
    report?: FloodReport;
    hotspot?: FloodHotspot;
    error?: string;
  }> {
    if (!isFirebaseConfigured || !db) {
      return { ok: false, error: firebaseConfigError || 'Firebase is not configured.' };
    }
    try {
      const headers = await this.getBearerHeaders();
      const syncRes = await fetch('/api/reports/public-sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ reportId }),
      });
      const data = await syncRes.json().catch(() => null);
      if (!syncRes.ok) {
        const errorMsg = data?.message || data?.error || `Public sync failed (HTTP ${syncRes.status})`;
        return { ok: false, error: errorMsg };
      }
      return {
        ok: true,
        hotspot: data?.hotspot as FloodHotspot | undefined,
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to contact server public sync endpoint.' };
    }
  }

  // --- Retry AI Verification via Server Admin SDK Endpoint (Concurrent Duplicate Guarded + Spark Fallback) ---
  public async retryAiVerification(
    reportId: string,
    override?: { customImage?: string; mimeType?: string }
  ): Promise<FloodReport | null> {
    if (!isFirebaseConfigured || !auth?.currentUser) {
      throw new Error('Authentication required to retry AI verification.');
    }

    if (this.inFlightAiRetryIds.has(reportId)) {
      throw new Error(`AI analysis is already in progress for report ${reportId}. Please wait.`);
    }

    this.inFlightAiRetryIds.add(reportId);
    try {
      const headers = await this.getBearerHeaders();
      const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/retry-ai`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...(override?.customImage ? { customImage: override.customImage } : {}),
          ...(override?.mimeType ? { mimeType: override.mimeType } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data?.report) {
        return data.report as FloodReport;
      }

      // If server Admin SDK is not configured on Spark-plan local dev (501/503), execute client-authorized retry against /api/ai/verify
      if ((res.status === 501 || res.status === 503) && db) {
        const snap = await getDoc(doc(db, 'reports', reportId));
        if (!snap.exists()) {
          throw new Error(`Report ${reportId} not found in Firestore.`);
        }
        const existing = snap.data() as FloodReport;
        let imageBase64 = override?.customImage ? stripDataUrlPrefix(override.customImage) : '';
        let mimeType = override?.mimeType || 'image/jpeg';

        if (!imageBase64) {
          const primaryEvidence = await this.getReportEvidence(
            reportId,
            existing.primaryEvidenceId || 'primary'
          );
          if (primaryEvidence?.base64Data) {
            imageBase64 = primaryEvidence.base64Data;
            mimeType = primaryEvidence.mimeType || 'image/jpeg';
          }
        }

        if (!imageBase64) {
          throw new Error(
            'No compressed photo evidence found in Firestore for this report. Upload photo evidence before retrying AI.'
          );
        }

        const aiResult = await this.verifyImageWithAi({
          imageBase64,
          mimeType,
          description: existing.description,
          waterLevel: existing.waterLevel,
          floodType: existing.floodType,
        });

        const timestamp = new Date().toISOString();
        const preservedVerificationStatus = existing.verificationStatus || 'UNDER REVIEW';
        const nextStatus: IncidentStatus =
          aiResult.aiStatus === 'COMPLETED' && existing.incidentStatus === 'Submitted'
            ? 'Under Review'
            : existing.incidentStatus;

        const historyEntry: StatusHistoryEntry = {
          status: nextStatus,
          timestamp,
          authorName: aiResult.method,
          note:
            aiResult.aiStatus === 'COMPLETED'
              ? `Retry AI Assessment completed: "${aiResult.aiAssessment}" (${aiResult.confidence ?? 'N/A'}% confidence). Human officer review required.`
              : `Retry AI Assessment (${aiResult.aiStatus}): ${aiResult.explanation}`,
        };

        const nextHistory = [...(existing.statusHistory || []), historyEntry];

        await updateDoc(doc(db, 'reports', reportId), {
          incidentStatus: nextStatus,
          verificationStatus: preservedVerificationStatus,
          aiConfidence: aiResult.confidence,
          aiClassification: aiResult.aiAssessment,
          aiStatus: aiResult.aiStatus,
          aiVerificationDetails: aiResult,
          statusHistory: nextHistory,
          updatedAt: timestamp,
        });

        await setDoc(doc(db, 'status_history', `${reportId}_h_${Date.now()}`), {
          reportId,
          citizenUid: existing.reporterId || auth.currentUser.uid,
          ...historyEntry,
        }).catch(() => {});

        return {
          ...existing,
          id: reportId,
          incidentStatus: nextStatus,
          verificationStatus: preservedVerificationStatus,
          aiConfidence: aiResult.confidence,
          aiClassification: aiResult.aiAssessment,
          aiStatus: aiResult.aiStatus,
          aiVerificationDetails: aiResult,
          statusHistory: nextHistory,
        };
      }

      throw new Error(data?.error || `AI verification retry failed (HTTP ${res.status})`);
    } finally {
      this.inFlightAiRetryIds.delete(reportId);
    }
  }

  // --- Incident Lifecycle Status Updates (Emergency Officer Only) ---
  public async updateIncidentStatus(
    reportId: string,
    newStatus: IncidentStatus,
    authorName: string,
    officerNote?: string
  ): Promise<{ report: FloodReport; auditRecord?: BlockchainRecord } | null> {
    if (!isFirebaseConfigured || !db || !auth?.currentUser) {
      throw new Error(firebaseConfigError || 'Authenticated Firebase connection required.');
    }

    const snap = await getDoc(doc(db, 'reports', reportId));
    if (!snap.exists()) {
      throw new Error(`Report ${reportId} not found in Firestore.`);
    }
    const existing = snap.data() as FloodReport;

    const timestamp = new Date().toISOString();
    const newEntry: StatusHistoryEntry = {
      status: newStatus,
      timestamp,
      authorName,
      ...(officerNote ? { note: officerNote } : {}),
    };

    const isNowVerified = newStatus === 'Verified' || newStatus === 'Alert Issued' || newStatus === 'Resolved';
    const updatedReport: FloodReport = {
      ...existing,
      id: reportId,
      incidentStatus: newStatus,
      verificationStatus: isNowVerified ? 'VERIFIED' : newStatus === 'Rejected' ? 'REJECTED' : 'UNDER REVIEW',
      statusHistory: [...(existing.statusHistory || []), newEntry],
      officerNotes: officerNote ? [...(existing.officerNotes || []), officerNote] : existing.officerNotes || [],
      verificationTimestamp: isNowVerified ? (existing.verificationTimestamp || timestamp) : existing.verificationTimestamp,
      verifiedBy: isNowVerified ? (existing.verifiedBy || authorName) : existing.verifiedBy,
    };

    await updateDoc(doc(db, 'reports', reportId), {
      incidentStatus: updatedReport.incidentStatus,
      verificationStatus: updatedReport.verificationStatus,
      statusHistory: updatedReport.statusHistory,
      officerNotes: updatedReport.officerNotes || [],
      verificationTimestamp: updatedReport.verificationTimestamp || null,
      verifiedBy: updatedReport.verifiedBy || null,
      updatedAt: timestamp,
    });

    await setDoc(doc(db, 'status_history', `${reportId}_h_${Date.now()}`), {
      reportId,
      citizenUid: updatedReport.reporterId || '',
      ...newEntry,
    });

    if (updatedReport.reporterId) {
      await setDoc(doc(db, 'notifications', `notif_${reportId}_${Date.now()}`), {
        reportId,
        recipientUid: updatedReport.reporterId,
        title: `Incident ${reportId} Updated: ${newStatus}`,
        description: officerNote || `Status updated to ${newStatus} by ${authorName}.`,
        status: newStatus,
        severity: newStatus === 'Alert Issued' ? 'HIGH' : 'MEDIUM',
        type: 'OFFICER_UPDATE',
        location: updatedReport.location || '',
        createdAt: serverTimestamp(),
        unread: true,
      });
    }

    await updateDoc(doc(db, 'public_reports', reportId), {
      incidentStatus: updatedReport.incidentStatus,
      verificationStatus: updatedReport.verificationStatus,
    }).catch(() => {});

    let auditRecord: BlockchainRecord | undefined;
    if (newStatus === 'Alert Issued' || newStatus === 'Verified') {
      try {
        const existingChain = await this.getBlockchainRecords();
        const latest = existingChain[0];
        auditRecord = generateAuditChainRecord(
          updatedReport.hotspotId || reportId,
          updatedReport.location,
          updatedReport.riskLevel,
          {
            prevHash: latest?.recordHash || GENESIS_PREV_HASH,
            blockNumber: (latest?.blockNumber || 0) + 1,
          }
        );
        await setDoc(doc(db, 'blockchain_records', auditRecord.eventId), auditRecord);
      } catch {
        // Non-blocking audit chain write
      }
    }

    return { report: updatedReport, auditRecord };
  }

  // --- Hotspots ---
  public async getHotspots(): Promise<FloodHotspot[]> {
    if (!isFirebaseConfigured || !db) return [];
    const snapshot = await getDocs(collection(db, 'hotspots'));
    return snapshot.docs.map((d) => d.data() as FloodHotspot);
  }

  public async persistHotspots(hotspots: FloodHotspot[]): Promise<void> {
    if (!isFirebaseConfigured || !db) return;
    for (const h of hotspots) {
      await setDoc(doc(db, 'hotspots', h.id), h, { merge: true }).catch(() => {});
    }
  }

  // --- Audit Hash-Chain Records ---
  public async getBlockchainRecords(): Promise<BlockchainRecord[]> {
    if (!isFirebaseConfigured || !db) return [];
    const snapshot = await getDocs(query(collection(db, 'blockchain_records'), orderBy('blockNumber', 'desc')));
    return snapshot.docs.map((d) => d.data() as BlockchainRecord);
  }

  // --- Real-Time Firestore Synchronization ---
  public subscribeToReports(
    onUpdate: (reports: FloodReport[]) => void,
    onError: (error: Error) => void,
    options?: { role?: 'officer' | 'citizen'; uid?: string }
  ): Unsubscribe | null {
    if (!isFirebaseConfigured || !db) return null;
    const activeUid = options?.uid || auth?.currentUser?.uid;
    if (!activeUid) {
      const pubQ = query(collection(db, 'public_reports'), orderBy('timestamp', 'desc'));
      return onSnapshot(
        pubQ,
        (snapshot) => {
          onUpdate(snapshot.docs.map((d) => d.data() as FloodReport));
        },
        (err) => onError(err)
      );
    }

    if (options?.role === 'officer') {
      const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
      return onSnapshot(
        q,
        (snapshot) => onUpdate(snapshot.docs.map((d) => d.data() as FloodReport)),
        (err) => onError(err)
      );
    }

    // Citizen: combine own private /reports + public /public_reports
    let latestOwn: FloodReport[] = [];
    let latestPub: FloodReport[] = [];
    const emitMerged = () => {
      const map = new Map<string, FloodReport>();
      latestPub.forEach((r) => r.id && map.set(r.id, r));
      latestOwn.forEach((r) => r.id && map.set(r.id, r));
      onUpdate(Array.from(map.values()).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)));
    };

    const unsubOwn = onSnapshot(
      query(collection(db, 'reports'), where('reporterId', '==', activeUid), orderBy('timestamp', 'desc')),
      (snap) => {
        latestOwn = snap.docs.map((d) => d.data() as FloodReport);
        emitMerged();
      },
      (err) => onError(err)
    );
    const unsubPub = onSnapshot(
      query(collection(db, 'public_reports'), orderBy('timestamp', 'desc')),
      (snap) => {
        latestPub = snap.docs.map((d) => d.data() as FloodReport);
        emitMerged();
      },
      (err) => onError(err)
    );

    return () => {
      unsubOwn();
      unsubPub();
    };
  }

  public subscribeToHotspots(
    onUpdate: (hotspots: FloodHotspot[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe | null {
    if (!isFirebaseConfigured || !db) return null;
    return onSnapshot(
      collection(db, 'hotspots'),
      (snapshot) => {
        onUpdate(snapshot.docs.map((d) => d.data() as FloodHotspot));
      },
      (err) => onError(err)
    );
  }

  public subscribeToNotifications(
    uid: string,
    isOfficer: boolean,
    onUpdate: (items: any[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe | null {
    if (!isFirebaseConfigured || !db || !uid) return null;
    const q = isOfficer
      ? query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))
      : query(
          collection(db, 'notifications'),
          where('recipientUid', '==', uid),
          orderBy('createdAt', 'desc')
        );
    return onSnapshot(
      q,
      (snapshot) => {
        onUpdate(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      (err) => onError(err)
    );
  }

  public async markNotificationReadInFirestore(notificationId: string): Promise<void> {
    if (!isFirebaseConfigured || !db) return;
    await updateDoc(doc(db, 'notifications', notificationId), { unread: false }).catch(() => {});
  }

  // --- Auth & Authoritative Two-Role Integration (CITIZEN & EMERGENCY OFFICER only) ---
  public formatFirebaseAuthError(err: any): string {
    const code = String(err?.code || '');
    switch (code) {
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication -> Sign-in method). Enable Email/Password there or use Google Sign-In.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password. Please verify your credentials and try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many failed authentication attempts. Please wait a few minutes and try again.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Google sign-in popup was closed before completing authentication.';
      case 'auth/popup-blocked':
        return 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
      case 'auth/network-request-failed':
        return 'Network error contacting Firebase Authentication. Check your connection and retry.';
      default:
        return err?.message || 'Authentication failed. Please try again.';
    }
  }

  public async createCitizenUserProfileInFirestore(
    uid: string,
    name: string,
    email: string,
    phone?: string
  ): Promise<void> {
    if (!isFirebaseConfigured || !db || !uid) return;
    const userRef = doc(db, 'users', uid);
    const existing = await getDoc(userRef);
    if (existing.exists()) {
      return;
    }
    await setDoc(userRef, {
      uid,
      displayName: name,
      name,
      email,
      phone: phone || '',
      role: 'citizen',
      isOfficer: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  public async updateUserProfileInFirestore(
    uid: string,
    updates: {
      name?: string;
      phone?: string;
      department?: string;
      emergencySector?: string;
      avatarUrl?: string;
    } & Record<string, any>
  ): Promise<void> {
    const forbiddenKeys = [
      'role',
      'isOfficer',
      'officer',
      'admin',
      'isAdmin',
      'claims',
      'customClaims',
      'permissions',
      'uid',
      'email',
    ];
    for (const key of forbiddenKeys) {
      if (key in updates && updates[key] !== undefined) {
        throw new Error(`Forbidden: "${key}" cannot be modified via profile updates.`);
      }
    }

    if (!isFirebaseConfigured || !db || !uid) {
      throw new Error(firebaseConfigError || 'Firebase Firestore user profile storage is not configured.');
    }

    const sanitizedPayload: Record<string, any> = {};
    if (typeof updates.name === 'string' && updates.name.trim()) {
      const trimmed = updates.name.trim().slice(0, 120);
      sanitizedPayload.displayName = trimmed;
      sanitizedPayload.name = trimmed;
    }
    if (updates.phone !== undefined) {
      sanitizedPayload.phone = String(updates.phone).trim().slice(0, 40);
    }
    if (updates.department !== undefined) {
      sanitizedPayload.department = String(updates.department).trim().slice(0, 120);
    }
    if (updates.emergencySector !== undefined) {
      sanitizedPayload.emergencySector = String(updates.emergencySector).trim().slice(0, 120);
    }
    if (typeof updates.avatarUrl === 'string' && updates.avatarUrl.trim()) {
      sanitizedPayload.avatarUrl = updates.avatarUrl.trim().slice(0, 500);
    }

    if (Object.keys(sanitizedPayload).length === 0) return;

    sanitizedPayload.updatedAt = serverTimestamp();
    await updateDoc(doc(db, 'users', uid), sanitizedPayload);
  }

  public async getAuthoritativeFirebaseRole(user: any, forceRefresh = true): Promise<'officer' | 'citizen'> {
    if (!user) return 'citizen';
    try {
      if (typeof user.getIdTokenResult === 'function') {
        const tokenResult = await user.getIdTokenResult(forceRefresh);
        if (tokenResult?.claims?.role === 'officer' || tokenResult?.claims?.officer === true) {
          return 'officer';
        }
      }
      if (db && user.uid) {
        const officerSnap = await getDoc(doc(db, 'officers', user.uid));
        if (officerSnap.exists() && officerSnap.data()?.active !== false) {
          return 'officer';
        }
      }
    } catch (err) {
      console.warn('Authoritative role check fallback to citizen:', err);
    }
    return 'citizen';
  }

  public async verifyOfficerWithBackend(user: any): Promise<{
    authorized: boolean;
    role: 'officer' | 'citizen';
    verificationSource?: string;
    error?: string;
    status: number;
  }> {
    if (!user || typeof user.getIdToken !== 'function') {
      return {
        authorized: false,
        role: 'citizen',
        status: 401,
        error: 'Authentication session missing. Please sign in with Firebase Authentication.',
      };
    }

    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch('/api/auth/verify-officer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.authorized === true && data?.role === 'officer') {
        return {
          authorized: true,
          role: 'officer',
          verificationSource: data.verificationSource,
          status: res.status,
        };
      }
      return {
        authorized: false,
        role: 'citizen',
        status: res.status,
        error:
          data?.error ||
          'Access denied: this account is not pre-authorized as an Emergency Officer.',
      };
    } catch (err: any) {
      return {
        authorized: false,
        role: 'citizen',
        status: 500,
        error: err?.message || 'Unable to verify Emergency Officer credentials with backend.',
      };
    }
  }

  public async fetchVerifiedSessionRole(user: any): Promise<'officer' | 'citizen'> {
    if (!user || typeof user.getIdToken !== 'function') return 'citizen';
    try {
      const idToken = await user.getIdToken(false);
      const res = await fetch('/api/auth/session', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.authenticated && data?.role === 'officer') {
          return 'officer';
        }
        return 'citizen';
      }
    } catch {
      // Fall back to verified Firebase token claims check
    }
    return this.getAuthoritativeFirebaseRole(user, false);
  }

  public async sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (!isFirebaseConfigured || !auth) {
      return {
        success: false,
        message: firebaseConfigError || 'Firebase Authentication is not configured in this environment.',
      };
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return {
        success: true,
        message: `Password reset instructions sent to ${cleanEmail}. Check your inbox.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: this.formatFirebaseAuthError(err),
      };
    }
  }

  private googleSignInInFlight: Promise<{
    uid?: string;
    email?: string;
    displayName?: string;
    role?: 'officer' | 'citizen';
    fbUser?: any;
    redirected?: boolean;
  }> | null = null;

  public async consumeGoogleRedirectResult(): Promise<{
    fbUser: any;
    portal: 'citizen' | 'officer';
  } | null> {
    if (!isFirebaseConfigured || !auth) return null;
    let portal: 'citizen' | 'officer' = 'citizen';
    try {
      const storedPortal =
        typeof window !== 'undefined' ? window.sessionStorage.getItem(PENDING_GOOGLE_PORTAL_KEY) : null;
      if (storedPortal === 'officer') portal = 'officer';
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(PENDING_GOOGLE_PORTAL_KEY);
      }
    } catch {
      // Ignore storage access restrictions
    }

    try {
      const redirectResult = await getRedirectResult(auth);
      if (!redirectResult?.user) {
        return null;
      }
      if (portal !== 'officer') {
        await this.createCitizenUserProfileInFirestore(
          redirectResult.user.uid,
          redirectResult.user.displayName || redirectResult.user.email?.split('@')[0] || 'Citizen Reporter',
          redirectResult.user.email || '',
          redirectResult.user.phoneNumber || ''
        ).catch(() => {});
      }
      return { fbUser: redirectResult.user, portal };
    } catch (err: any) {
      console.warn('Google redirect sign-in processing failed:', err?.message);
      return null;
    }
  }

  public async loginWithGoogle(options?: {
    portal?: 'citizen' | 'officer';
    useRedirect?: boolean;
  }): Promise<{
    uid?: string;
    email?: string;
    displayName?: string;
    role?: 'officer' | 'citizen';
    fbUser?: any;
    redirected?: boolean;
  }> {
    if (!isFirebaseConfigured || !auth) {
      throw new Error(firebaseConfigError || 'Firebase Authentication is not configured.');
    }

    if (this.googleSignInInFlight) {
      return this.googleSignInInFlight;
    }

    const portal = options?.portal || 'citizen';

    const startRedirectFlow = async () => {
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(PENDING_GOOGLE_PORTAL_KEY, portal);
        }
      } catch {
        // Ignore sessionStorage restrictions
      }
      await signInWithRedirect(auth!, googleProvider);
      return { redirected: true };
    };

    this.googleSignInInFlight = (async () => {
      if (options?.useRedirect) {
        return startRedirectFlow();
      }

      try {
        const result = await signInWithPopup(auth!, googleProvider);
        const role = await this.fetchVerifiedSessionRole(result.user);
        if (role !== 'officer' && portal !== 'officer') {
          await this.createCitizenUserProfileInFirestore(
            result.user.uid,
            result.user.displayName || result.user.email?.split('@')[0] || 'Citizen Reporter',
            result.user.email || '',
            result.user.phoneNumber || ''
          ).catch(() => {});
        }
        return {
          uid: result.user.uid,
          email: result.user.email || '',
          displayName: result.user.displayName || 'Authorized User',
          role,
          fbUser: result.user,
          redirected: false,
        };
      } catch (err: any) {
        const code = String(err?.code || '');
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment'
        ) {
          return startRedirectFlow();
        }
        throw err;
      }
    })();

    try {
      return await this.googleSignInInFlight;
    } finally {
      this.googleSignInInFlight = null;
    }
  }

  public async logout(): Promise<void> {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(PENDING_GOOGLE_PORTAL_KEY);
      } catch {
        // Ignore storage restrictions
      }
    }
    if (isFirebaseConfigured && auth) {
      await fbSignOut(auth);
    }
  }
}

export const floodService = new FloodService();
