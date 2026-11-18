/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { useFlood } from '../../context/FloodContext';

export const CitizenNotificationsPage: React.FC = () => {
  const { notifications, markAllNotificationsAsRead, markNotificationAsRead } = useFlood();
  const [filterType, setFilterType] = useState<'ALL' | 'UNREAD' | 'HIGH'>('ALL');

  const filtered = notifications.filter((item) => {
    if (filterType === 'UNREAD') return item.unread;
    if (filterType === 'HIGH') return item.severity === 'HIGH';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#666666] mb-1.5">
            <NavLink to="/citizen" className="hover:text-[#171717] transition-colors">
              Citizen Portal
            </NavLink>
            <ChevronRight className="w-3 h-3 text-[#A3A3A3]" />
            <span className="text-[#171717] font-semibold">Notifications</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
            Citizen Alert &amp; Update Center
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1.5">
            Real-time status updates on your submitted reports and official Colombo flood advisories.
          </p>
        </div>

        <button
          type="button"
          onClick={markAllNotificationsAsRead}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-white border border-[#E5E5E2] text-[#171717] hover:bg-[#EEEEEB] text-xs font-semibold self-start sm:self-center cursor-pointer transition-colors"
        >
          <CheckCheck className="w-4 h-4 text-[#171717]" />
          <span>Mark All Read</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5E5E2] pb-3">
        {[
          { id: 'ALL', label: `All Alerts (${notifications.length})` },
          { id: 'UNREAD', label: `Unread (${notifications.filter((n) => n.unread).length})` },
          { id: 'HIGH', label: 'Severe Warnings' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              filterType === tab.id
                ? 'bg-[#171717] text-white'
                : 'bg-white border border-[#E5E5E2] text-[#666666] hover:bg-[#EEEEEB] hover:text-[#171717]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification Stream */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-md border border-[#E5E5E2] text-center space-y-2">
            <Bell className="w-10 h-10 text-[#A3A3A3] mx-auto" />
            <p className="text-sm font-semibold text-[#171717]">No notifications in this filter</p>
            <p className="text-xs text-[#666666]">All alerts have been reviewed or marked as read.</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => markNotificationAsRead(item.id)}
              className={`p-5 rounded-md border transition-colors cursor-pointer ${
                item.unread
                  ? 'bg-white border-[#171717]'
                  : 'bg-white border-[#E5E5E2] hover:border-[#171717]/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      item.severity === 'HIGH'
                        ? 'bg-red-600'
                        : item.severity === 'MEDIUM'
                        ? 'bg-amber-500'
                        : 'bg-[#171717]'
                    }`}
                  />
                  <h3 className="text-xs sm:text-sm font-semibold text-[#171717] truncate">
                    {item.title}
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-[#666666] shrink-0">{item.time}</span>
              </div>

              <p className="text-xs text-[#666666] leading-relaxed pl-4">{item.description}</p>

              <div className="flex items-center justify-between pl-4 pt-2.5 mt-2.5 border-t border-[#E5E5E2] text-[10px] text-[#666666]">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717]">
                    {item.type}
                  </span>
                  {item.location && <span>Location: {item.location}</span>}
                </div>
                {item.unread && <span className="font-mono font-semibold uppercase tracking-wider text-[#171717]">Unread</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
