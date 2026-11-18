/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  PlusCircle,
  Flame,
  Activity,
  BarChart3,
  Link2,
  Settings,
  LogOut,
  X,
  BookOpen,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { authenticatedRole, userProfile, logout } = useFlood();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    onClose();
    navigate('/login');
  };

  const navItems = [
    { name: 'Overview', path: '/officer/overview', legacyPath: '/', icon: LayoutDashboard },
    { name: 'Incident Review Queue', path: '/officer/incidents', icon: ClipboardCheck, badge: 'Triage' },
    { name: 'Live Flood Map', path: '/officer/map', legacyPath: '/map', icon: Map },
    { name: 'Report Flood', path: '/officer/report', legacyPath: '/report', icon: PlusCircle, badge: 'Field' },
    { name: 'Flood Hotspots', path: '/officer/hotspots', legacyPath: '/hotspots', icon: Flame },
    { name: 'Risk Predictions', path: '/officer/predictions', legacyPath: '/predictions', icon: Activity },
    { name: 'Analytics', path: '/officer/analytics', legacyPath: '/analytics', icon: BarChart3 },
    { name: 'Blockchain Audit Chain', path: '/officer/blockchain', legacyPath: '/blockchain', icon: Link2, badge: 'SHA-256' },
    { name: 'Methodology & Data', path: '/officer/methodology', legacyPath: '/methodology', icon: BookOpen },
    { name: 'Settings', path: '/officer/settings', legacyPath: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container (#202020 Dark EOC Charcoal) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#202020] text-neutral-300 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } border-r border-white/10`}
      >
        {/* Brand Header */}
        <div className="overflow-y-auto">
          <div className="h-16 px-6 flex items-center justify-between border-b border-white/10">
            <NavLink
              to="/"
              onClick={onClose}
              className="group"
            >
              <span className="font-sans font-extrabold text-sm tracking-[0.22em] uppercase text-white block">
                FLOODSENSE
              </span>
              <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider block mt-0.5">
                Officer EOC
              </span>
            </NavLink>

            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-sm text-neutral-400 hover:text-white hover:bg-white/10"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Operations Center
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.legacyPath && location.pathname === item.legacyPath);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center justify-between px-3 py-2 rounded-sm text-xs font-semibold transition-colors group ${
                    isActive
                      ? 'bg-white text-[#171717]'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-[#171717]' : 'text-neutral-400 group-hover:text-white'
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono font-medium shrink-0 ${
                        isActive
                          ? 'bg-[#171717] text-white'
                          : 'bg-white/5 text-neutral-400 group-hover:text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Switcher */}
        <div className="p-4 border-t border-white/10 bg-[#181818] space-y-3">
          <NavLink
            to="/officer/settings"
            onClick={onClose}
            className="flex items-center gap-3 p-2 rounded-sm hover:bg-white/5 transition-colors group"
          >
            <div className="relative shrink-0">
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt={userProfile.name || 'Officer'}
                  className="w-9 h-9 rounded-full object-cover border border-white/20"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white text-[#171717] flex items-center justify-center font-bold text-xs">
                  {(userProfile.name || 'EO').slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {userProfile.name || 'Emergency Officer'}
              </p>
              <p className="text-[11px] text-neutral-400 truncate">
                {authenticatedRole === 'officer' ? 'Emergency Officer' : 'Citizen Reporter'}
              </p>
            </div>
          </NavLink>

          <div className="space-y-1.5">
            <NavLink
              to="/citizen"
              onClick={onClose}
              className="w-full flex items-center justify-between px-3 py-2 rounded-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold transition-colors group"
            >
              <span>View Citizen Portal</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </NavLink>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-3 py-2 rounded-sm bg-transparent hover:bg-red-950/50 border border-white/10 hover:border-red-800/60 text-neutral-400 hover:text-red-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>Sign Out</span>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-500">
            <span className="font-mono">FloodSense EOC</span>
            <span className="text-neutral-300 font-medium">Colombo Metro</span>
          </div>
        </div>
      </aside>
    </>
  );
};
