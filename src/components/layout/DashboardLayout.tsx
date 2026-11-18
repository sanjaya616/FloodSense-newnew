/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useFlood } from '../../context/FloodContext';
import { IncidentDetailsModal } from '../common/IncidentDetailsModal';
import { Radio } from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { reports, selectedReportId, setSelectedReportId, weather, isFirebaseAvailable } = useFlood();

  const selectedReport = reports.find((r) => r.id === selectedReportId) || null;

  return (
    <div className="min-h-screen bg-[#F5F5F2] flex text-[#171717]">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Navigation Bar */}
        <Topbar onToggleSidebar={() => setSidebarOpen(true)} />

        {/* Global System Status Banner */}
        <div className="bg-[#181818] text-white px-4 sm:px-6 py-2 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold tracking-wider uppercase text-[10px] text-white">
              Emergency Operations Center
            </span>
            <span className="hidden md:inline text-neutral-500" aria-hidden="true">|</span>
            <span className="hidden md:inline text-neutral-300">
              Colombo Basin Flood Monitoring &amp; Community Early Warning
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-neutral-400 font-mono">
            <span className={`flex items-center gap-1 ${weather.isLive ? 'text-emerald-400' : 'text-amber-300'}`}>
              <Radio className="w-3 h-3" />
              {weather.isLive ? 'Open-Meteo Live' : 'Weather Unavailable'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-neutral-200 font-sans font-medium">
              {isFirebaseAvailable ? 'Cloud Firestore' : 'Firebase Unconfigured'}
            </span>
          </div>
        </div>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Incident Details Modal */}
      {selectedReport && (
        <IncidentDetailsModal
          report={selectedReport}
          onClose={() => setSelectedReportId(null)}
        />
      )}
    </div>
  );
};
