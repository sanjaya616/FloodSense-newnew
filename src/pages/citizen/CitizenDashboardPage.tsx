/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  FileText,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  CloudRain,
  MapPin,
  Camera,
  Activity,
  Bell,
  Flame,
  X,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { RiskBadge } from '../../components/common/RiskBadge';
import { ReportEvidenceImage } from '../../components/common/ReportEvidenceImage';
import { FloodMap } from '../../components/map/FloodMap';

export const CitizenDashboardPage: React.FC = () => {
  const { userProfile, myReports, weather, hotspots, reports, notifications, logout } = useFlood();
  const location = useLocation();
  const navigate = useNavigate();

  const routeState = (location.state as {
    accessDenied?: boolean;
    deniedFrom?: string;
    accessDeniedMessage?: string;
  } | null) || null;

  const [accessDeniedNotice, setAccessDeniedNotice] = useState<{
    message: string;
    deniedFrom?: string;
  } | null>(() =>
    routeState?.accessDenied
      ? {
          message:
            routeState.accessDeniedMessage ||
            'Access Denied: Emergency Officer authorization is required to view Officer Operations routes.',
          deniedFrom: routeState.deniedFrom,
        }
      : null
  );

  useEffect(() => {
    if (routeState?.accessDenied) {
      setAccessDeniedNotice({
        message:
          routeState.accessDeniedMessage ||
          'Access Denied: Emergency Officer authorization is required to view Officer Operations routes.',
        deniedFrom: routeState.deniedFrom,
      });
    }
  }, [routeState?.accessDenied, routeState?.accessDeniedMessage, routeState?.deniedFrom]);

  const underReviewCount = myReports.filter(
    (r) =>
      r.incidentStatus === 'Submitted' ||
      r.incidentStatus === 'Under Review' ||
      r.incidentStatus === 'More Info Requested'
  ).length;

  const verifiedCount = myReports.filter(
    (r) => r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued'
  ).length;

  const resolvedCount = myReports.filter((r) => r.incidentStatus === 'Resolved').length;

  // Recent 3 citizen reports
  const recentReports = myReports.slice(0, 3);
  const topHotspots = hotspots.slice(0, 3);
  const topNotifications = notifications.slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 font-sans">
      {accessDeniedNotice && (
        <div
          role="alert"
          data-testid="citizen-access-denied-banner"
          className="p-4 sm:p-5 bg-red-50 border border-red-300 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-sm bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-red-200 text-red-900">
                  Access Denied · 403
                </span>
                {accessDeniedNotice.deniedFrom && (
                  <span className="text-[11px] font-mono text-red-700">
                    Blocked route: {accessDeniedNotice.deniedFrom}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-semibold text-red-950">
                {accessDeniedNotice.message}
              </p>
              <p className="text-[11px] text-red-800">
                Signed in as <strong>{userProfile.email}</strong> (Citizen account). You have been redirected back to the Citizen Portal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/login?portal=officer');
              }}
              className="px-3.5 py-2 rounded-md bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Officer Sign In
            </button>
            <button
              type="button"
              aria-label="Dismiss access denied alert"
              onClick={() => setAccessDeniedNotice(null)}
              className="p-2 rounded-md text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Welcome & Editorial Persona Banner */}
      <div className="bg-[#181818] rounded-md p-6 sm:p-9 text-white border border-[#2A2A2A]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#A3A3A3] block">
              Citizen Reporting Portal · Colombo Municipal Network
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-white">
              Welcome back, {userProfile.name}
            </h1>
            <p className="text-[#D4D4D0] text-xs sm:text-sm max-w-2xl leading-relaxed">
              Your verified street-level submissions supply ground-truth hydrology data for the
              Colombo Municipal Flood Operations Center and safeguard public transit routes.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <NavLink
              to="/citizen/report"
              className="px-5 py-3 rounded-md bg-white hover:bg-[#EEEEEB] text-[#171717] font-semibold text-xs tracking-wide transition-colors flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report Flooded Road</span>
            </NavLink>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between text-[#666666] text-xs font-medium">
            <span>My Total Reports</span>
            <FileText className="w-4 h-4 text-[#171717]" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[#171717] font-mono tabular-nums mt-2">
            {myReports.length}
          </p>
          <span className="text-[11px] text-[#666666] mt-1 block">Submitted to Colombo EOC</span>
        </div>

        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between text-amber-800 text-xs font-medium">
            <span>Under Officer Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-700 font-mono tabular-nums mt-2">
            {underReviewCount}
          </p>
          <span className="text-[11px] text-[#666666] mt-1 block">Queued for officer triage</span>
        </div>

        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-medium">
            <span>Verified Incidents</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-700 font-mono tabular-nums mt-2">
            {verifiedCount}
          </p>
          <span className="text-[11px] text-[#666666] mt-1 block">Confirmed by officer</span>
        </div>

        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between text-[#171717] text-xs font-medium">
            <span>Resolved Incidents</span>
            <ShieldAlert className="w-4 h-4 text-[#666666]" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[#171717] font-mono tabular-nums mt-2">
            {resolvedCount}
          </p>
          <span className="text-[11px] text-[#666666] mt-1 block">Water drained &amp; clear</span>
        </div>
      </div>

      {/* Main Action Banner: 5-Step Reporting Callout */}
      <div className="bg-white rounded-md border border-[#E5E5E2] p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-3">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-[#666666]">
            5-Step Structured Incident Reporting
          </span>
          <h2 className="font-serif text-2xl text-[#171717]">
            Witnessing water buildup or stalled vehicles?
          </h2>
          <p className="text-xs sm:text-sm text-[#666666] max-w-xl leading-relaxed">
            Attach a street photograph, verify GPS coordinates, and submit. Server-side AI vision
            assesses water depth while municipal officers prioritize drainage dispatches.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#666666] pt-1">
            <span className="flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#171717]" /> Photo &amp; Depth
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#171717]" /> GPS Auto-Pin
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#171717]" /> AI Triage Support
            </span>
          </div>
        </div>

        <NavLink
          to="/citizen/report"
          className="px-6 py-3.5 rounded-md bg-[#171717] hover:bg-black text-white font-semibold text-xs tracking-wide transition-colors shrink-0 flex items-center gap-2"
        >
          <span>Start Report Wizard</span>
          <ArrowRight className="w-4 h-4" />
        </NavLink>
      </div>

      {/* Grid: My Recent Reports & Live Weather Advisory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: My Recent Reports (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold text-[#171717] uppercase tracking-[0.14em]">
              My Recent Flood Submissions
            </h3>
            <NavLink
              to="/citizen/reports"
              className="text-xs font-semibold text-[#171717] hover:underline flex items-center gap-1"
            >
              <span>View All Reports ({myReports.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          <div className="space-y-3">
            {recentReports.length === 0 ? (
              <div className="p-8 bg-white rounded-md border border-[#E5E5E2] text-center space-y-3">
                <FileText className="w-9 h-9 text-[#A3A3A3] mx-auto" />
                <p className="text-xs text-[#666666]">You have not submitted any flood reports yet.</p>
                <NavLink
                  to="/citizen/report"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#171717] hover:bg-black text-white text-xs font-semibold rounded-md transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Submit Your First Report</span>
                </NavLink>
              </div>
            ) : (
              recentReports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 bg-white rounded-md border border-[#E5E5E2] hover:border-[#171717]/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <ReportEvidenceImage
                      report={report}
                      compact
                      className="w-14 h-14 rounded-sm object-cover shrink-0 border border-[#E5E5E2]"
                    />
                    <div className="min-w-0">
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
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {report.incidentStatus}
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-semibold text-[#171717] truncate">
                        {report.location}
                      </h4>
                      <p className="text-[11px] text-[#666666] mt-0.5">
                        Water Level: <span className="font-semibold text-[#171717]">{report.waterLevel}</span> ·{' '}
                        {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <NavLink
                    to="/citizen/reports"
                    className="text-xs font-semibold text-[#171717] hover:underline shrink-0 self-end sm:self-center"
                  >
                    Track Timeline →
                  </NavLink>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Weather & Important Safety Notifications (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-semibold text-[#171717] uppercase tracking-[0.14em]">
              Colombo Basin Weather Telemetry
            </h3>

            <div className="bg-white p-5 rounded-md border border-[#E5E5E2] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-[#171717]" />
                  <span className="font-semibold text-xs text-[#171717]">Colombo Western Basin</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider ${
                    weather.isLive
                      ? 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                      : 'text-amber-800 bg-amber-50 border border-amber-200'
                  }`}
                >
                  {weather.isLive ? 'Open-Meteo Live' : 'Telemetry Unavailable'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-[#F5F5F2] rounded-sm border border-[#E5E5E2]">
                  <span className="text-[11px] text-[#666666]">Current Rainfall</span>
                  <p className="text-xl font-bold text-[#171717] font-mono tabular-nums mt-0.5">
                    {weather.currentRainfallMm !== null ? `${weather.currentRainfallMm} mm/h` : 'Unavailable'}
                  </p>
                </div>
                <div className="p-3 bg-[#F5F5F2] rounded-sm border border-[#E5E5E2]">
                  <span className="text-[11px] text-[#666666]">Next 3 Hours</span>
                  <p className="text-xl font-bold text-[#171717] font-mono tabular-nums mt-0.5">
                    {weather.expected3hRainfallMm !== null
                      ? `${weather.expected3hRainfallMm} mm`
                      : 'Unavailable'}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-sm border border-amber-200 text-xs text-amber-950 space-y-1">
                <span className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Active Safety Directive</span>
                </span>
                <p className="leading-relaxed text-[11px] text-amber-900">
                  {(() => {
                    const highAreas = Array.from(
                      new Set(hotspots.filter((h) => h.riskLevel === 'HIGH').map((h) => h.area))
                    );
                    if (highAreas.length > 0) {
                      return `Active HIGH risk clusters in ${highAreas.join(', ')}. Avoid low-lying underpasses and stalled canal corridors.`;
                    }
                    if (weather.expected3hRainfallMm !== null && weather.expected3hRainfallMm > 10) {
                      return `Moderate-to-heavy rainfall forecast (${weather.expected3hRainfallMm} mm / 3h). Monitor nearby canal corridors before commuting.`;
                    }
                    return 'No HIGH risk flood clusters currently reported. Continue following local municipal advisories.';
                  })()}
                </p>
              </div>
            </div>
          </div>

          {/* Important Safety Notifications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold text-[#171717] uppercase tracking-[0.14em] flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-[#171717]" />
                <span>Safety Notifications</span>
              </h3>
              <NavLink to="/citizen/notifications" className="text-xs font-semibold text-[#171717] hover:underline">
                View All →
              </NavLink>
            </div>

            <div className="bg-white rounded-md border border-[#E5E5E2] divide-y divide-[#E5E5E2]">
              {topNotifications.length === 0 ? (
                <div className="p-5 text-center text-xs text-[#666666]">
                  No new safety notifications yet. Updates appear when officers review your reports or issue advisories.
                </div>
              ) : (
                topNotifications.map((item) => (
                  <div key={item.id} className="p-3.5 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#171717] truncate">{item.title}</span>
                      <span className="text-[10px] font-mono text-[#666666] shrink-0">{item.time}</span>
                    </div>
                    <p className="text-[11px] text-[#666666] line-clamp-2">{item.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nearby Public Flood Hotspots & Community Map Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Nearby Public Hotspots */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold text-[#171717] uppercase tracking-[0.14em] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-red-600" />
              <span>Nearby Public Flood Hotspots</span>
            </h3>
            <NavLink to="/map-public" className="text-xs font-semibold text-[#171717] hover:underline">
              Explore Map →
            </NavLink>
          </div>

          <div className="space-y-3">
            {topHotspots.length === 0 ? (
              <div className="p-6 bg-white rounded-md border border-[#E5E5E2] text-center text-xs text-[#666666]">
                No active flood hotspots currently reported in Colombo wards.
              </div>
            ) : (
              topHotspots.map((hotspot) => (
                <div
                  key={hotspot.id}
                  className="p-4 bg-white rounded-md border border-[#E5E5E2] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-[#666666]">{hotspot.id}</span>
                    <RiskBadge level={hotspot.riskLevel} />
                  </div>
                  <h4 className="font-semibold text-[#171717] text-sm">{hotspot.location}</h4>
                  <p className="text-xs text-[#666666]">
                    {hotspot.area} Ward · {hotspot.reportCount} clustered reports ·{' '}
                    {hotspot.rainfallSource === 'MISSING' ? 'Rain N/A' : `${hotspot.forecastRainfallMm}mm rain`}
                  </p>
                  <p className="text-[11px] text-[#666666] bg-[#F5F5F2] p-2.5 rounded-sm border border-[#E5E5E2]">
                    {hotspot.precaution}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Community Flood Map Preview */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold text-[#171717] uppercase tracking-[0.14em]">
              Community Flood Map Preview (Zero Private PII)
            </h3>
            <NavLink to="/map-public" className="text-xs font-semibold text-[#171717] hover:underline">
              Open Full Interactive Map →
            </NavLink>
          </div>

          <div className="bg-white p-2 rounded-md border border-[#E5E5E2] overflow-hidden">
            <FloodMap
              hotspots={hotspots}
              reports={reports}
              heightClass="h-[340px]"
              showLegendOverlay={true}
              showSectorControls={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
