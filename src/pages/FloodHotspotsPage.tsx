/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFlood } from '../context/FloodContext';
import { useNavigate } from 'react-router-dom';
import { HotspotCard } from '../components/common/HotspotCard';
import { RiskBadge } from '../components/common/RiskBadge';
import {
  Search,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { FloodHotspot } from '../utils/floodLogic';

export const FloodHotspotsPage: React.FC = () => {
  const {
    hotspots,
    reports,
    setSelectedHotspotId,
    setSelectedReportId,
    clusteringConfig,
  } = useFlood();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [selectedHotspotForModal, setSelectedHotspotForModal] = useState<FloodHotspot | null>(null);

  const filteredHotspots = hotspots.filter((h) => {
    const matchesSearch =
      !search ||
      h.location.toLowerCase().includes(search.toLowerCase()) ||
      h.area.toLowerCase().includes(search.toLowerCase()) ||
      h.id.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity = filterSeverity === 'ALL' || h.riskLevel === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  const handleOpenOnMap = (hs: FloodHotspot) => {
    setSelectedHotspotId(hs.id);
    navigate('/officer/map');
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
              Flood Hotspot Clusters
            </h2>
          </div>
          <p className="text-sm text-[#666666]">
            Algorithmic incident aggregation identifying high-risk stormwater pooling zones across Colombo.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Search hotspots..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-white border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666] focus:outline-none focus:border-[#171717]"
            />
          </div>

          <div className="flex items-center bg-white border border-[#E5E5E2] p-1 rounded-md">
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setFilterSeverity(sev)}
                className={`px-3 py-1 text-xs font-mono font-semibold rounded-sm transition-colors cursor-pointer ${
                  filterSeverity === sev
                    ? 'bg-[#171717] text-white'
                    : 'text-[#666666] hover:text-[#171717]'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Clustering Concept Explainer Banner */}
      <div className="bg-[#181818] text-white p-5 rounded-md border border-[#2A2A2A] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 max-w-2xl">
          <div className="p-2.5 rounded-sm bg-[#262626] text-white border border-[#3A3A3A] shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white mb-1 flex flex-wrap items-center gap-2">
              <span>Geospatial Hotspot Clustering Model (Haversine Formula)</span>
              <span className="text-[10px] bg-[#262626] text-[#D4D4D0] border border-[#3A3A3A] px-2 py-0.5 rounded-sm font-mono font-normal">
                Radius ≤ {clusteringConfig.spatialRadiusMeters}m · Window ≤ {clusteringConfig.temporalWindowHours}h
              </span>
            </h4>
            <p className="text-xs text-[#D4D4D0] leading-relaxed">
              When individual citizen reports and stormwater sensors report rising water within a {clusteringConfig.spatialRadiusMeters}-meter
              radius inside a {clusteringConfig.temporalWindowHours}-hour temporal window, FloodSense clusters them into an authoritative
              Hotspot. This avoids alert fatigue and equips municipal drainage crews with localized tasking.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/officer/predictions')}
          className="px-4 py-2 bg-white hover:bg-[#EEEEEB] text-[#171717] font-semibold text-xs rounded-md transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
        >
          <span>View Predictive Rules</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Hotspots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredHotspots.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-md border border-[#E5E5E2] text-center">
            <p className="text-sm font-semibold text-[#171717]">No flood hotspots found</p>
            <p className="text-xs text-[#666666] mt-1">
              Try adjusting your search criteria or risk filter.
            </p>
          </div>
        ) : (
          filteredHotspots.map((hotspot) => (
            <HotspotCard
              key={hotspot.id}
              hotspot={hotspot}
              onViewOnMap={handleOpenOnMap}
              onSelectDetails={(hs) => setSelectedHotspotForModal(hs)}
            />
          ))
        )}
      </div>

      {/* Hotspot Detailed Inspection Modal */}
      {selectedHotspotForModal && (
        <div className="fixed inset-0 z-1000 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-2xl border border-[#E5E5E2] p-6 space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-[#E5E5E2]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold bg-[#F5F5F2] border border-[#E5E5E2] px-2 py-0.5 rounded-sm text-[#171717]">
                    {selectedHotspotForModal.id}
                  </span>
                  <RiskBadge level={selectedHotspotForModal.riskLevel} />
                  <RiskBadge level={selectedHotspotForModal.verificationStatus} />
                </div>
                <h3 className="font-serif text-2xl text-[#171717]">
                  {selectedHotspotForModal.location}
                </h3>
                <p className="text-xs text-[#666666]">
                  {selectedHotspotForModal.area} Sector · GPS: {selectedHotspotForModal.lat.toFixed(4)},{' '}
                  {selectedHotspotForModal.lng.toFixed(4)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHotspotForModal(null)}
                className="text-[#666666] hover:text-[#171717] p-1.5 rounded-md hover:bg-[#EEEEEB] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Clustering Statistics & Formation Details */}
            <div className="grid grid-cols-3 gap-3 p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] text-xs font-mono">
              <div>
                <span className="text-[10px] text-[#666666] uppercase block font-sans">
                  Total Observations
                </span>
                <span className="text-base font-bold text-[#171717]">
                  {selectedHotspotForModal.reportCount} Unique
                  {selectedHotspotForModal.duplicateReportCount
                    ? ` (+${selectedHotspotForModal.duplicateReportCount} dup)`
                    : ''}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#666666] uppercase block font-sans">
                  Risk Computation
                </span>
                <span className="text-base font-bold text-red-700">
                  {selectedHotspotForModal.riskScore}/100
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#666666] uppercase block font-sans">
                  3h Rainfall Forecast
                </span>
                <span className="text-base font-bold text-[#171717]">
                  {selectedHotspotForModal.rainfallSource === 'MISSING'
                    ? 'Unavailable'
                    : `${selectedHotspotForModal.forecastRainfallMm} mm`}
                </span>
              </div>
            </div>

            {/* How this cluster was formed */}
            <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] text-xs space-y-1.5 font-mono">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#171717] block font-sans">
                Haversine Cluster Formation Trace
              </span>
              <div className="flex justify-between text-[#666666]">
                <span>Spatial Radius:</span>
                <strong className="text-[#171717]">≤ {selectedHotspotForModal.clusterRadiusMeters || 500} meters</strong>
              </div>
              <div className="flex justify-between text-[#666666]">
                <span>First Incident:</span>
                <span className="text-[#171717]">{new Date(selectedHotspotForModal.firstReportedTime).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between text-[#666666]">
                <span>Latest Incident:</span>
                <span className="text-[#171717]">{new Date(selectedHotspotForModal.latestReportedTime).toLocaleTimeString()}</span>
              </div>
              {selectedHotspotForModal.formationDetails && (
                <p className="text-[11px] text-[#666666] pt-1.5 border-t border-[#E5E5E2] font-sans">
                  {selectedHotspotForModal.formationDetails.reasoning}
                </p>
              )}
            </div>

            {/* Operational Precaution */}
            <div className="p-4 bg-amber-50 rounded-md border border-amber-200 text-xs">
              <span className="font-bold uppercase tracking-wider text-amber-950 block mb-1">
                Field Deployment Protocol
              </span>
              <p className="text-amber-950 leading-relaxed italic">
                &ldquo;{selectedHotspotForModal.precaution}&rdquo;
              </p>
            </div>

            {/* Associated Reports List */}
            <div>
              <h4 className="text-xs font-mono font-semibold uppercase tracking-[0.14em] text-[#171717] mb-2">
                Clustered Citizen Reports ({selectedHotspotForModal.associatedReportIds.length})
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {reports
                  .filter((r) =>
                    selectedHotspotForModal.associatedReportIds.includes(r.id) ||
                    r.hotspotId === selectedHotspotForModal.id
                  )
                  .map((rep) => (
                    <div
                      key={rep.id}
                      onClick={() => {
                        setSelectedHotspotForModal(null);
                        setSelectedReportId(rep.id);
                      }}
                      className="p-3 rounded-md border border-[#E5E5E2] hover:border-[#171717] bg-white cursor-pointer transition-colors text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono font-bold text-[#171717]">{rep.id}</span>
                          <span className="text-[#A3A3A3]">·</span>
                          <span className="font-semibold text-[#171717]">{rep.waterLevel}</span>
                          <span className="text-[#A3A3A3]">·</span>
                          <span className="text-[#666666]">{rep.floodType}</span>
                        </div>
                        <p className="text-[#666666] line-clamp-1">{rep.location}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-[#171717] shrink-0" />
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5E5E2] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedHotspotForModal(null)}
                className="px-4 py-2 text-xs font-semibold text-[#666666] hover:text-[#171717] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleOpenOnMap(selectedHotspotForModal);
                  setSelectedHotspotForModal(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#171717] hover:bg-black rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Navigate to Map View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
