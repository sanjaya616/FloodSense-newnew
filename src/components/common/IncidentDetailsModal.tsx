/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FloodReport, IncidentStatus } from '../../utils/floodLogic';
import { RiskBadge } from './RiskBadge';
import { ReportEvidenceImage, hasReportPhotoEvidence } from './ReportEvidenceImage';
import { useFlood } from '../../context/FloodContext';
import {
  X,
  MapPin,
  Clock,
  ShieldCheck,
  Cpu,
  User,
  Phone,
  Compass,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  History,
  Lock,
  Check,
  Ban,
  Radio,
} from 'lucide-react';

interface IncidentDetailsModalProps {
  report: FloodReport | null;
  onClose: () => void;
}

export const IncidentDetailsModal: React.FC<IncidentDetailsModalProps> = ({
  report,
  onClose,
}) => {
  const { authenticatedRole, userProfile, updateIncidentStatus } = useFlood();
  const isOfficerSession = authenticatedRole === 'officer';
  const [newStatus, setNewStatus] = useState<IncidentStatus>(
    report?.incidentStatus || 'Submitted'
  );
  const [officerNote, setOfficerNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    if (report) {
      setNewStatus(report.incidentStatus || 'Submitted');
      setUpdateError(null);
      setUpdateSuccess(false);
    }
  }, [report?.id, report?.incidentStatus]);

  if (!report) return null;

  const aiDetails = report.aiVerificationDetails;
  const statusHistory = report.statusHistory || [];

  const handleUpdateStatus = async (targetStatus?: IncidentStatus) => {
    const statusToApply = targetStatus || newStatus;
    setIsUpdating(true);
    setUpdateSuccess(false);
    setUpdateError(null);

    try {
      await updateIncidentStatus(report.id, statusToApply, officerNote.trim() || undefined);
      setIsUpdating(false);
      setUpdateSuccess(true);
      setOfficerNote('');
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err: any) {
      setIsUpdating(false);
      setUpdateError(err?.message || 'Failed to update incident status.');
    }
  };

  const getStatusStepIndex = (st: IncidentStatus) => {
    switch (st) {
      case 'Submitted':
        return 0;
      case 'Under Review':
        return 1;
      case 'Verified':
        return 2;
      case 'Alert Issued':
        return 3;
      case 'Resolved':
        return 4;
      case 'Rejected':
        return -1;
      default:
        return 0;
    }
  };

  const currentStep = getStatusStepIndex(report.incidentStatus || 'Submitted');

  return (
    <div className="fixed inset-0 z-1000 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[#E5E5E2]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-modal-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E5E2] flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs sm:text-sm font-bold bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717] px-2.5 py-1 rounded-sm">
              {report.id}
            </span>
            <RiskBadge level={report.riskLevel} />
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-sm border ${
                report.incidentStatus === 'Alert Issued'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : report.incidentStatus === 'Resolved'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : report.incidentStatus === 'Verified'
                  ? 'bg-[#171717] text-white border-[#171717]'
                  : report.incidentStatus === 'More Info Requested'
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : report.incidentStatus === 'Rejected'
                  ? 'bg-[#EEEEEB] text-[#666666] border-[#E5E5E2]'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}
            >
              {report.incidentStatus || report.verificationStatus}
            </span>
            {report.isDuplicate && (
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-[#EEEEEB] text-[#171717] border border-[#E5E5E2]">
                Duplicate of {report.duplicateOfReportId || 'prior report'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-md text-[#666666] hover:text-[#171717] hover:bg-[#EEEEEB] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Main Title & Geolocation */}
          <div>
            <h3 id="incident-modal-title" className="text-xl font-bold text-[#171717] mb-1.5">
              {report.location}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#666666]">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#171717]" />
                {report.area}, Colombo Metro
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 font-mono tabular-nums">
                <Compass className="w-3.5 h-3.5 text-[#666666]" />
                {report.lat.toFixed(4)}° N, {report.lng.toFixed(4)}° E
                {(report.isPublicRedacted || report.coordinatePrecision === 'APPROX_100M_GRID') && (
                  <span className="text-[10px] text-[#171717] font-sans font-semibold ml-1">
                    (~100m Public Grid)
                  </span>
                )}
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 font-mono tabular-nums">
                <Clock className="w-3.5 h-3.5 text-[#666666]" />
                {new Date(report.timestamp).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Citizen Lifecycle Progress Bar */}
          <div className="p-4 bg-[#F5F5F2] rounded-lg border border-[#E5E5E2]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block mb-3 font-mono">
              Incident Resolution Lifecycle
            </span>

            {report.incidentStatus === 'Rejected' ? (
              <div className="p-3 bg-red-50 text-red-900 border border-red-200 rounded-md text-xs font-semibold flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-700 shrink-0" />
                <span>This report was evaluated and marked as Rejected by emergency management officers.</span>
              </div>
            ) : (
              <div className="flex items-center justify-between relative">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-[#E5E5E2] z-0" />
                {(['Submitted', 'Under Review', 'Verified', 'Alert Issued', 'Resolved'] as const).map(
                  (st, idx) => {
                    const isPassed = currentStep >= idx;
                    const isCurrent = currentStep === idx;
                    return (
                      <div key={st} className="flex flex-col items-center relative z-10">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                            isCurrent
                              ? 'bg-[#171717] text-white ring-4 ring-[#E5E5E2]'
                              : isPassed
                              ? 'bg-emerald-700 text-white'
                              : 'bg-white border border-[#E5E5E2] text-[#666666]'
                          }`}
                        >
                          {isPassed && !isCurrent ? <Check className="w-3 h-3" /> : idx + 1}
                        </div>
                        <span
                          className={`text-[10px] mt-1.5 font-medium text-center hidden sm:block ${
                            isCurrent
                              ? 'text-[#171717] font-bold'
                              : isPassed
                              ? 'text-[#171717]'
                              : 'text-[#666666]'
                          }`}
                        >
                          {st}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* Photo Evidence if uploaded (strictly excluded on public redacted views) */}
          {hasReportPhotoEvidence(report) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#666666] mb-2">
                Field Photographic Evidence
              </p>
              <div className="rounded-lg overflow-hidden border border-[#E5E5E2] bg-[#F5F5F2]">
                <ReportEvidenceImage
                  report={report}
                  showDimensions
                  className="w-full max-h-72 object-cover"
                />
              </div>
            </div>
          )}

          {/* Severity & Incident Attributes Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-[#F5F5F2] rounded-lg border border-[#E5E5E2]">
              <span className="text-[10px] uppercase font-bold text-[#666666] block mb-1">
                Citizen Water Level
              </span>
              <span className="text-sm font-bold text-[#171717]">{report.waterLevel}</span>
            </div>
            <div className="p-3 bg-[#F5F5F2] rounded-lg border border-[#E5E5E2]">
              <span className="text-[10px] uppercase font-bold text-[#666666] block mb-1">
                Road Status
              </span>
              <span className="text-sm font-bold text-[#171717]">{report.roadAccessibility}</span>
            </div>
            <div className="p-3 bg-[#F5F5F2] rounded-lg border border-[#E5E5E2]">
              <span className="text-[10px] uppercase font-bold text-[#666666] block mb-1">
                Flood Classification
              </span>
              <span className="text-sm font-bold text-[#171717] truncate block">
                {report.floodType}
              </span>
            </div>
          </div>

          {/* Narrative description */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#666666] mb-1.5">
              Citizen Field Description
            </h4>
            <p className="text-sm text-[#171717] bg-[#F5F5F2] p-3.5 rounded-lg border border-[#E5E5E2] leading-relaxed">
              {report.description}
            </p>
          </div>

          {/* AI VERIFICATION SECTION */}
          <div className="p-4 bg-[#F5F5F2] rounded-lg border border-[#E5E5E2] space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E5E2]">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#171717]" />
                <span className="text-xs font-bold text-[#171717] uppercase tracking-wider">
                  {aiDetails?.method || 'AI Image Verification Assessment'}
                </span>
              </div>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-sm border ${
                  report.aiStatus === 'FAILED'
                    ? 'text-red-800 bg-red-50 border-red-200'
                    : report.aiStatus === 'NOT_RUN'
                    ? 'text-[#666666] bg-white border-[#E5E5E2]'
                    : report.aiStatus === 'UNCONFIGURED' || report.aiStatus === 'PENDING'
                    ? 'text-amber-900 bg-amber-50 border-amber-200'
                    : 'text-[#171717] bg-white border-[#E5E5E2]'
                }`}
              >
                {(() => {
                  const aiConf = report.aiConfidence ?? aiDetails?.confidence ?? null;
                  if (report.aiStatus === 'FAILED') return 'AI FAILED';
                  if (report.aiStatus === 'UNCONFIGURED') return 'AI UNCONFIGURED';
                  if (report.aiStatus === 'PENDING') return 'AI PENDING';
                  if (report.aiStatus === 'NOT_RUN' || (!hasReportPhotoEvidence(report) && aiConf == null)) {
                    return 'AI NOT RUN';
                  }
                  return aiConf != null ? `Confidence: ${aiConf}%` : 'Confidence: N/A';
                })()}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-[#666666]">Classification Hypothesis:</span>
                <span className="font-bold text-[#171717] text-right">
                  {report.aiClassification ??
                    aiDetails?.aiAssessment ??
                    aiDetails?.assessment ??
                    (report.aiStatus === 'NOT_RUN'
                      ? 'AI Not Run (No Image)'
                      : report.aiStatus === 'UNCONFIGURED'
                      ? 'AI Verification Not Configured'
                      : 'Under Review')}
                </span>
              </div>

              {aiDetails?.waterLevelEstimated && (
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#666666]">Observed Water Depth:</span>
                  <span className="font-bold text-[#171717]">{aiDetails.waterLevelEstimated}</span>
                </div>
              )}

              {aiDetails?.roadAccessibilityEstimated && (
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#666666]">Observed Road Status:</span>
                  <span className="font-bold text-[#171717]">{aiDetails.roadAccessibilityEstimated}</span>
                </div>
              )}

              {aiDetails?.uncertainty && (
                <div className="text-[11px] text-[#666666] bg-white p-2.5 rounded-md border border-[#E5E5E2]">
                  <strong className="text-[#171717]">Uncertainty Assessment:</strong> {aiDetails.uncertainty}
                </div>
              )}

              <p className="text-xs text-[#171717]/85 leading-relaxed pt-1">
                {aiDetails?.explanation ||
                  'AI visual assessment details will appear here once processing completes.'}
              </p>
            </div>

            <div className="p-2.5 bg-amber-50 rounded-md border border-amber-200 text-[11px] text-amber-900 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <span>
                {aiDetails?.disclaimer ||
                  'Image classification is an assistive early warning signal and not a substitute for official municipal field inspection.'}
              </span>
            </div>
          </div>

          {/* Incident Status History Timeline */}
          {statusHistory.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#171717] mb-2.5 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#666666]" />
                <span>Incident Status History &amp; Audit Log</span>
              </h4>
              <div className="space-y-3 border-l border-[#E5E5E2] pl-3.5">
                {statusHistory.map((item, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#171717]">{item.status}</span>
                      <span className="text-[10px] text-[#666666] font-mono tabular-nums">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#666666] font-medium">By {item.authorName}</span>
                    {item.note && (
                      <p className="text-[11px] text-[#171717] bg-[#F5F5F2] p-2 rounded-md border border-[#E5E5E2] mt-1 italic">
                        "{item.note}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Protected Reporter Information */}
          <div className="pt-3 border-t border-[#E5E5E2] text-xs">
            {isOfficerSession ? (
              <div className="flex items-center justify-between text-[#666666] bg-[#F5F5F2] p-3 rounded-lg border border-[#E5E5E2]">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[#171717]" />
                  <span>
                    Reported by: <strong className="text-[#171717]">{report.reporterName || 'Citizen'}</strong>
                  </span>
                </div>
                {report.reporterPhone && (
                  <div className="flex items-center gap-1 font-mono text-[#171717]">
                    <Phone className="w-3.5 h-3.5 text-[#666666]" />
                    <span>{report.reporterPhone}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[#666666] text-[11px]">
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  Privacy Protected: Contributor contact details are restricted to authorized municipal emergency officers.
                </span>
              </div>
            )}
          </div>

          {/* OFFICER MANAGEMENT CONTROLS (Only visible for Authenticated Emergency Officer) */}
          {isOfficerSession && (
            <div className="p-4 sm:p-5 bg-[#181818] text-white rounded-lg space-y-3 border border-[#2C2C2C]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>Officer Command &amp; Status Action</span>
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  Officer: {userProfile.name}
                </span>
              </div>

              {updateSuccess && (
                <div className="p-2.5 bg-emerald-950/60 text-emerald-200 border border-emerald-700 rounded-md text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Incident status updated and recorded to audit history.</span>
                </div>
              )}

              {updateError && (
                <div className="p-2.5 bg-red-950/60 text-red-200 border border-red-800 rounded-md text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{updateError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-neutral-300 mb-1 font-semibold">
                    Update Incident Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as IncidentStatus)}
                    className="w-full px-3 py-2 bg-[#202020] border border-neutral-700 rounded-md text-white text-xs focus:outline-none focus:border-white"
                  >
                    <option value="Submitted">1. Submitted</option>
                    <option value="Under Review">2. Under Review</option>
                    <option value="More Info Requested">3. More Info Requested</option>
                    <option value="Verified">4. Verified</option>
                    <option value="Alert Issued">5. Alert Issued</option>
                    <option value="Resolved">6. Resolved</option>
                    <option value="Rejected">7. Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-300 mb-1 font-semibold">
                    Officer Dispatch Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Sucker truck deployed, culverts cleared..."
                    value={officerNote}
                    onChange={(e) => setOfficerNote(e.target.value)}
                    className="w-full px-3 py-2 bg-[#202020] border border-neutral-700 rounded-md text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus('Verified')}
                    className="px-3 py-1.5 bg-white hover:bg-[#EEEEEB] text-[#171717] font-semibold text-xs rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Verify Incident</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus('More Info Requested')}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Request Info</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus('Alert Issued')}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Issue Public Alert</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus('Resolved')}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Resolved</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleUpdateStatus()}
                  className="px-4 py-1.5 bg-white text-[#171717] hover:bg-[#EEEEEB] font-semibold text-xs rounded-md transition-colors disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Apply Selection'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#E5E5E2] bg-[#F5F5F2] flex items-center justify-between text-xs">
          <span className="text-[#666666] font-mono">
            Cluster Hotspot: {report.hotspotId || 'Unassociated'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#171717] text-white font-semibold rounded-md hover:bg-black transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
