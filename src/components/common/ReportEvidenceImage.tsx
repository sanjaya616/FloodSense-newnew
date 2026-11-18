/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2, AlertTriangle } from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { FloodReport, ReportEvidenceRecord } from '../../utils/floodLogic';
import { base64ToImageUrl, revokeImageUrl } from '../../utils/imageUtils';

export function hasReportPhotoEvidence(
  report: Pick<
    FloodReport,
    'hasEvidence' | 'evidenceCount' | 'imageUrl' | 'isPublicRedacted'
  > | null | undefined
): boolean {
  if (!report || report.isPublicRedacted) return false;
  return Boolean(
    report.hasEvidence ||
      (typeof report.evidenceCount === 'number' && report.evidenceCount > 0) ||
      report.imageUrl
  );
}

interface ReportEvidenceImageProps {
  report: FloodReport;
  className?: string;
  alt?: string;
  compact?: boolean;
  showDimensions?: boolean;
  fallback?: React.ReactNode;
}

export const ReportEvidenceImage: React.FC<ReportEvidenceImageProps> = ({
  report,
  className = 'w-full h-52 rounded-lg object-cover border border-[#E5E5E2]',
  alt,
  compact = false,
  showDimensions = false,
  fallback,
}) => {
  const { isAuthenticated, getEvidenceForReport } = useFlood();
  const [imageUrl, setImageUrl] = useState<string | null>(
    !report.isPublicRedacted && report.imageUrl ? report.imageUrl : null
  );
  const [evidenceMeta, setEvidenceMeta] = useState<ReportEvidenceRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);

  const shouldLoadFromFirestore =
    Boolean(isAuthenticated) &&
    !report.isPublicRedacted &&
    Boolean(report.hasEvidence || (typeof report.evidenceCount === 'number' && report.evidenceCount > 0)) &&
    !report.imageUrl;

  useEffect(() => {
    let cancelled = false;
    let activeBlobUrl: string | null = null;

    if (report.isPublicRedacted) {
      setImageUrl(null);
      setEvidenceMeta(null);
      setIsLoading(false);
      setLoadFailed(false);
      return;
    }

    if (report.imageUrl) {
      setImageUrl(report.imageUrl);
      setIsLoading(false);
      setLoadFailed(false);
      return;
    }

    if (!shouldLoadFromFirestore) {
      setImageUrl(null);
      setEvidenceMeta(null);
      setIsLoading(false);
      setLoadFailed(false);
      return;
    }

    setIsLoading(true);
    setLoadFailed(false);

    getEvidenceForReport(report.id)
      .then((records) => {
        if (cancelled) return;
        const primary =
          records.find((r) => r.id === report.primaryEvidenceId) ||
          records.find((r) => r.id === 'primary') ||
          records[0];
        if (primary?.base64Data) {
          const objectUrl = base64ToImageUrl(primary.base64Data, primary.mimeType || 'image/jpeg');
          activeBlobUrl = objectUrl;
          setImageUrl(objectUrl);
          setEvidenceMeta(primary);
          setLoadFailed(false);
        } else {
          setImageUrl(null);
          setEvidenceMeta(null);
          setLoadFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImageUrl(null);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (activeBlobUrl) {
        revokeImageUrl(activeBlobUrl);
      }
    };
  }, [
    report.id,
    report.imageUrl,
    report.isPublicRedacted,
    report.hasEvidence,
    report.evidenceCount,
    report.primaryEvidenceId,
    report.evidenceStatus,
    shouldLoadFromFirestore,
    getEvidenceForReport,
  ]);

  if (isLoading) {
    return compact ? (
      <div
        aria-label="Loading flood photograph"
        className={`${className} bg-[#F5F5F2] border border-[#E5E5E2] flex items-center justify-center text-[#666666]`}
      >
        <Loader2 className="w-4 h-4 animate-spin text-[#171717]" />
      </div>
    ) : (
      <div
        aria-label="Loading flood photograph"
        className={`${className} bg-[#F5F5F2] border border-[#E5E5E2] flex flex-col items-center justify-center text-[#666666] gap-1.5`}
      >
        <Loader2 className="w-5 h-5 animate-spin text-[#171717]" />
        <span className="text-[11px] font-medium">Loading Firestore image evidence...</span>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <div className={showDimensions ? 'space-y-1.5' : undefined}>
        <img
          src={imageUrl}
          alt={alt || `Flood evidence at ${report.location}`}
          className={className}
          referrerPolicy="no-referrer"
        />
        {showDimensions && evidenceMeta && (
          <span className="text-[10px] text-[#666666] font-mono block px-1 pb-1">
            Firestore Evidence ({evidenceMeta.width}×{evidenceMeta.height} ·{' '}
            {Math.max(1, Math.round((evidenceMeta.byteSize || 0) / 1024))} KB JPEG)
          </span>
        )}
      </div>
    );
  }

  if (report.evidenceStatus === 'FAILED' || loadFailed) {
    if (fallback) return <>{fallback}</>;
    return compact ? (
      <div
        title={report.evidenceError || 'Photo evidence failed to load or save'}
        className={`${className} bg-amber-50 border border-amber-200 flex flex-col items-center justify-center text-amber-800`}
      >
        <AlertTriangle className="w-4 h-4" />
      </div>
    ) : (
      <div className="w-full h-36 rounded-lg border border-amber-200 bg-amber-50 flex flex-col items-center justify-center text-amber-900 gap-1.5 px-4 text-center">
        <AlertTriangle className="w-5 h-5 text-amber-700" />
        <span className="text-xs font-bold">Photo Evidence Unavailable</span>
        <span className="text-[11px] text-amber-800">
          {report.evidenceError || 'Photograph could not be retrieved from Firestore subcollection.'}
        </span>
      </div>
    );
  }

  if (fallback) return <>{fallback}</>;

  return compact ? (
    <div
      title="No photograph attached"
      className={`${className} bg-[#F5F5F2] border border-[#E5E5E2] flex flex-col items-center justify-center text-[#666666]`}
    >
      <ImageOff className="w-3.5 h-3.5" />
    </div>
  ) : (
    <div className="w-full h-36 rounded-lg border border-dashed border-[#E5E5E2] bg-[#F5F5F2] flex flex-col items-center justify-center text-[#666666] gap-1.5">
      <ImageOff className="w-6 h-6 text-[#666666]" />
      <span className="text-xs font-bold text-[#171717]">No Photograph Attached</span>
      <span className="text-[11px] text-[#666666]">
        Text-only incident submission (AI visual review not run)
      </span>
    </div>
  );
};
