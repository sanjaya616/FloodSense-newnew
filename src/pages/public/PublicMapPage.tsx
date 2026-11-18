/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  AlertTriangle,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { FloodMap } from '../../components/map/FloodMap';
import { RiskBadge } from '../../components/common/RiskBadge';
import { IncidentDetailsModal } from '../../components/common/IncidentDetailsModal';
import { FloodReport, FloodHotspot } from '../../utils/floodLogic';

export const PublicMapPage: React.FC = () => {
  const { hotspots, reports, weather } = useFlood();
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeReportModal, setActiveReportModal] = useState<FloodReport | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<FloodHotspot | null>(null);

  const distinctAreas = useMemo(() => {
    const set = new Set<string>();
    hotspots.forEach((h) => set.add(h.area));
    reports.forEach((r) => set.add(r.area));
    return Array.from(set).sort();
  }, [hotspots, reports]);

  const filteredHotspots = useMemo(() => {
    return hotspots.filter((h) => {
      const matchArea = selectedArea === 'ALL' || h.area === selectedArea;
      const matchRisk = selectedRisk === 'ALL' || h.riskLevel === selectedRisk;
      const matchSearch =
        searchTerm === '' ||
        h.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.area.toLowerCase().includes(searchTerm.toLowerCase());
      return matchArea && matchRisk && matchSearch;
    });
  }, [hotspots, selectedArea, selectedRisk, searchTerm]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchArea = selectedArea === 'ALL' || r.area === selectedArea;
      const matchRisk = selectedRisk === 'ALL' || r.riskLevel === selectedRisk;
      const matchSearch =
        searchTerm === '' ||
        r.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.area.toLowerCase().includes(searchTerm.toLowerCase());
      return matchArea && matchRisk && matchSearch;
    });
  }, [reports, selectedArea, selectedRisk, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E5E5E2]">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#666666] mb-2">
            <NavLink to="/" className="hover:text-[#171717] transition-colors">
              Home
            </NavLink>
            <ChevronRight className="w-3 h-3 text-[#666666]" />
            <span className="text-[#171717] font-semibold">Public Flood Map</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#171717] tracking-tight">
            Live Urban Flood Map
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1.5">
            Public roadway waterlogging, active hotspot clusters, and traffic passability advisories across Colombo.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <NavLink
            to="/citizen/report"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm bg-[#171717] hover:bg-black text-white font-semibold text-xs uppercase tracking-wider transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report Flooded Road</span>
          </NavLink>
        </div>
      </div>

      {/* Advisory Banner */}
      {(() => {
        const highAreas = Array.from(
          new Set(hotspots.filter((h) => h.riskLevel === 'HIGH').map((h) => h.area))
        );
        const mediumAreas = Array.from(
          new Set(hotspots.filter((h) => h.riskLevel === 'MEDIUM').map((h) => h.area))
        );
        const advisoryText =
          highAreas.length > 0
            ? `HIGH risk flood clusters active in ${highAreas.join(', ')}. Avoid low-lying underpasses and inundated intersections.`
            : mediumAreas.length > 0
            ? `Moderate runoff watch in ${mediumAreas.join(', ')}. Exercise caution near canal corridors.`
            : 'No HIGH or MEDIUM risk flood hotspot clusters currently active across monitored Colombo wards.';

        return (
          <div className="p-4 rounded-lg bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <span className="font-bold">Colombo Flood Advisory: </span>
                <span>{advisoryText}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-amber-900 bg-white px-2.5 py-1 rounded-sm border border-amber-200 shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {weather.isLive
                  ? `Open-Meteo Forecast API (${weather.updatedAt})`
                  : weather.status || 'Live weather telemetry unavailable'}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-[#E5E5E2] flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Search by street name, landmark, or district (e.g., Maradana, Baseline Rd)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666] focus:outline-none focus:border-[#171717] font-sans"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md px-3 py-2 text-[#171717] font-semibold focus:outline-none focus:border-[#171717]"
          >
            <option value="ALL">All Municipal Areas ({distinctAreas.length})</option>
            {distinctAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>

          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md px-3 py-2 text-[#171717] font-semibold focus:outline-none focus:border-[#171717]"
          >
            <option value="ALL">All Risk Severities</option>
            <option value="HIGH">High Severity Only</option>
            <option value="MEDIUM">Medium Severity</option>
            <option value="LOW">Low / Receding</option>
          </select>
        </div>
      </div>

      {/* Main Map Container */}
      <div className="bg-white rounded-lg border border-[#E5E5E2] overflow-hidden p-2">
        <FloodMap
          hotspots={filteredHotspots}
          reports={filteredReports}
          selectedHotspotId={selectedHotspot?.id}
          onSelectHotspot={(h) => setSelectedHotspot(h)}
          onSelectReport={(r) => setActiveReportModal(r)}
          heightClass="h-[520px]"
          showLegendOverlay={true}
          showSectorControls={true}
        />
      </div>

      {/* Quick Cards Grid: Active Hotspot Summary */}
      <div className="space-y-3 pt-2">
        <h2 className="text-xs font-bold text-[#171717] uppercase tracking-wider">
          Active Clustered Flood Hotspots ({filteredHotspots.length})
        </h2>

        {filteredHotspots.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-[#E5E5E2] text-center text-xs text-[#666666]">
            No active clustered flood hotspots match the current filter criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredHotspots.map((hotspot) => (
              <div
                key={hotspot.id}
                onClick={() => setSelectedHotspot(hotspot)}
                className={`p-5 rounded-lg border transition-colors cursor-pointer bg-white ${
                  selectedHotspot?.id === hotspot.id
                    ? 'border-[#171717] ring-1 ring-[#171717]'
                    : 'border-[#E5E5E2] hover:border-[#171717]/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-mono text-xs font-semibold text-[#666666]">{hotspot.id}</span>
                  <RiskBadge level={hotspot.riskLevel} size="sm" />
                </div>

                <h4 className="font-bold text-[#171717] text-sm leading-snug">{hotspot.location}</h4>
                <p className="text-xs text-[#666666] mt-0.5">{hotspot.area} Municipal Basin</p>

                <div className="mt-3 pt-3 border-t border-[#E5E5E2] flex items-center justify-between text-xs font-mono tabular-nums text-[#666666]">
                  <span>
                    {hotspot.reportCount} unique ({hotspot.verificationStatus === 'VERIFIED' ? 'Verified' : 'Unverified'})
                  </span>
                  <span className="text-[#171717] font-bold">
                    {hotspot.rainfallSource === 'MISSING' ? 'Rain: N/A' : `${hotspot.forecastRainfallMm} mm`}
                  </span>
                </div>

                <p className="text-[11px] text-[#666666] mt-3 bg-[#F5F5F2] border border-[#E5E5E2] p-2.5 rounded-md line-clamp-2">
                  {hotspot.precaution}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incident Details Modal */}
      {activeReportModal && (
        <IncidentDetailsModal
          report={activeReportModal}
          onClose={() => setActiveReportModal(null)}
        />
      )}
    </div>
  );
};
