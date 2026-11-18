/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FloodReport } from '../../utils/floodLogic';
import { RiskBadge } from './RiskBadge';
import { Clock, Droplets, ChevronRight } from 'lucide-react';

interface IncidentCardProps {
  report: FloodReport;
  onSelect: (report: FloodReport) => void;
  isSelected?: boolean;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  report,
  onSelect,
  isSelected = false,
}) => {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const statusLabel = report.incidentStatus || report.verificationStatus;

  return (
    <div
      onClick={() => onSelect(report)}
      className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer bg-white ${
        isSelected
          ? 'border-[#171717] ring-1 ring-[#171717]'
          : 'border-[#E5E5E2] hover:border-[#171717]/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono font-semibold text-[#171717]">
            {report.id}
          </span>
          <span className="text-[#666666]" aria-hidden="true">·</span>
          <span className="text-[11px] text-[#666666] flex items-center gap-1 font-mono tabular-nums">
            <Clock className="w-3 h-3 text-[#666666]" />
            {formatTime(report.timestamp)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <RiskBadge level={report.riskLevel} size="sm" />
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
              statusLabel === 'Alert Issued'
                ? 'bg-red-50 text-red-800 border-red-200'
                : statusLabel === 'Resolved'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : statusLabel === 'Verified'
                ? 'bg-[#171717] text-white border-[#171717]'
                : statusLabel === 'Rejected'
                ? 'bg-[#EEEEEB] text-[#666666] border-[#E5E5E2]'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <h4 className="text-sm font-semibold text-[#171717] leading-snug mb-1.5 line-clamp-1">
        {report.location}
      </h4>

      <p className="text-xs text-[#666666] line-clamp-2 mb-3 leading-relaxed">
        {report.description}
      </p>

      <div className="flex items-center justify-between text-xs pt-2.5 border-t border-[#E5E5E2] text-[#666666]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center gap-1 text-[#171717] font-medium">
            <Droplets className="w-3.5 h-3.5 text-[#666666]" />
            <span>{report.waterLevel}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-[11px] truncate max-w-[140px]">{report.floodType}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(report);
          }}
          className="text-xs font-semibold text-[#171717] hover:opacity-75 flex items-center gap-0.5 group shrink-0"
        >
          <span>View Details</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
