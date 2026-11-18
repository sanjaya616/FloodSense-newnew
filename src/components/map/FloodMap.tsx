/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { FloodReport, FloodHotspot, validateCoordinates } from '../../utils/floodLogic';
import { RiskBadge } from '../common/RiskBadge';
import { MapLegend } from './MapLegend';
import { ReportEvidenceImage, hasReportPhotoEvidence } from '../common/ReportEvidenceImage';
import {
  MapPin,
  Navigation,
  ArrowRight,
  Eye,
  Crosshair,
  Compass,
  Layers,
} from 'lucide-react';

interface FloodMapProps {
  hotspots: FloodHotspot[];
  reports: FloodReport[];
  selectedHotspotId?: string | null;
  focusCoordinates?: [number, number] | null;
  focusZoom?: number;
  onSelectHotspot?: (hotspot: FloodHotspot) => void;
  onSelectReport?: (report: FloodReport) => void;
  heightClass?: string;
  showLegendOverlay?: boolean;
  showSectorControls?: boolean;
}

const MapRecenter: React.FC<{ center: [number, number]; zoom?: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    try {
      const container = map.getContainer();
      if (!container || !container.isConnected) return;
      map.stop();
      map.setView(center, zoom || map.getZoom(), { animate: false });
    } catch {
      // Ignore if map instance is already tearing down
    }
    return () => {
      try {
        map.stop();
      } catch {
        // Ignore teardown errors
      }
    };
  }, [center, zoom, map]);
  return null;
};

const createCustomIcon = (
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW',
  type: 'hotspot' | 'report',
  count?: number
) => {
  const colorMap = {
    HIGH: {
      bg: '#DC2626',
      border: '#FFFFFF',
    },
    MEDIUM: {
      bg: '#D97706',
      border: '#FFFFFF',
    },
    LOW: {
      bg: '#15803D',
      border: '#FFFFFF',
    },
  }[riskLevel];

  const size = type === 'hotspot' ? 40 : 30;
  const label = type === 'hotspot' && count ? count : '';

  const html = `
    <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      ${
        riskLevel === 'HIGH'
          ? `<span style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: ${colorMap.bg}; opacity: 0.35; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
          : ''
      }
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${colorMap.bg};
        border: 2.5px solid ${colorMap.border};
        box-shadow: 0 4px 12px rgba(23,23,23,0.28);
        border-radius: ${type === 'hotspot' ? '50%' : '50% 50% 50% 0'};
        transform: ${type === 'report' ? 'rotate(-45deg)' : 'none'};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: 'JetBrains Mono', monospace;
        font-weight: 700;
        font-size: ${type === 'hotspot' ? '13px' : '11px'};
      ">
        <span style="transform: ${type === 'report' ? 'rotate(45deg)' : 'none'};">
          ${label || (type === 'hotspot' ? '!' : '•')}
        </span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-flood-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, type === 'report' ? size : size / 2],
    popupAnchor: [0, -(size / 2) - 6],
  });
};

export const FloodMap: React.FC<FloodMapProps> = ({
  hotspots,
  reports,
  selectedHotspotId,
  focusCoordinates,
  focusZoom = 15,
  onSelectHotspot,
  onSelectReport,
  heightClass = 'h-[520px]',
  showLegendOverlay = true,
  showSectorControls = true,
}) => {
  const [activeLayer, setActiveLayer] = useState<'all' | 'hotspots' | 'reports'>('all');
  const [mapCenter, setMapCenter] = useState<[number, number]>(focusCoordinates || [6.9271, 79.8653]);
  const [zoomLevel, setZoomLevel] = useState(focusCoordinates ? focusZoom : 13);
  const [showRadiusCircles, setShowRadiusCircles] = useState(true);
  const [mobileLegendOpen, setMobileLegendOpen] = useState(false);

  const validHotspots = hotspots.filter((hs) => validateCoordinates(hs.lat, hs.lng));
  const validReports = reports.filter((rep) => validateCoordinates(rep.lat, rep.lng));

  const sectors: Array<{ name: string; center: [number, number]; zoom: number }> = [
    { name: 'Colombo Metro', center: [6.9271, 79.8653], zoom: 13 },
    { name: 'Maradana', center: [6.9271, 79.8653], zoom: 15 },
    { name: 'Kolonnawa', center: [6.9360, 79.8850], zoom: 15 },
    { name: 'Wellawatte', center: [6.8745, 79.8600], zoom: 15 },
    { name: 'Dematagoda', center: [6.9380, 79.8780], zoom: 15 },
    { name: 'Borella', center: [6.9110, 79.8770], zoom: 15 },
    { name: 'Nugegoda', center: [6.8710, 79.8980], zoom: 15 },
  ];

  useEffect(() => {
    if (focusCoordinates && validateCoordinates(focusCoordinates[0], focusCoordinates[1])) {
      setMapCenter(focusCoordinates);
      setZoomLevel(focusZoom);
    }
  }, [focusCoordinates?.[0], focusCoordinates?.[1], focusZoom]);

  useEffect(() => {
    if (selectedHotspotId) {
      const match = validHotspots.find((h) => h.id === selectedHotspotId);
      if (match) {
        setMapCenter([match.lat, match.lng]);
        setZoomLevel(15);
      }
    }
  }, [selectedHotspotId, validHotspots]);

  return (
    <div className={`relative w-full ${heightClass} rounded-lg overflow-hidden border border-[#E5E5E2] bg-[#EEEEEB] flex flex-col`}>
      {/* Sector Quick-Focus Ribbon */}
      {showSectorControls && (
        <div className="absolute top-3 left-3 z-500 bg-white/95 backdrop-blur-md p-1.5 rounded-md border border-[#E5E5E2] shadow-sm flex items-center gap-1 overflow-x-auto max-w-[calc(100%-24px)] md:max-w-[calc(100%-290px)]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#666666] px-2 flex items-center gap-1 shrink-0 font-mono">
            <Crosshair className="w-3 h-3 text-[#171717]" />
            Sectors:
          </span>
          {sectors.map((sec) => (
            <button
              key={sec.name}
              type="button"
              onClick={() => {
                setMapCenter(sec.center);
                setZoomLevel(sec.zoom);
              }}
              className="px-2.5 py-1 text-[11px] font-medium text-[#171717] hover:bg-[#EEEEEB] rounded-sm transition-colors shrink-0 whitespace-nowrap"
            >
              {sec.name}
            </button>
          ))}
        </div>
      )}

      {/* Map Container */}
      <MapContainer
        center={mapCenter}
        zoom={zoomLevel}
        zoomControl={false}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <ZoomControl position="bottomright" />
        <MapRecenter center={mapCenter} zoom={zoomLevel} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* 500m Hotspot Clustering Radius Circles */}
        {showRadiusCircles &&
          (activeLayer === 'all' || activeLayer === 'hotspots') &&
          validHotspots.map((hs) => {
            const circleColor =
              hs.riskLevel === 'HIGH' ? '#DC2626' : hs.riskLevel === 'MEDIUM' ? '#D97706' : '#15803D';
            return (
              <Circle
                key={`circle-${hs.id}`}
                center={[hs.lat, hs.lng]}
                radius={500}
                pathOptions={{
                  color: circleColor,
                  fillColor: circleColor,
                  fillOpacity: hs.riskLevel === 'HIGH' ? 0.14 : 0.08,
                  weight: 1.5,
                  dashArray: '4, 6',
                }}
              />
            );
          })}

        {/* Hotspot Markers */}
        {(activeLayer === 'all' || activeLayer === 'hotspots') &&
          validHotspots.map((hs) => (
            <Marker
              key={`hs-${hs.id}`}
              position={[hs.lat, hs.lng]}
              icon={createCustomIcon(hs.riskLevel, 'hotspot', hs.reportCount)}
            >
              <Popup>
                <div className="p-3.5 max-w-[280px]">
                  <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#E5E5E2]">
                    <span className="font-mono text-xs font-bold text-[#171717]">{hs.id}</span>
                    <RiskBadge level={hs.riskLevel} size="sm" />
                  </div>

                  <h4 className="text-sm font-bold text-[#171717] leading-snug mb-0.5">
                    {hs.location}
                  </h4>
                  <p className="text-xs text-[#666666] mb-2 flex items-center gap-1 font-mono">
                    <MapPin className="w-3 h-3 text-[#171717]" />
                    <span>{hs.area} Sector · 500m Cluster</span>
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-[#F5F5F2] border border-[#E5E5E2] p-2 rounded-md mb-2.5 font-mono">
                    <div>
                      <span className="text-[10px] text-[#666666] uppercase block font-sans">Reports</span>
                      <span className="font-bold text-[#171717]">
                        {hs.reportCount} Unique ({hs.verificationStatus === 'VERIFIED' ? 'Verified' : 'Unverified'})
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#666666] uppercase block font-sans">3h Forecast</span>
                      <span className="font-bold text-[#171717]">
                        {hs.rainfallSource === 'MISSING' ? 'Unavailable' : `${hs.forecastRainfallMm} mm`}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#666666] line-clamp-2 italic mb-2.5">
                    "{hs.precaution}"
                  </p>

                  {onSelectHotspot && (
                    <button
                      type="button"
                      onClick={() => onSelectHotspot(hs)}
                      className="w-full py-1.5 px-3 bg-[#171717] hover:bg-black text-white font-medium text-xs rounded-md transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Hotspot Details</span>
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Individual Citizen Report Markers */}
        {(activeLayer === 'all' || activeLayer === 'reports') &&
          validReports.map((rep) => (
            <Marker
              key={`rep-${rep.id}`}
              position={[rep.lat, rep.lng]}
              icon={createCustomIcon(rep.riskLevel, 'report')}
            >
              <Popup>
                <div className="p-3 max-w-[270px]">
                  <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-[#E5E5E2]">
                    <span className="font-mono text-xs font-bold text-[#171717]">{rep.id}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider border ${
                        rep.verificationStatus === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : rep.verificationStatus === 'REJECTED'
                          ? 'bg-[#EEEEEB] text-[#666666] border-[#E5E5E2]'
                          : 'bg-amber-50 text-amber-900 border-amber-200'
                      }`}
                    >
                      {rep.verificationStatus === 'VERIFIED'
                        ? 'Officer Verified'
                        : rep.verificationStatus === 'REJECTED'
                        ? 'Rejected'
                        : 'Citizen — Unverified'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-[#171717] leading-tight mb-1">
                    {rep.location}
                  </h4>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#666666] mb-2 font-mono">
                    <span>{rep.floodType}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-[#171717]">{rep.waterLevel}</span>
                    {(rep.isPublicRedacted || rep.coordinatePrecision === 'APPROX_100M_GRID') && (
                      <span className="text-[9px] bg-[#F5F5F2] border border-[#E5E5E2] text-[#666666] px-1.5 py-0.5 rounded-sm">
                        ~100m Grid
                      </span>
                    )}
                  </div>

                  {hasReportPhotoEvidence(rep) && (
                    <div className="mb-2 rounded-md overflow-hidden h-24 border border-[#E5E5E2]">
                      <ReportEvidenceImage
                        report={rep}
                        compact
                        className="w-full h-24 object-cover"
                      />
                    </div>
                  )}

                  <p className="text-[11px] text-[#666666] mb-2 line-clamp-2">
                    {rep.description}
                  </p>

                  {onSelectReport && (
                    <button
                      type="button"
                      onClick={() => onSelectReport(rep)}
                      className="w-full py-1.5 px-3 bg-[#171717] hover:bg-black text-white font-medium text-xs rounded-md transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>View Full Report</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {/* Overlaid Map Legend & Layer Filter */}
      {showLegendOverlay && (
        <>
          <div className="hidden md:block absolute top-3 right-3 z-500 max-w-[260px] pointer-events-auto">
            <MapLegend
              activeLayer={activeLayer}
              onLayerChange={setActiveLayer}
            />
          </div>

          <div className="md:hidden absolute top-14 right-3 z-500 flex flex-col items-end gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => setMobileLegendOpen(!mobileLegendOpen)}
              className="bg-white/95 backdrop-blur-sm border border-[#E5E5E2] text-[#171717] text-[11px] font-semibold px-2.5 py-1.5 rounded-md shadow-sm flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-[#171717]" />
              <span>{mobileLegendOpen ? 'Hide Legend' : 'Layers & Legend'}</span>
            </button>
            {mobileLegendOpen && (
              <div className="max-w-[250px]">
                <MapLegend
                  activeLayer={activeLayer}
                  onLayerChange={setActiveLayer}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Bottom Bar: Radius toggle & Center Reset */}
      <div className="absolute bottom-3 left-3 z-500 flex flex-wrap items-center gap-2 max-w-[calc(100%-70px)]">
        <button
          type="button"
          onClick={() => {
            setMapCenter([6.9271, 79.8653]);
            setZoomLevel(13);
          }}
          className="bg-white/95 backdrop-blur-sm border border-[#E5E5E2] text-[#171717] text-xs font-semibold py-1.5 px-3 rounded-md shadow-sm hover:bg-[#EEEEEB] transition-colors flex items-center gap-1.5"
        >
          <Navigation className="w-3.5 h-3.5 text-[#171717]" />
          <span>Reset Colombo View</span>
        </button>

        <button
          type="button"
          onClick={() => setShowRadiusCircles(!showRadiusCircles)}
          className={`py-1.5 px-3 text-xs font-semibold rounded-md shadow-sm transition-colors flex items-center gap-1.5 border ${
            showRadiusCircles
              ? 'bg-[#171717] border-[#171717] text-white'
              : 'bg-white/95 border-[#E5E5E2] text-[#666666] hover:bg-[#EEEEEB]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>500m Buffers: {showRadiusCircles ? 'ON' : 'OFF'}</span>
        </button>

        {validHotspots.length === 0 && validReports.length === 0 && (
          <div className="bg-white/95 backdrop-blur-sm border border-[#E5E5E2] text-[#666666] text-xs font-medium py-1.5 px-3 rounded-md shadow-sm flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#666666]" />
            <span>No active flood hotspots or reports recorded on the map yet.</span>
          </div>
        )}
      </div>
    </div>
  );
};
