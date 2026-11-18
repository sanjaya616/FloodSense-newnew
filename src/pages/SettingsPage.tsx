/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useFlood } from '../context/FloodContext';
import {
  User,
  Shield,
  Sliders,
  CheckCircle2,
  Download,
  Cloud,
  Lock,
  RefreshCw,
  LogOut,
  Activity,
  Layers,
  Bell,
  AlertTriangle,
} from 'lucide-react';

type ServiceHealthState =
  | 'NOT_CONFIGURED'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'LOCAL_AUDIT_CHAIN'
  | 'NOT_VERIFIED';

interface SystemHealthData {
  timestamp: string;
  status: string;
  services: {
    geminiAi: {
      state: ServiceHealthState;
      status: string;
      configured: boolean;
      mode: string;
      model: string;
      lastSuccess?: string | null;
      lastError?: string | null;
      lastChecked?: string;
    };
    weatherApi: {
      state: ServiceHealthState;
      status: string;
      provider: string;
      mode: string;
      lastSuccessfulConnection?: string | null;
      lastError?: string | null;
    };
    firebase: {
      state: ServiceHealthState;
      status: string;
      mode: string;
      adminSdkReady?: boolean;
      rulesConfigured: boolean | null;
      rulesNote?: string;
    };
    blockchain: {
      state: ServiceHealthState;
      status: string;
      network: string;
      chainId?: number;
      isSimulated?: boolean;
    };
    mapTileService: {
      state: ServiceHealthState;
      status: string;
      provider: string;
      lastSuccessfulConnection?: string | null;
      lastChecked?: string;
    };
  };
}

export const SettingsPage: React.FC = () => {
  const {
    authenticatedRole,
    userProfile,
    updateUserProfile,
    reports,
    hotspots,
    blockchainRecords,
    isFirebaseAvailable,
    firebaseConfigError,
    dbOperationStatus,
    logout,
    checkFirebaseConnection,
    clusteringConfig,
    setClusteringConfig,
    riskThresholds,
    setRiskThresholds,
    reclusterAllReports,
  } = useFlood();

  const [savedMessage, setSavedMessage] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [reclusterNotice, setReclusterNotice] = useState(false);

  // System Health state from live server probe
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [isProbingHealth, setIsProbingHealth] = useState(false);

  // Local form state for user profile
  const [profileForm, setProfileForm] = useState({
    name: userProfile.name,
    roleName: userProfile.roleName,
    department: userProfile.department,
    emergencySector: userProfile.emergencySector,
    email: userProfile.email,
    phone: userProfile.phone,
  });

  // Preference toggles with localStorage persistence
  const [notifyHighRisk, setNotifyHighRisk] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('floodsense_notify_high_risk');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [notifyWeatherAdvisory, setNotifyWeatherAdvisory] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('floodsense_notify_weather');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [notifySms, setNotifySms] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('floodsense_notify_sms');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Fetch actual health from backend /api/health
  const probeSystemHealth = async () => {
    setIsProbingHealth(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch {
      // ignore
    } finally {
      setIsProbingHealth(false);
    }
  };

  useEffect(() => {
    probeSystemHealth();
  }, []);

  // Update profileForm if userProfile changes externally
  useEffect(() => {
    setProfileForm({
      name: userProfile.name,
      roleName: userProfile.roleName,
      department: userProfile.department,
      emergencySector: userProfile.emergencySector,
      email: userProfile.email,
      phone: userProfile.phone,
    });
  }, [userProfile]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaveError(null);
    setSavedMessage(false);
    setIsSavingProfile(true);

    const updates = {
      name: profileForm.name.trim(),
      department: profileForm.department.trim(),
      emergencySector: profileForm.emergencySector.trim(),
      phone: profileForm.phone.trim(),
    };

    try {
      const res = await updateUserProfile(updates);
      if (!res.success) {
        setProfileSaveError(res.error || 'Failed to save profile changes.');
        return;
      }

      try {
        localStorage.setItem('floodsense_notify_high_risk', JSON.stringify(notifyHighRisk));
        localStorage.setItem('floodsense_notify_weather', JSON.stringify(notifyWeatherAdvisory));
        localStorage.setItem('floodsense_notify_sms', JSON.stringify(notifySms));
      } catch (err) {
        console.warn('Failed to persist notification preferences to localStorage:', err);
      }

      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 3500);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRecluster = () => {
    reclusterAllReports();
    setReclusterNotice(true);
    setTimeout(() => setReclusterNotice(false), 3000);
  };

  const handleExportData = () => {
    const data = {
      exportTimestamp: new Date().toISOString(),
      platform: 'FloodSense Urban Flood Intelligence',
      firebaseConfigured: isFirebaseAvailable,
      clusteringSettings: clusteringConfig,
      riskThresholdSettings: riskThresholds,
      colomboHotspots: hotspots,
      citizenReports: reports,
      blockchainRecords,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `floodsense_colombo_telemetry_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (label: string, state?: ServiceHealthState) => {
    if (state === 'CONNECTED') {
      return (
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-800 border border-emerald-200">
          {label}
        </span>
      );
    }
    if (state === 'LOCAL_AUDIT_CHAIN') {
      return (
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-[#EEEEEB] text-[#171717] border border-[#E5E5E2]">
          {label}
        </span>
      );
    }
    if (state === 'ERROR' || state === 'DISCONNECTED') {
      return (
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-red-50 text-red-800 border border-red-200">
          {label}
        </span>
      );
    }
    if (state === 'NOT_CONFIGURED' || state === 'NOT_VERIFIED') {
      return (
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-amber-50 text-amber-800 border border-amber-200">
          {label}
        </span>
      );
    }
    return (
      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-[#EEEEEB] text-[#171717]">
        {label}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      {/* Page Header */}
      <div>
        <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
          System Configuration &amp; Role Settings
        </h2>
        <p className="text-sm text-[#666666] mt-1">
          Manage officer credentials, live backend service health, Firebase persistence, and clustering heuristics.
        </p>
      </div>

      {savedMessage && (
        <div className="p-3.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-md text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          <span>Profile credentials and notification preferences successfully saved.</span>
        </div>
      )}

      {profileSaveError && (
        <div className="p-3.5 bg-red-50 text-red-900 border border-red-200 rounded-md text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
          <span>{profileSaveError}</span>
        </div>
      )}

      {reclusterNotice && (
        <div className="p-3.5 bg-[#EEEEEB] text-[#171717] border border-[#171717] rounded-md text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#171717]" />
          <span>Geospatial clustering recalculated across all active reports.</span>
        </div>
      )}

      {/* Database Operation Notification Banner */}
      {dbOperationStatus.success && (
        <div className="p-3.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-md text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          <span>{dbOperationStatus.success}</span>
        </div>
      )}

      {dbOperationStatus.error && (
        <div className="p-3.5 bg-amber-50 text-amber-950 border border-amber-200 rounded-md text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
          <span>{dbOperationStatus.error}</span>
        </div>
      )}

      {/* SYSTEM HEALTH SECTION */}
      <div className="bg-white p-6 rounded-md border border-[#E5E5E2] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E5E5E2] gap-2">
          <div>
            <span className="text-[10px] font-semibold text-[#666666] uppercase tracking-[0.14em] block font-mono">
              Live Infrastructure Telemetry
            </span>
            <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#171717]" />
              <span>System Health &amp; Service Integration Probes</span>
            </h3>
            <p className="text-xs text-[#666666]">
              Live operational checks for cloud services, AI models, weather APIs, and cryptographic ledgers.
            </p>
          </div>

          <button
            type="button"
            onClick={probeSystemHealth}
            disabled={isProbingHealth}
            className="px-3.5 py-2 bg-[#F5F5F2] hover:bg-[#EEEEEB] border border-[#E5E5E2] text-[#171717] font-semibold text-xs rounded-md transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProbingHealth ? 'animate-spin' : ''}`} />
            <span>Probe Services</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {/* Gemini AI */}
          <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-[#171717]">Gemini AI Model</span>
                {getStatusBadge(
                  systemHealth?.services?.geminiAi?.status || (isProbingHealth ? 'Checking...' : 'Unavailable'),
                  systemHealth?.services?.geminiAi?.state
                )}
              </div>
              <p className="text-[11px] text-[#666666]">
                Model: <strong className="font-mono text-[#171717]">{systemHealth?.services?.geminiAi?.model || 'gemini-3.8-flash'}</strong> (Server-Side Multimodal Verification)
              </p>
            </div>
            <span className="text-[10px] text-[#666666] mt-2 font-mono">
              Mode: {systemHealth?.services?.geminiAi?.mode || 'Checking backend...'}
            </span>
          </div>

          {/* Weather API */}
          <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-[#171717]">Weather API</span>
                {getStatusBadge(
                  systemHealth?.services?.weatherApi?.status || (isProbingHealth ? 'Checking...' : 'Unavailable'),
                  systemHealth?.services?.weatherApi?.state
                )}
              </div>
              <p className="text-[11px] text-[#666666]">
                Provider: <strong className="text-[#171717]">Open-Meteo Forecast API</strong> (Asia/Colombo)
              </p>
            </div>
            <span className="text-[10px] text-[#666666] mt-2 font-mono">
              Last probe: {systemHealth?.timestamp ? new Date(systemHealth.timestamp).toLocaleTimeString() : 'Checking...'}
            </span>
          </div>

          {/* Firebase */}
          <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-[#171717]">Cloud Firestore</span>
                {getStatusBadge(
                  systemHealth?.services?.firebase?.status || (isProbingHealth ? 'Checking...' : 'Not Checked'),
                  systemHealth?.services?.firebase?.state
                )}
              </div>
              <p className="text-[11px] text-[#666666]">
                Status: {isFirebaseAvailable ? 'Configured (floodsense-72e55)' : 'Environment Variables Required'}
              </p>
            </div>
            <span className="text-[10px] text-[#666666] mt-2 font-mono">
              {systemHealth?.services?.firebase?.rulesNote || firebaseConfigError || 'Checking security rules status...'}
            </span>
          </div>

          {/* Audit Hash-Chain */}
          <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-[#171717]">Audit Hash-Chain</span>
                {getStatusBadge(
                  systemHealth?.services?.blockchain?.status || 'Active',
                  systemHealth?.services?.blockchain?.state || 'CONNECTED'
                )}
              </div>
              <p className="text-[11px] text-[#666666]">
                {systemHealth?.services?.blockchain?.network || 'FloodSense SHA-256 Audit Chain'}
              </p>
            </div>
            <span className="text-[10px] text-[#666666] mt-2 font-mono">
              Status: Tamper-Evident SHA-256 Digest Chain
            </span>
          </div>

          {/* Map Tile Service */}
          <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-[#171717]">GIS Tile Service</span>
                {getStatusBadge(
                  systemHealth?.services?.mapTileService?.status || (isProbingHealth ? 'Checking...' : 'Unavailable'),
                  systemHealth?.services?.mapTileService?.state
                )}
              </div>
              <p className="text-[11px] text-[#666666]">
                OpenStreetMap Carto Vector Tiles
              </p>
            </div>
            <span className="text-[10px] text-[#666666] font-medium mt-2 font-mono">
              {systemHealth?.services?.mapTileService?.lastChecked
                ? `Probed at ${new Date(systemHealth.services.mapTileService.lastChecked).toLocaleTimeString()}`
                : 'Awaiting live tile probe...'}
            </span>
          </div>

          {/* Data Freshness */}
          <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-[#171717]">Health Telemetry</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-white border border-[#E5E5E2] text-[#171717]">
                  {systemHealth ? 'RESPONDED' : isProbingHealth ? 'CHECKING' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-[11px] text-[#666666] font-mono">
                Probe: {systemHealth ? new Date(systemHealth.timestamp).toLocaleTimeString() : 'Pending'}
              </p>
            </div>
            <span className="text-[10px] text-[#171717] font-medium mt-2 font-mono">
              On-demand /api/health endpoint
            </span>
          </div>
        </div>
      </div>

      {/* FIREBASE PERSISTENCE & SESSION ACCESS CONTROL PANEL */}
      <div className="bg-white p-6 rounded-md border border-[#E5E5E2] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E5E5E2] gap-2">
          <div>
            <span className="text-[10px] font-semibold text-[#666666] uppercase tracking-[0.14em] block font-mono">
              Cloud Backend &amp; Role Access
            </span>
            <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[#171717]" />
              <span>Firebase Authentication, Firestore &amp; Officer Authorization</span>
            </h3>
            <p className="text-xs text-[#666666]">
              All operational incident records, citizen accounts, and Emergency Officer claims are verified strictly through Firebase.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded-sm ${
                isFirebaseAvailable
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {isFirebaseAvailable ? 'Firebase Connected' : 'Firebase Unconfigured'}
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] text-xs text-[#666666] flex items-start gap-2">
          <Shield className="w-4 h-4 text-[#171717] shrink-0 mt-0.5" />
          <p>
            <strong className="text-[#171717]">Role Verification:</strong> Active session role is{' '}
            <strong className="text-[#171717]">
              {authenticatedRole === 'officer' ? 'EMERGENCY OFFICER' : 'CITIZEN'}
            </strong>
            . Emergency Officer authorization is enforced server-side via Firebase custom claims (
            <code>request.auth.token.role == &apos;officer&apos;</code>) and the backend <code>/officers/&#123;uid&#125;</code> collection.
          </p>
        </div>

        {/* Action Controls: Probe Connection & Sign Out */}
        <div className="p-4 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={dbOperationStatus.loading}
              onClick={() => checkFirebaseConnection()}
              className="px-3.5 py-2 bg-white border border-[#E5E5E2] hover:bg-[#EEEEEB] text-[#171717] font-semibold rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${dbOperationStatus.loading ? 'animate-spin' : ''}`}
              />
              <span>Test Cloud Firestore Connection</span>
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="px-3.5 py-2 bg-[#171717] hover:bg-black text-white font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#666666] font-mono">
            <Lock className="w-3.5 h-3.5 text-[#666666]" />
            <span>{systemHealth?.services?.firebase?.rulesNote || 'Security rules check pending'}</span>
          </div>
        </div>
      </div>

      {/* CLUSTERING & RISK THRESHOLD HEURISTICS */}
      <div className="bg-white p-6 rounded-md border border-[#E5E5E2] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E5E5E2] gap-2">
          <div>
            <span className="text-[10px] font-semibold text-[#666666] uppercase tracking-[0.14em] block font-mono">
              Heuristic Configuration
            </span>
            <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#171717]" />
              <span>Configurable Geospatial Clustering &amp; Risk Thresholds</span>
            </h3>
            <p className="text-xs text-[#666666]">
              Tune Haversine aggregation distance and rainfall evaluation thresholds in real time.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRecluster}
            className="px-4 py-2 bg-[#171717] hover:bg-black text-white font-semibold text-xs rounded-md transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Recalculate Clusters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Clustering controls */}
          <div className="p-4 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] space-y-3">
            <span className="font-bold text-[#171717] block font-mono uppercase text-[10px] tracking-wider">
              Geospatial Haversine Parameters
            </span>

            <div>
              <div className="flex justify-between font-semibold text-[#171717] mb-1">
                <span>Spatial Radius (Meters):</span>
                <span className="font-mono font-bold text-[#171717]">{clusteringConfig.spatialRadiusMeters}m</span>
              </div>
              <input
                type="range"
                min="200"
                max="1500"
                step="50"
                value={clusteringConfig.spatialRadiusMeters}
                onChange={(e) =>
                  setClusteringConfig((prev) => ({
                    ...prev,
                    spatialRadiusMeters: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-[#171717] cursor-pointer"
              />
              <span className="text-[10px] text-[#666666]">Default: 500 meters</span>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#171717] mb-1">
                <span>Temporal Window (Hours):</span>
                <span className="font-mono font-bold text-[#171717]">{clusteringConfig.temporalWindowHours} hours</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                step="0.5"
                value={clusteringConfig.temporalWindowHours}
                onChange={(e) =>
                  setClusteringConfig((prev) => ({
                    ...prev,
                    temporalWindowHours: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-[#171717] cursor-pointer"
              />
              <span className="text-[10px] text-[#666666]">Default: 2.0 hours</span>
            </div>
          </div>

          {/* Risk threshold controls */}
          <div className="p-4 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] space-y-3">
            <span className="font-bold text-[#171717] block font-mono uppercase text-[10px] tracking-wider">
              Deterministic Risk Thresholds
            </span>

            <div>
              <div className="flex justify-between font-semibold text-[#171717] mb-1">
                <span>High-Risk Rainfall Threshold:</span>
                <span className="font-mono font-bold text-[#171717]">{riskThresholds.highRainfallMm} mm</span>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                step="1"
                value={riskThresholds.highRainfallMm}
                onChange={(e) =>
                  setRiskThresholds((prev) => ({
                    ...prev,
                    highRainfallMm: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-[#171717] cursor-pointer"
              />
              <span className="text-[10px] text-[#666666]">Default: 20 mm</span>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#171717] mb-1">
                <span>High-Risk Report Count:</span>
                <span className="font-mono font-bold text-[#171717]">{riskThresholds.highReportCount} reports</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                step="1"
                value={riskThresholds.highReportCount}
                onChange={(e) =>
                  setRiskThresholds((prev) => ({
                    ...prev,
                    highReportCount: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-[#171717] cursor-pointer"
              />
              <span className="text-[10px] text-[#666666]">Default: 3 reports</span>
            </div>
          </div>
        </div>
      </div>

      {/* User Profile Form */}
      <form onSubmit={handleProfileSave} className="bg-white p-6 rounded-md border border-[#E5E5E2] space-y-4">
        <div className="pb-3 border-b border-[#E5E5E2]">
          <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
            <User className="w-4 h-4 text-[#171717]" />
            <span>Profile &amp; Municipal Command Information</span>
          </h3>
          <p className="text-xs text-[#666666]">
            Officer details attached to automated alerts and verification signatures.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-[#171717] mb-1">Full Name</label>
            <input
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] focus:bg-white focus:outline-none focus:border-[#171717]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#171717] mb-1">Official Role Title (Governed by Firebase Claims)</label>
            <input
              type="text"
              readOnly
              disabled
              value={profileForm.roleName}
              className="w-full px-3 py-2 bg-[#EEEEEB] border border-[#E5E5E2] rounded-md text-[#666666] cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#171717] mb-1">Command Agency</label>
            <input
              type="text"
              value={profileForm.department}
              onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
              className="w-full px-3 py-2 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] focus:bg-white focus:outline-none focus:border-[#171717]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#171717] mb-1">Emergency Operations Sector</label>
            <input
              type="text"
              value={profileForm.emergencySector}
              onChange={(e) => setProfileForm({ ...profileForm, emergencySector: e.target.value })}
              className="w-full px-3 py-2 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] focus:bg-white focus:outline-none focus:border-[#171717]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#171717] mb-1">Gov Contact Email (Governed by Firebase Auth)</label>
            <input
              type="email"
              readOnly
              disabled
              value={profileForm.email}
              className="w-full px-3 py-2 bg-[#EEEEEB] border border-[#E5E5E2] rounded-md text-[#666666] font-mono cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#171717] mb-1">Operations Hot Line</label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              className="w-full px-3 py-2 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] focus:bg-white focus:outline-none focus:border-[#171717] font-mono"
            />
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="pt-3 border-t border-[#E5E5E2]">
          <span className="text-xs font-bold text-[#171717] flex items-center gap-1.5 mb-2">
            <Bell className="w-3.5 h-3.5 text-[#171717]" />
            <span>Notification &amp; Alert Broadcast Preferences</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <label className="flex items-center gap-2 p-2.5 rounded-sm bg-[#F5F5F2] border border-[#E5E5E2] cursor-pointer">
              <input
                type="checkbox"
                checked={notifyHighRisk}
                onChange={(e) => setNotifyHighRisk(e.target.checked)}
                className="text-[#171717] rounded-sm"
              />
              <span className="text-[#171717]">High Risk Alerts</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-sm bg-[#F5F5F2] border border-[#E5E5E2] cursor-pointer">
              <input
                type="checkbox"
                checked={notifyWeatherAdvisory}
                onChange={(e) => setNotifyWeatherAdvisory(e.target.checked)}
                className="text-[#171717] rounded-sm"
              />
              <span className="text-[#171717]">Weather Advisories</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-sm bg-[#F5F5F2] border border-[#E5E5E2] cursor-pointer">
              <input
                type="checkbox"
                checked={notifySms}
                onChange={(e) => setNotifySms(e.target.checked)}
                className="text-[#171717] rounded-sm"
              />
              <span className="text-[#171717]">SMS Alert Preferences</span>
            </label>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSavingProfile}
            className="px-5 py-2.5 bg-[#171717] text-white font-semibold text-xs rounded-md hover:bg-black transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSavingProfile ? 'Saving...' : 'Update & Persist Profile Credentials'}
          </button>
        </div>
      </form>

      {/* Telemetry Export */}
      <div className="bg-white p-6 rounded-md border border-[#E5E5E2] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
            <Download className="w-4 h-4 text-[#171717]" />
            <span>Operational Data Export</span>
          </h3>
          <p className="text-xs text-[#666666]">
            Export active flood reports, hotspot clusters, thresholds, and SHA-256 audit records as JSON.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleExportData}
            className="px-4 py-2 bg-[#F5F5F2] hover:bg-[#EEEEEB] border border-[#E5E5E2] text-[#171717] font-semibold text-xs rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Telemetry JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
