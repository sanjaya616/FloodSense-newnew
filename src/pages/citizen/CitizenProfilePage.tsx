/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  LogOut,
  FileText,
  Bell,
  AlertTriangle,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';

export const CitizenProfilePage: React.FC = () => {
  const { userProfile, updateUserProfile, authenticatedRole, myReports, logout } = useFlood();
  const navigate = useNavigate();

  const [name, setName] = useState(userProfile.name);
  const [phone, setPhone] = useState(userProfile.phone);
  const [sector, setSector] = useState(userProfile.emergencySector);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(userProfile.name);
    setPhone(userProfile.phone);
    setSector(userProfile.emergencySector);
  }, [userProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSavedNotice(false);
    setIsSaving(true);
    try {
      const res = await updateUserProfile({
        name: name.trim() || userProfile.name,
        phone: phone.trim() || userProfile.phone,
        emergencySector: sector.trim() || userProfile.emergencySector,
      });
      if (!res.success) {
        setSaveError(res.error || 'Could not save profile changes.');
        return;
      }
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#666666] mb-1.5">
            <NavLink to="/citizen" className="hover:text-[#171717] transition-colors">
              Citizen Portal
            </NavLink>
            <ChevronRight className="w-3 h-3 text-[#A3A3A3]" />
            <span className="text-[#171717] font-semibold">Profile &amp; Account</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
            Citizen Profile &amp; Preferences
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1.5">
            Manage your contact information for municipal field updates and review your account security role.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 text-xs font-semibold self-start sm:self-center cursor-pointer transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {savedNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Your citizen profile details have been updated.</span>
        </div>
      )}

      {saveError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Account Overview Card */}
      <div className="bg-white p-6 rounded-md border border-[#E5E5E2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          {userProfile.avatarUrl ? (
            <img
              src={userProfile.avatarUrl}
              alt={userProfile.name || 'Citizen'}
              className="w-16 h-16 rounded-md object-cover border border-[#E5E5E2]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-md bg-[#181818] text-white flex items-center justify-center font-mono font-bold text-lg">
              {(userProfile.name || 'CR').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-[#171717]">{userProfile.name}</h2>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-semibold uppercase tracking-wider bg-[#EEEEEB] text-[#171717] border border-[#E5E5E2]">
                Role: {authenticatedRole === 'officer' ? 'OFFICER' : 'CITIZEN'}
              </span>
            </div>
            <p className="text-xs text-[#666666] mt-0.5">{userProfile.email}</p>
            <p className="text-[11px] text-[#666666] mt-1">{userProfile.department}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <NavLink
            to="/citizen/reports"
            className="px-3.5 py-2 rounded-md bg-[#F5F5F2] hover:bg-[#EEEEEB] border border-[#E5E5E2] text-[#171717] font-semibold flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-[#171717]" />
            <span>{myReports.length} Reports</span>
          </NavLink>
          <NavLink
            to="/citizen/notifications"
            className="px-3.5 py-2 rounded-md bg-[#F5F5F2] hover:bg-[#EEEEEB] border border-[#E5E5E2] text-[#171717] font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-[#171717]" />
            <span>Alerts</span>
          </NavLink>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSave} className="bg-white p-6 sm:p-8 rounded-md border border-[#E5E5E2] space-y-5">
        <div className="border-b border-[#E5E5E2] pb-3">
          <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
            <User className="w-4 h-4 text-[#171717]" />
            <span>Contact &amp; Neighborhood Information</span>
          </h3>
          <p className="text-xs text-[#666666] mt-0.5">
            Personal contact details are private and visible only to authorized municipal emergency officers reviewing your reports.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-[#171717] mb-1.5">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] focus:bg-white focus:outline-none focus:border-[#171717]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#171717] mb-1.5">Email Address (Verified Identity)</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                disabled
                value={userProfile.email}
                className="w-full pl-9 pr-3 py-2.5 bg-[#EEEEEB] border border-[#E5E5E2] rounded-md text-[#666666] cursor-not-allowed font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#171717] mb-1.5">Contact Phone Number</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] focus:bg-white focus:outline-none focus:border-[#171717] font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#171717] mb-1.5">Primary Colombo Neighborhood / Sector</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] focus:bg-white focus:outline-none focus:border-[#171717]"
              />
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] text-xs text-[#666666] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <span>
            <strong className="text-[#171717]">Privacy Guarantee:</strong> Public maps never display your name, phone number, or email address.
            Officer EOC access is restricted by server-enforced role verification.
          </span>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-md bg-[#171717] hover:bg-black text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Saving Profile...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
