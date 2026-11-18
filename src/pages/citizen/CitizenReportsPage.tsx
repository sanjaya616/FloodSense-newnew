/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FileText,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Eye,
  X,
  RefreshCw,
  Ban,
  MessageSquare,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { RiskBadge } from '../../components/common/RiskBadge';
import { ReportEvidenceImage, hasReportPhotoEvidence } from '../../components/common/ReportEvidenceImage';
import { FloodReport } from '../../utils/floodLogic';

export const CitizenReportsPage: React.FC = () => {
  const {
    myReports,
    retryAiVerification,
    retryPublicSync,
    retryReportEvidenceUpload,
    deleteReport,
  } = useFlood();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<FloodReport | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingSyncId, setRetryingSyncId] = useState<string | null>(null);
  const [retryingEvidenceId, setRetryingEvidenceId] = useState<string | null>(null);
  const [confirmDeleteReport, setConfirmDeleteReport] = useState<FloodReport | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [syncRetryError, setSyncRetryError] = useState<string | null>(null);
  const [aiRetryFeedback, setAiRetryFeedback] = useState<{
    reportId: string;
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const filteredReports = myReports.filter((r) => {
    const matchSearch =
      searchQuery === '' ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.area.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;

    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'ACTIVE') {
      return (
        r.incidentStatus === 'Submitted' ||
        r.incidentStatus === 'Under Review' ||
        r.incidentStatus === 'More Info Requested' ||
        r.incidentStatus === 'Verified' ||
        r.incidentStatus === 'Alert Issued'
      );
    }
    if (filterStatus === 'VERIFIED') {
      return r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued';
    }
    if (filterStatus === 'RESOLVED') {
      return r.incidentStatus === 'Resolved';
    }
    return true;
  });

  // 6-stage timeline progress:
  // 1: Submitted -> 2: AI Reviewed -> 3: Under Officer Review -> 4: Verified -> 5: Alert Issued -> 6: Resolved
  const getTimelineStep = (report: FloodReport) => {
    switch (report.incidentStatus) {
      case 'Submitted':
        return report.aiStatus === 'COMPLETED' ? 2 : 1;
      case 'Under Review':
      case 'More Info Requested':
        return 3;
      case 'Verified':
        return 4;
      case 'Alert Issued':
        return 5;
      case 'Resolved':
        return 6;
      case 'Rejected':
        return 0;
      default:
        return 1;
    }
  };

  const timelineStages = [
    { num: 1, label: 'Submitted' },
    { num: 2, label: 'AI Reviewed' },
    { num: 3, label: 'Officer Review' },
    { num: 4, label: 'Verified' },
    { num: 5, label: 'Alert Issued' },
    { num: 6, label: 'Resolved' },
  ];

  const handleRetryAi = async (reportId: string) => {
    if (retryingId === reportId) return;
    setRetryingId(reportId);
    setAiRetryFeedback(null);
    try {
      const updated = await retryAiVerification(reportId);
      if (updated) {
        if (selectedReport?.id === reportId) {
          setSelectedReport(updated);
        }
        if (updated.aiStatus === 'COMPLETED') {
          setAiRetryFeedback({
            reportId,
            type: 'success',
            message: `AI assessment succeeded for ${reportId}: ${updated.aiClassification} (${updated.aiConfidence ?? 'N/A'}% confidence).`,
          });
        } else {
          setAiRetryFeedback({
            reportId,
            type: 'error',
            message:
              updated.aiVerificationDetails?.explanation ||
              `AI assessment failed for ${reportId}. Report remains saved for retry.`,
          });
        }
      }
    } catch (err: any) {
      setAiRetryFeedback({
        reportId,
        type: 'error',
        message: err?.message || `Unable to retry AI assessment for ${reportId}.`,
      });
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryPublicSync = async (reportId: string) => {
    setSyncRetryError(null);
    setRetryingSyncId(reportId);
    try {
      const res = await retryPublicSync(reportId);
      if (!res.ok) {
        setSyncRetryError(res.error || 'Could not synchronize report with public flood map.');
      }
    } finally {
      setRetryingSyncId(null);
    }
  };

  const handleRetryEvidenceFile = async (reportId: string, file: File) => {
    setSyncRetryError(null);
    setRetryingEvidenceId(reportId);
    try {
      await retryReportEvidenceUpload(reportId, file);
    } catch (err: any) {
      setSyncRetryError(err?.message || 'Could not upload compressed photograph to Firestore.');
    } finally {
      setRetryingEvidenceId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteReport) return;
    setSyncRetryError(null);
    setIsDeletingId(confirmDeleteReport.id);
    try {
      await deleteReport(confirmDeleteReport.id);
      if (selectedReport?.id === confirmDeleteReport.id) {
        setSelectedReport(null);
      }
      setConfirmDeleteReport(null);
    } catch (err: any) {
      setSyncRetryError(err?.message || 'Unable to delete report and its Firestore evidence.');
    } finally {
      setIsDeletingId(null);
    }
  };

  const canCitizenDelete = (report: FloodReport) =>
    report.incidentStatus === 'Submitted' ||
    report.incidentStatus === 'Under Review' ||
    report.incidentStatus === 'More Info Requested';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#666666] mb-1.5">
            <NavLink to="/citizen" className="hover:text-[#171717] transition-colors">
              Citizen Portal
            </NavLink>
            <ChevronRight className="w-3 h-3 text-[#A3A3A3]" />
            <span className="text-[#171717] font-semibold">My Reports</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
            Track My Flood Reports
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1.5">
            Real-time status tracking from submission to municipal officer review and road clearance.
          </p>
        </div>

        <NavLink
          to="/citizen/report"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#171717] hover:bg-black text-white font-semibold text-xs transition-colors self-start sm:self-center"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Report Another Road</span>
        </NavLink>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-md border border-[#E5E5E2] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Search by Report ID, location, or area (e.g. Maradana)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666] focus:bg-white focus:outline-none focus:border-[#171717] font-sans"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Reports' },
            { id: 'ACTIVE', label: 'Active Incidents' },
            { id: 'VERIFIED', label: 'Officer Verified' },
            { id: 'RESOLVED', label: 'Resolved' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                filterStatus === tab.id
                  ? 'bg-[#171717] text-white'
                  : 'bg-[#F5F5F2] text-[#666666] hover:bg-[#EEEEEB] hover:text-[#171717]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {syncRetryError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
          <span>{syncRetryError}</span>
        </div>
      )}

      {aiRetryFeedback && (
        <div
          className={`p-3 rounded-md border text-xs flex items-center gap-2 ${
            aiRetryFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {aiRetryFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
          )}
          <span>{aiRetryFeedback.message}</span>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <div className="bg-white p-12 rounded-md border border-[#E5E5E2] text-center space-y-3">
            <FileText className="w-10 h-10 text-[#A3A3A3] mx-auto" />
            <h3 className="text-base font-bold text-[#171717]">No flood reports found</h3>
            <p className="text-xs text-[#666666] max-w-sm mx-auto">
              You have not submitted any reports matching this filter yet. When you report a road, you
              can track operational progress here.
            </p>
            <NavLink
              to="/citizen/report"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#171717] hover:bg-black text-white text-xs font-semibold rounded-md mt-2 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report Flooded Road Now</span>
            </NavLink>
          </div>
        ) : (
          filteredReports.map((report) => {
            const stepNum = getTimelineStep(report);
            const aiFailed = report.aiStatus === 'FAILED' || report.aiClassification === 'AI Processing Failed';

            return (
              <div
                key={report.id}
                className="bg-white p-5 sm:p-6 rounded-md border border-[#E5E5E2] hover:border-[#171717]/40 transition-colors space-y-5"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ReportEvidenceImage
                      report={report}
                      compact
                      className="w-14 h-14 rounded-sm object-cover shrink-0 border border-[#E5E5E2]"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[#171717]">
                          {report.id}
                        </span>
                        <RiskBadge level={report.riskLevel} />
                        <span
                          className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                            report.incidentStatus === 'Verified' || report.incidentStatus === 'Alert Issued'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : report.incidentStatus === 'Resolved'
                              ? 'bg-[#EEEEEB] text-[#171717] border border-[#E5E5E2]'
                              : report.incidentStatus === 'Rejected'
                              ? 'bg-red-50 text-red-800 border border-red-200'
                              : report.incidentStatus === 'More Info Requested'
                              ? 'bg-amber-50 text-amber-900 border border-amber-300'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {report.incidentStatus}
                        </span>
                        {report.isDuplicate && (
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-[#F5F5F2] border border-[#E5E5E2] text-[#666666]">
                            Duplicate of {report.duplicateOfReportId}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-[#171717]">
                        {report.location}
                      </h3>
                      <p className="text-xs text-[#666666]">
                        {report.area} Municipal Ward · Reported {new Date(report.timestamp).toLocaleDateString()},{' '}
                        {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => setSelectedReport(report)}
                      className="px-3.5 py-1.5 rounded-md bg-[#F5F5F2] hover:bg-[#EEEEEB] text-[#171717] font-semibold text-xs border border-[#E5E5E2] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Full Log</span>
                    </button>
                    {canCitizenDelete(report) && (
                      <button
                        type="button"
                        aria-label={`Delete report ${report.id}`}
                        onClick={() => setConfirmDeleteReport(report)}
                        className="px-3 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-800 font-semibold text-xs border border-red-200 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Branch Explanations for Rejected / More Info Requested / Duplicate */}
                {report.incidentStatus === 'Rejected' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900 flex items-start gap-2">
                    <Ban className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Report Rejected by Emergency Officer</span>
                      <span>
                        {report.officerNotes?.[report.officerNotes.length - 1] ||
                          'Officer determined this submission did not require emergency dispatch.'}
                      </span>
                    </div>
                  </div>
                )}

                {report.incidentStatus === 'More Info Requested' && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-md text-xs text-amber-950 flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Officer Requested Additional Information</span>
                      <span>
                        {report.officerNotes?.[report.officerNotes.length - 1] ||
                          'Please verify street landmark or attach a clearer daytime photograph.'}
                      </span>
                    </div>
                  </div>
                )}

                {report.evidenceStatus === 'FAILED' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Photo Evidence Upload Needs Retry</span>
                        <span className="text-[11px] text-amber-900">
                          {report.evidenceError || 'Select a flood photograph to store compressed JPEG evidence in Firestore.'}
                        </span>
                      </div>
                    </div>
                    <label className="px-3 py-1.5 rounded-md bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>
                        {retryingEvidenceId === report.id ? 'Compressing & Saving...' : 'Retry Photo Upload'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={retryingEvidenceId === report.id}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleRetryEvidenceFile(report.id, file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}

                {report.publicSyncStatus === 'FAILED' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Public Map Aggregation Pending Retry</span>
                        <span className="text-[11px] text-amber-900">
                          {report.publicSyncError || 'Your private report is safely stored in Firestore, but public hotspot sync failed.'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={retryingSyncId === report.id}
                      onClick={() => handleRetryPublicSync(report.id)}
                      className="px-3 py-1.5 rounded-md bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${retryingSyncId === report.id ? 'animate-spin' : ''}`} />
                      <span>{retryingSyncId === report.id ? 'Syncing...' : 'Retry Public Sync'}</span>
                    </button>
                  </div>
                )}

                {/* 6-Stage Timeline Stepper */}
                {report.incidentStatus !== 'Rejected' && (
                  <div className="pt-3 border-t border-[#E5E5E2]">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-[#666666] block mb-2.5">
                      6-Stage Operational Lifecycle Progress
                    </span>
                    <div className="flex items-center justify-between">
                      {timelineStages.map((stage, idx) => {
                        const isPassed = stepNum >= stage.num;
                        const isCurrent = stepNum === stage.num;
                        return (
                          <React.Fragment key={stage.num}>
                            <div className="flex flex-col items-center gap-1 flex-1">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-colors ${
                                  isPassed
                                    ? 'bg-emerald-700 text-white'
                                    : 'bg-[#F5F5F2] text-[#666666] border border-[#E5E5E2]'
                                }`}
                              >
                                {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : stage.num}
                              </div>
                              <span
                                className={`text-[9px] font-semibold text-center leading-tight ${
                                  isCurrent
                                    ? 'text-[#171717] font-bold'
                                    : isPassed
                                    ? 'text-[#171717]'
                                    : 'text-[#666666]'
                                }`}
                              >
                                {stage.label}
                              </span>
                            </div>
                            {idx < timelineStages.length - 1 && (
                              <div
                                className={`h-px flex-1 mb-4 transition-colors ${
                                  stepNum > stage.num ? 'bg-emerald-700' : 'bg-[#E5E5E2]'
                                }`}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI & Officer Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div
                    className={`p-3 rounded-md border flex items-center justify-between gap-2 ${
                      aiFailed ? 'bg-red-50 border-red-200' : 'bg-[#F5F5F2] border-[#E5E5E2]'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#666666] block">
                        AI Vision Analysis (
                        {aiFailed
                          ? 'Failed'
                          : report.aiStatus === 'UNCONFIGURED'
                          ? 'Unconfigured'
                          : report.aiStatus === 'PENDING'
                          ? 'Pending'
                          : report.aiStatus === 'NOT_RUN' ||
                            (!hasReportPhotoEvidence(report) && report.aiConfidence == null)
                          ? 'Not Run — No Photo'
                          : report.aiConfidence != null
                          ? `${report.aiConfidence}% confidence`
                          : 'Confidence N/A'}
                        )
                      </span>
                      <p className={`font-semibold text-xs mt-0.5 ${aiFailed ? 'text-red-900' : 'text-[#171717]'}`}>
                        {report.aiClassification ||
                          (report.aiStatus === 'NOT_RUN'
                            ? 'AI Not Run (No Image)'
                            : report.aiStatus === 'UNCONFIGURED'
                            ? 'AI Verification Not Configured'
                            : 'Under Review')}
                      </p>
                    </div>
                    {(aiFailed ||
                      report.aiStatus === 'PENDING' ||
                      (report.aiStatus === 'UNCONFIGURED' && hasReportPhotoEvidence(report))) && (
                      <button
                        type="button"
                        disabled={retryingId === report.id}
                        onClick={() => handleRetryAi(report.id)}
                        className="px-3 py-1.5 rounded-md bg-[#171717] hover:bg-black text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${retryingId === report.id ? 'animate-spin' : ''}`} />
                        <span>{retryingId === report.id ? 'Retrying AI...' : 'Retry AI Analysis'}</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-[#F5F5F2] rounded-md border border-[#E5E5E2]">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#666666] block">
                      Latest Operations Status
                    </span>
                    <p className="font-semibold text-[#171717] text-xs mt-0.5">
                      {report.officerNotes && report.officerNotes.length > 0
                        ? report.officerNotes[report.officerNotes.length - 1]
                        : report.incidentStatus === 'Verified'
                        ? 'Confirmed by emergency officer. Drainage response dispatched.'
                        : 'Awaiting on-site field officer verification.'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-[#E5E5E2] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedReport(null)}
              className="absolute top-6 right-6 p-2 rounded-md text-[#666666] hover:text-[#171717] hover:bg-[#EEEEEB] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-[#666666]">{selectedReport.id}</span>
                <RiskBadge level={selectedReport.riskLevel} />
              </div>
              <h2 className="font-serif text-2xl text-[#171717]">{selectedReport.location}</h2>
              <p className="text-xs text-[#666666] mt-0.5">{selectedReport.area} Municipal Ward</p>
            </div>

            {hasReportPhotoEvidence(selectedReport) && (
              <ReportEvidenceImage
                report={selectedReport}
                showDimensions
                className="w-full max-h-72 rounded-sm object-cover border border-[#E5E5E2]"
              />
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-[#F5F5F2] p-4 rounded-md border border-[#E5E5E2]">
              <div>
                <span className="text-[#666666] block">Water Depth:</span>
                <span className="font-semibold text-[#171717]">{selectedReport.waterLevel}</span>
              </div>
              <div>
                <span className="text-[#666666] block">Road Passability:</span>
                <span className="font-semibold text-[#171717]">{selectedReport.roadAccessibility}</span>
              </div>
              <div>
                <span className="text-[#666666] block">Flood Type:</span>
                <span className="font-semibold text-[#171717]">{selectedReport.floodType}</span>
              </div>
            </div>

            {/* AI Breakdown */}
            <div className="p-4 bg-[#181818] text-white rounded-md border border-[#2A2A2A] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#D4D4D0] uppercase tracking-wider text-[11px]">
                  Multimodal AI Assessment
                </span>
                <span className="font-mono text-white font-bold">
                  {selectedReport.aiStatus === 'FAILED'
                    ? 'AI FAILED'
                    : selectedReport.aiStatus === 'UNCONFIGURED'
                    ? 'UNCONFIGURED'
                    : selectedReport.aiStatus === 'PENDING'
                    ? 'PENDING'
                    : selectedReport.aiStatus === 'NOT_RUN' ||
                      (!hasReportPhotoEvidence(selectedReport) && selectedReport.aiConfidence == null)
                    ? 'NOT RUN'
                    : selectedReport.aiConfidence != null
                    ? `${selectedReport.aiConfidence}%`
                    : 'N/A'}
                </span>
              </div>
              <p className="text-white font-medium">
                {selectedReport.aiClassification ||
                  (selectedReport.aiStatus === 'NOT_RUN'
                    ? 'AI Not Run (No Image)'
                    : selectedReport.aiStatus === 'UNCONFIGURED'
                    ? 'AI Verification Not Configured'
                    : 'Under Review')}
              </p>
              {selectedReport.aiVerificationDetails?.explanation && (
                <p className="text-[11px] text-[#D4D4D0] italic">
                  "{selectedReport.aiVerificationDetails.explanation}"
                </p>
              )}
              {(selectedReport.aiStatus === 'FAILED' ||
                selectedReport.aiStatus === 'PENDING' ||
                (selectedReport.aiStatus === 'UNCONFIGURED' && hasReportPhotoEvidence(selectedReport))) && (
                <button
                  type="button"
                  disabled={retryingId === selectedReport.id}
                  onClick={() => handleRetryAi(selectedReport.id)}
                  className="mt-2 px-3 py-1.5 rounded-md bg-white hover:bg-[#EEEEEB] text-[#171717] font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${retryingId === selectedReport.id ? 'animate-spin' : ''}`} />
                  <span>{retryingId === selectedReport.id ? 'Retrying AI Analysis...' : 'Retry AI Analysis'}</span>
                </button>
              )}
            </div>

            {/* Status History Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-semibold text-[#171717] uppercase tracking-[0.14em]">
                Full Incident Audit Trail
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedReport.statusHistory?.map((entry, idx) => (
                  <div key={idx} className="p-3 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] text-xs">
                    <div className="flex items-center justify-between text-[#666666] mb-1">
                      <span className="font-semibold text-[#171717]">{entry.status}</span>
                      <span className="font-mono text-[10px]">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#666666] text-[11px]">By {entry.authorName}</p>
                    {entry.note && (
                      <p className="text-[#171717] text-xs mt-1 bg-white p-2 rounded-sm border border-[#E5E5E2]">
                        {entry.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2">
              {canCitizenDelete(selectedReport) ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteReport(selectedReport)}
                  className="px-4 py-2.5 rounded-md bg-red-50 hover:bg-red-100 text-red-800 font-semibold text-xs border border-red-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Report</span>
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-5 py-2.5 rounded-md bg-[#171717] hover:bg-black text-white font-semibold text-xs cursor-pointer transition-colors"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteReport && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Confirm deletion of report ${confirmDeleteReport.id}`}
            className="bg-white rounded-md max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E5E5E2]"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-md bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#171717]">
                  Delete Flood Report {confirmDeleteReport.id}?
                </h3>
                <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                  This permanently removes your report at <strong>{confirmDeleteReport.location}</strong> and all compressed photo evidence from Cloud Firestore.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingId === confirmDeleteReport.id}
                onClick={() => setConfirmDeleteReport(null)}
                className="px-4 py-2 rounded-md border border-[#E5E5E2] text-[#171717] text-xs font-semibold hover:bg-[#EEEEEB] cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingId === confirmDeleteReport.id}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isDeletingId === confirmDeleteReport.id ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
