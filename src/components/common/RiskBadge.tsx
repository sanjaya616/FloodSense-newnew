/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, ShieldCheck, Clock, XCircle } from 'lucide-react';

interface RiskBadgeProps {
  level: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERIFIED' | 'UNDER REVIEW' | 'REJECTED' | 'CONFIRMED' | 'PENDING';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-[11px] px-2.5 py-1 gap-1.5',
    lg: 'text-xs px-3 py-1.5 gap-2',
  }[size];

  const getStyle = () => {
    switch (level) {
      case 'HIGH':
        return {
          bg: 'bg-red-50 text-red-800 border border-red-200',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />,
          label: 'HIGH RISK',
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-50 text-amber-900 border border-amber-200',
          icon: <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
          label: 'MEDIUM RISK',
        };
      case 'LOW':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />,
          label: 'LOW RISK',
        };
      case 'VERIFIED':
        return {
          bg: 'bg-[#171717] text-white border border-[#171717]',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-white shrink-0" />,
          label: 'VERIFIED',
        };
      case 'UNDER REVIEW':
        return {
          bg: 'bg-[#EEEEEB] text-[#171717] border border-[#E5E5E2]',
          icon: <Clock className="w-3.5 h-3.5 text-[#666666] shrink-0" />,
          label: 'UNDER REVIEW',
        };
      case 'REJECTED':
        return {
          bg: 'bg-rose-50 text-rose-800 border border-rose-200',
          icon: <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />,
          label: 'REJECTED',
        };
      case 'CONFIRMED':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />,
          label: 'CONFIRMED',
        };
      case 'PENDING':
        return {
          bg: 'bg-amber-50 text-amber-900 border border-amber-200',
          icon: <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
          label: 'PENDING',
        };
      default:
        return {
          bg: 'bg-[#F5F5F2] text-[#171717] border border-[#E5E5E2]',
          icon: null,
          label: level,
        };
    }
  };

  const { bg, icon, label } = getStyle();

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-sm uppercase tracking-wider whitespace-nowrap ${bg} ${sizeClasses} ${className}`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
};
