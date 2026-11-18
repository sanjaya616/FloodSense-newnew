/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  FloodReport,
  FloodHotspot,
  BlockchainRecord,
  ReportEvidenceRecord,
  IncidentStatus,
  ClusteringConfig,
  DEFAULT_CLUSTERING_CONFIG,
  RiskThresholdConfig,
  DEFAULT_RISK_THRESHOLDS,
  calculateDynamicAnalytics,
  clusterReports,
} from '../utils/floodLogic';
import { CompressedReportImage } from '../utils/imageUtils';
import { FLOOD_IMAGES } from '../assets/images';
import { floodService, WeatherData } from '../services/floodService';
import {
  isFirebaseConfigured,
  firebaseConfigError,
  testFirestoreConnection,
  auth,
  db,
} from '../services/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export interface UserProfile {
  name: string;
  roleName: string;
  department: string;
  email: string;
  phone: string;
  avatarUrl: string;
  emergencySector: string;
  isFirebaseUser?: boolean;
  uid?: string;
}

const DEFAULT_EMPTY_PROFILE: UserProfile = {
  name: '',
  roleName: 'Citizen Reporter',
  department: 'Colombo Community Sentinel',
  email: '',
  phone: '',
  avatarUrl: '',
  emergencySector: 'Colombo Basin',
  isFirebaseUser: false,
};

export type NotificationType =
  | 'NEW_REPORT'
  | 'NEW_HOTSPOT'
  | 'HIGH_RISK_ALERT'
  | 'WEATHER_WARNING'
  | 'OFFICER_UPDATE'
  | 'INCIDENT_RESOLVED'
  | 'AI_STATUS'
  | 'BLOCKCHAIN';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  location?: string;
  time: string;
  unread: boolean;
  type: NotificationType;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  deliveryChannel: 'in-app' | 'push';
  reportId?: string;
  recipientUid?: string;
}

export interface DbOperationStatus {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export interface FloodContextType {
  reports: FloodReport[];
  myReports: FloodReport[];
  hotspots: FloodHotspot[];
  blockchainRecords: BlockchainRecord[];
  weather: WeatherData;
  refreshWeather: () => Promise<void>;
  role: 'officer' | 'citizen';
  authenticatedRole: 'officer' | 'citizen' | null;
  isAuthLoading: boolean;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  retryPublicSync: (reportId: string) => Promise<{ ok: boolean; error?: string }>;
  isAuthenticated: boolean;
  loginWithEmail: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; role: 'officer' | 'citizen'; message?: string }>;
  loginWithOfficerEmail: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; role: 'officer' | 'citizen'; message?: string }>;
  loginWithOfficerGoogle: (useRedirect?: boolean) => Promise<{
    success: boolean;
    role: 'officer' | 'citizen';
    redirected?: boolean;
    message?: string;
  }>;
  registerWithEmail: (
    name: string,
    email: string,
    password: string,
    phone?: string
  ) => Promise<{ success: boolean; message?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  selectedHotspotId: string | null;
  setSelectedHotspotId: (id: string | null) => void;
  selectedReportId: string | null;
  setSelectedReportId: (id: string | null) => void;
  notifications: NotificationItem[];
  markAllNotificationsAsRead: () => void;
  markNotificationAsRead: (id: string) => void;
  addNotification: (n: Omit<NotificationItem, 'id' | 'time' | 'unread'>) => void;
  addReport: (
    newReportData: Omit<
      FloodReport,
      | 'id'
      | 'timestamp'
      | 'riskLevel'
      | 'verificationStatus'
      | 'incidentStatus'
      | 'statusHistory'
      | 'aiConfidence'
      | 'aiClassification'
      | 'aiVerificationDetails'
      | 'isDuplicate'
      | 'duplicateOfReportId'
    > & {
      imageFile?: File;
      compressedEvidence?: CompressedReportImage;
      customImage?: string;
      imageMimeType?: string;
      onUploadProgress?: (percent: number) => void;
    }
  ) => Promise<{
    report: FloodReport;
    hotspot: FloodHotspot;
    blockchainRecord?: BlockchainRecord;
    isDuplicate?: boolean;
    duplicateOfId?: string;
    duplicateCheckStatus?: 'VERIFIED_CITYWIDE' | 'LOCAL_ONLY' | 'UNAVAILABLE';
    duplicateCheckWarning?: string;
    evidenceUploadFailed?: boolean;
    evidenceUploadError?: string;
  }>;
  getEvidenceForReport: (reportId: string) => Promise<ReportEvidenceRecord[]>;
  retryReportEvidenceUpload: (
    reportId: string,
    fileOrCompressed: File | CompressedReportImage
  ) => Promise<ReportEvidenceRecord>;
  deleteReport: (reportId: string) => Promise<{ deletedEvidenceCount: number }>;
  retryAiVerification: (
    reportId: string,
    override?: { customImage?: string; mimeType?: string }
  ) => Promise<FloodReport | null>;
  updateIncidentStatus: (
    reportId: string,
    newStatus: IncidentStatus,
    officerNote?: string
  ) => Promise<FloodReport | null>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  clusteringConfig: ClusteringConfig;
  setClusteringConfig: React.Dispatch<React.SetStateAction<ClusteringConfig>>;
  riskThresholds: RiskThresholdConfig;
  setRiskThresholds: React.Dispatch<React.SetStateAction<RiskThresholdConfig>>;
  reclusterAllReports: () => void;
  getAnalytics: (timeRange: '24h' | '7d' | '30d' | 'all') => ReturnType<typeof calculateDynamicAnalytics>;
  isFirebaseAvailable: boolean;
  firebaseConfigError: string | null;
  dbOperationStatus: DbOperationStatus;
  loginWithGoogle: (useRedirect?: boolean) => Promise<{
    success: boolean;
    role: 'officer' | 'citizen';
    redirected?: boolean;
    message?: string;
  }>;
  logoutGoogle: () => Promise<void>;
  checkFirebaseConnection: () => Promise<boolean>;
}

const FloodContext = createContext<FloodContextType | undefined>(undefined);

const STORAGE_KEY_CLUSTERING = 'floodsense_clustering_v2';
const STORAGE_KEY_THRESHOLDS = 'floodsense_thresholds_v2';

export const FloodProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isFirebaseAvailable] = useState<boolean>(isFirebaseConfigured);

  const [clusteringConfig, setClusteringConfig] = useState<ClusteringConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLUSTERING);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage errors
    }
    return DEFAULT_CLUSTERING_CONFIG;
  });

  const [riskThresholds, setRiskThresholds] = useState<RiskThresholdConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THRESHOLDS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage errors
    }
    return DEFAULT_RISK_THRESHOLDS;
  });

  const [dbOperationStatus, setDbOperationStatus] = useState<DbOperationStatus>({
    loading: false,
    error: firebaseConfigError,
    success: null,
  });

  const [reports, setReports] = useState<FloodReport[]>([]);
  const [hotspots, setHotspots] = useState<FloodHotspot[]>([]);
  const [blockchainRecords, setBlockchainRecords] = useState<BlockchainRecord[]>([]);

  const verifyingOfficerRef = useRef<boolean>(false);
  const registeringRef = useRef<boolean>(false);

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(
    () => isFirebaseConfigured && Boolean(auth)
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authenticatedRole, setAuthenticatedRole] = useState<'officer' | 'citizen' | null>(null);
  const role: 'officer' | 'citizen' = authenticatedRole === 'officer' ? 'officer' : 'citizen';

  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_EMPTY_PROFILE);

  const [weather, setWeather] = useState<WeatherData>({
    currentTempC: null,
    condition: 'Fetching telemetry...',
    currentRainfallMm: null,
    expected3hRainfallMm: null,
    humidityPercent: null,
    windSpeedKmh: null,
    windDirection: null,
    updatedAt: 'Connecting...',
    source: 'Open-Meteo Forecast API',
    provider: 'Open-Meteo Forecast API',
    forecastAvailable: false,
    forecastCompleteness: 'UNAVAILABLE',
    forecastTimeRange: 'Unavailable',
    rainfallUnit: 'mm',
    isLive: false,
    unavailable: false,
    status: 'Connecting to Open-Meteo API',
  });

  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const buildProfileFromFirebaseUser = useCallback(
    async (fbUser: any, authoritativeRole: 'officer' | 'citizen'): Promise<UserProfile> => {
      let storedUserData: any = null;
      if (db && fbUser?.uid) {
        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid));
          if (snap.exists()) storedUserData = snap.data();
        } catch {
          // Proceed with auth profile attributes
        }
      }
      return {
        uid: fbUser.uid,
        name:
          storedUserData?.displayName ||
          storedUserData?.name ||
          fbUser.displayName ||
          (authoritativeRole === 'officer' ? 'Emergency Officer' : 'Citizen Reporter'),
        roleName:
          authoritativeRole === 'officer'
            ? 'Emergency Management Officer'
            : 'Citizen Reporter & Resident',
        department:
          storedUserData?.department ||
          (authoritativeRole === 'officer' ? 'Colombo Municipal Flood Operations' : 'Colombo Community Sentinel'),
        email: fbUser.email || '',
        phone: storedUserData?.phone || fbUser.phoneNumber || '',
        avatarUrl:
          storedUserData?.avatarUrl ||
          fbUser.photoURL ||
          (authoritativeRole === 'officer' ? FLOOD_IMAGES.officerAvatar : ''),
        emergencySector:
          storedUserData?.emergencySector ||
          (authoritativeRole === 'officer' ? 'Sector 04 — Colombo Municipal Basin' : 'Colombo Metro Basin'),
        isFirebaseUser: true,
      };
    },
    []
  );

  // Monitor Firebase Authentication session state & process any completed Google redirect sign-in
  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      setIsAuthLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const redirectOutcome = await floodService.consumeGoogleRedirectResult();
        if (cancelled) return;

        if (redirectOutcome?.fbUser && redirectOutcome.portal === 'officer') {
          verifyingOfficerRef.current = true;
          try {
            const verifyRes = await floodService.verifyOfficerWithBackend(redirectOutcome.fbUser);
            if (!verifyRes.authorized || verifyRes.role !== 'officer') {
              await floodService.logout();
              if (!cancelled) {
                setIsAuthenticated(false);
                setAuthenticatedRole(null);
                setUserProfile(DEFAULT_EMPTY_PROFILE);
                setDbOperationStatus({
                  loading: false,
                  error:
                    verifyRes.error ||
                    'Access denied: this Google account is not pre-authorized as an Emergency Officer.',
                  success: null,
                });
              }
            }
          } finally {
            verifyingOfficerRef.current = false;
          }
        }
      } catch {
        // Proceed cleanly to auth state listener
      }

      if (cancelled || !auth) return;

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (verifyingOfficerRef.current || registeringRef.current) {
          return;
        }
        if (user) {
          const authRole = await floodService.fetchVerifiedSessionRole(user);
          const profile = await buildProfileFromFirebaseUser(user, authRole);
          if (!cancelled) {
            setAuthenticatedRole(authRole);
            setUserProfile(profile);
            setIsAuthenticated(true);
          }
        } else if (!cancelled) {
          setIsAuthenticated(false);
          setAuthenticatedRole(null);
          setUserProfile(DEFAULT_EMPTY_PROFILE);
          setNotifications([]);
        }
        if (!cancelled) {
          setIsAuthLoading(false);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [buildProfileFromFirebaseUser]);

  // Subscribe to Firestore Notifications when authenticated
  useEffect(() => {
    if (!isFirebaseConfigured || !isAuthenticated || !userProfile.uid) {
      setNotifications([]);
      return;
    }
    const unsub = floodService.subscribeToNotifications(
      userProfile.uid,
      authenticatedRole === 'officer',
      (items) => {
        setNotifications(
          items.map((item: any) => ({
            id: item.id,
            title: item.title || 'FloodSense Notification',
            description: item.description || item.message || '',
            location: item.location || '',
            time: item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : 'Just now',
            unread: Boolean(item.unread),
            type: item.type || 'OFFICER_UPDATE',
            severity: item.severity || 'INFO',
            deliveryChannel: 'in-app',
            reportId: item.reportId,
            recipientUid: item.recipientUid,
          }))
        );
      },
      (err) => console.warn('Notifications listener error:', err.message)
    );
    return () => {
      if (unsub) unsub();
    };
  }, [isAuthenticated, userProfile.uid, authenticatedRole]);

  // Synchronize reports, hotspots, and audit records with Cloud Firestore
  useEffect(() => {
    if (!isFirebaseConfigured || isAuthLoading) return;

    const effectiveRole: 'officer' | 'citizen' = authenticatedRole || 'citizen';
    const effectiveUid = isAuthenticated ? userProfile.uid : undefined;

    setDbOperationStatus({ loading: true, error: null, success: null });

    Promise.all([
      floodService.getReports({ role: effectiveRole, uid: effectiveUid }),
      floodService.getHotspots(),
      floodService.getBlockchainRecords(),
    ])
      .then(([cloudReports, cloudHotspots, cloudBlockchain]) => {
        setReports(cloudReports);
        setHotspots(cloudHotspots);
        setBlockchainRecords(cloudBlockchain);
        setDbOperationStatus({
          loading: false,
          error: null,
          success: `Connected to Cloud Firestore (${cloudReports.length} report(s) loaded).`,
        });
      })
      .catch((err) => {
        setDbOperationStatus({
          loading: false,
          error: `Failed to load Cloud Firestore data: ${err.message}`,
          success: null,
        });
      });

    const unsubReports = floodService.subscribeToReports(
      (updatedReports) => setReports(updatedReports),
      (err) => console.warn('Real-time reports listener error:', err.message),
      { role: effectiveRole, uid: effectiveUid }
    );

    const unsubHotspots = floodService.subscribeToHotspots(
      (updatedHotspots) => setHotspots(updatedHotspots),
      (err) => console.warn('Real-time hotspots listener error:', err.message)
    );

    return () => {
      if (unsubReports) unsubReports();
      if (unsubHotspots) unsubHotspots();
    };
  }, [isAuthenticated, isAuthLoading, authenticatedRole, userProfile.uid]);

  const refreshWeather = useCallback(async () => {
    const live = await floodService.fetchLiveWeather();
    setWeather(live);
  }, []);

  useEffect(() => {
    refreshWeather();
    const interval = setInterval(refreshWeather, 300000);
    return () => clearInterval(interval);
  }, [refreshWeather]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CLUSTERING, JSON.stringify(clusteringConfig));
    } catch {
      // ignore storage errors
    }
    floodService.setClusteringConfig(clusteringConfig);
  }, [clusteringConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THRESHOLDS, JSON.stringify(riskThresholds));
    } catch {
      // ignore storage errors
    }
    floodService.setRiskThresholds(riskThresholds);
  }, [riskThresholds]);

  const updateUserProfile = async (
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string }> => {
    const rawKeys = Object.keys(updates || {});
    const forbiddenKeys = [
      'role',
      'isOfficer',
      'officer',
      'admin',
      'isAdmin',
      'claims',
      'customClaims',
      'permissions',
      'uid',
      'email',
      'isFirebaseUser',
    ];
    if (rawKeys.some((k) => forbiddenKeys.includes(k) && (updates as Record<string, any>)[k] !== undefined)) {
      return {
        success: false,
        error: 'Forbidden: Role or identity privilege fields cannot be modified through profile updates.',
      };
    }

    const safeUpdates: Partial<UserProfile> = {
      ...(typeof updates.name === 'string' && updates.name.trim() ? { name: updates.name.trim().slice(0, 120) } : {}),
      ...(updates.phone !== undefined ? { phone: String(updates.phone).trim().slice(0, 40) } : {}),
      ...(updates.department !== undefined ? { department: String(updates.department).trim().slice(0, 120) } : {}),
      ...(updates.emergencySector !== undefined
        ? { emergencySector: String(updates.emergencySector).trim().slice(0, 120) }
        : {}),
      ...(typeof updates.avatarUrl === 'string' && updates.avatarUrl.trim()
        ? { avatarUrl: updates.avatarUrl.trim().slice(0, 500) }
        : {}),
    };

    if (!isFirebaseConfigured || !userProfile.uid) {
      return {
        success: false,
        error: firebaseConfigError || 'Signed-in Firebase user session required to update profile.',
      };
    }

    try {
      await floodService.updateUserProfileInFirestore(userProfile.uid, safeUpdates);
      const nextProfile = { ...userProfile, ...safeUpdates };
      setUserProfile(nextProfile);
      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Failed to update profile in Cloud Firestore.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, error: msg };
    }
  };

  const reclusterAllReports = useCallback(() => {
    const rainfallByArea: Record<string, number> = {};
    hotspots.forEach((h) => {
      if (h.rainfallSource !== 'MISSING' && Number.isFinite(h.forecastRainfallMm)) {
        rainfallByArea[h.area] = h.forecastRainfallMm;
      }
    });
    if (
      weather.isLive &&
      weather.expected3hRainfallMm !== null &&
      Number.isFinite(weather.expected3hRainfallMm)
    ) {
      rainfallByArea['__default'] = weather.expected3hRainfallMm;
    }

    const newHotspots = clusterReports(reports, clusteringConfig, rainfallByArea, riskThresholds);
    setHotspots(newHotspots);
    if (authenticatedRole === 'officer') {
      floodService.persistHotspots(newHotspots).catch(() => {});
    }
  }, [reports, clusteringConfig, riskThresholds, hotspots, weather, authenticatedRole]);

  const getAnalytics = useCallback(
    (timeRange: '24h' | '7d' | '30d' | 'all') => {
      return calculateDynamicAnalytics(reports, hotspots, timeRange);
    },
    [reports, hotspots]
  );

  const checkFirebaseConnection = async (): Promise<boolean> => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    try {
      const ok = await testFirestoreConnection();
      if (ok) {
        setDbOperationStatus({
          loading: false,
          error: null,
          success: 'Connected to Cloud Firestore successfully.',
        });
      } else {
        setDbOperationStatus({
          loading: false,
          error: firebaseConfigError || 'Could not establish connection to Firestore server. Verify configuration and rules.',
          success: null,
        });
      }
      return ok;
    } catch (err: any) {
      setDbOperationStatus({
        loading: false,
        error: err?.message || 'Firestore connection probe failed.',
        success: null,
      });
      return false;
    }
  };

  const myReports = reports.filter((r) => {
    if (!isAuthenticated || !userProfile.uid) return false;
    return r.reporterId === userProfile.uid;
  });

  const loginWithEmail = async (email: string, password: string, rememberMe = false) => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      const msg = 'Please enter a valid email address.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    if (!password) {
      const msg = 'Please enter your password.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    if (!isFirebaseConfigured || !auth) {
      const msg = firebaseConfigError || 'Firebase Authentication is not configured in .env.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = userCredential.user;
      const authoritativeRole = await floodService.fetchVerifiedSessionRole(fbUser);
      const profile = await buildProfileFromFirebaseUser(fbUser, authoritativeRole);

      setUserProfile(profile);
      setAuthenticatedRole(authoritativeRole);
      setIsAuthenticated(true);
      setDbOperationStatus({
        loading: false,
        error: null,
        success: `Signed in as ${authoritativeRole === 'officer' ? 'Emergency Officer' : 'Citizen Reporter'}.`,
      });
      return { success: true, role: authoritativeRole };
    } catch (err: any) {
      const msg = floodService.formatFirebaseAuthError(err);
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }
  };

  const loginWithOfficerEmail = async (email: string, password: string, rememberMe = false) => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      const msg = 'Please enter a valid officer email address.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    if (!password) {
      const msg = 'Please enter your password.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    if (!isFirebaseConfigured || !auth) {
      const msg = firebaseConfigError || 'Firebase Authentication is not configured for Emergency Officer sign-in.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    verifyingOfficerRef.current = true;
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = userCredential.user;
      const verifyRes = await floodService.verifyOfficerWithBackend(fbUser);

      if (!verifyRes.authorized || verifyRes.role !== 'officer') {
        await floodService.logout();
        setIsAuthenticated(false);
        setAuthenticatedRole(null);
        setUserProfile(DEFAULT_EMPTY_PROFILE);
        const deniedMsg =
          verifyRes.error ||
          'Access denied: this account is not pre-authorized as an Emergency Officer.';
        setDbOperationStatus({ loading: false, error: deniedMsg, success: null });
        return { success: false, role: 'citizen' as const, message: deniedMsg };
      }

      const profile = await buildProfileFromFirebaseUser(fbUser, 'officer');
      setUserProfile(profile);
      setAuthenticatedRole('officer');
      setIsAuthenticated(true);
      setDbOperationStatus({
        loading: false,
        error: null,
        success: 'Emergency Officer credentials verified. Opening Operations Center.',
      });
      return { success: true, role: 'officer' as const };
    } catch (err: any) {
      const msg = floodService.formatFirebaseAuthError(err);
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    } finally {
      verifyingOfficerRef.current = false;
    }
  };

  const loginWithOfficerGoogle = async (useRedirect = false) => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    if (!isFirebaseConfigured || !auth) {
      const msg = firebaseConfigError || 'Firebase Authentication must be configured to sign in as an Emergency Officer with Google.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    verifyingOfficerRef.current = true;
    try {
      const googleRes = await floodService.loginWithGoogle({ portal: 'officer', useRedirect });
      if (googleRes?.redirected) {
        setDbOperationStatus({
          loading: false,
          error: null,
          success: 'Redirecting to Google Sign-In for Emergency Officer verification...',
        });
        return { success: false, role: 'citizen' as const, redirected: true };
      }

      if (!googleRes?.fbUser) {
        const msg = 'Google authentication did not return a valid Firebase user.';
        setDbOperationStatus({ loading: false, error: msg, success: null });
        return { success: false, role: 'citizen' as const, message: msg };
      }

      const verifyRes = await floodService.verifyOfficerWithBackend(googleRes.fbUser);
      if (!verifyRes.authorized || verifyRes.role !== 'officer') {
        await floodService.logout();
        setIsAuthenticated(false);
        setAuthenticatedRole(null);
        setUserProfile(DEFAULT_EMPTY_PROFILE);
        const deniedMsg =
          verifyRes.error ||
          'Access denied: this Google account is not pre-authorized as an Emergency Officer.';
        setDbOperationStatus({ loading: false, error: deniedMsg, success: null });
        return { success: false, role: 'citizen' as const, message: deniedMsg };
      }

      const profile = await buildProfileFromFirebaseUser(googleRes.fbUser, 'officer');
      setUserProfile(profile);
      setAuthenticatedRole('officer');
      setIsAuthenticated(true);
      setDbOperationStatus({
        loading: false,
        error: null,
        success: `Verified Emergency Officer ${profile.name} via Google & backend Admin SDK.`,
      });
      return { success: true, role: 'officer' as const };
    } catch (err: any) {
      const msg = floodService.formatFirebaseAuthError(err);
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    } finally {
      verifyingOfficerRef.current = false;
    }
  };

  const registerWithEmail = async (name: string, email: string, password: string, phone?: string) => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      const msg = 'Please enter your full name.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, message: msg };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const msg = 'Please enter a valid email address.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, message: msg };
    }
    if (password.length < 6) {
      const msg = 'Password must be at least 6 characters.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, message: msg };
    }

    if (!isFirebaseConfigured || !auth) {
      const msg = firebaseConfigError || 'Firebase Authentication is not configured in .env.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, message: msg };
    }

    registeringRef.current = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const fbUid = cred.user.uid;
      await updateProfile(cred.user, { displayName: cleanName });
      await floodService.createCitizenUserProfileInFirestore(fbUid, cleanName, cleanEmail, phone);

      const newCitizen: UserProfile = {
        uid: fbUid,
        name: cleanName,
        roleName: 'Citizen Reporter & Resident',
        department: 'Colombo Community Sentinel',
        email: cleanEmail,
        phone: phone?.trim() || '',
        avatarUrl: cred.user.photoURL || '',
        emergencySector: 'Western Province — Citizen Sentinel',
        isFirebaseUser: true,
      };

      setUserProfile(newCitizen);
      setAuthenticatedRole('citizen');
      setIsAuthenticated(true);

      setDbOperationStatus({
        loading: false,
        error: null,
        success: `Account registered successfully for ${cleanName}. Welcome to FloodSense!`,
      });
      return { success: true };
    } catch (err: any) {
      const msg = floodService.formatFirebaseAuthError(err);
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, message: msg };
    } finally {
      registeringRef.current = false;
    }
  };

  const requestPasswordReset = async (email: string) => {
    return floodService.sendPasswordReset(email);
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      await floodService.logout();
    }
    setIsAuthenticated(false);
    setAuthenticatedRole(null);
    setUserProfile(DEFAULT_EMPTY_PROFILE);
    setNotifications([]);
    setDbOperationStatus({
      loading: false,
      error: null,
      success: 'Signed out successfully.',
    });
  };

  const loginWithGoogle = async (useRedirect = false) => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    if (!isFirebaseConfigured || !auth) {
      const msg = firebaseConfigError || 'Firebase Authentication is not configured in .env.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    try {
      const user = await floodService.loginWithGoogle({ portal: 'citizen', useRedirect });
      if (user?.redirected) {
        setDbOperationStatus({
          loading: false,
          error: null,
          success: 'Redirecting to Google Sign-In...',
        });
        return { success: false, role: 'citizen' as const, redirected: true };
      }

      if (!user?.fbUser || !user.role) {
        const msg = 'Google authentication did not return a valid session.';
        setDbOperationStatus({ loading: false, error: msg, success: null });
        return { success: false, role: 'citizen' as const, message: msg };
      }

      const profile = await buildProfileFromFirebaseUser(user.fbUser, user.role);
      setUserProfile(profile);
      setAuthenticatedRole(user.role);
      setIsAuthenticated(true);
      setDbOperationStatus({
        loading: false,
        error: null,
        success: `Signed in as ${profile.name} via Google Firebase Auth.`,
      });
      return { success: true, role: user.role };
    } catch (err: any) {
      const msg = floodService.formatFirebaseAuthError(err);
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }
  };

  const logoutGoogle = async () => {
    await logout();
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => {
      prev.forEach((n) => {
        if (n.unread) {
          floodService.markNotificationReadInFirestore(n.id).catch(() => {});
        }
      });
      return prev.map((n) => ({ ...n, unread: false }));
    });
  };

  const markNotificationAsRead = (id: string) => {
    floodService.markNotificationReadInFirestore(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };

  const addNotification = (n: Omit<NotificationItem, 'id' | 'time' | 'unread'>) => {
    const newItem: NotificationItem = {
      ...n,
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: 'Just now',
      unread: true,
    };
    setNotifications((prev) => [newItem, ...prev]);
  };

  const addReport = async (
    newReportData: Omit<
      FloodReport,
      | 'id'
      | 'timestamp'
      | 'riskLevel'
      | 'verificationStatus'
      | 'incidentStatus'
      | 'statusHistory'
      | 'aiConfidence'
      | 'aiClassification'
      | 'aiVerificationDetails'
      | 'isDuplicate'
      | 'duplicateOfReportId'
    > & {
      imageFile?: File;
      compressedEvidence?: CompressedReportImage;
      customImage?: string;
      imageMimeType?: string;
      onUploadProgress?: (percent: number) => void;
    }
  ) => {
    setDbOperationStatus({ loading: true, error: null, success: null });

    if (!auth?.currentUser?.uid) {
      const err = new Error('Authentication required before submitting a flood report.');
      setDbOperationStatus({ loading: false, error: err.message, success: null });
      throw err;
    }

    const enrichedInput = {
      ...newReportData,
      reporterName: newReportData.reporterName || userProfile.name || auth.currentUser.displayName || 'Citizen Reporter',
      reporterPhone: newReportData.reporterPhone !== undefined ? newReportData.reporterPhone : userProfile.phone,
      reporterId: auth.currentUser.uid,
    };

    try {
      const result = await floodService.submitReport(enrichedInput);

      setReports((prev) => {
        if (prev.some((r) => r.id === result.report.id)) return prev;
        return [result.report, ...prev];
      });

      setHotspots((prev) => {
        const existing = prev.find((h) => h.id === result.hotspot.id);
        if (existing) {
          return prev.map((h) => (h.id === result.hotspot.id ? result.hotspot : h));
        }
        return [result.hotspot, ...prev];
      });

      setDbOperationStatus({
        loading: false,
        error: result.evidenceUploadFailed ? result.evidenceUploadError || 'Photo evidence upload failed.' : null,
        success: result.evidenceUploadFailed
          ? `Report ${result.report.id} metadata saved, but photo evidence upload needs retry.`
          : `Report ${result.report.id} saved to Cloud Firestore.`,
      });

      return result;
    } catch (err: any) {
      setDbOperationStatus({
        loading: false,
        error: err?.message || 'Failed to submit report.',
        success: null,
      });
      throw err;
    }
  };

  const getEvidenceForReport = useCallback(async (reportId: string) => {
    return floodService.getEvidenceForReport(reportId);
  }, []);

  const retryReportEvidenceUpload = async (
    reportId: string,
    fileOrCompressed: File | CompressedReportImage
  ) => {
    const saved = await floodService.retryReportEvidenceUpload(reportId, fileOrCompressed);
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              hasEvidence: true,
              evidenceCount: 1,
              primaryEvidenceId: saved.id,
              evidenceStatus: 'SAVED',
              evidenceError: undefined,
            }
          : r
      )
    );
    return saved;
  };

  const deleteReport = async (reportId: string) => {
    const outcome = await floodService.deleteReportAndEvidence(reportId);
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    setDbOperationStatus({
      loading: false,
      error: null,
      success: `Report ${reportId} and its Firestore evidence deleted.`,
    });
    return outcome;
  };

  const retryAiVerification = async (
    reportId: string,
    override?: { customImage?: string; mimeType?: string }
  ): Promise<FloodReport | null> => {
    const updated = await floodService.retryAiVerification(reportId, override);
    if (updated) {
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
    }
    return updated;
  };

  const updateIncidentStatus = async (
    reportId: string,
    newStatus: IncidentStatus,
    officerNote?: string
  ): Promise<FloodReport | null> => {
    try {
      const res = await floodService.updateIncidentStatus(
        reportId,
        newStatus,
        userProfile.name || 'Emergency Officer',
        officerNote
      );

      if (res?.report) {
        setReports((prev) => prev.map((r) => (r.id === reportId ? res.report : r)));
        if (res.auditRecord) {
          setBlockchainRecords((prev) => {
            if (prev.some((b) => b.eventId === res.auditRecord!.eventId)) return prev;
            return [res.auditRecord!, ...prev];
          });
        }
        return res.report;
      }
      return null;
    } catch (err: any) {
      setDbOperationStatus({
        loading: false,
        error: err?.message || 'Failed to update status in cloud database.',
        success: null,
      });
      throw err;
    }
  };

  const retryPublicSync = async (
    reportId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await floodService.retryPublicSync(reportId);
    if (res.ok) {
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                publicSyncStatus: 'SYNCED',
                publicSyncError: undefined,
                hotspotId: res.hotspot?.id || r.hotspotId,
              }
            : r
        )
      );
      if (res.hotspot) {
        setHotspots((prev) => {
          const exists = prev.some((h) => h.id === res.hotspot!.id);
          return exists
            ? prev.map((h) => (h.id === res.hotspot!.id ? res.hotspot! : h))
            : [res.hotspot!, ...prev];
        });
      }
      return { ok: true };
    }
    return { ok: false, error: res.error || 'Public sync retry failed.' };
  };

  return (
    <FloodContext.Provider
      value={{
        reports,
        myReports,
        hotspots,
        blockchainRecords,
        weather,
        refreshWeather,
        role,
        authenticatedRole,
        isAuthLoading,
        userProfile,
        setUserProfile,
        updateUserProfile,
        retryPublicSync,
        isAuthenticated,
        loginWithEmail,
        loginWithOfficerEmail,
        loginWithOfficerGoogle,
        registerWithEmail,
        requestPasswordReset,
        logout,
        selectedHotspotId,
        setSelectedHotspotId,
        selectedReportId,
        setSelectedReportId,
        notifications,
        markAllNotificationsAsRead,
        markNotificationAsRead,
        addNotification,
        addReport,
        getEvidenceForReport,
        retryReportEvidenceUpload,
        deleteReport,
        retryAiVerification,
        updateIncidentStatus,
        searchQuery,
        setSearchQuery,
        clusteringConfig,
        setClusteringConfig,
        riskThresholds,
        setRiskThresholds,
        reclusterAllReports,
        getAnalytics,
        isFirebaseAvailable,
        firebaseConfigError,
        dbOperationStatus,
        loginWithGoogle,
        logoutGoogle,
        checkFirebaseConnection,
      }}
    >
      {children}
    </FloodContext.Provider>
  );
};

export const useFlood = () => {
  const context = useContext(FloodContext);
  if (!context) {
    throw new Error('useFlood must be used within a FloodProvider');
  }
  return context;
};
