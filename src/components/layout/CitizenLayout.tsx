/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  PlusCircle,
  Map,
  FileText,
  ShieldCheck,
  Bell,
  Menu,
  X,
  User,
  LogOut,
  ChevronDown,
  ShieldAlert,
  ArrowRight,
  CloudRain,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';

export const CitizenLayout: React.FC = () => {
  const {
    authenticatedRole,
    userProfile,
    logout,
    notifications,
    markAllNotificationsAsRead,
    weather,
    isAuthenticated,
  } = useFlood();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  const unreadNotifications = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(e.target as Node)) {
        setNotificationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGoToOfficerPortal = () => {
    setProfileDropdownOpen(false);
    if (isAuthenticated && authenticatedRole === 'officer') {
      navigate('/officer/overview');
    } else {
      navigate('/login?portal=officer');
    }
  };

  const handleLogout = async () => {
    await logout();
    setProfileDropdownOpen(false);
    navigate('/login');
  };

  const navLinks = [
    { label: 'Citizen Portal', path: '/citizen', icon: User },
    { label: 'Report a Flood', path: '/citizen/report', icon: PlusCircle, isCta: true },
    { label: 'My Reports', path: '/citizen/reports', icon: FileText },
    { label: 'Public Flood Map', path: '/map-public', icon: Map },
    { label: 'Safety Guidelines', path: '/safety', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F2] flex flex-col text-[#171717] overflow-x-hidden">
      {/* Emergency Advisory Strip */}
      <div className="bg-[#181818] text-white text-xs px-4 py-2 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-semibold text-white shrink-0">Colombo Urban Advisory:</span>
            <span className="text-neutral-300 truncate min-w-0">
              {weather.condition} ·{' '}
              {weather.expected3hRainfallMm !== null
                ? `Forecast ${weather.expected3hRainfallMm}mm next 3 hrs`
                : '3h forecast unavailable'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-neutral-300">
            <span className="hidden sm:inline font-mono">DMC Hotline: 117</span>
            <span className="hidden md:inline font-mono">Suwa Seriya: 1990</span>
            <NavLink
              to={authenticatedRole === 'officer' ? '/officer/overview' : '/login?portal=officer'}
              className="text-white hover:underline font-semibold flex items-center gap-1"
            >
              <span>{authenticatedRole === 'officer' ? 'Return to Officer EOC' : 'Officer Sign In'}</span>
              <ArrowRight className="w-3 h-3" />
            </NavLink>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E5E2]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Wordmark */}
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
            <span className="font-sans font-extrabold text-sm sm:text-base tracking-[0.2em] uppercase text-[#171717] whitespace-nowrap">
              FLOODSENSE
            </span>
          </NavLink>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;

              if (link.isCta) {
                return (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    className="mx-1.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm bg-[#171717] hover:bg-black text-white font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{link.label}</span>
                  </NavLink>
                );
              }

              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#EEEEEB] text-[#171717]'
                      : 'text-[#666666] hover:text-[#171717] hover:bg-[#F5F5F2]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#171717]' : 'text-[#666666]'}`} />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right Action Icons: Weather, Notifications, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden 2xl:flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717] text-xs whitespace-nowrap shrink-0">
              <CloudRain className="w-3.5 h-3.5 text-[#171717] shrink-0" />
              <span className="font-mono font-semibold tabular-nums">
                {weather.currentTempC !== null ? `${weather.currentTempC}°C` : '--°C'}
              </span>
              <span className="text-[#666666]">|</span>
              <span className="font-mono text-[#666666] tabular-nums">
                {weather.currentRainfallMm !== null ? `${weather.currentRainfallMm}mm` : 'Unavailable'}
              </span>
            </div>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notificationMenuRef}>
              <button
                type="button"
                onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
                className="relative p-2 rounded-sm text-[#666666] hover:text-[#171717] hover:bg-[#EEEEEB] transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white font-mono">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {notificationDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-88 bg-white rounded-lg shadow-xl border border-[#E5E5E2] overflow-hidden z-50">
                  <div className="p-3.5 bg-[#F5F5F2] border-b border-[#E5E5E2] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#171717] uppercase tracking-wider">
                      Citizen Alerts &amp; Updates
                    </span>
                    {unreadNotifications > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsAsRead}
                        className="text-[11px] font-semibold text-[#171717] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-[#E5E5E2]">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#666666]">
                        No active notifications or flood advisories.
                      </div>
                    ) : (
                      notifications.slice(0, 4).map((item) => (
                        <div key={item.id} className="p-3 hover:bg-[#F5F5F2] transition-colors text-xs">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-[#171717] truncate">{item.title}</span>
                            <span className="text-[10px] font-mono text-[#666666] shrink-0">
                              {item.time}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#666666] line-clamp-2">{item.description}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 bg-[#F5F5F2] border-t border-[#E5E5E2] text-center">
                    <NavLink
                      to="/citizen/notifications"
                      onClick={() => setNotificationDropdownOpen(false)}
                      className="text-xs font-semibold text-[#171717] hover:underline"
                    >
                      View All Alerts &amp; Status Notifications →
                    </NavLink>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            {isAuthenticated ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-sm hover:bg-[#F5F5F2] transition-colors"
                >
                  {userProfile.avatarUrl ? (
                    <img
                      src={userProfile.avatarUrl}
                      alt={userProfile.name || 'User'}
                      className="w-8 h-8 rounded-full object-cover border border-[#E5E5E2]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#171717] text-white flex items-center justify-center font-bold text-xs">
                      {(userProfile.name || 'CR').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="hidden xl:block text-left">
                    <span className="text-xs font-bold text-[#171717] block leading-tight">
                      {userProfile.name || 'Citizen Reporter'}
                    </span>
                    <span className="text-[10px] text-[#666666] block leading-tight font-medium">
                      {authenticatedRole === 'officer' ? 'Emergency Officer' : 'Citizen Reporter'}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#666666]" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-[#E5E5E2] p-2 z-50">
                    <div className="p-3 bg-[#F5F5F2] rounded-md mb-1 border border-[#E5E5E2]">
                      <p className="text-xs font-bold text-[#171717]">{userProfile.name}</p>
                      <p className="text-[11px] text-[#666666] truncate">{userProfile.email}</p>
                      <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-sm bg-[#171717] text-white">
                        {authenticatedRole === 'officer' ? 'Emergency Officer' : 'Verified Citizen Account'}
                      </span>
                    </div>

                    <div className="space-y-0.5 py-1">
                      <NavLink
                        to="/citizen/profile"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#171717] rounded-md hover:bg-[#F5F5F2]"
                      >
                        <User className="w-4 h-4 text-[#666666]" />
                        <span>My Profile &amp; Account</span>
                      </NavLink>
                      <NavLink
                        to="/citizen/reports"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#171717] rounded-md hover:bg-[#F5F5F2]"
                      >
                        <FileText className="w-4 h-4 text-[#666666]" />
                        <span>My Flood Reports</span>
                      </NavLink>
                      <NavLink
                        to="/citizen/notifications"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#171717] rounded-md hover:bg-[#F5F5F2]"
                      >
                        <Bell className="w-4 h-4 text-[#666666]" />
                        <span>Notification Center</span>
                      </NavLink>
                      {authenticatedRole === 'officer' && (
                        <button
                          type="button"
                          onClick={handleGoToOfficerPortal}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#171717] rounded-md hover:bg-[#EEEEEB]"
                        >
                          <div className="flex items-center gap-2.5">
                            <ShieldAlert className="w-4 h-4 text-[#171717]" />
                            <span>Open Officer EOC</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="border-t border-[#E5E5E2] pt-1 mt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-700 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <NavLink
                  to="/login"
                  className="px-2.5 py-1.5 text-xs font-semibold text-[#666666] hover:text-[#171717] transition-colors whitespace-nowrap"
                >
                  Log In
                </NavLink>
                <NavLink
                  to="/register"
                  className="px-3.5 py-1.5 rounded-sm bg-[#171717] hover:bg-black text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Register
                </NavLink>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-sm text-[#666666] hover:text-[#171717] hover:bg-[#EEEEEB]"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-[#E5E5E2] px-4 pt-2 pb-6 space-y-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-semibold ${
                    link.isCta
                      ? 'bg-[#171717] text-white'
                      : isActive
                      ? 'bg-[#EEEEEB] text-[#171717]'
                      : 'text-[#666666] hover:bg-[#F5F5F2]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}

            <div className="pt-2 border-t border-[#E5E5E2] flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleGoToOfficerPortal();
                }}
                className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#171717] bg-[#F5F5F2] border border-[#E5E5E2] rounded-sm"
              >
                <span>{authenticatedRole === 'officer' ? 'Open Officer EOC' : 'Officer Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Outlet Body */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-[#181818] text-neutral-400 text-xs border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3 md:col-span-1">
              <span className="font-sans font-extrabold text-sm tracking-[0.2em] uppercase text-white block">
                FLOODSENSE
              </span>
              <p className="text-neutral-400 text-xs leading-relaxed">
                Empowering Colombo citizens and emergency services with real-time flood monitoring,
                early warning AI intelligence, and crowd-sourced ground verification.
              </p>
              <div className="text-[11px] text-neutral-300 font-mono">
                Colombo Basin Early Warning Platform
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">
                Quick Navigation
              </h4>
              <ul className="space-y-2">
                <li>
                  <NavLink to="/citizen" className="hover:text-white transition-colors">
                    Citizen Portal Home
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/citizen/report" className="hover:text-white transition-colors">
                    Report a Flooded Road
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/citizen/reports" className="hover:text-white transition-colors">
                    Track My Reports
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/map-public" className="hover:text-white transition-colors">
                    Public Flood Map
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/safety" className="hover:text-white transition-colors">
                    Community Flood Safety Guidelines
                  </NavLink>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">
                Emergency Hotlines (Sri Lanka)
              </h4>
              <ul className="space-y-2 font-mono text-neutral-300">
                <li className="flex items-center justify-between">
                  <span>Disaster Management Centre:</span>
                  <a href="tel:117" className="text-white font-bold hover:underline">
                    117
                  </a>
                </li>
                <li className="flex items-center justify-between">
                  <span>Suwa Seriya Ambulance:</span>
                  <a href="tel:1990" className="text-white font-bold hover:underline">
                    1990
                  </a>
                </li>
                <li className="flex items-center justify-between">
                  <span>Sri Lanka Police:</span>
                  <a href="tel:119" className="text-white font-bold hover:underline">
                    119
                  </a>
                </li>
                <li className="flex items-center justify-between">
                  <span>Colombo Municipal Council:</span>
                  <a href="tel:0112684293" className="text-white font-bold hover:underline">
                    011 268 4293
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">
                Officer Operations
              </h4>
              <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                Authorized municipal emergency officers, drainage engineers, and dispatchers access the tactical Emergency Operations Center.
              </p>
              <NavLink
                to={authenticatedRole === 'officer' ? '/officer/overview' : '/login?portal=officer'}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-sm bg-[#202020] hover:bg-white/10 text-white border border-white/15 text-xs font-semibold transition-colors"
              >
                <span>{authenticatedRole === 'officer' ? 'Launch Officer EOC Dashboard' : 'Officer Portal Sign In'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </NavLink>
            </div>
          </div>

          <div className="border-t border-white/10 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-500 gap-2">
            <span>© 2026 FloodSense. Urban Flood Intelligence &amp; Early Warning Platform.</span>
            <div className="flex items-center gap-4">
              <NavLink to="/map-public" className="hover:text-neutral-300">
                Public GIS Map
              </NavLink>
              <NavLink to="/safety" className="hover:text-neutral-300">
                Safety &amp; Privacy Policy
              </NavLink>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
