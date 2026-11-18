/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FloodHotspot } from '../../utils/floodLogic';
import { RiskBadge } from './RiskBadge';
import { RiskGauge } from './RiskGauge';
import { MapPin, Users, CloudRain, ArrowUpRight } from 'lucide-react';

interface HotspotCardProps {
  hotspot: FloodHotspot;
  onViewOnMap?: (hotspot: FloodHotspot) => void;
  onSelectDetails?: (hotspot: FloodHotspot) => void;
}

export const HotspotCard: React.FC<HotspotCardProps> = ({
  hotspot,
  onViewOnMap,
  onSelectDetails,
}) => {
  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#E5E5E2] hover:border-[#171717]/40 transition-colors p-5 flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-xs font-semibold text-[#171717]">
                {hotspot.id}
              </span>
              <RiskBadge level={hotspot.riskLevel} size="sm" />
              <RiskBadge level={hotspot.verificationStatus} size="sm" />
            </div>
            <h3 className="text-base font-bold text-[#171717] leading-tight">
              {hotspot.location}
            </h3>
            <p className="text-xs text-[#666666] flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-[#666666]" />
              <span>{hotspot.area} Municipal Sector</span>
            </p>
          </div>

          <div className="shrink-0">
            <RiskGauge
              score={hotspot.riskScore}
              level={hotspot.riskLevel}
              size={68}
              strokeWidth={6}
              showCategory={false}
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 my-3 p-3 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-xs font-mono tabular-nums">
          <div>
            <span className="text-[10px] text-[#666666] uppercase block font-sans mb-0.5">
              Unique Reports
            </span>
            <span className="font-semibold text-[#171717] flex items-center gap-1">
              <Users className="w-3 h-3 text-[#666666]" />
              <span>{hotspot.reportCount}</span>
              {hotspot.duplicateReportCount ? (
                <span className="text-[10px] text-[#666666] font-normal">
                  (+{hotspot.duplicateReportCount} dup)
                </span>
              ) : null}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-[#666666] uppercase block font-sans mb-0.5">
              3h Rain Forecast
            </span>
            <span className="font-semibold text-[#171717] flex items-center gap-1">
              <CloudRain className="w-3 h-3 text-[#666666]" />
              <span>
                {hotspot.rainfallSource === 'MISSING'
                  ? 'Unavailable'
                  : `${hotspot.forecastRainfallMm} mm`}
              </span>
            </span>
          </div>
          <div>
            <span className="text-[10px] text-[#666666] uppercase block font-sans mb-0.5">
              Coordinates
            </span>
            <span className="font-medium text-[#666666] truncate block text-[11px]">
              {hotspot.lat.toFixed(3)}, {hotspot.lng.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Actionable Precaution */}
        <div className="text-xs text-[#171717] bg-amber-50/70 border border-amber-200 p-3 rounded-md mb-4">
          <span className="font-semibold text-amber-900 block text-[10px] uppercase tracking-wider mb-0.5">
            Operational Recommendation
          </span>
          <p className="line-clamp-2 text-[#171717]/85">{hotspot.precaution}</p>
        </div>
      </div>

      {/* Footer Details */}
      <div className="pt-3 border-t border-[#E5E5E2] flex items-center justify-between text-xs gap-2">
        <div className="text-[#666666] text-[11px] font-mono tabular-nums">
          <span>Active: {formatTime(hotspot.firstReportedTime)}</span>
          <span className="mx-1">→</span>
          <span>{formatTime(hotspot.latestReportedTime)}</span>
        </div>

        <div className="flex items-center gap-2">
          {onViewOnMap && (
            <button
              type="button"
              onClick={() => onViewOnMap(hotspot)}
              className="px-2.5 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#EEEEEB] rounded-md transition-colors flex items-center gap-1"
            >
              <span>Map Pin</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
          {onSelectDetails && (
            <button
              type="button"
              onClick={() => onSelectDetails(hotspot)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#171717] hover:bg-black rounded-md transition-colors"
            >
              Inspect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
