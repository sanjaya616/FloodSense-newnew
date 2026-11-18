/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface RiskGaugeProps {
  score: number; // 0 - 100
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  size?: number;
  strokeWidth?: number;
  label?: string;
  showCategory?: boolean;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({
  score,
  level,
  size = 120,
  strokeWidth = 8,
  label,
  showCategory = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = () => {
    switch (level) {
      case 'HIGH':
        return {
          stroke: '#DC2626',
          text: 'text-red-700',
        };
      case 'MEDIUM':
        return {
          stroke: '#D97706',
          text: 'text-amber-800',
        };
      case 'LOW':
      default:
        return {
          stroke: '#15803D',
          text: 'text-emerald-800',
        };
    }
  };

  const colors = getColor();

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E5E2"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Filled progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold font-mono tabular-nums text-[#171717] tracking-tight leading-none">
            {score}
          </span>
          <span className="text-[10px] text-[#666666] uppercase tracking-wider font-medium mt-0.5">
            / 100
          </span>
        </div>
      </div>

      {showCategory && (
        <div className="mt-2 text-center">
          <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
            {level} RISK
          </span>
          {label && <p className="text-[11px] text-[#666666] mt-0.5">{label}</p>}
        </div>
      )}
    </div>
  );
};
