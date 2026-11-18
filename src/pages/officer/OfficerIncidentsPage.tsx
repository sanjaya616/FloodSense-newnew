/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  X,
  Radio,
  CloudRain,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  MapPin,
  Flame,
  Navigation,
  Phone,
  User,
  Trash2,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { RiskBadge } from '../../components/common/RiskBadge';
import { ReportEvidenceImage, hasReportPhotoEvidence } from '../../components/common/ReportEvidenceImage';
import { FloodMap } from '../../components/map/FloodMap';
import {
  FloodReport,
  IncidentStatus,
  calculateHaversineDistance,
} from '../../utils/floodLogic';

export const OfficerIncidentsPage: React.FC = () => {
  const {
    reports,
    updateIncidentStatus,
    retryAiVerification,
    deleteReport,
    hotspots,
    weather,
  } = useFlood();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIncident, setSelectedIncident] = useState<FloodReport | null>(null);

  // Review modal form state
  const [officerNote, setOfficerNote] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [infoRequestPrompt, setInfoRequestPrompt] = useState<string>('');
  const [showRejectBox, setShowRejectBox] = useState<boolean>(false);
  const [showInfoRequestBox, setShowInfoRequestBox] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isRetryingAi, setIsRetryingAi] = useState<boolean>(false);

  // Metric counts
  const pendingReviewCount = useMemo(
    () =>
      reports.filter(
        (r) =>
          r.incidentStatus === 'Submitted' ||
          r.incidentStatus === 'Under Review' ||
          r.incidentStatus === 'More Info Requested'
      ).length,
    [reports]
  );
  const verifiedCount = useMemo(
    () =>
      reports.filter(
        (r) => r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued'
      ).length,
    [reports]
  );
  const highRiskCount = useMemo(
    () =>
      reports.filter((r) => r.riskLevel === 'HIGH' && r.incidentStatus !== 'Resolved')
        .length,
    [reports]
  );
  const resolvedCount = useMemo(
    () => reports.filter((r) => r.incidentStatus === 'Resolved').length,
    [reports]
  );

  // Distinct areas
  const distinctAreas = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => set.add(r.area));
    return Array.from(set).sort();
  }, [reports]);

  // Helper to resolve matched hotspot cluster for any report
  const findHotspotForReport = (report: FloodReport) =>
    hotspots.find(
      (h) => h.id === report.hotspotId || h.associatedReportIds.includes(report.id)
    ) || null;

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchSearch =
        searchQuery === '' ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.reporterName && r.reporterName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PENDING' &&
          (r.incidentStatus === 'Submitted' || r.incidentStatus === 'Under Review')) ||
        (statusFilter === 'MORE_INFO' && r.incidentStatus === 'More Info Requested') ||
        (statusFilter === 'VERIFIED' &&
          (r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued')) ||
        (statusFilter === 'RESOLVED' && r.incidentStatus === 'Resolved') ||
        (statusFilter === 'REJECTED' && r.incidentStatus === 'Rejected') ||
        r.incidentStatus === statusFilter;

      const matchArea = areaFilter === 'ALL' || r.area === areaFilter;

      return matchSearch && matchStatus && matchArea;
    });
  }, [reports, searchQuery, statusFilter, areaFilter]);

  // Modal contextual intelligence (matched hotspot + nearby reports within 1km)
  const matchedHotspot = useMemo(
    () => (selectedIncident ? findHotspotForReport(selectedIncident) : null),
    [selectedIncident, hotspots]
  );

  const nearbyReports = useMemo(() => {
    if (!selectedIncident) return [];
    return reports
      .filter((r) => r.id !== selectedIncident.id)
      .map((r) => ({
        report: r,
        distanceMeters: Math.round(
          calculateHaversineDistance(selectedIncident.lat, selectedIncident.lng, r.lat, r.lng)
        ),
      }))
      .filter((item) => item.distanceMeters <= 1000)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [selectedIncident, reports]);

  const openIncidentModal = (report: FloodReport) => {
    setSelectedIncident(report);
    setActionSuccess(null);
    setActionError(null);
    setOfficerNote('');
    setRejectionReason('');
    setInfoRequestPrompt('');
    setShowRejectBox(false);
    setShowInfoRequestBox(false);
    setShowDeleteConfirm(false);
  };

  const handleStatusChange = async (newStatus: IncidentStatus, customNote?: string) => {
    if (!selectedIncident) return;
    setIsProcessing(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const noteToSave = customNote || officerNote.trim() || undefined;
      const updated = await updateIncidentStatus(selectedIncident.id, newStatus, noteToSave);
      if (updated) {
        setSelectedIncident(updated);
        setActionSuccess(`Incident ${updated.id} updated to status "${newStatus}".`);
        setOfficerNote('');
        setRejectionReason('');
        setInfoRequestPrompt('');
        setShowRejectBox(false);
        setShowInfoRequestBox(false);
      } else {
        setActionError('Unable to locate incident record for status update.');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Unable to update incident status.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryAi = async () => {
    if (!selectedIncident || isRetryingAi) return;
    setIsRetryingAi(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await retryAiVerification(selectedIncident.id);
      if (updated) {
        setSelectedIncident(updated);
        if (updated.aiStatus === 'COMPLETED') {
          setActionSuccess(
            `AI reassessment completed: ${updated.aiClassification} (${updated.aiConfidence}% confidence).`
          );
        } else {
          setActionError(
            updated.aiVerificationDetails?.explanation ||
              'AI vision retry failed. Please continue with officer manual review.'
          );
        }
      }
    } catch (err: any) {
      setActionError(err?.message || 'AI vision retry failed.');
    } finally {
      setIsRetryingAi(false);
    }
  };

  const getStatusBadgeClasses = (status: IncidentStatus) => {
    switch (status) {
      case 'Verified':
      case 'Alert Issued':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      case 'Resolved':
        return 'bg-[#EEEEEB] text-[#171717] border border-[#E5E5E2]';
      case 'Rejected':
        return 'bg-red-50 text-red-800 border border-red-200';
      case 'More Info Requested':
        return 'bg-amber-50 text-amber-900 border border-amber-300';
      default:
        return 'bg-amber-50 text-amber-800 border border-amber-200';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-[#666666] font-medium mb-1">
            <span>Operations Center</span>
            <ChevronRight className="w-3 h-3 text-[#A3A3A3]" />
            <span className="text-[#171717] font-semibold">Incident Review Queue</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#171717] tracking-tight">
            Citizen Flood Incident Triage Queue
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            Evaluate incoming crowd-sourced reports, inspect GPS context &amp; AI vision evidence, and verify emergency dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold font-mono">
            {pendingReviewCount} Pending Verification
          </span>
        </div>
      </div>

      {/* KPI Triage Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between text-[#666666] text-xs font-medium">
            <span>Pending Officer Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
            {pendingReviewCount}
          </p>
          <span className="text-[11px] text-[#666666]">Needs human verification</span>
        </div>

        <div className="bg-white p-4 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between text-[#666666] text-xs font-medium">
            <span>Verified Incidents</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">{verifiedCount}</p>
          <span className="text-[11px] text-[#666666]">Pumping teams mobilized</span>
        </div>

        <div className="bg-white p-4 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between text-[#666666] text-xs font-medium">
            <span>High Risk Priority</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">{highRiskCount}</p>
          <span className="text-[11px] text-[#666666]">Water depth &gt; 30cm</span>
        </div>

        <div className="bg-white p-4 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between text-[#666666] text-xs font-medium">
            <span>Resolved Incidents</span>
            <ShieldCheck className="w-4 h-4 text-[#171717]" />
          </div>
          <p className="text-2xl font-bold text-[#171717] font-mono tabular-nums mt-1">{resolvedCount}</p>
          <span className="text-[11px] text-[#666666]">Water receded safely</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-md border border-[#E5E5E2] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Search report ID, road, municipal area, or citizen name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666] focus:bg-white focus:outline-none focus:border-[#171717] font-sans"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md px-3 py-2 text-[#171717] font-semibold focus:bg-white focus:outline-none focus:border-[#171717]"
          >
            <option value="ALL">All Operational Statuses</option>
            <option value="PENDING">Pending Review (Submitted / Under Review)</option>
            <option value="MORE_INFO">More Info Requested</option>
            <option value="VERIFIED">Verified &amp; Alerts Issued</option>
            <option value="RESOLVED">Resolved Incidents</option>
            <option value="REJECTED">Rejected Submissions</option>
          </select>

          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md px-3 py-2 text-[#171717] font-semibold focus:bg-white focus:outline-none focus:border-[#171717]"
          >
            <option value="ALL">All Municipal Areas ({distinctAreas.length})</option>
            {distinctAreas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Incident Review Queue Table */}
      <div className="bg-white rounded-md border border-[#E5E5E2] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F5F5F2] border-b border-[#E5E5E2] text-[#666666] uppercase tracking-wider text-[10px] font-mono font-semibold">
                <th className="py-3 px-3">Report</th>
                <th className="py-3 px-3">Citizen</th>
                <th className="py-3 px-3">Location &amp; Hotspot</th>
                <th className="py-3 px-2">Photo</th>
                <th className="py-3 px-3">AI Assessment</th>
                <th className="py-3 px-2">Risk</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2]">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#666666]">
                    No flood reports found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => {
                  const hs = findHotspotForReport(report);
                  const isAiFailed = report.aiStatus === 'FAILED';
                  const isAiNotRun =
                    report.aiStatus === 'NOT_RUN' ||
                    (!hasReportPhotoEvidence(report) && report.aiConfidence == null);
                  const isAiUnconfigured = report.aiStatus === 'UNCONFIGURED';
                  const isAiPending = report.aiStatus === 'PENDING';

                  return (
                    <tr
                      key={report.id}
                      className="hover:bg-[#F5F5F2]/80 transition-colors cursor-pointer group"
                      onClick={() => openIncidentModal(report)}
                    >
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-[#171717] leading-tight">
                            {report.id}
                          </span>
                          {report.isDuplicate && (
                            <span
                              title={`Duplicate of ${report.duplicateOfReportId || 'prior report'}`}
                              className="text-[9px] font-mono font-bold px-1 py-0.2 rounded-sm bg-[#EEEEEB] text-[#666666] border border-[#E5E5E2]"
                            >
                              DUP
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#666666] font-mono">
                          {new Date(report.timestamp).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-semibold text-[#171717] block leading-tight max-w-[105px] truncate">
                          {report.reporterName || 'Citizen Reporter'}
                        </span>
                        <span className="text-[10px] text-[#666666] font-mono">
                          {report.reporterPhone || 'No phone'}
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-[150px]">
                        <span className="font-semibold text-[#171717] block truncate leading-tight">
                          {report.location}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-[#666666] truncate">{report.area}</span>
                          {hs && (
                            <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded-sm bg-[#F5F5F2] text-[#171717] border border-[#E5E5E2] shrink-0">
                              {hs.id}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-2">
                        <ReportEvidenceImage
                          report={report}
                          compact
                          className="w-9 h-9 rounded-sm object-cover border border-[#E5E5E2] shrink-0"
                        />
                      </td>

                      <td className="py-3 px-3 max-w-[135px]">
                        <span
                          className={`text-[11px] font-semibold block truncate ${
                            isAiFailed ? 'text-red-700' : isAiNotRun ? 'text-[#666666]' : 'text-[#171717]'
                          }`}
                        >
                          {report.aiClassification ||
                            (isAiNotRun
                              ? 'AI Not Run (No Image)'
                              : isAiUnconfigured
                                ? 'AI Vision Unconfigured'
                                : 'Under Evaluation')}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isAiFailed ? (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-red-50 text-red-800 border border-red-200">
                              AI FAILED
                            </span>
                          ) : isAiNotRun ? (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-[#F5F5F2] text-[#666666] border border-[#E5E5E2]">
                              NOT RUN
                            </span>
                          ) : isAiUnconfigured ? (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-amber-50 text-amber-800 border border-amber-200">
                              UNCONFIGURED
                            </span>
                          ) : isAiPending ? (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-[#F5F5F2] text-[#171717] border border-[#E5E5E2]">
                              PENDING
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-bold text-[#171717]">
                              {report.aiConfidence != null ? `${report.aiConfidence}%` : 'N/A'}
                            </span>
                          )}
                          <span className="text-[10px] text-[#666666] truncate">· {report.waterLevel}</span>
                        </div>
                      </td>

                      <td className="py-3 px-2 whitespace-nowrap">
                        <RiskBadge level={report.riskLevel} size="sm" />
                      </td>

                      <td className="py-3 px-2 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm inline-block whitespace-nowrap ${getStatusBadgeClasses(
                            report.incidentStatus
                          )}`}
                        >
                          {report.incidentStatus}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openIncidentModal(report);
                          }}
                          className="px-2.5 py-1 rounded-md bg-[#F5F5F2] hover:bg-[#171717] text-[#171717] hover:text-white border border-[#E5E5E2] text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Officer Incident Inspection Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white rounded-md max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl border border-[#E5E5E2] relative"
            role="dialog"
            aria-modal="true"
            aria-label={`Inspect incident ${selectedIncident.id}`}
          >
            <button
              type="button"
              onClick={() => setSelectedIncident(null)}
              aria-label="Close incident review modal"
              className="absolute top-6 right-6 p-2 rounded-md text-[#666666] hover:text-[#171717] hover:bg-[#EEEEEB] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E5E2] pb-4 pr-10">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-[#171717] bg-[#F5F5F2] border border-[#E5E5E2] px-2 py-0.5 rounded-sm">
                    {selectedIncident.id}
                  </span>
                  <RiskBadge level={selectedIncident.riskLevel} />
                  <span
                    className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${getStatusBadgeClasses(
                      selectedIncident.incidentStatus
                    )}`}
                  >
                    Status: {selectedIncident.incidentStatus}
                  </span>
                  {selectedIncident.isDuplicate && (
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-[#EEEEEB] text-[#171717] border border-[#E5E5E2]">
                      Duplicate of {selectedIncident.duplicateOfReportId || 'prior report'}
                    </span>
                  )}
                </div>
                <h2 className="font-serif text-2xl text-[#171717]">{selectedIncident.location}</h2>
                <p className="text-xs text-[#666666]">
                  {selectedIncident.area} Municipal Ward · GPS:{' '}
                  <span className="font-mono">
                    {selectedIncident.lat.toFixed(5)}, {selectedIncident.lng.toFixed(5)}
                  </span>
                </p>
              </div>

              <div className="text-left sm:text-right text-xs font-mono text-[#666666] shrink-0">
                <span>Submitted: {new Date(selectedIncident.timestamp).toLocaleString()}</span>
              </div>
            </div>

            {actionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Two-Column Evidence & Context Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Photo, Mini GPS Map, Citizen Description & Reporter Info */}
              <div className="lg:col-span-6 space-y-4">
                <div>
                  <ReportEvidenceImage
                    report={selectedIncident}
                    showDimensions
                    className="w-full h-52 rounded-sm object-cover border border-[#E5E5E2]"
                  />
                </div>

                {/* Mini Leaflet Map Focused on Incident Pin */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono font-semibold text-[#171717] uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#171717]" />
                      <span>GPS Location Pin &amp; Nearby Context</span>
                    </span>
                    <span className="text-[10px] text-[#666666]">
                      {nearbyReports.length} report(s) within 1 km
                    </span>
                  </div>
                  <FloodMap
                    hotspots={matchedHotspot ? [matchedHotspot] : []}
                    reports={[selectedIncident, ...nearbyReports.map((n) => n.report)]}
                    selectedHotspotId={matchedHotspot?.id || null}
                    focusCoordinates={[selectedIncident.lat, selectedIncident.lng]}
                    focusZoom={15}
                    heightClass="h-48"
                    showLegendOverlay={false}
                    showSectorControls={false}
                  />
                </div>

                {/* Field Attributes & Narrative */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 bg-[#F5F5F2] rounded-sm border border-[#E5E5E2]">
                    <span className="text-[10px] font-mono uppercase text-[#666666] block">
                      Water Depth
                    </span>
                    <span className="font-semibold text-[#171717]">{selectedIncident.waterLevel}</span>
                  </div>
                  <div className="p-2.5 bg-[#F5F5F2] rounded-sm border border-[#E5E5E2]">
                    <span className="text-[10px] font-mono uppercase text-[#666666] block">
                      Road Status
                    </span>
                    <span className="font-semibold text-[#171717]">
                      {selectedIncident.roadAccessibility}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#F5F5F2] rounded-sm border border-[#E5E5E2]">
                    <span className="text-[10px] font-mono uppercase text-[#666666] block">
                      Flood Type
                    </span>
                    <span className="font-semibold text-[#171717] truncate block">
                      {selectedIncident.floodType}
                    </span>
                  </div>
                </div>

                {/* Citizen Reporter Card */}
                <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] text-xs space-y-1.5">
                  <span className="text-[10px] font-mono font-semibold text-[#666666] uppercase tracking-wider block">
                    Citizen Reporter &amp; Field Observations
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#171717] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#666666]" />
                      {selectedIncident.reporterName || 'Citizen Contributor'}
                    </span>
                    <span className="text-[#666666] font-mono text-[11px] flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#666666]" />
                      {selectedIncident.reporterPhone || 'Not provided'}
                    </span>
                  </div>
                  {selectedIncident.description && (
                    <p className="text-[#171717] text-xs leading-relaxed pt-1">
                      &ldquo;{selectedIncident.description}&rdquo;
                    </p>
                  )}
                  {selectedIncident.additionalObservations && (
                    <p className="text-[11px] text-[#666666] bg-white p-2 rounded-sm border border-[#E5E5E2]">
                      <strong>Additional observations:</strong>{' '}
                      {selectedIncident.additionalObservations}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: AI Vision, Weather Summary, Hotspot Cluster & Nearby Reports */}
              <div className="lg:col-span-6 space-y-4">
                {/* AI Assessment Card */}
                <div className="p-4 bg-[#181818] text-white rounded-md border border-[#2A2A2A] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#D4D4D0] flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Vision Assessment</span>
                    </span>
                    {selectedIncident.aiStatus === 'FAILED' ? (
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-sm bg-red-950 text-red-300 border border-red-800">
                        AI Processing Failed
                      </span>
                    ) : selectedIncident.aiStatus === 'NOT_RUN' ||
                      (!hasReportPhotoEvidence(selectedIncident) && selectedIncident.aiConfidence == null) ? (
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-sm bg-[#262626] text-[#D4D4D0]">
                        AI NOT RUN (NO IMAGE)
                      </span>
                    ) : selectedIncident.aiStatus === 'UNCONFIGURED' ? (
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-sm bg-amber-950 text-amber-300 border border-amber-800">
                        AI UNCONFIGURED
                      </span>
                    ) : selectedIncident.aiStatus === 'PENDING' ? (
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-sm bg-[#262626] text-[#D4D4D0]">
                        PENDING AI ANALYSIS
                      </span>
                    ) : (
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-sm bg-[#262626] text-white border border-[#404040]">
                        {selectedIncident.aiConfidence != null
                          ? `${selectedIncident.aiConfidence}% Confidence`
                          : 'Confidence N/A'}
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-white">
                    {selectedIncident.aiClassification ||
                      (selectedIncident.aiStatus === 'NOT_RUN'
                        ? 'AI Not Run (No Image)'
                        : selectedIncident.aiStatus === 'UNCONFIGURED'
                          ? 'AI Vision Unconfigured'
                          : 'Pending AI Review')}
                  </p>
                  <p className="text-[11px] text-[#D4D4D0] leading-relaxed">
                    {selectedIncident.aiVerificationDetails?.explanation ||
                      'Automated optical review is an assistive signal; human officer verification is mandatory.'}
                  </p>
                  {selectedIncident.aiVerificationDetails?.uncertainty && (
                    <p className="text-[10px] text-amber-300 bg-black/40 p-2 rounded-sm border border-[#2A2A2A]">
                      Uncertainty: {selectedIncident.aiVerificationDetails.uncertainty}
                    </p>
                  )}
                  {(selectedIncident.aiStatus === 'FAILED' ||
                    selectedIncident.aiStatus === 'PENDING' ||
                    (selectedIncident.aiStatus === 'UNCONFIGURED' && hasReportPhotoEvidence(selectedIncident))) && (
                    <button
                      type="button"
                      disabled={isRetryingAi}
                      onClick={handleRetryAi}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-[#EEEEEB] text-[#171717] text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isRetryingAi ? 'animate-spin' : ''}`}
                      />
                      <span>{isRetryingAi ? 'Retrying AI Analysis...' : 'Retry AI Analysis'}</span>
                    </button>
                  )}
                </div>

                {/* Weather Summary Card */}
                <div className="p-4 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#171717] flex items-center gap-1.5">
                      <CloudRain className="w-4 h-4 text-[#171717]" />
                      <span>Colombo Weather Context</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-white border border-[#E5E5E2] text-[#666666]">
                      {weather.isLive ? 'Open-Meteo Live' : 'Telemetry Unavailable'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] font-mono text-[#666666] uppercase block">Condition</span>
                      <span className="font-semibold text-[#171717]">{weather.condition}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-[#666666] uppercase block">Current Rain</span>
                      <span className="font-semibold font-mono text-[#171717]">
                        {weather.currentRainfallMm !== null ? `${weather.currentRainfallMm} mm` : 'Unavailable'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-[#666666] uppercase block">3h Forecast</span>
                      <span className="font-semibold font-mono text-[#171717]">
                        {weather.expected3hRainfallMm !== null
                          ? `${weather.expected3hRainfallMm} mm`
                          : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hotspot Cluster Card */}
                <div className="p-4 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#171717] flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-600" />
                      <span>Geospatial Hotspot Cluster</span>
                    </span>
                    {matchedHotspot && (
                      <RiskBadge level={matchedHotspot.riskLevel} size="sm" />
                    )}
                  </div>
                  {matchedHotspot ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-[#171717]">
                        {matchedHotspot.id} — {matchedHotspot.location}
                      </p>
                      <p className="text-[11px] text-[#666666]">
                        {matchedHotspot.reportCount} unique report(s) within{' '}
                        {matchedHotspot.clusterRadiusMeters || 500}m · Risk Score:{' '}
                        <span className="font-mono font-bold text-[#171717]">{matchedHotspot.riskScore}/100</span>
                      </p>
                      <p className="text-[11px] text-[#666666] italic">
                        {matchedHotspot.precaution}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#666666]">
                      Not yet grouped into an active geospatial hotspot cluster.
                    </p>
                  )}
                </div>

                {/* Nearby Reports within 1 km */}
                <div className="p-4 bg-white border border-[#E5E5E2] rounded-md text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#171717] flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-[#666666]" />
                      <span>Nearby Reports (&le; 1 km)</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#666666]">
                      {nearbyReports.length} found
                    </span>
                  </div>
                  {nearbyReports.length === 0 ? (
                    <p className="text-[11px] text-[#666666]">
                      No other flood reports recorded within 1 km of this GPS pin.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {nearbyReports.map(({ report, distanceMeters }) => (
                        <button
                          key={report.id}
                          type="button"
                          onClick={() => openIncidentModal(report)}
                          className="w-full text-left p-2 rounded-sm bg-[#F5F5F2] hover:bg-[#EEEEEB] border border-[#E5E5E2] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-[#171717] block truncate">
                              {report.id} · {report.location}
                            </span>
                            <span className="text-[10px] text-[#666666]">
                              {report.waterLevel} depth · {report.incidentStatus}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] font-bold text-[#171717] shrink-0">
                            {distanceMeters} m
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Operational Actions Grid */}
            <div className="space-y-3 pt-4 border-t border-[#E5E5E2]">
              <h3 className="text-xs font-mono font-semibold text-[#171717] uppercase tracking-[0.14em]">
                Officer Operational Actions
              </h3>

              {/* Note input */}
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Operational Note / Citizen Message / Dispatch Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sucker truck unit #4 mobilized. Flap gates opened."
                  value={officerNote}
                  onChange={(e) => setOfficerNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666] focus:bg-white focus:outline-none focus:border-[#171717]"
                />
              </div>

              {/* 5 Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleStatusChange('Verified')}
                  className="py-2.5 px-3 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Approve &amp; Verify</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    setShowInfoRequestBox(!showInfoRequestBox);
                    setShowRejectBox(false);
                  }}
                  className="py-2.5 px-3 rounded-md bg-[#171717] hover:bg-black text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span>Request Info</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleStatusChange('Alert Issued')}
                  className="py-2.5 px-3 rounded-md bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Radio className="w-4 h-4 shrink-0" />
                  <span>Issue Alert</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleStatusChange('Resolved')}
                  className="py-2.5 px-3 rounded-md bg-[#2A2A2A] hover:bg-[#171717] text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Mark Resolved</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    setShowRejectBox(!showRejectBox);
                    setShowInfoRequestBox(false);
                  }}
                  className="py-2.5 px-3 rounded-md bg-red-50 hover:bg-red-100 text-red-800 font-semibold text-xs border border-red-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 col-span-2 sm:col-span-1"
                >
                  <X className="w-4 h-4 shrink-0" />
                  <span>Reject Report</span>
                </button>
              </div>

              {/* Request More Info Box if toggled */}
              {showInfoRequestBox && (
                <div className="p-4 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] space-y-3">
                  <span className="text-xs font-bold text-[#171717] block">
                    Request Clarification from Citizen Reporter
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Please confirm nearby junction landmark or upload a clearer daylight photo."
                    value={infoRequestPrompt}
                    onChange={(e) => setInfoRequestPrompt(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666] focus:outline-none focus:border-[#171717]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInfoRequestBox(false)}
                      className="px-3 py-1.5 text-xs text-[#666666] hover:text-[#171717] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusChange(
                          'More Info Requested',
                          infoRequestPrompt.trim() ||
                            officerNote.trim() ||
                            'Officer requested clearer street landmarks or updated water level details.'
                        )
                      }
                      className="px-4 py-1.5 bg-[#171717] hover:bg-black text-white font-semibold text-xs rounded-md cursor-pointer"
                    >
                      Send Info Request
                    </button>
                  </div>
                </div>
              )}

              {/* Rejection Box if toggled */}
              {showRejectBox && (
                <div className="p-4 bg-red-50 rounded-md border border-red-200 space-y-3">
                  <span className="text-xs font-bold text-red-900 block">
                    Specify Rejection Reason (Audit Evidence Preserved)
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Duplicate submission, invalid coordinates, or normal runoff."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-red-200 rounded-md text-[#171717] placeholder-[#666666] focus:outline-none focus:border-red-600"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectBox(false)}
                      className="px-3 py-1.5 text-xs text-[#666666] hover:text-[#171717] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusChange(
                          'Rejected',
                          rejectionReason.trim() ||
                            officerNote.trim() ||
                            'Report rejected by emergency officer.'
                        )
                      }
                      className="px-4 py-1.5 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs rounded-md cursor-pointer"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}

              {/* Permanent Deletion Control for Emergency Officers */}
              <div className="pt-2 flex flex-col gap-2">
                {!showDeleteConfirm ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowRejectBox(false);
                        setShowInfoRequestBox(false);
                      }}
                      className="px-3.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Report &amp; Evidence</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 rounded-md border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-red-900">
                      <span className="font-bold block">
                        Permanently delete report {selectedIncident.id} and all photo evidence?
                      </span>
                      <span className="text-[11px] text-red-800">
                        Removes the private report, Firestore image evidence subcollection, and public summary.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 rounded-md bg-white border border-red-200 text-[#171717] text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={async () => {
                          setIsProcessing(true);
                          setActionError(null);
                          try {
                            await deleteReport(selectedIncident.id);
                            setSelectedIncident(null);
                          } catch (err: any) {
                            setActionError(err?.message || 'Unable to delete report.');
                          } finally {
                            setIsProcessing(false);
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-md bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {isProcessing ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Audit History Log */}
            <div className="space-y-2 pt-2 border-t border-[#E5E5E2]">
              <span className="text-xs font-mono font-semibold text-[#171717] uppercase tracking-[0.14em] block">
                Audit Trail &amp; Status Log
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-[#E5E5E2] text-xs">
                {selectedIncident.statusHistory?.map((entry, idx) => (
                  <div key={idx} className="pt-1.5 flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-[#171717]">{entry.status}</span>
                      <span className="text-[#666666] ml-1.5">by {entry.authorName}</span>
                      {entry.note && (
                        <p className="text-[#666666] text-[11px] mt-0.5">{entry.note}</p>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-[#666666] shrink-0">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
