/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export const MAX_ORIGINAL_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB raw upload ceiling
export const MAX_EVIDENCE_DIMENSION = 1280; // Max 1280px width or height
export const TARGET_COMPRESSED_BYTES = 450 * 1024; // ~450 KB compressed JPEG target
export const MAX_EVIDENCE_BINARY_BYTES = 600 * 1024; // 600 KB binary ceiling before base64 expansion
export const MAX_FIRESTORE_EVIDENCE_DOC_BYTES = 850 * 1024; // 850 KiB (870,400 bytes) strict Firestore limit (< 1 MiB)

const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Computes exact UTF-8 byte size of a string in both browser and Node environments.
 */
export function getUtf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return Buffer.byteLength(value, 'utf8');
}

/**
 * Strips any `data:image/...;base64,` prefix and whitespace, returning raw base64 characters.
 */
export function stripDataUrlPrefix(input: string): string {
  return String(input || '')
    .replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/i, '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Computes decoded binary byte length from a raw base64 string.
 */
export function getBase64DecodedByteLength(base64Data: string): number {
  const clean = stripDataUrlPrefix(base64Data);
  if (!clean) return 0;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

/**
 * Measures the serialized UTF-8 payload size of a Firestore evidence document
 * (fields + modest document metadata overhead) to guarantee safe headroom under 1 MiB.
 */
export function estimateFirestoreEvidenceDocBytes(payload: {
  ownerUid: string;
  mimeType: string;
  base64Data: string;
  fileName: string;
  byteSize: number;
  width: number;
  height: number;
  createdAt: string;
}): number {
  const serialized = JSON.stringify(payload);
  // Add 1024 bytes conservative margin for Firestore document path & field name framing
  return getUtf8ByteLength(serialized) + 1024;
}

/**
 * Inspects leading bytes to verify JPEG, PNG, or WEBP magic signatures.
 */
export async function detectImageMagicMime(file: Blob): Promise<SupportedImageMime | null> {
  const slice = file.slice(0, 12);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WEBP: RIFF....WEBP
  const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const format = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (header === 'RIFF' && format === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export interface ImageValidationResult {
  valid: boolean;
  detectedMime?: SupportedImageMime;
  error?: string;
}

/**
 * Validates that an uploaded file is a non-empty, supported, uncorrupted JPG/PNG/WEBP <= 10 MB.
 */
export async function validateReportImage(file: File | Blob | null | undefined): Promise<ImageValidationResult> {
  if (!file) {
    return { valid: false, error: 'Please select an image file.' };
  }
  if (file.size <= 32) {
    return { valid: false, error: 'Selected image file is empty or too small to be a valid photograph.' };
  }
  if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
    return {
      valid: false,
      error: `Image exceeds the ${(MAX_ORIGINAL_IMAGE_BYTES / (1024 * 1024)).toFixed(0)} MB original file limit.`,
    };
  }

  const declaredType = (file as File).type?.toLowerCase?.() || '';
  if (
    declaredType &&
    !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(declaredType)
  ) {
    return {
      valid: false,
      error: 'Unsupported image format. Please choose a JPG, PNG, or WEBP photograph.',
    };
  }

  const detectedMime = await detectImageMagicMime(file);
  if (!detectedMime) {
    return {
      valid: false,
      error: 'Corrupt or unsupported image binary header. Please select an authentic JPG, PNG, or WEBP photograph.',
    };
  }

  return { valid: true, detectedMime };
}

export interface CompressedReportImage {
  file: File;
  base64Data: string; // Raw base64 string WITHOUT data:image/...;base64, prefix
  dataUrl: string; // Full data URL for local preview and optional AI payload
  mimeType: 'image/jpeg';
  fileName: string;
  byteSize: number; // Compressed binary byte size
  originalBytes: number;
  width: number;
  height: number;
  exifStripped: boolean;
  sizeLabel: string;
  estimatedFirestoreDocBytes: number;
}

export type SanitizedImageResult = CompressedReportImage;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      resolve(stripDataUrlPrefix(dataUrl));
    };
    reader.onerror = () => reject(new Error('Failed to serialize compressed photograph.'));
    reader.readAsDataURL(blob);
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) resolve(blob);
        else reject(new Error('Browser canvas failed to encode compressed JPEG image.'));
      },
      'image/jpeg',
      quality
    );
  });
}

async function decodeImageDimensions(file: Blob): Promise<{
  source: CanvasImageSource;
  naturalWidth: number;
  naturalHeight: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        naturalWidth: bitmap.width,
        naturalHeight: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Unable to decode photograph. The file may be corrupted.'));
      el.src = objectUrl;
    });
    return {
      source: img,
      naturalWidth: img.naturalWidth || img.width,
      naturalHeight: img.naturalHeight || img.height,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

/**
 * Validates, strips EXIF metadata via HTML5 Canvas, resizes to max 1280px,
 * and adaptively compresses as JPEG <= 450 KB (and strictly < 850 KiB Firestore doc size).
 */
export async function compressReportImage(
  file: File,
  options?: {
    maxDimension?: number;
    targetBytes?: number;
  }
): Promise<CompressedReportImage> {
  const validation = await validateReportImage(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid report photograph.');
  }

  const maxDim = Math.min(options?.maxDimension || MAX_EVIDENCE_DIMENSION, MAX_EVIDENCE_DIMENSION);
  const targetBytes = Math.min(options?.targetBytes || TARGET_COMPRESSED_BYTES, MAX_EVIDENCE_BINARY_BYTES);

  const decoded = await decodeImageDimensions(file);
  try {
    if (!decoded.naturalWidth || !decoded.naturalHeight) {
      throw new Error('Photograph dimensions are invalid or zero.');
    }

    let width = decoded.naturalWidth;
    let height = decoded.naturalHeight;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }

    const qualitySteps = [0.82, 0.72, 0.62, 0.52, 0.42, 0.34];
    let bestBlob: Blob | null = null;
    let bestWidth = width;
    let bestHeight = height;

    for (let dimAttempt = 0; dimAttempt < 4; dimAttempt++) {
      const canvas = document.createElement('canvas');
      canvas.width = bestWidth;
      canvas.height = bestHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Browser canvas context unavailable for image compression.');
      }

      // Fill white background before drawing so PNG/WEBP transparency encodes cleanly as JPEG
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, bestWidth, bestHeight);
      ctx.drawImage(decoded.source, 0, 0, bestWidth, bestHeight);

      for (const quality of qualitySteps) {
        const candidateBlob = await canvasToJpegBlob(canvas, quality);
        bestBlob = candidateBlob;
        if (candidateBlob.size <= targetBytes) {
          break;
        }
      }

      if (bestBlob && bestBlob.size <= targetBytes) {
        break;
      }

      // Reduce dimensions slightly and re-try if image remained dense above targetBytes
      bestWidth = Math.max(320, Math.round(bestWidth * 0.78));
      bestHeight = Math.max(320, Math.round(bestHeight * 0.78));
    }

    if (!bestBlob || bestBlob.size > MAX_EVIDENCE_BINARY_BYTES) {
      throw new Error(
        'Compressed image still exceeds Firestore size constraints. Please upload a clearer or smaller photograph.'
      );
    }

    const base64Data = await blobToBase64(bestBlob);
    if (!base64Data || !BASE64_REGEX.test(base64Data)) {
      throw new Error('Failed to generate valid Base64 payload for image evidence.');
    }

    const safeFileName = `${(file.name || 'flood_evidence').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)}.jpg`;

    const estimatedDocBytes = estimateFirestoreEvidenceDocBytes({
      ownerUid: '0'.repeat(32),
      mimeType: 'image/jpeg',
      base64Data,
      fileName: safeFileName,
      byteSize: bestBlob.size,
      width: bestWidth,
      height: bestHeight,
      createdAt: new Date().toISOString(),
    });

    if (estimatedDocBytes >= MAX_FIRESTORE_EVIDENCE_DOC_BYTES) {
      throw new Error(
        `Compressed Firestore evidence payload (${Math.round(estimatedDocBytes / 1024)} KiB) exceeds the 850 KiB safety ceiling.`
      );
    }

    const compressedFile = new File([bestBlob], safeFileName, { type: 'image/jpeg' });
    const dataUrl = `data:image/jpeg;base64,${base64Data}`;

    return {
      file: compressedFile,
      base64Data,
      dataUrl,
      mimeType: 'image/jpeg',
      fileName: safeFileName,
      byteSize: bestBlob.size,
      originalBytes: file.size,
      width: bestWidth,
      height: bestHeight,
      exifStripped: true,
      sizeLabel: `${Math.max(1, Math.round(bestBlob.size / 1024))} KB · ${bestWidth}×${bestHeight}`,
      estimatedFirestoreDocBytes: estimatedDocBytes,
    };
  } finally {
    decoded.cleanup();
  }
}

/**
 * Backward-compatible alias that routes through the Spark-plan JPEG compressor.
 */
export async function validateAndSanitizeImageFile(
  file: File
): Promise<CompressedReportImage> {
  return compressReportImage(file);
}

/**
 * Converts stored raw Base64 image data back into a browser-displayable Blob Object URL.
 * Callers should pass the returned URL to `revokeImageUrl(url)` on cleanup/unmount.
 */
export function base64ToImageUrl(base64Data: string, mimeType = 'image/jpeg'): string {
  const cleanBase64 = stripDataUrlPrefix(base64Data);
  if (!cleanBase64) return '';

  const safeMime = ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType.toLowerCase())
    ? mimeType.toLowerCase()
    : 'image/jpeg';

  if (typeof atob === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      const binaryStr = atob(cleanBase64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: safeMime });
      return URL.createObjectURL(blob);
    } catch {
      // Fallback to data URL below if atob/Blob fails
    }
  }

  return `data:${safeMime};base64,${cleanBase64}`;
}

export function revokeImageUrl(url?: string | null): void {
  if (url && url.startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore already-revoked object URLs
    }
  }
}

export function createSubmissionRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
