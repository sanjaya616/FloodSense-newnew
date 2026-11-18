/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFlood } from '../context/FloodContext';
import { Sparkles, Info } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export const AnalyticsPage: React.FC = () => {
  const { hotspots, getAnalytics } = useFlood();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('24h');

  // Dynamically compute all metrics from active dataset
  const analytics = getAnalytics(timeRange);
  const totalActiveHotspots = hotspots.length;
  const highRiskHotspots = hotspots.filter((h) => h.riskLevel === 'HIGH').length;

  // Real timestamp-bucketed timeseries from calculateDynamicAnalytics
  const dynamicTimeseries = analytics.reportVolumeOverTime.map((pt) => ({
    label: pt.label,
    reports: pt.total,
    verified: pt.verified,
    highRisk: pt.highRisk,
  }));

  // Status breakdown array for charts
  const statusChartData = Object.entries(analytics.statusCounts).map(([status, count]) => ({
    status,
    count,
  }));

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header & Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
            Flood Intelligence &amp; Dynamic Analytics
          </h2>
          <p className="text-sm text-[#666666] mt-1">
            Real-time calculations synthesizing citizen incident reports, municipal sectors, and radar precipitation.
          </p>
        </div>

        {/* Date Filter Bar */}
        <div className="flex items-center bg-white border border-[#E5E5E2] p-1 rounded-md">
          {(
            [
              { key: '24h', label: 'Last 24 Hours' },
              { key: '7d', label: 'Last 7 Days' },
              { key: '30d', label: 'Last 30 Days' },
              { key: 'all', label: 'All Records' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTimeRange(item.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors cursor-pointer ${
                timeRange === item.key
                  ? 'bg-[#171717] text-white'
                  : 'text-[#666666] hover:text-[#171717]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Highlights Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-[#666666] block mb-1">
            Avg Review / Alert Time
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#171717] font-mono tabular-nums">
              {analytics.avgReviewMinutes !== null ? `${analytics.avgReviewMinutes} min` : 'Insufficient Timestamps'}
            </span>
          </div>
          <p
            className={`text-xs mt-2 font-medium ${
              analytics.avgAlertMinutes !== null ? 'text-emerald-800' : 'text-[#666666]'
            }`}
          >
            Alert gen:{' '}
            {analytics.avgAlertMinutes !== null
              ? `${analytics.avgAlertMinutes} min avg`
              : 'No alert timestamp yet'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-[#666666] block mb-1">
            Reports ({timeRange.toUpperCase()}) · Unique vs Dup
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#171717] font-mono tabular-nums">
              {analytics.totalReports}
            </span>
            <span className="text-xs font-semibold text-[#666666]">
              ({analytics.uniqueReportCount} unique · {analytics.duplicateReportCount} dup)
            </span>
          </div>
          <p className="text-xs text-[#171717] mt-2 font-medium">
            {analytics.verifiedCount} verified · {analytics.unverifiedCount} pending/unverified (
            {analytics.verifiedPercentage}%)
          </p>
        </div>

        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-[#666666] block mb-1">
            Active Hotspot Clusters
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-700 font-mono tabular-nums">
              {totalActiveHotspots}
            </span>
            <span className="text-sm font-semibold text-[#666666]">clusters</span>
          </div>
          <p className="text-xs text-[#666666] mt-2">
            {highRiskHotspots} High ·{' '}
            {analytics.hotspotSeverityDistribution.find((h) => h.name === 'MEDIUM')?.count ?? 0} Med ·{' '}
            {analytics.hotspotSeverityDistribution.find((h) => h.name === 'LOW')?.count ?? 0} Low
          </p>
        </div>

        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-[#666666] block mb-1">
            Data Completeness &amp; Freshness
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#171717] font-mono tabular-nums">
              {analytics.dataCompleteness.reportsWithValidTimestamps}/{analytics.totalReports}
            </span>
            <span className="text-xs font-semibold text-[#666666]">timestamped</span>
          </div>
          <p className="text-[11px] text-[#666666] mt-2 font-mono flex flex-wrap items-center gap-x-1.5">
            <span>{analytics.dataCompleteness.reportsWithCoordinates} geo</span>
            <span>·</span>
            <span>{analytics.dataCompleteness.reportsWithImages} photo</span>
            <span>·</span>
            <span className="whitespace-nowrap">
              {new Date(analytics.freshnessTimestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </p>
        </div>
      </div>

      {/* Primary Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Reports Over Time */}
        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#171717]">1. Report Volume &amp; Verification Trend</h3>
              <p className="text-xs text-[#666666]">
                Real timestamp-bucketed submissions ({timeRange.toUpperCase()} window)
              </p>
            </div>
            <span className="text-[10px] font-mono bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717] px-2 py-0.5 rounded-sm font-semibold">
              Timestamp Aggregation
            </span>
          </div>

          <div className="h-64">
            {dynamicTimeseries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#666666]">
                No timestamped reports available in this time window.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dynamicTimeseries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E2" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#666666' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#666666' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#181818',
                      border: '1px solid #333333',
                      borderRadius: '4px',
                      color: '#FFFFFF',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line
                    type="monotone"
                    dataKey="reports"
                    stroke="#171717"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#171717' }}
                    name="Total Reports"
                  />
                  <Line
                    type="monotone"
                    dataKey="verified"
                    stroke="#15803D"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#15803D' }}
                    name="Verified Reports"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Reports By Zone */}
        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#171717]">2. Incident Frequency by Municipal Sector</h3>
              <p className="text-xs text-[#666666]">Calculated directly from active citizen reports</p>
            </div>
            <span className="text-[10px] font-mono bg-[#F5F5F2] border border-[#E5E5E2] text-[#666666] px-2 py-0.5 rounded-sm font-semibold">
              Zonal Distribution
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.reportsByZone}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E2" />
                <XAxis dataKey="zone" tick={{ fontSize: 11, fill: '#666666' }} />
                <YAxis tick={{ fontSize: 11, fill: '#666666' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#181818',
                    border: '1px solid #333333',
                    borderRadius: '4px',
                    color: '#FFFFFF',
                    fontSize: '11px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="highRisk" fill="#DC2626" name="High Risk" stackId="a" />
                <Bar dataKey="mediumRisk" fill="#D97706" name="Medium Risk" stackId="a" />
                <Bar dataKey="lowRisk" fill="#15803D" name="Low Risk" stackId="a" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Risk Distribution */}
        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#171717]">3. Overall Risk Severity Distribution</h3>
              <p className="text-xs text-[#666666]">Proportion of high vs medium vs low risk signals</p>
            </div>
            <span className="text-[10px] font-mono bg-[#F5F5F2] border border-[#E5E5E2] text-[#666666] px-2 py-0.5 rounded-sm font-semibold">
              Computed %
            </span>
          </div>

          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {analytics.riskDistribution.map((entry, index) => (
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
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Incident Lifecycle Status Distribution */}
        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#171717]">4. Incident Lifecycle Status Breakdown</h3>
              <p className="text-xs text-[#666666]">Distribution across 6 incident management stages</p>
            </div>
            <span className="text-[10px] font-mono bg-[#F5F5F2] border border-[#E5E5E2] text-[#666666] px-2 py-0.5 rounded-sm font-semibold">
              Lifecycle
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E5E2" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#666666' }} />
                <YAxis
                  type="category"
                  dataKey="status"
                  width={110}
                  tick={{ fontSize: 10, fill: '#666666' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#181818',
                    border: '1px solid #333333',
                    borderRadius: '4px',
                    color: '#FFFFFF',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="count" fill="#171717" name="Reports in Stage" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Rainfall vs Report Volume Correlation & Hotspot Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#171717]">5. Rainfall vs Report Volume Correlation</h3>
              <p className="text-xs text-[#666666]">Observed rainfall vs hotspot report density</p>
            </div>
            <span className="text-[10px] font-mono bg-[#F5F5F2] border border-[#E5E5E2] text-[#666666] px-2 py-0.5 rounded-sm font-semibold">
              {analytics.hasRainfallCorrelationData ? 'Paired Observations' : 'Insufficient Pairs'}
            </span>
          </div>
          <div className="h-56">
            {analytics.hasRainfallCorrelationData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.rainfallVsVolumeCorrelation}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E2" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: '#666666' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#666666' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#181818',
                      border: '1px solid #333333',
                      borderRadius: '4px',
                      color: '#FFFFFF',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="avgRainfallMm" fill="#737373" name="Avg 3h Rainfall (mm)" />
                  <Bar dataKey="reportCount" fill="#171717" name="Unique Reports" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#666666] text-center px-6">
                Insufficient matched rainfall-forecast and report pairs for correlation display.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#171717]">6. Verified vs Unverified &amp; Hotspot Split</h3>
              <p className="text-xs text-[#666666]">Audit summary across reports and active clusters</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-md bg-[#F5F5F2] border border-[#E5E5E2]">
              <span className="text-[10px] font-mono uppercase font-semibold text-[#666666] block mb-1.5">Verification Split</span>
              {analytics.verifiedVsUnverified.map((v) => (
                <div key={v.name} className="flex justify-between py-1">
                  <span className="text-[#171717] font-medium">{v.name}</span>
                  <span className="font-mono font-bold text-[#171717]">{v.count}</span>
                </div>
              ))}
            </div>
            <div className="p-3.5 rounded-md bg-[#F5F5F2] border border-[#E5E5E2]">
              <span className="text-[10px] font-mono uppercase font-semibold text-[#666666] block mb-1.5">Unique vs Duplicate</span>
              {analytics.uniqueVsDuplicate.map((u) => (
                <div key={u.name} className="flex justify-between py-1">
                  <span className="text-[#171717] font-medium">{u.name}</span>
                  <span className="font-mono font-bold text-[#171717]">{u.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Insights Panel */}
      {(() => {
        const sortedZones = [...analytics.reportsByZone].sort((a, b) => b.reports - a.reports);
        const topZone = sortedZones[0];
        const topZoneShare =
          topZone && analytics.totalReports > 0
            ? Math.round((topZone.reports / analytics.totalReports) * 100)
            : 0;
        const measuredRainfallHotspots = hotspots.filter((h) => h.rainfallSource !== 'MISSING').length;

        return (
          <div className="bg-white p-6 rounded-md border border-[#E5E5E2]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
              <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#171717]" />
                <span>Computed Insights &amp; Analytical Transparency Notice</span>
              </h3>
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-sm bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717] self-start sm:self-auto">
                Filter Window: {timeRange.toUpperCase()} ({analytics.totalReports} reports)
              </span>
            </div>
            <p className="text-xs text-[#666666] mb-4">
              All statistical metrics above and the first three summaries below are calculated dynamically from the active report window and Open-Meteo rainfall telemetry.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#F5F5F2] rounded-md border border-[#E5E5E2]">
                <span className="font-bold text-[#171717] block mb-1">
                  Top Reported Sector in Window
                </span>
                <p className="text-[#666666] leading-relaxed">
                  {topZone && topZone.reports > 0
                    ? `${topZone.zone} accounts for ${topZone.reports} of ${analytics.totalReports} filtered reports (${topZoneShare}% share), including ${topZone.highRisk} HIGH-risk submission(s).`
                    : `No flood reports fall within the selected ${timeRange.toUpperCase()} window.`}
                </p>
              </div>

              <div className="p-4 bg-[#F5F5F2] rounded-md border border-[#E5E5E2]">
                <span className="font-bold text-[#171717] block mb-1">
                  Verification &amp; Deduplication Yield
                </span>
                <p className="text-[#666666] leading-relaxed">
                  {analytics.verifiedCount} of {analytics.totalReports} reports are officer-verified ({analytics.verifiedPercentage}%).{' '}
                  {analytics.duplicateReportCount} near-duplicate submission(s) were filtered from unique cluster counts.
                  {analytics.avgReviewMinutes !== null
                    ? ` Mean review latency is ${analytics.avgReviewMinutes} minutes.`
                    : ' Insufficient verification timestamps to compute mean review latency.'}
                </p>
              </div>

              <div className="p-4 bg-[#F5F5F2] rounded-md border border-[#E5E5E2]">
                <span className="font-bold text-[#171717] block mb-1">
                  Rainfall Telemetry Coverage
                </span>
                <p className="text-[#666666] leading-relaxed">
                  {measuredRainfallHotspots} of {totalActiveHotspots} active hotspot cluster(s) include paired forecast rainfall telemetry;{' '}
                  {analytics.hasRainfallCorrelationData
                    ? 'paired rainfall-vs-volume buckets are rendered in Chart 5.'
                    : 'Chart 5 suppresses regression bars where forecast telemetry pairs are incomplete.'}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3.5 bg-amber-50 rounded-md border border-amber-200 text-[11px] text-amber-950 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block">Analytical Scope &amp; Telemetry Notice:</strong>
                <span className="text-amber-900">
                  Metrics above are computed directly over active Firestore incident collections and live Open-Meteo rainfall telemetry using deterministic spatial clustering. They reflect submitted field observations rather than full hydrological sensor instrumentation.
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
