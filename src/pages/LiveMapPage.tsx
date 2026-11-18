/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFlood } from '../context/FloodContext';
import { FloodMap } from '../components/map/FloodMap';
import { RiskBadge } from '../components/common/RiskBadge';
import {
  Search,
  Flame,
  AlertTriangle,
  Droplets,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { FloodHotspot } from '../utils/floodLogic';

export const LiveMapPage: React.FC = () => {
  const { reports, hotspots, setSelectedReportId } = useFlood();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<
    'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERIFIED' | 'UNVERIFIED'
  >('ALL');
  const [activeTab, setActiveTab] = useState<'hotspots' | 'reports'>('hotspots');
  const [selectedHotspot, setSelectedHotspot] = useState<FloodHotspot | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Compute summary stats
  const totalActiveIncidents = reports.length;
  const confirmedHotspots = hotspots.filter((h) => h.verificationStatus === 'VERIFIED').length;
  const highRiskLocations = hotspots.filter((h) => h.riskLevel === 'HIGH').length;

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      !search ||
      r.location.toLowerCase().includes(search.toLowerCase()) ||
      r.area.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'HIGH') return r.riskLevel === 'HIGH';
    if (filterType === 'MEDIUM') return r.riskLevel === 'MEDIUM';
    if (filterType === 'LOW') return r.riskLevel === 'LOW';
    if (filterType === 'VERIFIED') return r.verificationStatus === 'VERIFIED';
    if (filterType === 'UNVERIFIED') return r.verificationStatus !== 'VERIFIED';
    return true;
  });

  // Filtered hotspots
  const filteredHotspots = hotspots.filter((h) => {
    const matchesSearch =
      !search ||
      h.location.toLowerCase().includes(search.toLowerCase()) ||
      h.area.toLowerCase().includes(search.toLowerCase()) ||
      h.id.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'HIGH') return h.riskLevel === 'HIGH';
    if (filterType === 'MEDIUM') return h.riskLevel === 'MEDIUM';
    if (filterType === 'LOW') return h.riskLevel === 'LOW';
    if (filterType === 'VERIFIED') return h.verificationStatus === 'VERIFIED';
    if (filterType === 'UNVERIFIED') return h.verificationStatus !== 'VERIFIED';
    return true;
  });

  return (
    <div className="space-y-4 font-sans">
      {/* Top Operations Tactical Ribbon */}
      <div className="bg-white p-4 sm:p-5 rounded-md border border-[#E5E5E2] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <h2 className="font-serif text-2xl font-normal text-[#171717]">
              Live Colombo Flood GIS Operations Map
            </h2>
            <span className="text-[10px] font-mono font-semibold bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717] px-2 py-0.5 rounded-sm uppercase tracking-wider">
              SECTOR 04 WATCH
            </span>
          </div>
          <p className="text-xs text-[#666666]">
            Geospatial surveillance layer synchronizing community telemetry with algorithmic clustering (500m buffers).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md">
            <Droplets className="w-4 h-4 text-[#171717]" />
            <div>
              <span className="text-[10px] text-[#666666] uppercase block font-semibold leading-tight">
                Active Reports
              </span>
              <span className="text-sm font-bold text-[#171717] font-mono tabular-nums leading-tight">
                {totalActiveIncidents}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md">
            <Flame className="w-4 h-4 text-amber-600" />
            <div>
              <span className="text-[10px] text-[#666666] uppercase block font-semibold leading-tight">
                Confirmed Hotspots
              </span>
              <span className="text-sm font-bold text-[#171717] font-mono tabular-nums leading-tight">
                {confirmedHotspots}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md">
            <AlertTriangle className="w-4 h-4 text-red-700" />
            <div>
              <span className="text-[10px] text-red-800 uppercase block font-semibold leading-tight">
                High Risk Zones
              </span>
              <span className="text-sm font-bold text-red-900 font-mono tabular-nums leading-tight">
                {highRiskLocations}
              </span>
            </div>
          </div>

          {/* Toggle Panel Button */}
          <button
            type="button"
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            className="p-2.5 rounded-md border border-[#E5E5E2] bg-white hover:bg-[#EEEEEB] text-[#171717] transition-colors cursor-pointer"
            title={isPanelCollapsed ? 'Expand Side Inspector' : 'Collapse Side Inspector'}
          >
            {isPanelCollapsed ? (
              <PanelRightOpen className="w-4 h-4" />
            ) : (
              <PanelRightClose className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main Map + Collapsible Details Panel Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[660px]">
        {/* Map Area */}
        <div
          className={`${
            isPanelCollapsed ? 'lg:col-span-12' : 'lg:col-span-8 xl:col-span-9'
          } bg-white p-2 rounded-md border border-[#E5E5E2] flex flex-col transition-all duration-300`}
        >
          <div className="flex-1 rounded-sm overflow-hidden min-h-[630px]">
            <FloodMap
              hotspots={filteredHotspots}
              reports={filteredReports}
              heightClass="h-full min-h-[630px]"
              selectedHotspotId={selectedHotspot?.id}
              onSelectHotspot={(h) => setSelectedHotspot(h)}
              onSelectReport={(r) => setSelectedReportId(r.id)}
            />
          </div>
        </div>

        {/* Right Filter & Details Panel */}
        {!isPanelCollapsed && (
          <div className="lg:col-span-4 xl:col-span-3 bg-white p-4 rounded-md border border-[#E5E5E2] flex flex-col justify-between h-[660px]">
            <div>
              {/* Search & Tabs */}
              <div className="space-y-2.5 mb-3 pb-3 border-b border-[#E5E5E2]">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    placeholder="Filter by sector, ID, road..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666] focus:bg-white focus:outline-none focus:border-[#171717]"
                  />
                </div>

                {/* Filter Buttons */}
                <div className="flex flex-wrap gap-1">
                  {(['ALL', 'HIGH', 'MEDIUM', 'LOW', 'VERIFIED', 'UNVERIFIED'] as const).map(
                    (type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFilterType(type)}
                        className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-sm transition-colors cursor-pointer ${
                          filterType === type
                            ? 'bg-[#171717] text-white'
                            : 'bg-[#F5F5F2] text-[#666666] hover:bg-[#EEEEEB] hover:text-[#171717]'
                        }`}
                      >
                        {type}
                      </button>
                    )
                  )}
                </div>

                {/* View Switcher: Hotspots vs Reports */}
                <div className="grid grid-cols-2 gap-1 bg-[#F5F5F2] border border-[#E5E5E2] p-1 rounded-md">
                  <button
                    type="button"
                    onClick={() => setActiveTab('hotspots')}
                    className={`py-1 text-xs font-semibold rounded-sm transition-colors cursor-pointer ${
                      activeTab === 'hotspots'
                        ? 'bg-[#171717] text-white'
                        : 'text-[#666666] hover:text-[#171717]'
                    }`}
                  >
                    Hotspots ({filteredHotspots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className={`py-1 text-xs font-semibold rounded-sm transition-colors cursor-pointer ${
                      activeTab === 'reports'
                        ? 'bg-[#171717] text-white'
                        : 'text-[#666666] hover:text-[#171717]'
                    }`}
                  >
                    Reports ({filteredReports.length})
                  </button>
                </div>
              </div>

              {/* List View */}
              <div className="overflow-y-auto max-h-[380px] space-y-2 pr-1">
                {activeTab === 'hotspots' ? (
                  filteredHotspots.length === 0 ? (
                    <p className="text-xs text-[#666666] text-center py-6">No matching hotspots</p>
                  ) : (
                    filteredHotspots.map((hs) => (
                      <div
                        key={hs.id}
                        onClick={() => setSelectedHotspot(hs)}
                        className={`p-3 rounded-md border text-xs cursor-pointer transition-colors ${
                          selectedHotspot?.id === hs.id
                            ? 'bg-[#F5F5F2] border-[#171717]'
                            : 'bg-white border-[#E5E5E2] hover:border-[#171717]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-mono font-bold text-[#171717]">{hs.id}</span>
                          <RiskBadge level={hs.riskLevel} size="sm" />
                        </div>
                        <h4 className="font-semibold text-[#171717] truncate mb-1">{hs.location}</h4>
                        <div className="flex items-center justify-between text-[11px] text-[#666666] font-mono">
                          <span>{hs.reportCount} Verified Reports</span>
                          <span className="font-semibold text-[#171717]">
                            {hs.rainfallSource === 'MISSING'
                              ? 'Rain N/A'
                              : `${hs.forecastRainfallMm} mm rain`}
                          </span>
                        </div>
                      </div>
                    ))
                  )
                ) : filteredReports.length === 0 ? (
                  <p className="text-xs text-[#666666] text-center py-6">No matching reports</p>
                ) : (
                  filteredReports.map((rep) => (
                    <div
                      key={rep.id}
                      onClick={() => setSelectedReportId(rep.id)}
                      className="p-3 rounded-md border border-[#E5E5E2] hover:border-[#171717]/40 bg-white text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono font-bold text-[#171717]">{rep.id}</span>
                        <RiskBadge level={rep.riskLevel} size="sm" />
                      </div>
                      <h4 className="font-semibold text-[#171717] truncate mb-1">{rep.location}</h4>
                      <div className="flex items-center justify-between text-[11px] text-[#666666] font-mono">
                        <span>{rep.waterLevel}</span>
                        <span>{rep.floodType}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Active Hotspot Inspector Card */}
            {selectedHotspot && (
              <div className="pt-3 border-t border-[#E5E5E2] bg-[#F5F5F2] p-3 rounded-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono uppercase font-semibold text-[#666666]">Selected Hotspot</span>
                  <span className="text-xs font-mono font-bold text-[#171717]">{selectedHotspot.id}</span>
                </div>
                <p className="text-xs font-semibold text-[#171717] leading-snug truncate mb-1">
                  {selectedHotspot.location}
                </p>
                <p className="text-[11px] text-[#666666] line-clamp-2 italic mb-2">
                  &ldquo;{selectedHotspot.precaution}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedHotspot(null)}
                  className="w-full py-1 text-center text-xs text-[#666666] hover:text-[#171717] font-semibold cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
