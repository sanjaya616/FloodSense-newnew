/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Layers, Info } from 'lucide-react';

interface MapLegendProps {
  className?: string;
  showLayerToggle?: boolean;
  activeLayer?: 'all' | 'hotspots' | 'reports';
  onLayerChange?: (layer: 'all' | 'hotspots' | 'reports') => void;
}

export const MapLegend: React.FC<MapLegendProps> = ({
  className = '',
  showLayerToggle = true,
  activeLayer = 'all',
  onLayerChange,
}) => {
  return (
    <div
      className={`bg-white/95 backdrop-blur-md p-3.5 rounded-lg border border-[#E5E5E2] shadow-sm text-xs text-[#171717] min-w-[270px] ${className}`}
    >
      <div className="flex items-center justify-between gap-4 pb-2 mb-2.5 border-b border-[#E5E5E2]">
        <span className="font-bold text-[#171717] uppercase tracking-wider text-[10px] flex items-center gap-1.5 whitespace-nowrap">
          <Layers className="w-3.5 h-3.5 text-[#171717]" />
          <span>Map Legend &amp; Layers</span>
        </span>
        <span className="text-[10px] text-[#666666] font-mono whitespace-nowrap">
          Colombo Metro
        </span>
      </div>

      {showLayerToggle && onLayerChange && (
        <div className="mb-3 grid grid-cols-3 gap-1 bg-[#F5F5F2] border border-[#E5E5E2] p-1 rounded-md">
          <button
            type="button"
            onClick={() => onLayerChange('all')}
            className={`py-1 text-[11px] font-semibold rounded-sm transition-colors ${
              activeLayer === 'all'
                ? 'bg-[#171717] text-white'
                : 'text-[#666666] hover:text-[#171717]'
            }`}
          >
            All Pins
          </button>
          <button
            type="button"
            onClick={() => onLayerChange('hotspots')}
            className={`py-1 text-[11px] font-semibold rounded-sm transition-colors ${
              activeLayer === 'hotspots'
                ? 'bg-[#171717] text-white'
                : 'text-[#666666] hover:text-[#171717]'
            }`}
          >
            Hotspots
          </button>
          <button
            type="button"
            onClick={() => onLayerChange('reports')}
            className={`py-1 text-[11px] font-semibold rounded-sm transition-colors ${
              activeLayer === 'reports'
                ? 'bg-[#171717] text-white'
                : 'text-[#666666] hover:text-[#171717]'
            }`}
          >
            Reports
          </button>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-red-600 ring-2 ring-red-100 shrink-0" />
          <div className="flex items-center justify-between gap-3 w-full">
            <span className="font-semibold text-[#171717] whitespace-nowrap">High Risk Zone</span>
            <span className="text-[10px] text-[#666666] font-mono whitespace-nowrap">≥3 reports / severe</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-100 shrink-0" />
          <div className="flex items-center justify-between gap-3 w-full">
            <span className="font-semibold text-[#171717] whitespace-nowrap">Medium Risk Zone</span>
            <span className="text-[10px] text-[#666666] font-mono whitespace-nowrap">≥2 reports / mod.</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-emerald-600 ring-2 ring-emerald-100 shrink-0" />
          <div className="flex items-center justify-between gap-3 w-full">
            <span className="font-semibold text-[#171717] whitespace-nowrap">Low Risk Area</span>
            <span className="text-[10px] text-[#666666] font-mono whitespace-nowrap">1 report / clear</span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-[#E5E5E2] flex items-start gap-1.5 text-[10px] text-[#666666] leading-tight">
        <Info className="w-3 h-3 text-[#171717] shrink-0 mt-0.5" />
        <span>Live GIS layer centered on Colombo, Sri Lanka. Click markers for incident details.</span>
      </div>
    </div>
  );
};
