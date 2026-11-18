/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useFlood } from '../context/FloodContext';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  MapPin,
  Compass,
  FileCheck,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Cpu,
  ArrowRight,
  Info,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { validateCoordinates, AiStatus } from '../utils/floodLogic';
import {
  compressReportImage,
  CompressedReportImage,
  createSubmissionRequestId,
} from '../utils/imageUtils';

export const ReportFloodPage: React.FC = () => {
  const { addReport, retryAiVerification, retryReportEvidenceUpload, dbOperationStatus, userProfile } = useFlood();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef<boolean>(false);

  // Form state (no silent area/coordinate prefill)
  const [locationName, setLocationName] = useState('');
  const [area, setArea] = useState<string>('');
  const [latInput, setLatInput] = useState<string>('');
  const [lngInput, setLngInput] = useState<string>('');
  const [waterLevel, setWaterLevel] = useState<'Low' | 'Moderate' | 'High' | 'Severe'>('Moderate');
  const [roadAccessibility, setRoadAccessibility] = useState<'Open' | 'Partially Blocked' | 'Completely Blocked'>('Partially Blocked');
  const [floodType, setFloodType] = useState<'Street Waterlogging' | 'Flash Flood' | 'Canal Overflow' | 'Drainage Blockage'>('Street Waterlogging');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState(userProfile.name || '');
  const [reporterPhone, setReporterPhone] = useState(userProfile.phone || '');
  const [submissionRequestId, setSubmissionRequestId] = useState<string>(() => createSubmissionRequestId());

  // Image Upload state & validation (Starts EMPTY)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressedEvidence, setCompressedEvidence] = useState<CompressedReportImage | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [imageMeta, setImageMeta] = useState<{ name: string; size: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // GPS state
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsSuccess, setGpsSuccess] = useState<boolean>(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryingEvidence, setIsRetryingEvidence] = useState(false);
  const [isRetryingAi, setIsRetryingAi] = useState(false);
  const [retryAiFeedback, setRetryAiFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    id: string;
    hotspotId: string;
    method: string;
    aiStatus: AiStatus;
    aiConfidence: number | null;
    aiClassification: string;
    explanation: string;
    isDuplicate?: boolean;
    duplicateOfId?: string;
    duplicateCheckWarning?: string;
    evidenceUploadFailed?: boolean;
    evidenceUploadError?: string;
  } | null>(null);

  const parsedLat = Number.parseFloat(latInput);
  const parsedLng = Number.parseFloat(lngInput);
  const coordsAreValid = latInput.trim() !== '' && lngInput.trim() !== '' && validateCoordinates(parsedLat, parsedLng);

  // Area preset coordinates
  const areaCoordinates: Record<string, { lat: number; lng: number }> = {
    Maradana: { lat: 6.9271, lng: 79.8653 },
    Wellawatte: { lat: 6.8745, lng: 79.8600 },
    Borella: { lat: 6.9110, lng: 79.8770 },
    Kolonnawa: { lat: 6.9360, lng: 79.8850 },
    Dematagoda: { lat: 6.9380, lng: 79.8780 },
    Nugegoda: { lat: 6.8710, lng: 79.8980 },
  };

  const handleAreaChange = (newArea: string) => {
    setArea(newArea);
    setGpsSuccess(false);
    if (areaCoordinates[newArea]) {
      setLatInput(areaCoordinates[newArea].lat.toFixed(5));
      setLngInput(areaCoordinates[newArea].lng.toFixed(5));
    }
  };

  const processFile = async (file: File) => {
    setImageError(null);
    setIsProcessingImage(true);
    try {
      const sanitized = await compressReportImage(file);
      setSelectedFile(sanitized.file);
      setCompressedEvidence(sanitized);
      setImageMimeType(sanitized.mimeType);
      setImageMeta({
        name: file.name,
        size: `${sanitized.sizeLabel}${sanitized.exifStripped ? ' · EXIF stripped' : ''}`,
      });
      setImagePreview(sanitized.dataUrl);
      setImageBase64(sanitized.base64Data);
    } catch (err: any) {
      setCompressedEvidence(null);
      setImageError(err?.message || 'Unable to process selected image file.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setGpsError(null);
    setGpsSuccess(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatInput(pos.coords.latitude.toFixed(5));
        setLngInput(pos.coords.longitude.toFixed(5));
        setIsLocating(false);
        setGpsSuccess(true);
      },
      () => {
        setIsLocating(false);
        setGpsError(
          'Location access permission was not granted. Please select your sector or enter coordinates manually below.'
        );
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent, omitPhoto = false) => {
    e.preventDefault();
    setSubmissionError(null);

    if (!locationName.trim()) {
      setSubmissionError('Please enter a location name or road description.');
      return;
    }

    if (!area.trim()) {
      setSubmissionError('Please select a Colombo Municipal Sector.');
      return;
    }

    if (!coordsAreValid) {
      setSubmissionError('Please acquire GPS coordinates, pick a sector, or enter valid latitude/longitude coordinates.');
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await addReport({
        location: locationName.trim(),
        area,
        lat: parsedLat,
        lng: parsedLng,
        waterLevel,
        roadAccessibility,
        floodType,
        description: description.trim() || 'Citizen reported urban street flooding.',
        reporterName: reporterName.trim() || userProfile.name || 'Community Contributor',
        reporterPhone: reporterPhone.trim(),
        reporterId: userProfile.uid || userProfile.email || 'citizen_active_session',
        compressedEvidence: !omitPhoto && compressedEvidence ? compressedEvidence : undefined,
        imageFile: !omitPhoto && !compressedEvidence && selectedFile ? selectedFile : undefined,
        customImage: !omitPhoto && imageBase64 ? imageBase64 : undefined,
        imageMimeType: !omitPhoto ? imageMimeType : undefined,
        submissionRequestId,
      });

      setSubmittedResult({
        id: result.report.id,
        hotspotId: result.hotspot.id,
        method: result.report.aiVerificationDetails?.method || 'AI Early Verification',
        aiStatus: result.report.aiStatus || (omitPhoto || !imageBase64 ? 'NOT_RUN' : 'COMPLETED'),
        aiConfidence: result.report.aiConfidence ?? null,
        aiClassification:
          result.report.aiClassification ||
          result.report.aiVerificationDetails?.aiAssessment ||
          'No Photograph Attached',
        explanation:
          result.report.aiVerificationDetails?.explanation ||
          'Incident saved and queued for official officer verification.',
        isDuplicate: result.isDuplicate,
        duplicateOfId: result.duplicateOfId,
        duplicateCheckWarning: result.duplicateCheckWarning,
        evidenceUploadFailed: result.evidenceUploadFailed,
        evidenceUploadError: result.evidenceUploadError,
      });
    } catch (err: any) {
      setSubmissionError(err?.message || 'Failed to submit report. Please retry.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleRetryEvidenceUpload = async () => {
    if (!submittedResult || (!compressedEvidence && !selectedFile)) return;
    setIsRetryingEvidence(true);
    try {
      await retryReportEvidenceUpload(
        submittedResult.id,
        compressedEvidence || (selectedFile as File)
      );
      setSubmittedResult((prev) =>
        prev
          ? {
              ...prev,
              evidenceUploadFailed: false,
              evidenceUploadError: undefined,
            }
          : prev
      );
    } catch (err: any) {
      setSubmittedResult((prev) =>
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

  const handleRetryAi = async () => {
    if (!submittedResult || isRetryingAi) return;
    setIsRetryingAi(true);
    setRetryAiFeedback(null);
    try {
      const overridePayload = submittedResult.evidenceUploadFailed && imageBase64
        ? { customImage: imageBase64, mimeType: imageMimeType }
        : undefined;
      const updated = await retryAiVerification(submittedResult.id, overridePayload);
      if (updated) {
        setSubmittedResult((prev) =>
          prev
            ? {
                ...prev,
                method: updated.aiVerificationDetails?.method || prev.method,
                aiStatus: updated.aiStatus || 'FAILED',
                aiConfidence: updated.aiConfidence ?? null,
                aiClassification: updated.aiClassification || 'AI Processing Failed',
                explanation:
                  updated.aiVerificationDetails?.explanation ||
                  'AI retry finished. Queued for officer inspection.',
              }
            : prev
        );
        if (updated.aiStatus === 'COMPLETED') {
          setRetryAiFeedback({
            type: 'success',
            message: `AI assessment completed: ${updated.aiClassification} (${updated.aiConfidence ?? 'N/A'}% confidence).`,
          });
        } else {
          setRetryAiFeedback({
            type: 'error',
            message:
              updated.aiVerificationDetails?.explanation ||
              'AI analysis failed. Report remains saved for retry or manual review.',
          });
        }
      }
    } catch (err: any) {
      setRetryAiFeedback({
        type: 'error',
        message: err?.message || 'Unable to retry AI verification right now.',
      });
    } finally {
      setIsRetryingAi(false);
    }
  };

  const handleReset = () => {
    setLocationName('');
    setArea('');
    setLatInput('');
    setLngInput('');
    setDescription('');
    setWaterLevel('Moderate');
    setRoadAccessibility('Partially Blocked');
    setFloodType('Street Waterlogging');
    setImagePreview(null);
    setImageBase64(null);
    setSelectedFile(null);
    setCompressedEvidence(null);
    setImageMeta(null);
    setImageError(null);
    setSubmissionError(null);
    setSubmittedResult(null);
    setGpsError(null);
    setGpsSuccess(false);
    setSubmissionRequestId(createSubmissionRequestId());
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      {/* Title */}
      <div>
        <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
          Dispatch Flood Incident Report
        </h2>
        <p className="text-sm text-[#666666] mt-1">
          Operations dispatch &amp; field entry: upload photographs, log waterlogged intersections, and trigger drainage coordination.
        </p>
      </div>

      {/* Mandatory Privacy & Data Security Notice */}
      <div className="p-4 bg-[#181818] text-white rounded-md border border-[#2A2A2A] flex items-start gap-3.5 text-xs">
        <Lock className="w-5 h-5 text-[#D4D4D0] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white uppercase tracking-[0.14em] block mb-0.5 font-mono text-[10px]">
            Citizen Privacy &amp; Geospatial Integrity Notice
          </span>
          <p className="text-[#D4D4D0] leading-relaxed">
            Photographs and approximate location coordinates are used exclusively for spatial flood risk
            assessment and municipal dispatch. Personal contact information is protected and accessible
            only to authorized municipal emergency officers.
          </p>
        </div>
      </div>

      {/* Success Notification Banner after submission */}
      {submittedResult && (
        <div className="p-6 bg-emerald-50 rounded-md border border-emerald-200">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-700 text-white rounded-sm shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-900">
                  Incident Registered &amp; Assigned to Emergency Feed
                </span>
                <h3 className="text-lg font-bold text-[#171717] mt-0.5">
                  Report ID: <span className="font-mono text-[#171717]">{submittedResult.id}</span>
                </h3>
                <p className="text-xs text-[#666666] mt-1">
                  Assigned to Hotspot:{' '}
                  <strong className="text-[#171717] font-mono">{submittedResult.hotspotId}</strong>.
                  Status: <strong className="text-amber-800">Under Review</strong> (Awaiting official officer confirmation).
                </p>

                {submittedResult.isDuplicate && (
                  <p className="text-xs text-amber-900 bg-amber-100 p-2.5 rounded-sm mt-2 font-medium">
                    Notice: An existing report was detected within 25 meters and 5 minutes (Original: {submittedResult.duplicateOfId}).
                    Your submission has been cataloged as an audited duplicate without distorting unique citizen counts.
                  </p>
                )}

                {submittedResult.evidenceUploadFailed && (
                  <div className="mt-2 p-2.5 bg-amber-100 border border-amber-300 rounded-sm text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Photo evidence upload failed: {submittedResult.evidenceUploadError || 'Please retry saving photo.'}
                    </span>
                    {(compressedEvidence || selectedFile) && (
                      <button
                        type="button"
                        disabled={isRetryingEvidence}
                        onClick={handleRetryEvidenceUpload}
                        className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-sm font-semibold text-[11px] cursor-pointer disabled:opacity-50"
                      >
                        {isRetryingEvidence ? 'Retrying...' : 'Retry Photo Upload'}
                      </button>
                    )}
                  </div>
                )}

                {submittedResult.duplicateCheckWarning && (
                  <p className="text-[11px] text-[#666666] mt-1.5">
                    {submittedResult.duplicateCheckWarning}
                  </p>
                )}

                {/* AI verification badge in success */}
                <div className="mt-3 p-3 bg-white rounded-sm border border-emerald-200 text-xs text-[#171717]">
                  <div className="flex items-center gap-2 font-semibold text-[#171717] mb-0.5 flex-wrap">
                    <Cpu className="w-4 h-4 text-[#171717]" />
                    <span>{submittedResult.method}: {submittedResult.aiClassification}</span>
                    <span className="text-[10px] bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717] px-1.5 py-0.5 rounded-sm font-mono">
                      {submittedResult.aiStatus === 'NOT_RUN'
                        ? 'AI NOT RUN'
                        : submittedResult.aiStatus === 'FAILED'
                        ? 'AI FAILED'
                        : submittedResult.aiStatus === 'UNCONFIGURED'
                        ? 'AI UNCONFIGURED'
                        : submittedResult.aiStatus === 'PENDING'
                        ? 'AI PENDING'
                        : `${submittedResult.aiConfidence ?? 'N/A'}% confidence`}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#666666]">{submittedResult.explanation}</p>
                  {retryAiFeedback && (
                    <p
                      className={`mt-2 text-[11px] font-medium p-2 rounded-sm border ${
                        retryAiFeedback.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-red-50 border-red-200 text-red-900'
                      }`}
                    >
                      {retryAiFeedback.message}
                    </p>
                  )}
                  {(submittedResult.aiStatus === 'FAILED' ||
                    submittedResult.aiStatus === 'PENDING' ||
                    (submittedResult.aiStatus === 'UNCONFIGURED' && Boolean(imageBase64))) && (
                    <button
                      type="button"
                      disabled={isRetryingAi}
                      onClick={handleRetryAi}
                      className="mt-2 px-3 py-1.5 bg-[#171717] hover:bg-black text-white rounded-md font-semibold text-[11px] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRetryingAi ? 'animate-spin' : ''}`} />
                      <span>{isRetryingAi ? 'Retrying AI Analysis...' : 'Retry AI Analysis'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/officer/map')}
                className="px-4 py-2 bg-[#171717] text-white text-xs font-semibold rounded-md hover:bg-black transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>View on Live Map</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-white text-[#171717] border border-[#E5E5E2] text-xs font-semibold rounded-md hover:bg-[#EEEEEB] transition-colors cursor-pointer"
              >
                Submit Another Report
              </button>
            </div>
          </div>
        </div>
      )}

      {submissionError && (
        <div className="p-3.5 bg-red-50 text-red-900 border border-red-200 rounded-md text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
            <span>{submissionError}</span>
          </div>
          {imagePreview && (
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-md text-[11px] cursor-pointer"
            >
              Submit Without Photo
            </button>
          )}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-md border border-[#E5E5E2] divide-y divide-[#E5E5E2]">
        {/* SECTION A — Upload Photograph */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-mono font-semibold text-[#666666] uppercase tracking-[0.14em] block">
                Section A
              </span>
              <h3 className="text-base font-bold text-[#171717]">Upload Photographic Evidence</h3>
              <p className="text-xs text-[#666666]">
                Attach a street photograph showing water depth, stranded vehicles, or blocked drains.
              </p>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border border-dashed rounded-md p-6 text-center transition-colors ${
              isDragging
                ? 'border-[#171717] bg-[#EEEEEB]'
                : 'border-[#D4D4D0] hover:border-[#171717] bg-[#F5F5F2]'
            }`}
          >
            {imagePreview ? (
              <div className="max-w-md mx-auto space-y-3">
                <div className="relative rounded-sm overflow-hidden border border-[#E5E5E2] max-h-56 bg-[#181818]">
                  <img
                    src={imagePreview}
                    alt="Uploaded flood evidence"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImageBase64(null);
                      setSelectedFile(null);
                      setCompressedEvidence(null);
                      setImageMeta(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-700 text-white rounded-sm hover:bg-red-800 transition-colors cursor-pointer"
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {imageMeta && (
                  <div className="flex items-center justify-between text-xs text-[#666666] bg-white p-2.5 rounded-sm border border-[#E5E5E2]">
                    <span className="font-medium text-[#171717] truncate max-w-[200px]">{imageMeta.name}</span>
                    <span className="font-mono text-[#666666]">{imageMeta.size}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold text-[#171717] hover:underline cursor-pointer"
                >
                  Change Photograph
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-md bg-white border border-[#E5E5E2] text-[#171717] flex items-center justify-center mx-auto">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold text-[#171717] underline cursor-pointer"
                  >
                    Click to browse
                  </button>
                  <span className="text-xs text-[#666666]"> or drag and drop image here</span>
                </div>
                <p className="text-[11px] text-[#666666]">
                  Validated formats: JPG, JPEG, PNG, WEBP up to 10MB (auto-compressed ≤ 1280px JPEG)
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {imageError && (
            <p className="mt-2 text-xs text-red-700 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{imageError}</span>
            </p>
          )}
        </div>

        {/* SECTION B — Location Information */}
        <div className="p-6">
          <div className="mb-4">
            <span className="text-[10px] font-mono font-semibold text-[#666666] uppercase tracking-[0.14em] block">
              Section B
            </span>
            <h3 className="text-base font-bold text-[#171717]">Geographic Location</h3>
            <p className="text-xs text-[#666666]">
              Pinpoint the flooded corridor or road intersection.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Location / Street Description <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Near Technical College Junction, Sri Sangaraja Mawatha"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] focus:bg-white focus:outline-none focus:border-[#171717]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Colombo Municipal Sector <span className="text-red-600">*</span>
                </label>
                <select
                  value={area}
                  required
                  onChange={(e) => handleAreaChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] focus:bg-white focus:outline-none focus:border-[#171717]"
                >
                  <option value="">Select municipal sector...</option>
                  <option value="Maradana">Maradana Sector</option>
                  <option value="Wellawatte">Wellawatte Sector</option>
                  <option value="Borella">Borella Sector</option>
                  <option value="Kolonnawa">Kolonnawa Sector</option>
                  <option value="Dematagoda">Dematagoda Sector</option>
                  <option value="Nugegoda">Nugegoda Sector</option>
                </select>
              </div>

              {/* Coordinates & GPS button */}
              <div className="p-3 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#171717] flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-[#171717]" />
                    GPS Coordinates <span className="text-red-600">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRequestLocation}
                    disabled={isLocating}
                    className="px-2.5 py-1 text-xs font-semibold text-[#171717] bg-white hover:bg-[#EEEEEB] border border-[#E5E5E2] rounded-sm transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>{isLocating ? 'Acquiring GPS...' : 'Use My Current Location'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <label className="text-[10px] text-[#666666] uppercase block">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="6.92710"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-[#E5E5E2] rounded-sm text-[#171717]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#666666] uppercase block">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="79.86530"
                      value={lngInput}
                      onChange={(e) => setLngInput(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-[#E5E5E2] rounded-sm text-[#171717]"
                    />
                  </div>
                </div>

                {gpsSuccess && (
                  <p className="text-[11px] text-emerald-800 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    Browser coordinates acquired accurately.
                  </p>
                )}

                {gpsError && (
                  <p className="text-[11px] text-amber-800 flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0" />
                    {gpsError}
                  </p>
                )}
              </div>
            </div>

            {/* Mini preview card */}
            <div className="bg-[#F5F5F2] p-4 rounded-md border border-[#E5E5E2] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase font-semibold text-[#666666] block mb-1">
                  Location Preview
                </span>
                <p className="text-sm font-bold text-[#171717]">
                  {locationName || 'Unspecified location'}
                </p>
                <p className="text-xs text-[#666666] mb-3">
                  {area ? `${area}, Colombo Basin` : 'Select sector or acquire GPS'}
                </p>
                <div className="p-3 bg-white rounded-sm border border-[#E5E5E2] text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#666666]">Target Lat:</span>
                    <span className="text-[#171717] font-bold">
                      {coordsAreValid ? `${parsedLat.toFixed(4)}° N` : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666666]">Target Lng:</span>
                    <span className="text-[#171717] font-bold">
                      {coordsAreValid ? `${parsedLng.toFixed(4)}° E` : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[11px] text-[#666666] leading-tight">
                Reports within 500m and 2 hours are clustered algorithmically into disaster management response hotspots.
              </div>
            </div>
          </div>
        </div>

        {/* SECTION C — Incident Details */}
        <div className="p-6">
          <div className="mb-4">
            <span className="text-[10px] font-mono font-semibold text-[#666666] uppercase tracking-[0.14em] block">
              Section C
            </span>
            <h3 className="text-base font-bold text-[#171717]">Incident Severity &amp; Attributes</h3>
            <p className="text-xs text-[#666666]">
              Select estimated flood depths and traffic disruption parameters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Water Level */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">Water Level</label>
              <div className="space-y-1.5">
                {(['Low', 'Moderate', 'High', 'Severe'] as const).map((lvl) => (
                  <label
                    key={lvl}
                    className={`flex items-center justify-between p-2 rounded-sm border text-xs cursor-pointer transition-colors ${
                      waterLevel === lvl
                        ? 'bg-[#171717] border-[#171717] text-white font-semibold'
                        : 'bg-[#F5F5F2] border-[#E5E5E2] text-[#171717] hover:bg-white'
                    }`}
                  >
                    <span>{lvl}</span>
                    <input
                      type="radio"
                      name="waterLevel"
                      value={lvl}
                      checked={waterLevel === lvl}
                      onChange={() => setWaterLevel(lvl)}
                      className="text-[#171717] focus:ring-[#171717]"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Road Accessibility */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Road Accessibility
              </label>
              <div className="space-y-1.5">
                {(['Open', 'Partially Blocked', 'Completely Blocked'] as const).map((acc) => (
                  <label
                    key={acc}
                    className={`flex items-center justify-between p-2 rounded-sm border text-xs cursor-pointer transition-colors ${
                      roadAccessibility === acc
                        ? 'bg-[#171717] border-[#171717] text-white font-semibold'
                        : 'bg-[#F5F5F2] border-[#E5E5E2] text-[#171717] hover:bg-white'
                    }`}
                  >
                    <span>{acc}</span>
                    <input
                      type="radio"
                      name="roadAccessibility"
                      value={acc}
                      checked={roadAccessibility === acc}
                      onChange={() => setRoadAccessibility(acc)}
                      className="text-[#171717] focus:ring-[#171717]"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Flood Type */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">Flood Type</label>
              <div className="space-y-1.5">
                {(
                  [
                    'Street Waterlogging',
                    'Flash Flood',
                    'Canal Overflow',
                    'Drainage Blockage',
                  ] as const
                ).map((ft) => (
                  <label
                    key={ft}
                    className={`flex items-center justify-between p-2 rounded-sm border text-xs cursor-pointer transition-colors ${
                      floodType === ft
                        ? 'bg-[#171717] border-[#171717] text-white font-semibold'
                        : 'bg-[#F5F5F2] border-[#E5E5E2] text-[#171717] hover:bg-white'
                    }`}
                  >
                    <span className="truncate">{ft}</span>
                    <input
                      type="radio"
                      name="floodType"
                      value={ft}
                      checked={floodType === ft}
                      onChange={() => setFloodType(ft)}
                      className="text-[#171717] focus:ring-[#171717]"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1">
              Field Description &amp; Key Landmarks
            </label>
            <textarea
              rows={3}
              placeholder="Describe submerged sidewalks, stranded vehicles, direction of stormwater flow, or vulnerable residents nearby..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] focus:bg-white focus:outline-none focus:border-[#171717]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-[#666666] mb-1">
                Your Name (Optional)
              </label>
              <input
                type="text"
                placeholder="Citizen Contributor"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] focus:bg-white focus:outline-none focus:border-[#171717]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#666666] mb-1">
                Contact Phone (Optional - Protected PII)
              </label>
              <input
                type="tel"
                placeholder="+94 77 XXX XXXX"
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] font-mono focus:bg-white focus:outline-none focus:border-[#171717]"
              />
            </div>
          </div>
        </div>

        {/* SECTION D — AI Early Verification Pipeline */}
        <div className="p-6 bg-[#F5F5F2]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-mono font-semibold text-[#666666] uppercase tracking-[0.14em] block">
                Section D
              </span>
              <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#171717]" />
                <span>AI Verification Pipeline &amp; Multimodal Processing</span>
              </h3>
              <p className="text-xs text-[#666666]">
                {imagePreview
                  ? 'On submission, your EXIF-stripped photograph will be inspected by server-side Gemini AI when configured.'
                  : 'No photograph attached — AI vision analysis will be skipped (NOT RUN) and your report will enter human officer review directly.'}
              </p>
            </div>
            <span className="text-[10px] font-mono bg-white border border-[#E5E5E2] text-[#171717] font-semibold px-2 py-0.5 rounded-sm">
              {isProcessingImage ? 'Sanitizing...' : imagePreview ? 'Photo Ready' : 'No Photo'}
            </span>
          </div>

          <div className="bg-white p-4 rounded-md border border-[#E5E5E2] space-y-2 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-semibold text-[#171717]">Initial Pipeline Status:</span>
              <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-amber-50 border border-amber-200 text-amber-900">
                Under Review (Human Officer Confirmation Required)
              </span>
            </div>
            <div className="text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-sm font-medium border border-amber-200">
              Notice: AI assessment is an assistive early warning signal only and runs only after submission when a photograph is attached. Official status requires emergency officer confirmation.
            </div>
          </div>
        </div>

        {/* SECTION E — Submission Action */}
        <div className="p-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-semibold text-[#666666] hover:text-[#171717] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Form</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || dbOperationStatus.loading}
              className="px-6 py-2.5 bg-[#171717] hover:bg-black text-white font-semibold text-xs rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting || dbOperationStatus.loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing &amp; Uploading Incident...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>Submit Flood Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
