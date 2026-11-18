/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GEMINI_FALLBACK_MODEL = '';
export const DEFAULT_GEMINI_TIMEOUT_MS = 75_000; // 75 seconds per multimodal attempt (60-90s target)
export const DEFAULT_GEMINI_MAX_RETRIES = 2; // Max 3 total primary attempts (initial + 2 bounded retries)
export const DEFAULT_GEMINI_RETRY_BASE_DELAY_MS = 4_000; // Retry 1 ~2-4s, Retry 2 ~4-8s with equal jitter
export const DEFAULT_GEMINI_RETRY_MAX_DELAY_MS = 10_000; // Bounded max backoff per retry wait
export const MAX_GEMINI_RETRY_AFTER_MS = 15_000; // Safety cap on honored Retry-After header waits
export const MAX_GEMINI_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB raw upload ceiling

const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

export type SupportedGeminiMime = 'image/jpeg' | 'image/png' | 'image/webp';

export type GeminiErrorCategory =
  | 'TIMEOUT'
  | 'INVALID_MODEL'
  | 'INVALID_API_KEY'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED_OR_QUOTA'
  | 'UPSTREAM_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'MALFORMED_OUTPUT'
  | 'UNKNOWN_ERROR';

export interface GeminiErrorDiagnosis {
  category: GeminiErrorCategory;
  httpStatus: 502 | 503 | 504;
  upstreamStatus: number | null;
  retryable: boolean;
  userMessage: string;
  safeLogMessage: string;
}

export interface GeminiAssessmentPayload {
  method: string;
  modelName: string;
  aiStatus: 'COMPLETED' | 'FAILED' | 'UNCONFIGURED' | 'NOT_RUN';
  hasVisibleFlooding: boolean;
  aiAssessment:
    | 'Possible Flooding Detected'
    | 'No Clear Flooding Detected'
    | 'Uncertain Image'
    | 'Invalid or Unusable Photograph'
    | 'AI Processing Failed'
    | 'AI Verification Not Configured'
    | 'AI Not Run (No Image)';
  officialStatus: 'Under Review';
  confidence: number | null;
  explanation: string;
  uncertainty: string;
  waterLevelEstimated: string;
  roadAccessibilityEstimated: string;
  humanVerificationRequired: boolean;
  timestamp: string;
  disclaimer: string;
  diagnosticCode?: GeminiErrorCategory;
  upstreamStatus?: number | null;
  requestId?: string;
  retryable?: boolean;
}

export interface GeminiAssessmentResult {
  statusCode: number;
  payload: GeminiAssessmentPayload;
  requestId: string;
  diagnosis?: GeminiErrorDiagnosis;
}

export type GeminiClientLike = {
  models: {
    generateContent: (args: any) => Promise<{ text?: string }>;
    list?: () => Promise<AsyncIterable<{ name?: string; supportedActions?: string[] }>>;
  };
};

export function createGeminiRequestId(): string {
  return `gai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getConfiguredGeminiModel(overrideModel?: string | null): string {
  if (typeof overrideModel === 'string' && overrideModel.trim()) {
    return overrideModel.trim().replace(/^models\//, '');
  }
  const envModel = process.env.GEMINI_MODEL;
  if (typeof envModel === 'string' && envModel.trim()) {
    return envModel.trim().replace(/^models\//, '');
  }
  return DEFAULT_GEMINI_MODEL;
}

export function getConfiguredFallbackGeminiModel(
  overrideFallbackModel?: string | null,
  primaryModel?: string
): string | null {
  let candidate = '';
  if (overrideFallbackModel !== undefined) {
    candidate = typeof overrideFallbackModel === 'string' ? overrideFallbackModel.trim() : '';
  } else if (typeof process.env.GEMINI_FALLBACK_MODEL === 'string') {
    candidate = process.env.GEMINI_FALLBACK_MODEL.trim();
  } else {
    candidate = DEFAULT_GEMINI_FALLBACK_MODEL;
  }

  const normalized = candidate.replace(/^models\//, '').trim();
  if (!normalized) return null;
  if (primaryModel && normalized === primaryModel.replace(/^models\//, '').trim()) {
    return null;
  }
  return normalized;
}

export function getGeminiTimeoutMs(overrideTimeoutMs?: number | null): number {
  if (typeof overrideTimeoutMs === 'number' && Number.isFinite(overrideTimeoutMs) && overrideTimeoutMs > 0) {
    return Math.min(Math.max(Math.round(overrideTimeoutMs), 50), 180_000);
  }
  const raw = process.env.GEMINI_TIMEOUT_MS;
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1000) {
      return Math.min(parsed, 180_000);
    }
  }
  return DEFAULT_GEMINI_TIMEOUT_MS;
}

export function getGeminiMaxRetries(overrideMaxRetries?: number | null): number {
  if (typeof overrideMaxRetries === 'number' && Number.isFinite(overrideMaxRetries)) {
    return Math.min(Math.max(Math.round(overrideMaxRetries), 0), 4);
  }
  const raw = process.env.GEMINI_MAX_RETRIES;
  if (raw !== undefined) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, 0), 4);
    }
  }
  return DEFAULT_GEMINI_MAX_RETRIES;
}

export function getGeminiRetryBaseDelayMs(overrideBaseDelayMs?: number | null): number {
  if (typeof overrideBaseDelayMs === 'number' && Number.isFinite(overrideBaseDelayMs) && overrideBaseDelayMs >= 0) {
    return Math.min(Math.round(overrideBaseDelayMs), 30_000);
  }
  const raw = process.env.GEMINI_RETRY_BASE_DELAY_MS;
  if (raw !== undefined && raw.trim() !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.min(parsed, 30_000);
    }
  }
  return DEFAULT_GEMINI_RETRY_BASE_DELAY_MS;
}

export function getGeminiMethodLabel(modelId: string): string {
  if (modelId === 'gemini-4-hydrogen') {
    return 'Gemini 4 Hydrogen (Multimodal)';
  }
  return `Gemini Vision (${modelId})`;
}

/**
 * Only Gemini 3.x and Gemini 4.x text/multimodal models accept `thinkingConfig.thinkingLevel`.
 * Avoids sending unsupported parameters when GEMINI_MODEL points to other models (e.g., Gemini 2.5).
 */
export function supportsThinkingLevelConfig(modelId: string): boolean {
  const normalized = modelId.replace(/^models\//, '').toLowerCase();
  if (/(image|tts|live|embedding|transcribe)/i.test(normalized)) {
    return false;
  }
  return /^gemini-(3|4)(\.|-|$)/i.test(normalized);
}

/**
 * Validates decoded binary magic bytes against supported image formats.
 */
export function detectImageMagicMimeFromBuffer(buf: Buffer): SupportedGeminiMime | null {
  if (!buf || buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WEBP: RIFF....WEBP
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export interface NormalizedImageValidation {
  ok: boolean;
  statusCode?: 400 | 413;
  error?: string;
  detectedMime?: SupportedGeminiMime;
  canonicalBase64?: string;
  byteLength?: number;
}

/**
 * Validates and normalizes Base64 image bytes strictly without repeated conversions.
 */
export function validateAndPrepareImageBuffer(
  rawImageInput: string,
  declaredMimeType = 'image/jpeg'
): NormalizedImageValidation {
  const validDeclaredMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const normalizedDeclared = typeof declaredMimeType === 'string' ? declaredMimeType.toLowerCase().trim() : 'image/jpeg';
  if (normalizedDeclared && !validDeclaredMimes.includes(normalizedDeclared)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Invalid image format. Supported formats are JPG, JPEG, PNG, and WEBP.',
    };
  }

  const stripped = String(rawImageInput || '')
    .replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/i, '')
    .replace(/\s+/g, '')
    .trim();

  if (!stripped || !BASE64_REGEX.test(stripped)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Image payload is empty or contains invalid Base64 encoding.',
    };
  }

  const imageBuffer = Buffer.from(stripped, 'base64');
  if (imageBuffer.length < 32) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Image payload is empty or corrupt.',
    };
  }

  if (imageBuffer.length > MAX_GEMINI_IMAGE_BYTES) {
    return {
      ok: false,
      statusCode: 413,
      error: `Image size (${(imageBuffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum 5 MB server limit.`,
    };
  }

  const detectedMime = detectImageMagicMimeFromBuffer(imageBuffer);
  if (!detectedMime) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Uploaded binary does not match JPEG, PNG, or WEBP magic-byte signatures.',
    };
  }

  return {
    ok: true,
    detectedMime,
    canonicalBase64: imageBuffer.toString('base64'),
    byteLength: imageBuffer.length,
  };
}

export function stripApiKeyFromText(text: string): string {
  return String(text || '')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]')
    .slice(0, 320);
}

function extractNumericStatus(err: any): number | null {
  const candidates = [
    err?.status,
    err?.statusCode,
    err?.response?.status,
    err?.error?.code,
    err?.code,
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c) && c >= 100 && c < 600) {
      return c;
    }
    if (typeof c === 'string' && /^\d{3}$/.test(c)) {
      return Number.parseInt(c, 10);
    }
  }
  const msg = String(err?.message || '');
  const match = msg.match(/\b(400|401|403|404|408|429|500|502|503|504)\b/);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return null;
}

function readHeaderValue(headers: any, targetName: string): string | null {
  if (!headers) return null;
  if (typeof headers.get === 'function') {
    const val = headers.get(targetName);
    return typeof val === 'string' && val.trim() ? val.trim() : null;
  }
  if (typeof headers === 'object') {
    const lowerTarget = targetName.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lowerTarget && v !== undefined && v !== null) {
        const str = Array.isArray(v) ? String(v[0] ?? '') : String(v);
        return str.trim() || null;
      }
    }
  }
  return null;
}

export function extractRetryAfterMs(err: any, nowMs = Date.now()): number | null {
  const headerVal =
    readHeaderValue(err?.response?.headers, 'retry-after') ??
    readHeaderValue(err?.headers, 'retry-after') ??
    (typeof err?.retryAfter === 'string' || typeof err?.retryAfter === 'number'
      ? String(err.retryAfter).trim()
      : null);

  if (headerVal) {
    if (/^\d+(?:\.\d+)?$/.test(headerVal)) {
      const seconds = Number.parseFloat(headerVal);
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.round(seconds * 1000);
      }
    } else {
      const targetMs = Date.parse(headerVal);
      if (Number.isFinite(targetMs) && targetMs > nowMs) {
        return Math.round(targetMs - nowMs);
      }
    }
  }

  // Also check Google RPC RetryInfo metadata if surfaced on error details (e.g. "4s" or "2.5s")
  const details = Array.isArray(err?.error?.details)
    ? err.error.details
    : Array.isArray(err?.details)
    ? err.details
    : [];
  for (const detail of details) {
    const retryDelay = typeof detail?.retryDelay === 'string' ? detail.retryDelay.trim() : '';
    const secMatch = retryDelay.match(/^(\d+(?:\.\d+)?)s$/i);
    if (secMatch) {
      const secs = Number.parseFloat(secMatch[1]);
      if (Number.isFinite(secs) && secs > 0) {
        return Math.round(secs * 1000);
      }
    }
  }

  return null;
}

/**
 * Computes bounded exponential backoff with Equal Jitter (`exp / 2 + rand(0, exp / 2)`),
 * honoring valid Retry-After headers up to a strict safety cap.
 */
export function calculateGeminiRetryDelayMs(params: {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  retryAfterMs?: number | null;
  randomFn?: () => number;
}): number {
  const maxDelayMs =
    typeof params.maxDelayMs === 'number' && Number.isFinite(params.maxDelayMs) && params.maxDelayMs >= 0
      ? params.maxDelayMs
      : DEFAULT_GEMINI_RETRY_MAX_DELAY_MS;
  const rand = typeof params.randomFn === 'function' ? params.randomFn : Math.random;
  const clampedRand = Math.min(Math.max(rand(), 0), 1);

  let backoffMs = 0;
  if (params.baseDelayMs > 0) {
    const expCap = Math.min(maxDelayMs, params.baseDelayMs * Math.pow(2, Math.max(0, params.attempt - 1)));
    const half = expCap / 2;
    backoffMs = Math.round(half + clampedRand * half);
  }

  if (typeof params.retryAfterMs === 'number' && Number.isFinite(params.retryAfterMs) && params.retryAfterMs > 0) {
    const boundedRetryAfter = Math.min(Math.round(params.retryAfterMs), MAX_GEMINI_RETRY_AFTER_MS);
    return Math.max(backoffMs, boundedRetryAfter);
  }

  return backoffMs;
}

export function classifyGeminiError(
  err: any,
  modelId: string,
  timeoutMs: number
): GeminiErrorDiagnosis {
  const upstreamStatus = extractNumericStatus(err);
  const rawMsg = stripApiKeyFromText(String(err?.message || err?.error?.message || 'Gemini inference error'));
  const errName = String(err?.name || '');

  const isTimeout =
    errName === 'AbortError' ||
    errName === 'TimeoutError' ||
    err?.code === 'ETIMEDOUT' ||
    upstreamStatus === 408 ||
    upstreamStatus === 504 ||
    /timed out|timeout|aborted due to timeout|ETIMEDOUT/i.test(rawMsg);

  if (isTimeout) {
    const secs = Math.max(1, Math.round(timeoutMs / 1000));
    return {
      category: 'TIMEOUT',
      httpStatus: 504,
      upstreamStatus: upstreamStatus ?? 504,
      retryable: true,
      userMessage: `Gemini multimodal verification timed out after ${secs}s. Your report has been saved safely and you can retry AI analysis.`,
      safeLogMessage: rawMsg || `Request timed out after ${secs}s`,
    };
  }

  if (
    upstreamStatus === 401 ||
    (upstreamStatus === 400 && /API_KEY_INVALID|API key not valid|invalid api key/i.test(rawMsg)) ||
    /API_KEY_INVALID|API key not valid/i.test(rawMsg)
  ) {
    return {
      category: 'INVALID_API_KEY',
      httpStatus: 502,
      upstreamStatus: upstreamStatus ?? 400,
      retryable: false,
      userMessage:
        'Server GEMINI_API_KEY was rejected by the Gemini API. Verify the server-side API key configuration.',
      safeLogMessage: rawMsg,
    };
  }

  if (upstreamStatus === 403 || /PERMISSION_DENIED/i.test(rawMsg)) {
    return {
      category: 'PERMISSION_DENIED',
      httpStatus: 502,
      upstreamStatus: upstreamStatus ?? 403,
      retryable: false,
      userMessage: `Gemini API permission denied (HTTP 403) for model "${modelId}". Verify API enablement and key permissions.`,
      safeLogMessage: rawMsg,
    };
  }

  if (
    upstreamStatus === 404 ||
    /NOT_FOUND|is not found for API version|not supported for generateContent/i.test(rawMsg)
  ) {
    return {
      category: 'INVALID_MODEL',
      httpStatus: 502,
      upstreamStatus: upstreamStatus ?? 404,
      retryable: false,
      userMessage: `Configured Gemini model "${modelId}" was not found or does not support multimodal content generation (HTTP 404). Update GEMINI_MODEL on the server.`,
      safeLogMessage: rawMsg,
    };
  }

  if (upstreamStatus === 429 || /RESOURCE_EXHAUSTED|quota|rate limit|too many requests/i.test(rawMsg)) {
    const isHardQuotaExhausted =
      /limit:\s*0|daily limit|per[_ ]?day|quota exceeded for quota metric.*day|billing|free_tier.*exceeded|exhausted.*daily/i.test(
        rawMsg
      );
    return {
      category: 'RATE_LIMITED_OR_QUOTA',
      httpStatus: 502,
      upstreamStatus: upstreamStatus ?? 429,
      retryable: !isHardQuotaExhausted,
      userMessage: isHardQuotaExhausted
        ? 'Gemini API quota is exhausted for the configured project (HTTP 429). Report saved safely; check API billing/quota before retrying.'
        : 'Gemini API rate limit temporarily reached (HTTP 429). Report saved safely; please retry AI analysis shortly.',
      safeLogMessage: rawMsg,
    };
  }

  if (upstreamStatus === 503) {
    return {
      category: 'UPSTREAM_UNAVAILABLE',
      httpStatus: 503,
      upstreamStatus: 503,
      retryable: true,
      userMessage:
        'Gemini upstream service temporarily unavailable due to high model demand (HTTP 503). Report saved safely and ready for retry.',
      safeLogMessage: rawMsg,
    };
  }

  if (upstreamStatus === 500 || upstreamStatus === 502) {
    return {
      category: 'UPSTREAM_UNAVAILABLE',
      httpStatus: 502,
      upstreamStatus,
      retryable: true,
      userMessage: `Gemini upstream service temporarily unavailable (HTTP ${upstreamStatus}). Report saved safely and can be retried.`,
      safeLogMessage: rawMsg,
    };
  }

  if (/ECONNRESET|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|fetch failed|network/i.test(rawMsg)) {
    return {
      category: 'NETWORK_ERROR',
      httpStatus: 502,
      upstreamStatus: upstreamStatus ?? null,
      retryable: true,
      userMessage: 'Temporary network error contacting Gemini API. Report saved safely and ready for retry.',
      safeLogMessage: rawMsg,
    };
  }

  if (/malformed|confidenceScore|JSON/i.test(rawMsg)) {
    return {
      category: 'MALFORMED_OUTPUT',
      httpStatus: 502,
      upstreamStatus: upstreamStatus ?? 200,
      retryable: false,
      userMessage: `Gemini returned an unexpected non-structured response (${rawMsg}). Report saved safely for officer triage or retry.`,
      safeLogMessage: rawMsg,
    };
  }

  return {
    category: 'UNKNOWN_ERROR',
    httpStatus: 502,
    upstreamStatus,
    retryable: false,
    userMessage: `Gemini AI processing failed (${rawMsg}). Your flood report has been saved safely for officer review.`,
    safeLogMessage: rawMsg,
  };
}

export function parseGeminiJsonResponse(rawText: string): any {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    throw new Error('Gemini returned an empty response body.');
  }
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(fenceStripped);
  } catch {
    throw new Error('Gemini returned malformed non-JSON output');
  }
}

export async function runGeminiFloodAssessment(params: {
  geminiKey: string | null;
  cleanBase64: string;
  detectedMime: SupportedGeminiMime;
  waterLevel: string;
  floodType: string;
  description: string;
  endpointLabel: string;
  reportId?: string;
  modelOverride?: string | null;
  fallbackModelOverride?: string | null;
  timeoutMsOverride?: number | null;
  maxRetriesOverride?: number | null;
  retryBaseDelayMsOverride?: number | null;
  aiClientFactory?: (apiKey: string) => GeminiClientLike;
  sleepFn?: (ms: number) => Promise<void>;
  onSuccess?: () => void;
  onError?: (safeMessage: string) => void;
}): Promise<GeminiAssessmentResult> {
  const requestId = createGeminiRequestId();
  const primaryModelId = getConfiguredGeminiModel(params.modelOverride);
  const configuredFallbackModel = getConfiguredFallbackGeminiModel(
    params.fallbackModelOverride,
    primaryModelId
  );
  const timeoutMs = getGeminiTimeoutMs(params.timeoutMsOverride);
  const maxRetries = getGeminiMaxRetries(params.maxRetriesOverride);
  const retryBaseDelayMs = getGeminiRetryBaseDelayMs(params.retryBaseDelayMsOverride);
  const sleep = params.sleepFn ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const ts = new Date().toISOString();
  const disclaimer =
    'AI image assessment is an assistive early warning signal only. Official verification requires authorized emergency officer confirmation.';

  if (!params.geminiKey) {
    return {
      statusCode: 200,
      requestId,
      payload: {
        method: 'Gemini AI (Unconfigured)',
        modelName: primaryModelId,
        aiStatus: 'UNCONFIGURED',
        hasVisibleFlooding: false,
        aiAssessment: 'AI Verification Not Configured',
        officialStatus: 'Under Review',
        confidence: null,
        explanation:
          'Server GEMINI_API_KEY is not configured. Your flood photograph was saved safely and queued for manual emergency officer verification.',
        uncertainty:
          'Automated visual assessment is unavailable until GEMINI_API_KEY is configured on the server.',
        waterLevelEstimated: params.waterLevel,
        roadAccessibilityEstimated: 'Uncertain',
        humanVerificationRequired: true,
        timestamp: ts,
        disclaimer,
        requestId,
      },
    };
  }

  // Explicitly set SDK retryOptions.attempts = 1 so SDK retries NEVER multiply with application-level retries
  const ai = params.aiClientFactory
    ? params.aiClientFactory(params.geminiKey)
    : new GoogleGenAI({
        apiKey: params.geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
          retryOptions: {
            attempts: 1,
          },
        },
      });

  const prompt = `You are the AI verification engine for FloodSense, an urban disaster management platform for Colombo, Sri Lanka.
Analyze this submitted photograph carefully.
Citizen submission context:
- Claimed Water Level: "${params.waterLevel}"
- Flood Type: "${params.floodType}"
- Description: "${String(params.description || '').slice(0, 600)}"

Examine whether:
- Visible flooding or standing water exists
- Road surfaces or curbs/pedestrian paths are submerged
- Vehicles are affected or drainage overflow is visible
- Photograph is unclear, dark, unrelated, or unusable

Be objective and factual. Do NOT invent damage or flood severity.
Provide confidenceScore strictly as a percentage from 0 to 100 (e.g., 88 for 88%, never a 0.0-1.0 decimal).`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      hasVisibleFlooding: { type: Type.BOOLEAN },
      confidenceScore: {
        type: Type.NUMBER,
        description: 'Percentage confidence from 0 to 100 (e.g. 88.5 for 88.5%, NOT a 0 to 1 decimal).',
      },
      assessment: {
        type: Type.STRING,
        enum: [
          'Possible Flooding Detected',
          'No Clear Flooding Detected',
          'Uncertain Image',
          'Invalid or Unusable Photograph',
        ],
      },
      observedWaterLevel: {
        type: Type.STRING,
        enum: ['Low', 'Moderate', 'High', 'Severe', 'None'],
      },
      observedAccessibility: {
        type: Type.STRING,
        enum: ['Open', 'Partially Blocked', 'Completely Blocked', 'Uncertain'],
      },
      detailedExplanation: { type: Type.STRING },
      uncertaintyNotes: { type: Type.STRING },
    },
    required: [
      'hasVisibleFlooding',
      'confidenceScore',
      'assessment',
      'observedWaterLevel',
      'observedAccessibility',
      'detailedExplanation',
      'uncertaintyNotes',
    ],
  };

  const invokeModelOnce = async (targetModelId: string): Promise<any> => {
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          const timeoutErr = Object.assign(
            new Error(`Gemini multimodal verification timed out after ${Math.round(timeoutMs / 1000)}s`),
            { name: 'TimeoutError', code: 'ETIMEDOUT', status: 504 }
          );
          controller.abort(timeoutErr);
          reject(timeoutErr);
        }, timeoutMs);
      });

      const requestConfig: Record<string, any> = {
        abortSignal: controller.signal,
        responseMimeType: 'application/json',
        responseSchema,
        httpOptions: {
          retryOptions: {
            attempts: 1,
          },
        },
      };
      if (supportsThinkingLevelConfig(targetModelId)) {
        requestConfig.thinkingConfig = {
          thinkingLevel: ThinkingLevel.LOW,
        };
      }

      const callPromise = ai.models.generateContent({
        model: targetModelId,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: params.detectedMime,
                data: params.cleanBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: requestConfig,
      });

      const geminiRes = await Promise.race([callPromise, timeoutPromise]);
      const candidateParsed = parseGeminiJsonResponse(geminiRes?.text || '');
      if (
        typeof candidateParsed.confidenceScore !== 'number' ||
        !Number.isFinite(candidateParsed.confidenceScore) ||
        candidateParsed.confidenceScore < 0 ||
        candidateParsed.confidenceScore > 100
      ) {
        throw new Error('Gemini output omitted a valid numeric confidenceScore (0-100)');
      }
      return candidateParsed;
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
        timeoutHandle = undefined;
      }
    }
  };

  let lastDiagnosis: GeminiErrorDiagnosis | null = null;
  let parsed: any = null;
  let succeededModelId = primaryModelId;
  let finalFailedModelId = primaryModelId;

  const primaryTotalAttempts = 1 + maxRetries;

  for (let attempt = 1; attempt <= primaryTotalAttempts; attempt++) {
    try {
      parsed = await invokeModelOnce(primaryModelId);
      succeededModelId = primaryModelId;
      lastDiagnosis = null;
      break;
    } catch (err: any) {
      const diagnosis = classifyGeminiError(err, primaryModelId, timeoutMs);
      lastDiagnosis = diagnosis;
      finalFailedModelId = primaryModelId;

      // Safe structured telemetry log: NEVER logs API keys, credentials, Base64 image data, or PII
      console.error(
        `[FloodSense AI] requestId=${requestId} endpoint=${params.endpointLabel}` +
          `${params.reportId ? ` reportId=${params.reportId}` : ''} model=${primaryModelId}` +
          ` attempt=${attempt}/${primaryTotalAttempts} upstreamStatus=${diagnosis.upstreamStatus ?? 'N/A'}` +
          ` category=${diagnosis.category} retryable=${diagnosis.retryable} msg="${diagnosis.safeLogMessage}"`
      );

      if (!diagnosis.retryable || attempt >= primaryTotalAttempts) {
        break;
      }

      const retryAfterMs = extractRetryAfterMs(err);
      const delayMs = calculateGeminiRetryDelayMs({
        attempt,
        baseDelayMs: retryBaseDelayMs,
        maxDelayMs: DEFAULT_GEMINI_RETRY_MAX_DELAY_MS,
        retryAfterMs,
      });
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  // Optional single-attempt failover strictly for persistent 503 UPSTREAM_UNAVAILABLE,
  // and ONLY when GEMINI_FALLBACK_MODEL is explicitly configured AND confirmed via Gemini API model list.
  if (
    (!parsed || lastDiagnosis) &&
    lastDiagnosis?.category === 'UPSTREAM_UNAVAILABLE' &&
    lastDiagnosis?.upstreamStatus === 503 &&
    configuredFallbackModel
  ) {
    const fallbackCheck = await confirmFallbackModelSupport(
      ai,
      params.geminiKey,
      primaryModelId,
      configuredFallbackModel,
      params.aiClientFactory
    );

    if (fallbackCheck.confirmed) {
      try {
        parsed = await invokeModelOnce(configuredFallbackModel);
        succeededModelId = configuredFallbackModel;
        lastDiagnosis = null;
      } catch (fallbackErr: any) {
        const fallbackDiagnosis = classifyGeminiError(fallbackErr, configuredFallbackModel, timeoutMs);
        lastDiagnosis = fallbackDiagnosis;
        finalFailedModelId = configuredFallbackModel;

        console.error(
          `[FloodSense AI] requestId=${requestId} endpoint=${params.endpointLabel}` +
            `${params.reportId ? ` reportId=${params.reportId}` : ''} model=${configuredFallbackModel}` +
            ` attempt=fallback-1/1 upstreamStatus=${fallbackDiagnosis.upstreamStatus ?? 'N/A'}` +
            ` category=${fallbackDiagnosis.category} retryable=${fallbackDiagnosis.retryable} msg="${fallbackDiagnosis.safeLogMessage}"`
        );
      }
    } else {
      console.error(
        `[FloodSense AI] requestId=${requestId} endpoint=${params.endpointLabel}` +
          `${params.reportId ? ` reportId=${params.reportId}` : ''} model=${configuredFallbackModel}` +
          ` attempt=fallback-skipped upstreamStatus=${lastDiagnosis.upstreamStatus ?? 'N/A'}` +
          ` category=${lastDiagnosis.category} retryable=${lastDiagnosis.retryable} msg="${stripApiKeyFromText(fallbackCheck.reason || 'Fallback model not confirmed in official Gemini model list')}"`
      );
    }
  }

  if (!parsed || lastDiagnosis) {
    const finalDiag =
      lastDiagnosis ||
      classifyGeminiError(new Error('Gemini multimodal verification failed.'), finalFailedModelId, timeoutMs);
    params.onError?.(finalDiag.safeLogMessage);
    return {
      statusCode: finalDiag.httpStatus,
      requestId,
      diagnosis: finalDiag,
      payload: {
        method: getGeminiMethodLabel(finalFailedModelId),
        modelName: finalFailedModelId,
        aiStatus: 'FAILED',
        hasVisibleFlooding: false,
        aiAssessment: 'AI Processing Failed',
        officialStatus: 'Under Review',
        confidence: null,
        explanation: finalDiag.userMessage,
        uncertainty: 'Live AI model failed to return a valid structured assessment.',
        waterLevelEstimated: params.waterLevel,
        roadAccessibilityEstimated: 'Uncertain',
        humanVerificationRequired: true,
        timestamp: ts,
        disclaimer,
        diagnosticCode: finalDiag.category,
        upstreamStatus: finalDiag.upstreamStatus,
        requestId,
        retryable: finalDiag.retryable,
      },
    };
  }

  const confidenceScore = Number(parsed.confidenceScore.toFixed(1));
  const validAssessments = new Set([
    'Possible Flooding Detected',
    'No Clear Flooding Detected',
    'Uncertain Image',
    'Invalid or Unusable Photograph',
  ]);
  const aiAssessment = (
    validAssessments.has(parsed.assessment)
      ? parsed.assessment
      : parsed.hasVisibleFlooding === true
      ? 'Possible Flooding Detected'
      : 'Uncertain Image'
  ) as GeminiAssessmentPayload['aiAssessment'];

  params.onSuccess?.();

  return {
    statusCode: 200,
    requestId,
    payload: {
      method: getGeminiMethodLabel(succeededModelId),
      modelName: succeededModelId,
      aiStatus: 'COMPLETED',
      hasVisibleFlooding: Boolean(parsed.hasVisibleFlooding),
      aiAssessment,
      officialStatus: 'Under Review',
      confidence: confidenceScore,
      explanation:
        typeof parsed.detailedExplanation === 'string' && parsed.detailedExplanation.trim()
          ? parsed.detailedExplanation
          : `Visual inspection indicated ${aiAssessment.toLowerCase()}.`,
      uncertainty:
        typeof parsed.uncertaintyNotes === 'string' && parsed.uncertaintyNotes.trim()
          ? parsed.uncertaintyNotes
          : 'Optical assessment subject to camera angle and lighting conditions. Field officer verification required.',
      waterLevelEstimated: parsed.observedWaterLevel || params.waterLevel,
      roadAccessibilityEstimated: parsed.observedAccessibility || 'Uncertain',
      humanVerificationRequired: true,
      timestamp: ts,
      disclaimer,
      requestId,
    },
  };
}

interface ModelListRecord {
  name: string;
  supportedActions?: string[];
}

let cachedModelProbe: {
  checkedAt: number;
  models: ModelListRecord[];
  error?: string;
} | null = null;

async function fetchGeminiModelList(
  ai: GeminiClientLike,
  useCache: boolean
): Promise<{
  probed: boolean;
  models: ModelListRecord[];
  error?: string;
}> {
  const now = Date.now();
  if (useCache && cachedModelProbe && now - cachedModelProbe.checkedAt <= 15 * 60 * 1000) {
    return {
      probed: true,
      models: cachedModelProbe.models,
      error: cachedModelProbe.error,
    };
  }

  if (typeof ai.models?.list !== 'function') {
    return {
      probed: false,
      models: [],
      error: 'Gemini client models.list() unavailable',
    };
  }

  try {
    const pager = await ai.models.list();
    const found: ModelListRecord[] = [];
    for await (const m of pager) {
      if (m?.name) {
        const shortName = String(m.name).replace(/^models\//, '');
        if (shortName.includes('gemini')) {
          found.push({
            name: shortName,
            supportedActions: Array.isArray(m.supportedActions) ? m.supportedActions : undefined,
          });
        }
      }
      if (found.length >= 60) break;
    }
    if (useCache) {
      cachedModelProbe = { checkedAt: now, models: found };
    }
    return { probed: true, models: found };
  } catch (err: any) {
    const safeErr = stripApiKeyFromText(err?.message || 'Unable to list Gemini models');
    if (useCache) {
      cachedModelProbe = { checkedAt: now, models: [], error: safeErr };
    }
    return { probed: true, models: [], error: safeErr };
  }
}

function isModelSupportingMultimodalJson(record: ModelListRecord | undefined, modelId: string): boolean {
  if (!record) return false;
  if (/(image|tts|live|embedding|transcribe|decision)/i.test(modelId)) {
    return false;
  }
  if (Array.isArray(record.supportedActions)) {
    return record.supportedActions.includes('generateContent');
  }
  return true;
}

async function confirmFallbackModelSupport(
  ai: GeminiClientLike,
  _geminiKey: string,
  primaryModelId: string,
  fallbackModelId: string,
  aiClientFactory?: (apiKey: string) => GeminiClientLike
): Promise<{ confirmed: boolean; reason?: string }> {
  if (!fallbackModelId || fallbackModelId === primaryModelId) {
    return { confirmed: false, reason: 'No distinct fallback model configured.' };
  }
  if (/(image|tts|live|embedding|transcribe|decision)/i.test(fallbackModelId)) {
    return { confirmed: false, reason: `Fallback model "${fallbackModelId}" is not a multimodal content model.` };
  }

  // Only bypass global cache when test factory is injected
  const probe = await fetchGeminiModelList(ai, !aiClientFactory);
  if (!probe.probed) {
    return {
      confirmed: false,
      reason: `Cannot confirm fallback model "${fallbackModelId}" without official Gemini API model list.`,
    };
  }
  if (probe.error) {
    return {
      confirmed: false,
      reason: `Failed to verify fallback model "${fallbackModelId}" in Gemini model list: ${probe.error}`,
    };
  }

  const matched = probe.models.find((m) => m.name === fallbackModelId);
  if (!isModelSupportingMultimodalJson(matched, fallbackModelId)) {
    return {
      confirmed: false,
      reason: `Fallback model "${fallbackModelId}" not confirmed for generateContent in Gemini API model list.`,
    };
  }
  return { confirmed: true };
}

/**
 * Checks which Gemini models are visible to the configured API key (cached 15 min, metadata-only).
 */
export async function probeAvailableGeminiModels(
  geminiKey: string | null,
  configuredModel: string,
  aiClientFactory?: (apiKey: string) => GeminiClientLike,
  fallbackModel?: string | null
): Promise<{
  probed: boolean;
  configuredModelAvailable: boolean | null;
  fallbackModelAvailable?: boolean | null;
  intended38FlashAvailable: boolean | null;
  hydrogenAvailable: boolean | null;
  sampleModels: string[];
  error?: string;
}> {
  if (!geminiKey) {
    return {
      probed: false,
      configuredModelAvailable: null,
      fallbackModelAvailable: null,
      intended38FlashAvailable: null,
      hydrogenAvailable: null,
      sampleModels: [],
    };
  }

  const ai = aiClientFactory
    ? aiClientFactory(geminiKey)
    : new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
          retryOptions: { attempts: 1 },
        },
      });

  const probe = await fetchGeminiModelList(ai, !aiClientFactory);
  if (!probe.probed) {
    return {
      probed: false,
      configuredModelAvailable: null,
      fallbackModelAvailable: null,
      intended38FlashAvailable: null,
      hydrogenAvailable: null,
      sampleModels: [],
    };
  }

  if (probe.error) {
    return {
      probed: true,
      configuredModelAvailable: null,
      fallbackModelAvailable: null,
      intended38FlashAvailable: null,
      hydrogenAvailable: null,
      sampleModels: [],
      error: probe.error,
    };
  }

  const list = probe.models;
  const hasModel = (id: string) =>
    isModelSupportingMultimodalJson(
      list.find((m) => m.name === id.replace(/^models\//, '')),
      id.replace(/^models\//, '')
    );

  return {
    probed: true,
    configuredModelAvailable: hasModel(configuredModel),
    fallbackModelAvailable: fallbackModel ? hasModel(fallbackModel) : null,
    intended38FlashAvailable: hasModel('gemini-3.8-flash'),
    hydrogenAvailable: hasModel('gemini-4-hydrogen'),
    sampleModels: list.map((m) => m.name).slice(0, 12),
  };
}
