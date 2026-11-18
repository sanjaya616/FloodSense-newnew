/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  colorScheme?: 'primary' | 'danger' | 'warning' | 'success';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  colorScheme = 'primary',
}) => {
  const schemeStyles = {
    primary: {
      iconBg: 'bg-[#F5F5F2] text-[#171717] border border-[#E5E5E2]',
      borderHover: 'hover:border-[#171717]/40',
    },
    danger: {
      iconBg: 'bg-red-50 text-red-700 border border-red-200',
      borderHover: 'hover:border-red-300',
    },
    warning: {
      iconBg: 'bg-amber-50 text-amber-800 border border-amber-200',
      borderHover: 'hover:border-amber-300',
    },
    success: {
      iconBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      borderHover: 'hover:border-emerald-300',
    },
  }[colorScheme];

  return (
    <div
      className={`relative bg-white p-5 rounded-lg border border-[#E5E5E2] transition-colors duration-200 ${schemeStyles.borderHover}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-[#666666] tracking-wider uppercase mb-1.5">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#171717] tracking-tight font-mono tabular-nums">
              {value}
            </span>
          </div>
        </div>
        <div className={`p-2.5 rounded-md shrink-0 ${schemeStyles.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#E5E5E2] flex items-center justify-between text-xs gap-2">
        <span className="text-[#666666] truncate">{subtitle}</span>
        {trend && (
          <div
            className={`flex items-center gap-1 font-medium font-mono tabular-nums shrink-0 ${
              trend.isNeutral
                ? 'text-[#666666]'
                : trend.isPositive
                ? 'text-emerald-700'
                : 'text-red-700'
            }`}
          >
            {trend.isNeutral ? (
              <Minus className="w-3.5 h-3.5" />
            ) : trend.isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>{trend.value}</span>
          </div>
        )}
      </div>
    </div>
  );
};
