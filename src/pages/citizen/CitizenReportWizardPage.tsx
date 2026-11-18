/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Camera,
  MapPin,
  Compass,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  Trash2,
  Sparkles,
  Cpu,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { validateCoordinates, AiStatus } from '../../utils/floodLogic';
import {
  compressReportImage,
  CompressedReportImage,
  createSubmissionRequestId,
} from '../../utils/imageUtils';
import { FloodMap } from '../../components/map/FloodMap';

export const CitizenReportWizardPage: React.FC = () => {
  const {
    addReport,
    retryAiVerification,
    retryPublicSync,
    retryReportEvidenceUpload,
    userProfile,
    hotspots,
  } = useFlood();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef<boolean>(false);

  // Wizard current step: 1 (Photo) -> 2 (Location) -> 3 (Severity) -> 4 (Review) -> 5 (Result)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Photo & Drag/Drop
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressedEvidence, setCompressedEvidence] = useState<CompressedReportImage | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [imageMetaInfo, setImageMetaInfo] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Step 2: Location & Coordinates (No silent Maradana/coordinate prefills)
  const [locationName, setLocationName] = useState('');
  const [area, setArea] = useState<string>('');
  const [latInput, setLatInput] = useState<string>('');
  const [lngInput, setLngInput] = useState<string>('');
  const [pinConfirmed, setPinConfirmed] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Step 3: Flood details & Detailed Description
  const [waterLevel, setWaterLevel] = useState<'Low' | 'Moderate' | 'High' | 'Severe'>('Moderate');
  const [roadAccessibility, setRoadAccessibility] = useState<'Open' | 'Partially Blocked' | 'Completely Blocked'>('Partially Blocked');
  const [floodType, setFloodType] = useState<'Street Waterlogging' | 'Flash Flood' | 'Canal Overflow' | 'Drainage Blockage'>('Street Waterlogging');
  const [description, setDescription] = useState('');
  const [additionalObservations, setAdditionalObservations] = useState('');

  // Step 4: Contact & Idempotency key
  const [reporterPhone, setReporterPhone] = useState(userProfile.phone || '');
  const [submissionRequestId, setSubmissionRequestId] = useState<string>(() => createSubmissionRequestId());

  // Step 5: Submission, Upload Progress & AI Result
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryingAi, setIsRetryingAi] = useState(false);
  const [retryAiFeedback, setRetryAiFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isRetryingPublicSync, setIsRetryingPublicSync] = useState(false);
  const [isRetryingEvidence, setIsRetryingEvidence] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    reportId: string;
    hotspotId: string;
    aiStatus: AiStatus;
    aiConfidence: number | null;
    aiClassification: string;
    aiExplanation: string;
    status: string;
    isDuplicate?: boolean;
    duplicateOfId?: string;
    duplicateCheckStatus?: 'VERIFIED_CITYWIDE' | 'LOCAL_ONLY' | 'UNAVAILABLE';
    duplicateCheckWarning?: string;
    evidenceUploadFailed?: boolean;
    evidenceUploadError?: string;
    publicSyncStatus?: 'PENDING' | 'SYNCED' | 'FAILED';
    publicSyncError?: string;
  } | null>(null);

  const parsedLat = Number.parseFloat(latInput);
  const parsedLng = Number.parseFloat(lngInput);
  const coordsAreValid = latInput.trim() !== '' && lngInput.trim() !== '' && validateCoordinates(parsedLat, parsedLng);

  const areaCoordinates: Record<string, { lat: number; lng: number }> = {
    Maradana: { lat: 6.9271, lng: 79.8653 },
    Wellawatte: { lat: 6.8745, lng: 79.8600 },
    Borella: { lat: 6.9110, lng: 79.8770 },
    Kolonnawa: { lat: 6.9360, lng: 79.8850 },
    Dematagoda: { lat: 6.9380, lng: 79.8780 },
    Nugegoda: { lat: 6.8710, lng: 79.8980 },
    Pettah: { lat: 6.9366, lng: 79.8530 },
    Kotahena: { lat: 6.9515, lng: 79.8622 },
  };

  const handleAreaChange = (newArea: string) => {
    setArea(newArea);
    setPinConfirmed(false);
    setGpsSuccess(false);
    if (areaCoordinates[newArea]) {
      setLatInput(areaCoordinates[newArea].lat.toFixed(5));
      setLngInput(areaCoordinates[newArea].lng.toFixed(5));
      setLocationError(null);
    } else {
      setLatInput('');
      setLngInput('');
    }
  };

  const handleClearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setSelectedFile(null);
    setCompressedEvidence(null);
    setImageMetaInfo(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (file: File) => {
    setImageError(null);
    setIsProcessingImage(true);
    try {
      const sanitized = await compressReportImage(file);
      setSelectedFile(sanitized.file);
      setCompressedEvidence(sanitized);
      setImageMimeType(sanitized.mimeType);
      setImagePreview(sanitized.dataUrl);
      setImageBase64(sanitized.base64Data);
      setImageMetaInfo(
        `${sanitized.sizeLabel} · ${sanitized.exifStripped ? 'EXIF stripped for Spark Firestore' : 'Verified header'}`
      );
    } catch (err: any) {
      setCompressedEvidence(null);
      setImageError(err?.message || 'Unable to process selected image file.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleGetGps = () => {
    setIsLocating(true);
    setLocationError(null);
    setGpsSuccess(false);
    setPinConfirmed(false);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Please select a sector or enter coordinates manually.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatInput(pos.coords.latitude.toFixed(5));
        setLngInput(pos.coords.longitude.toFixed(5));
        setGpsSuccess(true);
        setIsLocating(false);
      },
      () => {
        setLocationError('Could not acquire browser GPS position. Please select a sector or enter latitude & longitude manually.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleContinueFromStep2 = () => {
    if (!area.trim()) {
      setLocationError('Please select a Colombo Municipal Area / Ward before continuing.');
      return;
    }
    if (!coordsAreValid) {
      setLocationError('Please acquire GPS or enter valid latitude (-90 to 90) and longitude (-180 to 180) coordinates.');
      return;
    }
    if (!pinConfirmed) {
      setLocationError('Please confirm that the pin shown on the preview map represents the flooded road location.');
      return;
    }
    setLocationError(null);
    setCurrentStep(3);
  };

  const handleFinalSubmit = async (omitPhoto = false) => {
    if (submittingRef.current) return;
    if (!coordsAreValid || !area.trim()) {
      setSubmitError('Invalid coordinates or missing area detected. Please return to Step 2.');
      return;
    }
    submittingRef.current = true;
    setSubmitError(null);
    setIsSubmitting(true);
    setUploadProgress(15);
    setCurrentStep(5);

    try {
      const finalLocation = locationName.trim() || `${area} Road Incident`;
      const result = await addReport({
        location: finalLocation,
        area: area as any,
        lat: parsedLat,
        lng: parsedLng,
        waterLevel,
        roadAccessibility,
        floodType,
        description: description.trim() || 'Reported via citizen 5-step reporting wizard.',
        additionalObservations: additionalObservations.trim() || undefined,
        reporterName: userProfile.name,
        reporterPhone: reporterPhone.trim(),
        reporterId: userProfile.uid || '',
        compressedEvidence: !omitPhoto && compressedEvidence ? compressedEvidence : undefined,
        imageFile: !omitPhoto && !compressedEvidence && selectedFile ? selectedFile : undefined,
        customImage: !omitPhoto && imageBase64 ? imageBase64 : undefined,
        imageMimeType: !omitPhoto ? imageMimeType : undefined,
        submissionRequestId,
        onUploadProgress: (pct) => setUploadProgress(Math.max(pct, 25)),
      });

      setUploadProgress(100);
      setSubmissionResult({
        reportId: result.report.id,
        hotspotId: result.hotspot.id,
        aiStatus: result.report.aiStatus || (omitPhoto || !imageBase64 ? 'NOT_RUN' : 'COMPLETED'),
        aiConfidence: result.report.aiConfidence ?? null,
        aiClassification: result.report.aiClassification || 'Under Review',
        aiExplanation:
          result.report.aiVerificationDetails?.explanation ||
          'Submission saved. Incident queued for emergency officer field verification.',
        status: result.report.incidentStatus,
        isDuplicate: result.isDuplicate,
        duplicateOfId: result.duplicateOfId,
        duplicateCheckStatus: result.duplicateCheckStatus,
        duplicateCheckWarning: result.duplicateCheckWarning,
        evidenceUploadFailed: result.evidenceUploadFailed,
        evidenceUploadError: result.evidenceUploadError,
        publicSyncStatus: result.report.publicSyncStatus,
        publicSyncError: result.report.publicSyncError,
      });
    } catch (err: any) {
      setSubmitError(err?.message || 'Report submission failed.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleRetryEvidenceUpload = async () => {
    if (!submissionResult || (!compressedEvidence && !selectedFile)) return;
    setIsRetryingEvidence(true);
    try {
      await retryReportEvidenceUpload(
        submissionResult.reportId,
        compressedEvidence || (selectedFile as File)
      );
      setSubmissionResult((prev) =>
        prev
          ? {
              ...prev,
              evidenceUploadFailed: false,
              evidenceUploadError: undefined,
            }
          : prev
      );
    } catch (err: any) {
      setSubmissionResult((prev) =>
        prev
          ? {
              ...prev,
              evidenceUploadFailed: true,
              evidenceUploadError: err?.message || 'Retry saving compressed photo evidence failed.',
            }
          : prev
      );
    } finally {
      setIsRetryingEvidence(false);
    }
  };

  const handleRetryPublicSync = async () => {
    if (!submissionResult) return;
    setIsRetryingPublicSync(true);
    try {
      const res = await retryPublicSync(submissionResult.reportId);
      setSubmissionResult((prev) =>
        prev
          ? {
              ...prev,
              publicSyncStatus: res.ok ? 'SYNCED' : 'FAILED',
              publicSyncError: res.ok ? undefined : res.error || 'Public map sync failed.',
            }
          : prev
      );
    } finally {
      setIsRetryingPublicSync(false);
    }
  };

  const handleRetryAi = async () => {
    if (!submissionResult || isRetryingAi) return;
    setIsRetryingAi(true);
    setRetryAiFeedback(null);
    try {
      const overridePayload = submissionResult.evidenceUploadFailed && imageBase64
        ? { customImage: imageBase64, mimeType: imageMimeType }
        : undefined;
      const updated = await retryAiVerification(submissionResult.reportId, overridePayload);
      if (updated) {
        setSubmissionResult({
          ...submissionResult,
          aiStatus: updated.aiStatus || 'FAILED',
          aiConfidence: updated.aiConfidence ?? null,
          aiClassification: updated.aiClassification || 'AI Processing Failed',
          aiExplanation:
            updated.aiVerificationDetails?.explanation ||
            'AI retry finished. Queued for officer inspection.',
          status: updated.incidentStatus,
        });
        if (updated.aiStatus === 'COMPLETED') {
          setRetryAiFeedback({
            type: 'success',
            message: `AI assessment completed for ${submissionResult.reportId}: ${updated.aiClassification} (${updated.aiConfidence ?? 'N/A'}% confidence).`,
          });
        } else {
          setRetryAiFeedback({
            type: 'error',
            message:
              updated.aiVerificationDetails?.explanation ||
              'AI analysis failed. Your report remains saved and ready for another retry or manual review.',
          });
        }
      }
    } catch (err: any) {
      setRetryAiFeedback({
        type: 'error',
        message: err?.message || 'Unable to retry AI assessment right now.',
      });
    } finally {
      setIsRetryingAi(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Photo' },
    { num: 2, label: 'Location' },
    { num: 3, label: 'Severity' },
    { num: 4, label: 'Review' },
    { num: 5, label: 'AI Result' },
  ];

  // Preview pin report for Step 2 map
  const previewPinReport = coordsAreValid
    ? [
        {
          id: 'PIN-PREVIEW',
          location: locationName.trim() || `${area} Pin Location`,
          area,
          lat: parsedLat,
          lng: parsedLng,
          timestamp: new Date().toISOString(),
          waterLevel,
          roadAccessibility,
          floodType,
          description: 'Selected incident location preview',
          riskLevel: 'MEDIUM' as const,
          verificationStatus: 'UNDER REVIEW' as const,
          incidentStatus: 'Submitted' as const,
          statusHistory: [],
        },
      ]
    : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 font-sans">
      {/* Wizard Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-[#666666] mb-1.5">
          <NavLink to="/citizen" className="hover:text-[#171717] transition-colors">
            Citizen Portal
          </NavLink>
          <ChevronRight className="w-3 h-3 text-[#A3A3A3]" />
          <span className="text-[#171717] font-semibold">Report a Flooded Road</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
          Flood Incident Reporting Wizard
        </h1>
        <p className="text-xs sm:text-sm text-[#666666] mt-1.5">
          Submit street photography and GPS coordinates to assist municipal drainage and response teams.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-md border border-[#E5E5E2]">
        <div className="flex items-center justify-between">
          {stepsList.map((step, idx) => {
            const isCompleted = currentStep > step.num;
            const isCurrent = currentStep === step.num;
            return (
              <React.Fragment key={step.num}>
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-xs transition-colors ${
                      isCompleted
                        ? 'bg-emerald-700 text-white'
                        : isCurrent
                        ? 'bg-[#171717] text-white ring-4 ring-[#EEEEEB]'
                        : 'bg-[#F5F5F2] text-[#666666] border border-[#E5E5E2]'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.num}
                  </div>
                  <span
                    className={`text-[11px] font-semibold ${
                      isCurrent ? 'text-[#171717]' : isCompleted ? 'text-[#171717]' : 'text-[#666666]'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < stepsList.length - 1 && (
                  <div
                    className={`h-px flex-1 mb-5 transition-colors ${
                      currentStep > step.num ? 'bg-emerald-700' : 'bg-[#E5E5E2]'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step 1: Photo Upload */}
      {currentStep === 1 && (
        <div className="bg-white p-6 sm:p-8 rounded-md border border-[#E5E5E2] space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#171717] flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#171717]" />
              <span>Step 1: Upload Flood Photograph</span>
            </h2>
            <p className="text-xs text-[#666666] mt-1">
              Photographs help AI evaluate water volume and confirm road obstruction for emergency officers.
            </p>
          </div>

          {imageError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{imageError}</span>
            </div>
          )}

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border border-dashed rounded-md p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-[#171717] bg-[#EEEEEB]'
                : imagePreview
                ? 'border-[#171717] bg-[#F5F5F2]'
                : 'border-[#D4D4D0] hover:border-[#171717] bg-[#F5F5F2]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            {imagePreview ? (
              <div className="space-y-4">
                <img
                  src={imagePreview}
                  alt="Flood Preview"
                  className="max-h-64 mx-auto rounded-sm object-cover border border-[#E5E5E2]"
                />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {isProcessingImage ? 'Sanitizing image...' : imageMetaInfo || 'Photo ready for AI analysis'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-2.5 py-1 rounded-sm bg-white border border-[#E5E5E2] text-[11px] font-semibold text-[#171717] hover:bg-[#EEEEEB]"
                  >
                    Replace Photo
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearImage();
                    }}
                    className="p-1.5 rounded-sm text-red-700 hover:bg-red-50 flex items-center gap-1 text-[11px] font-semibold"
                    aria-label="Remove photo"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-md bg-white border border-[#E5E5E2] text-[#171717] flex items-center justify-center mx-auto">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#171717]">
                    Click to browse or drag and drop your photo
                  </p>
                  <p className="text-xs text-[#666666] mt-0.5">
                    JPG, PNG, or WEBP up to 10MB (auto-compressed ≤ 1280px JPEG with EXIF stripped)
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-6 py-3 rounded-md bg-[#171717] hover:bg-black text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Continue to Step 2: Location</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Location & Map Pin */}
      {currentStep === 2 && (
        <div className="bg-white p-6 sm:p-8 rounded-md border border-[#E5E5E2] space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#171717] flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#171717]" />
              <span>Step 2: Road &amp; Location Information</span>
            </h2>
            <p className="text-xs text-[#666666] mt-1">
              Use browser GPS or manually enter/adjust latitude &amp; longitude coordinates for accurate hotspot clustering.
            </p>
          </div>

          {locationError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{locationError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Colombo Municipal Area / Ward <span className="text-red-600">*</span>
                </label>
                <select
                  value={area}
                  onChange={(e) => handleAreaChange(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] font-semibold focus:bg-white focus:outline-none focus:border-[#171717]"
                >
                  <option value="">Select municipal area...</option>
                  {Object.keys(areaCoordinates).map((a) => (
                    <option key={a} value={a}>
                      {a} Sector
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Street Name or Nearest Landmark
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maradana Road near Technical College"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666] focus:bg-white focus:outline-none focus:border-[#171717]"
                />
              </div>
            </div>

            {/* GPS Auto-Locate + Manual Lat/Lng Inputs */}
            <div className="p-4 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-[#171717] block">
                    GPS Coordinates (Required &amp; Editable)
                  </span>
                  <span className="text-[11px] text-[#666666]">
                    {gpsSuccess
                      ? '✓ GPS position acquired via browser'
                      : 'Select municipal area, use GPS, or type coordinates manually'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGetGps}
                  disabled={isLocating}
                  className="px-4 py-2 bg-white hover:bg-[#EEEEEB] border border-[#E5E5E2] text-[#171717] text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Compass className={`w-4 h-4 text-[#171717] ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? 'Acquiring GPS...' : 'Use My Current Location'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#666666] mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 6.92710"
                    value={latInput}
                    onChange={(e) => {
                      setLatInput(e.target.value);
                      setPinConfirmed(false);
                    }}
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E2] rounded-md font-mono text-[#171717] focus:outline-none focus:border-[#171717]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#666666] mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 79.86530"
                    value={lngInput}
                    onChange={(e) => {
                      setLngInput(e.target.value);
                      setPinConfirmed(false);
                    }}
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E2] rounded-md font-mono text-[#171717] focus:outline-none focus:border-[#171717]"
                  />
                </div>
              </div>
            </div>

            {/* Inline Map Pin Preview */}
            <div className="rounded-md overflow-hidden border border-[#E5E5E2]">
              <div className="bg-[#181818] text-white px-4 py-2 text-[11px] font-mono flex items-center justify-between">
                <span>
                  Selected Pin Preview ({coordsAreValid ? `${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}` : 'Awaiting coordinates'})
                </span>
                <span className="text-[#D4D4D0]">{area ? `${area} Sector` : 'Select sector'}</span>
              </div>
              <FloodMap
                hotspots={hotspots}
                reports={previewPinReport}
                focusCoordinates={coordsAreValid ? [parsedLat, parsedLng] : undefined}
                focusZoom={coordsAreValid ? 15 : undefined}
                heightClass="h-[220px]"
                showLegendOverlay={false}
                showSectorControls={false}
              />
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-md bg-[#F5F5F2] border border-[#E5E5E2] text-xs text-[#171717] cursor-pointer">
              <input
                type="checkbox"
                checked={pinConfirmed}
                onChange={(e) => setPinConfirmed(e.target.checked)}
                className="mt-0.5 rounded-sm border-[#D4D4D0] text-[#171717] focus:ring-[#171717]"
              />
              <span>
                <strong>Confirm Map Pin Location:</strong> I verify that the coordinates above match the flooded road section I am reporting.
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 rounded-md border border-[#E5E5E2] hover:bg-[#EEEEEB] text-[#171717] font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleContinueFromStep2}
              className="px-6 py-3 rounded-md bg-[#171717] hover:bg-black text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Continue to Step 3: Severity</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Severity & Detailed Description */}
      {currentStep === 3 && (
        <div className="bg-white p-6 sm:p-8 rounded-md border border-[#E5E5E2] space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#171717] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#171717]" />
              <span>Step 3: Flood Depth, Passability &amp; Description</span>
            </h2>
            <p className="text-xs text-[#666666] mt-1">
              Select what you observe on the ground to calibrate risk predictions.
            </p>
          </div>

          <div className="space-y-5">
            {/* Water Depth Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-2">
                Estimated Water Level
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'Low', label: 'Ankle Deep (< 15cm)', desc: 'Curb puddle, passable' },
                  { id: 'Moderate', label: 'Knee Deep (15-30cm)', desc: 'Tire half submerged' },
                  { id: 'High', label: 'Waist Deep (30-60cm)', desc: 'Engines stalled' },
                  { id: 'Severe', label: 'Submerged (> 60cm)', desc: 'Vehicles floating' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setWaterLevel(item.id as any)}
                    className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${
                      waterLevel === item.id
                        ? 'border-[#171717] bg-[#171717] text-white'
                        : 'border-[#E5E5E2] bg-[#F5F5F2] text-[#171717] hover:bg-white'
                    }`}
                  >
                    <span className="text-xs font-semibold block leading-tight">
                      {item.label}
                    </span>
                    <span
                      className={`text-[10px] mt-1 block ${
                        waterLevel === item.id ? 'text-[#D4D4D0]' : 'text-[#666666]'
                      }`}
                    >
                      {item.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Road Accessibility */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-2">
                Road Passability for Traffic
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'Open', label: 'Passable for All' },
                  { id: 'Partially Blocked', label: '4x4 / Trucks Only' },
                  { id: 'Completely Blocked', label: 'Completely Blocked' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRoadAccessibility(item.id as any)}
                    className={`p-3 rounded-md border text-center transition-colors cursor-pointer ${
                      roadAccessibility === item.id
                        ? 'border-[#171717] bg-[#171717] font-semibold text-white'
                        : 'border-[#E5E5E2] bg-[#F5F5F2] text-[#171717] hover:bg-white'
                    }`}
                  >
                    <span className="text-xs block">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Flood Type */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-2">Flood Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  'Street Waterlogging',
                  'Flash Flood',
                  'Canal Overflow',
                  'Drainage Blockage',
                ].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFloodType(t as any)}
                    className={`p-2.5 rounded-md border text-center text-xs transition-colors cursor-pointer ${
                      floodType === t
                        ? 'border-[#171717] bg-[#171717] font-semibold text-white'
                        : 'border-[#E5E5E2] bg-[#F5F5F2] text-[#666666] hover:bg-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Detailed Description */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Detailed Flood Description
              </label>
              <textarea
                rows={3}
                placeholder="Describe current conditions (e.g. storm drains blocked by debris, water entering ground-floor shops, buses stalled)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666] focus:bg-white focus:outline-none focus:border-[#171717]"
              />
            </div>

            {/* Additional Observations */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Additional Observations (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Nearby electrical poles, elderly residents needing evacuation, or blocked culvert ID"
                value={additionalObservations}
                onChange={(e) => setAdditionalObservations(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666] focus:bg-white focus:outline-none focus:border-[#171717]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 rounded-md border border-[#E5E5E2] hover:bg-[#EEEEEB] text-[#171717] font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="px-6 py-3 rounded-md bg-[#171717] hover:bg-black text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Continue to Step 4: Review</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Submit */}
      {currentStep === 4 && (
        <div className="bg-white p-6 sm:p-8 rounded-md border border-[#E5E5E2] space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#171717] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#171717]" />
              <span>Step 4: Review &amp; Submit Incident</span>
            </h2>
            <p className="text-xs text-[#666666] mt-1">
              Verify your details before initiating image upload and AI multimodal assessment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2]">
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[#666666] block">Location:</span>
                <span className="font-semibold text-[#171717] text-sm">
                  {locationName || `${area} Main Road`} ({area})
                </span>
              </div>
              <div>
                <span className="text-[#666666] block">Coordinates:</span>
                <span className="font-mono text-[#171717]">
                  {parsedLat.toFixed(5)}, {parsedLng.toFixed(5)}
                </span>
              </div>
              <div>
                <span className="text-[#666666] block">Water Level &amp; Type:</span>
                <span className="font-semibold text-[#171717]">
                  {waterLevel} · {floodType}
                </span>
              </div>
              <div>
                <span className="text-[#666666] block">Passability:</span>
                <span className="font-semibold text-[#171717]">{roadAccessibility}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[#666666] block">Reporter:</span>
                <span className="font-semibold text-[#171717]">{userProfile.name}</span>
              </div>
              <div>
                <span className="text-[#666666] block">Contact Phone:</span>
                <input
                  type="tel"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 bg-white border border-[#E5E5E2] rounded-md font-mono text-[#171717] focus:outline-none focus:border-[#171717]"
                />
              </div>
              <div>
                <span className="text-[#666666] block">Photograph Attached:</span>
                <span className="font-semibold text-emerald-800">
                  {imagePreview ? '✓ Photo Ready' : 'No Photo Attached'}
                </span>
              </div>
            </div>
          </div>

          {description && (
            <div className="p-3 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] text-xs">
              <span className="text-[#666666] block mb-0.5 font-semibold">Description:</span>
              <p className="text-[#171717]">{description}</p>
              {additionalObservations && (
                <p className="text-[#666666] mt-1">Observations: {additionalObservations}</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 rounded-md border border-[#E5E5E2] hover:bg-[#EEEEEB] text-[#171717] font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => handleFinalSubmit(false)}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-md bg-[#171717] hover:bg-black text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{imagePreview ? 'Submit & Run AI Verification' : 'Submit Report'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Submission, Progress & AI Result */}
      {currentStep === 5 && (
        <div className="bg-white p-6 sm:p-8 rounded-md border border-[#E5E5E2] space-y-6">
          {isSubmitting ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-md bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717] flex items-center justify-center mx-auto">
                <Cpu className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-[#171717]">
                Uploading Evidence &amp; Running AI Assessment...
              </h3>
              <div className="max-w-sm mx-auto space-y-1.5">
                <div className="w-full h-2 bg-[#EEEEEB] rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-[#171717] transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-[#666666]">{uploadProgress}% uploaded</span>
              </div>
            </div>
          ) : submitError ? (
            <div className="p-5 bg-red-50 border border-red-200 rounded-md space-y-3 text-xs text-red-900">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-red-700" />
                <span>Report Submission Error</span>
              </div>
              <p>{submitError}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleFinalSubmit(false)}
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-md cursor-pointer"
                >
                  Retry Submission
                </button>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => handleFinalSubmit(true)}
                    className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-md cursor-pointer"
                  >
                    Save Report Without Photo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 bg-white border border-red-300 text-red-900 font-semibold rounded-md cursor-pointer"
                >
                  Return to Review
                </button>
              </div>
            </div>
          ) : submissionResult ? (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Report {submissionResult.reportId} Successfully Saved
                  </h3>
                  <p className="text-xs text-emerald-900 mt-0.5">
                    Your report has been registered and forwarded to the Municipal Operations Queue (Cluster{' '}
                    {submissionResult.hotspotId}).
                    {submissionResult.isDuplicate &&
                      ` Note: Flagged as duplicate of ${submissionResult.duplicateOfId}; evidence preserved.`}
                  </p>
                </div>
              </div>

              {submissionResult.evidenceUploadFailed && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Report Saved — Photo Evidence Upload Failed</span>
                      <span className="text-amber-900">
                        {submissionResult.evidenceUploadError ||
                          'Your flood report metadata was saved to Firestore, but the compressed photograph failed to save.'}
                      </span>
                    </div>
                  </div>
                  {(compressedEvidence || selectedFile) && (
                    <button
                      type="button"
                      disabled={isRetryingEvidence}
                      onClick={handleRetryEvidenceUpload}
                      className="px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRetryingEvidence ? 'animate-spin' : ''}`} />
                      <span>{isRetryingEvidence ? 'Uploading Photo...' : 'Retry Uploading Photo'}</span>
                    </button>
                  )}
                </div>
              )}

              {submissionResult.duplicateCheckWarning && (
                <div className="p-3 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[11px] text-[#666666] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#666666] shrink-0" />
                  <span>{submissionResult.duplicateCheckWarning}</span>
                </div>
              )}

              {submissionResult.publicSyncStatus === 'FAILED' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Public Map Aggregation Pending Sync</span>
                      <span className="text-amber-900">
                        {submissionResult.publicSyncError ||
                          'Your private report is safely saved, but public hotspot publishing failed.'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isRetryingPublicSync}
                    onClick={handleRetryPublicSync}
                    className="px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRetryingPublicSync ? 'animate-spin' : ''}`} />
                    <span>{isRetryingPublicSync ? 'Retrying Sync...' : 'Retry Public Map Sync'}</span>
                  </button>
                </div>
              )}

              {/* AI Verification Breakdown Card */}
              <div
                className={`p-5 rounded-md border space-y-4 ${
                  submissionResult.aiStatus === 'FAILED'
                    ? 'bg-red-950 text-white border-red-800'
                    : 'bg-[#181818] text-white border-[#2A2A2A]'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#D4D4D0]" />
                    <span className="text-xs font-semibold text-white uppercase tracking-[0.12em]">
                      Multimodal AI Assessment (Server-Side Gemini Vision)
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold px-2.5 py-1 rounded-sm border ${
                      submissionResult.aiStatus === 'FAILED'
                        ? 'bg-red-900/50 text-red-200 border-red-700'
                        : submissionResult.aiStatus === 'NOT_RUN'
                        ? 'bg-[#262626] text-[#D4D4D0] border-[#404040]'
                        : submissionResult.aiStatus === 'UNCONFIGURED' || submissionResult.aiStatus === 'PENDING'
                        ? 'bg-amber-900/40 text-amber-200 border-amber-700'
                        : 'bg-[#262626] text-white border-[#404040]'
                    }`}
                  >
                    {submissionResult.aiStatus === 'FAILED'
                      ? 'AI Status: FAILED'
                      : submissionResult.aiStatus === 'UNCONFIGURED'
                      ? 'AI Status: UNCONFIGURED'
                      : submissionResult.aiStatus === 'PENDING'
                      ? 'AI Status: PENDING'
                      : submissionResult.aiStatus === 'NOT_RUN'
                      ? 'AI Status: NOT RUN (No Photo)'
                      : `${submissionResult.aiConfidence ?? 'N/A'}% Confidence`}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-[#A3A3A3] block">AI Classification:</span>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {submissionResult.aiClassification}
                  </p>
                </div>

                <p className="text-xs text-[#D4D4D0] bg-black/40 p-3 rounded-sm border border-[#2A2A2A] leading-relaxed">
                  {submissionResult.aiExplanation}
                </p>

                {retryAiFeedback && (
                  <div
                    className={`p-3 rounded-sm text-xs border ${
                      retryAiFeedback.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                        : 'bg-red-950/70 border-red-700 text-red-200'
                    }`}
                  >
                    {retryAiFeedback.message}
                  </div>
                )}

                {(submissionResult.aiStatus === 'FAILED' ||
                  submissionResult.aiStatus === 'PENDING' ||
                  (submissionResult.aiStatus === 'UNCONFIGURED' && Boolean(imageBase64))) && (
                  <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                    <span className="text-[11px] text-red-200">
                      Your report is saved safely. You can retry automated AI analysis now.
                    </span>
                    <button
                      type="button"
                      disabled={isRetryingAi}
                      onClick={handleRetryAi}
                      className="px-4 py-2 rounded-md bg-white hover:bg-[#EEEEEB] text-[#171717] font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRetryingAi ? 'animate-spin' : ''}`} />
                      <span>{isRetryingAi ? 'Retrying AI Analysis...' : 'Retry AI Analysis'}</span>
                    </button>
                  </div>
                )}

                <div className="p-3 bg-amber-950/40 rounded-sm border border-amber-800/60 text-[11px] text-amber-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Status is currently <strong>{submissionResult.status}</strong>. Official
                    verification requires authorized municipal officer confirmation.
                  </span>
                </div>
              </div>

              {/* Next Steps Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <NavLink
                  to="/map-public"
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#F5F5F2] hover:bg-[#EEEEEB] border border-[#E5E5E2] text-[#171717] text-xs font-semibold rounded-md text-center transition-colors"
                >
                  View on Live Public Map
                </NavLink>

                <NavLink
                  to="/citizen/reports"
                  className="w-full sm:w-auto px-6 py-3 bg-[#171717] hover:bg-black text-white text-xs font-semibold rounded-md text-center flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Track Status in My Reports</span>
                  <ArrowRight className="w-4 h-4" />
                </NavLink>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
