/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import {
  Menu,
  Bell,
  Search,
  Clock,
  ChevronRight,
  CheckCheck,
  X,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';

interface TopbarProps {
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const {
    authenticatedRole,
    userProfile,
    notifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
    searchQuery,
    setSearchQuery,
    isFirebaseAvailable,
  } = useFlood();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
      case '/officer':
      case '/officer/overview':
        return { title: 'Flood Monitoring Overview', breadcrumb: 'Overview' };
      case '/officer/incidents':
        return { title: 'Citizen Incident Triage Queue', breadcrumb: 'Incident Queue' };
      case '/map':
      case '/officer/map':
        return { title: 'Live Flood GIS Map', breadcrumb: 'Live Map' };
      case '/report':
      case '/officer/report':
        return { title: 'Report Flood Incident', breadcrumb: 'Field Reporting' };
      case '/hotspots':
      case '/officer/hotspots':
        return { title: 'Flood Hotspot Clusters', breadcrumb: 'Hotspots' };
      case '/predictions':
      case '/officer/predictions':
        return { title: 'Predictive Flood Risk Analysis', breadcrumb: 'Risk Predictions' };
      case '/analytics':
      case '/officer/analytics':
        return { title: 'Flood Intelligence & Analytics', breadcrumb: 'Analytics' };
      case '/blockchain':
      case '/officer/blockchain':
        return { title: 'SHA-256 Audit Chain Registry', breadcrumb: 'Audit Chain' };
      case '/methodology':
      case '/officer/methodology':
        return { title: 'System Methodology & Data Transparency', breadcrumb: 'Methodology' };
      case '/settings':
      case '/officer/settings':
        return { title: 'System & Role Settings', breadcrumb: 'Settings' };
      default:
        return { title: 'Disaster Management Console', breadcrumb: 'Console' };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <header className="h-16 bg-white border-b border-[#E5E5E2] px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left zone: Mobile toggle & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-sm text-[#666666] hover:text-[#171717] hover:bg-[#EEEEEB] transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-[#666666] font-medium">
            <span>FloodSense</span>
            <ChevronRight className="w-3 h-3 text-[#666666]" />
            <span className="text-[#171717] font-semibold truncate">{pageInfo.breadcrumb}</span>
          </div>
          <h1 className="text-sm sm:text-base font-bold text-[#171717] truncate hidden sm:block">
            {pageInfo.title}
          </h1>
        </div>
      </div>

      {/* Middle zone: Live search input */}
      <div className="hidden md:flex items-center flex-1 max-w-sm relative">
        <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          placeholder="Search locations, hotspots, reports..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#F5F5F2] focus:bg-white border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666] focus:outline-none focus:border-[#171717] transition-colors font-sans"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#171717]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Right zone: Cloud status, Clock, Notification Bell, User profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Cloud Firestore Indicator */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717] text-[10px] font-semibold font-mono">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isFirebaseAvailable ? 'bg-emerald-600' : 'bg-amber-600'
            }`}
          />
          <span>{isFirebaseAvailable ? 'FIRESTORE CONNECTED' : 'FIREBASE UNCONFIGURED'}</span>
        </div>

        {/* Live Date Time */}
        <div className="hidden 2xl:flex items-center gap-1.5 text-xs font-mono tabular-nums text-[#666666] bg-[#F5F5F2] px-2.5 py-1 rounded-sm border border-[#E5E5E2]">
          <Clock className="w-3.5 h-3.5 text-[#666666]" />
          <span>
            {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-sm text-[#666666] hover:text-[#171717] hover:bg-[#EEEEEB] transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-600 text-white font-mono text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-[#E5E5E2] overflow-hidden z-50">
              <div className="p-3.5 bg-[#F5F5F2] border-b border-[#E5E5E2] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#171717] uppercase tracking-wider">
                    Emergency Alerts &amp; Log
                  </span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold bg-[#171717] text-white px-1.5 py-0.5 rounded-sm font-mono">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsAsRead}
                    className="text-[11px] font-semibold text-[#171717] hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E5E2]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#666666]">
                    No active emergency alerts
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => markNotificationAsRead(item.id)}
                      className={`p-3 text-xs transition-colors cursor-pointer ${
                        item.unread ? 'bg-[#F5F5F2] hover:bg-[#EEEEEB]' : 'hover:bg-[#F5F5F2]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-bold text-[#171717]">{item.title}</span>
                        <span className="text-[10px] text-[#666666] font-mono shrink-0">
                          {item.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#666666] leading-relaxed mb-1">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-white border border-[#E5E5E2] text-[#171717]">
                          {item.type}
                        </span>
                        {item.unread && (
                          <span className="text-[10px] font-semibold text-[#171717]">
                            Unread
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2.5 bg-[#F5F5F2] border-t border-[#E5E5E2] text-center">
                <NavLink
                  to="/officer/analytics"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs font-semibold text-[#171717] hover:underline"
                >
                  View Historical Disaster Incident Log →
                </NavLink>
              </div>
            </div>
          )}
        </div>

        {/* View Citizen Portal Button */}
        <NavLink
          to="/citizen"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#F5F5F2] hover:bg-[#EEEEEB] text-[#171717] text-xs font-semibold border border-[#E5E5E2] transition-colors whitespace-nowrap"
        >
          <span>Citizen Portal</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#666666]" />
        </NavLink>

        {/* User Avatar Mini Profile */}
        <NavLink
          to="/officer/settings"
          className="flex items-center gap-2 pl-2 border-l border-[#E5E5E2] group"
        >
          {userProfile.avatarUrl ? (
            <img
              src={userProfile.avatarUrl}
              alt={userProfile.name || 'Officer'}
              className="w-8 h-8 rounded-full object-cover border border-[#E5E5E2]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#171717] text-white flex items-center justify-center font-bold text-xs">
              {(userProfile.name || 'EO').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="hidden sm:block text-left">
            <span className="text-xs font-bold text-[#171717] block leading-tight">
              {userProfile.name || 'Emergency Officer'}
            </span>
            <span className="text-[10px] text-[#666666] block leading-tight font-medium">
              {authenticatedRole === 'officer' ? 'Officer' : 'Citizen'}
            </span>
          </div>
        </NavLink>
      </div>
    </header>
  );
};
