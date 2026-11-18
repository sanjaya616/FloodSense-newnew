/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFlood } from '../context/FloodContext';
import { StatCard } from '../components/common/StatCard';
import { FloodMap } from '../components/map/FloodMap';
import { IncidentCard } from '../components/common/IncidentCard';
import {
  FileWarning,
  MapPin,
  AlertTriangle,
  Clock,
  Activity,
  CloudRain,
  ExternalLink,
  Radio,
  Volume2,
  VolumeX,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { NavLink } from 'react-router-dom';

export const OverviewPage: React.FC = () => {
  const {
    reports,
    hotspots,
    blockchainRecords,
    setSelectedReportId,
    setSelectedHotspotId,
    weather,
    refreshWeather,
    searchQuery,
    authenticatedRole,
    isFirebaseAvailable,
    userProfile,
    getAnalytics,
  } = useFlood();

  const [filterRisk, setFilterRisk] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [isAlarmArmed, setIsAlarmArmed] = useState(true);
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);

  // Compute dynamic analytics from active dataset
  const analytics24h = getAnalytics('all');
  const totalReportsToday = reports.length;
  const activeHotspotsCount = hotspots.length;
  const highRiskHotspots = hotspots.filter((h) => h.riskLevel === 'HIGH');
  const highRiskHotspotsCount = highRiskHotspots.length;
  const highRiskAreaSummary =
    highRiskHotspots.length > 0
      ? Array.from(new Set(highRiskHotspots.map((h) => h.area)))
          .slice(0, 3)
          .join(', ')
      : 'None active';

  const avgReviewDisplay =
    analytics24h.avgReviewMinutes !== null ? `${analytics24h.avgReviewMinutes} min` : 'No verified timing';

  // Filtered reports for live feed
  const filteredReports = reports.filter((r) => {
    const matchesRisk = filterRisk === 'ALL' || r.riskLevel === filterRisk;
    const matchesSearch =
      !searchQuery ||
      r.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRisk && matchesSearch;
  });

  // Real time-bucketed volume from active reports
  const volumeChartData = analytics24h.reportVolumeOverTime.map((pt) => ({
    time: pt.label,
    reports: pt.total,
  }));

  // Live activity derived from current reports & blockchain audit records
  const dynamicActivityEvents = [
    ...reports.slice(0, 2).map((rep) => ({
      id: `act-rep-${rep.id}`,
      title: `Report ${rep.id} (${rep.incidentStatus})`,
      time: new Date(rep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: `${rep.location} (${rep.area}) · ${rep.waterLevel} depth`,
    })),
    ...blockchainRecords.slice(0, 2).map((blk) => ({
      id: `act-blk-${blk.eventId}`,
      title: `Audit Block #${blk.blockNumber} (${blk.severity})`,
      time: new Date(blk.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: `SHA-256 anchored ${blk.hotspotId} (${blk.location})`,
    })),
  ].slice(0, 4);

  const handleManualWeatherRefresh = async () => {
    setIsRefreshingWeather(true);
    await refreshWeather();
    setTimeout(() => setIsRefreshingWeather(false), 600);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Tactical Emergency Operations Center (EOC) Header Bar */}
      <div className="bg-[#181818] text-white p-5 sm:p-6 rounded-md border border-[#2A2A2A] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <span className="px-2.5 py-0.5 rounded-sm bg-red-950/80 text-red-300 border border-red-800/80 font-mono font-bold text-[10px] tracking-[0.14em] uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              ALERT LEVEL 2 — ACTIVE WATCH
            </span>
            <span className="text-[#525252]">|</span>
            <span className="text-xs text-[#D4D4D0] font-medium flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#D4D4D0]" />
              {authenticatedRole === 'officer'
                ? `Operations Room · Officer: ${userProfile.name}`
                : 'Citizen Disaster Awareness View'}
            </span>
            <span className="text-[#525252]">|</span>
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-800/70 px-2 py-0.5 rounded-sm uppercase tracking-wider">
              {weather.isLive ? 'LIVE OPEN-METEO' : 'WEATHER UNAVAILABLE'}
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-normal text-white tracking-tight">
            Flood Monitoring Overview
          </h2>
          <p className="text-xs text-[#D4D4D0] mt-1 max-w-2xl leading-relaxed">
            Monitor real-time citizen incident telemetry, assess spatial flood risk clusters, and coordinate municipal drainage mitigation teams.
          </p>
        </div>

        {/* EOC Live Telemetry Widget */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#202020] border border-[#333333] p-3 rounded-md text-xs font-mono flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 text-[#A3A3A3] text-[10px] uppercase tracking-wider mb-0.5">
                <CloudRain className="w-3.5 h-3.5 text-white" />
                <span>Precipitation Velocity</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white tabular-nums">
                  {weather.currentRainfallMm !== null ? `${weather.currentRainfallMm} mm/h` : 'Unavailable'}
                </span>
                <span className="text-[#D4D4D0] font-medium text-[11px]">
                  ({weather.expected3hRainfallMm !== null ? `${weather.expected3hRainfallMm}mm 3h` : '3h N/A'})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleManualWeatherRefresh}
              disabled={isRefreshingWeather}
              title="Refresh meteorological telemetry"
              className="p-1.5 rounded-sm bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingWeather ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAlarmArmed(!isAlarmArmed)}
            className={`px-3 py-2 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isAlarmArmed
                ? 'bg-red-950/60 border-red-800/80 text-red-200 hover:bg-red-950'
                : 'bg-[#202020] border-[#333333] text-[#A3A3A3] hover:text-white'
            }`}
          >
            {isAlarmArmed ? (
              <>
                <Volume2 className="w-4 h-4 text-red-400" />
                <span>Audio Alert: ARMED</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-[#A3A3A3]" />
                <span>Audio Alert: MUTED</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4 Tactical KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Reports in System"
          value={totalReportsToday}
          subtitle="Citizen & field submissions"
          icon={FileWarning}
          colorScheme="primary"
          trend={{ value: `${analytics24h.verifiedPercentage}% verified`, isPositive: true }}
        />
        <StatCard
          title="Active Flood Hotspots"
          value={activeHotspotsCount}
          subtitle="Clustered within 500m radius"
          icon={MapPin}
          colorScheme="warning"
          trend={{ value: `${hotspots.filter(h => h.verificationStatus === 'VERIFIED').length} verified clusters`, isNeutral: true }}
        />
        <StatCard
          title="High-Risk Zones"
          value={highRiskHotspotsCount}
          subtitle="Critical road blockage risk"
          icon={AlertTriangle}
          colorScheme="danger"
          trend={{ value: highRiskAreaSummary, isPositive: false }}
        />
        <StatCard
          title="Avg Officer Review Time"
          value={avgReviewDisplay}
          subtitle="Submission to verification"
          icon={Clock}
          colorScheme="success"
          trend={{
            value:
              analytics24h.avgReviewMinutes !== null
                ? `${analytics24h.verifiedCount} verified reports`
                : 'Awaiting timestamps',
            isPositive: true,
          }}
        />
      </div>

      {/* Main 2-Column Section: Large Tactical Map + Live Incident Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Leaflet GIS Map (7 cols) */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-md border border-[#E5E5E2] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#171717]">
                Colombo Metro GIS Flood Map
              </h3>
              <p className="text-xs text-[#666666]">
                Spatial radar displaying classified incident markers and 500-meter cluster buffers.
              </p>
            </div>
            <NavLink
              to="/officer/map"
              className="text-xs font-semibold text-[#171717] hover:underline flex items-center gap-1 group shrink-0"
            >
              <span>Full Screen Operations Map</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          <FloodMap
            hotspots={hotspots}
            reports={reports}
            heightClass="h-[490px]"
            showSectorControls={true}
            onSelectReport={(r) => setSelectedReportId(r.id)}
            onSelectHotspot={(h) => setSelectedHotspotId(h.id)}
          />
        </div>

        {/* Right Column: Live Incident Feed (5 cols) */}
        <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-md border border-[#E5E5E2] flex flex-col h-[582px]">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E2]">
            <div>
              <h3 className="text-base font-bold text-[#171717]">Live Incident Stream</h3>
              <p className="text-xs text-[#666666] font-mono">
                {filteredReports.length} reports in active queue ({analytics24h.verifiedCount} verified)
              </p>
            </div>

            {/* Quick Risk Filter */}
            <div className="flex items-center gap-1 bg-[#F5F5F2] border border-[#E5E5E2] p-1 rounded-md">
              {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFilterRisk(r)}
                  className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-sm transition-colors cursor-pointer ${
                    filterRisk === r
                      ? 'bg-[#171717] text-white'
                      : 'text-[#666666] hover:text-[#171717]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#666666]">
                No flood incidents matching selected filter.
              </div>
            ) : (
              filteredReports.map((report) => (
                <IncidentCard
                  key={report.id}
                  report={report}
                  onSelect={(rep) => setSelectedReportId(rep.id)}
                />
              ))
            )}
          </div>

          <div className="pt-3 border-t border-[#E5E5E2] flex items-center justify-between text-xs">
            <span className="text-[#666666] text-[11px] font-mono">
              Source: {isFirebaseAvailable ? 'Cloud Firestore' : 'Firebase Unconfigured'}
            </span>
            <NavLink
              to="/officer/report"
              className="text-[#171717] hover:underline font-semibold flex items-center gap-1"
            >
              <span>+ Dispatch New Flood Report</span>
            </NavLink>
          </div>
        </div>
      </div>

      {/* Bottom Section: Analytics charts & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Chart 1: Reports Over Time */}
        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-[#171717]">Flood Reports Over Time</h4>
              <p className="text-xs text-[#666666]">Bucketed directly from incident timestamps</p>
            </div>
            <span className="text-[10px] font-mono bg-[#F5F5F2] border border-[#E5E5E2] text-[#666666] px-2 py-0.5 rounded-sm font-semibold">
              Timestamped
            </span>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E2" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#666666' }} />
                <YAxis tick={{ fontSize: 10, fill: '#666666' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#181818',
                    border: '1px solid #333333',
                    borderRadius: '4px',
                    color: '#FFFFFF',
                    fontSize: '11px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="reports"
                  stroke="#171717"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#171717' }}
                  name="Reports"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Risk Distribution Doughnut */}
        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-[#171717]">Risk Severity Breakdown</h4>
              <p className="text-xs text-[#666666]">Computed live across active Colombo records</p>
            </div>
            <span className="text-[10px] font-mono bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717] px-2 py-0.5 rounded-sm font-semibold">
              Live Dataset
            </span>
          </div>

          <div className="h-56 flex items-center justify-center">
            {reports.length === 0 ? (
              <p className="text-xs text-[#666666] text-center">No active incidents to chart.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics24h.riskDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {analytics24h.riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#181818',
                      border: '1px solid #333333',
                      borderRadius: '4px',
                      color: '#FFFFFF',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex items-center justify-around text-xs pt-2 border-t border-[#E5E5E2]">
            {analytics24h.riskDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[#666666] text-[11px]">{item.name}</span>
                <span className="font-mono font-bold text-[#171717] text-[11px]">
                  ({item.value}% · {item.count})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Recent Activity Feed */}
        <div className="bg-white p-5 rounded-md border border-[#E5E5E2] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-[#171717]">Recent System Activity</h4>
                <p className="text-xs text-[#666666]">Live incident &amp; SHA-256 audit feed</p>
              </div>
              <Activity className="w-4 h-4 text-[#171717]" />
            </div>

            <div className="space-y-3">
              {dynamicActivityEvents.length === 0 ? (
                <p className="text-xs text-[#666666] py-4 text-center">No recent operational events.</p>
              ) : (
                dynamicActivityEvents.map((evt) => (
                  <div key={evt.id} className="text-xs border-l-2 border-[#171717] pl-3 py-0.5">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-semibold text-[#171717] truncate">{evt.title}</span>
                      <span className="text-[10px] text-[#666666] font-mono shrink-0">{evt.time}</span>
                    </div>
                    <p className="text-[11px] text-[#666666] line-clamp-1">{evt.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[#E5E5E2] flex items-center justify-between text-xs">
            <span className="text-[#666666] font-mono text-[11px]">Audit Engine Active</span>
            <NavLink
              to="/officer/blockchain"
              className="font-semibold text-[#171717] hover:underline flex items-center gap-1"
            >
              <span>View Audit Ledger →</span>
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
};
