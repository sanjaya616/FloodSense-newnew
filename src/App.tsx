/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { FloodProvider, useFlood } from './context/FloodContext';

// Layouts
import { DashboardLayout } from './components/layout/DashboardLayout';
import { CitizenLayout } from './components/layout/CitizenLayout';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { PublicMapPage } from './pages/public/PublicMapPage';
import { SafetyInfoPage } from './pages/public/SafetyInfoPage';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// Citizen Portal Pages
import { CitizenDashboardPage } from './pages/citizen/CitizenDashboardPage';
import { CitizenReportWizardPage } from './pages/citizen/CitizenReportWizardPage';
import { CitizenReportsPage } from './pages/citizen/CitizenReportsPage';
import { CitizenNotificationsPage } from './pages/citizen/CitizenNotificationsPage';
import { CitizenProfilePage } from './pages/citizen/CitizenProfilePage';

// Officer EOC Dashboard Pages
import { OverviewPage } from './pages/OverviewPage';
import { OfficerIncidentsPage } from './pages/officer/OfficerIncidentsPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { ReportFloodPage } from './pages/ReportFloodPage';
import { FloodHotspotsPage } from './pages/FloodHotspotsPage';
import { RiskPredictionsPage } from './pages/RiskPredictionsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BlockchainRegistryPage } from './pages/BlockchainRegistryPage';
import { SettingsPage } from './pages/SettingsPage';
import { MethodologyPage } from './pages/MethodologyPage';

const AuthLoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-[#F5F5F2] flex flex-col items-center justify-center p-6 font-sans">
    <div className="w-8 h-8 rounded-full border-2 border-[#171717] border-t-transparent animate-spin mb-4" />
    <p className="text-xs font-medium tracking-wide uppercase text-[#666666]">
      Verifying session credentials
    </p>
  </div>
);

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAuthLoading } = useFlood();
  const location = useLocation();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
};

const RequireOfficer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAuthLoading, authenticatedRole } = useFlood();
  const location = useLocation();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login?portal=officer"
        state={{
          from: location.pathname,
          portal: 'officer',
          accessDeniedMessage:
            'Emergency Officer authentication is required to access the Officer Operations Center.',
        }}
        replace
      />
    );
  }

  if (authenticatedRole !== 'officer') {
    return (
      <Navigate
        to="/citizen"
        state={{
          accessDenied: true,
          deniedFrom: location.pathname,
          accessDeniedMessage:
            'Access Denied (403): Only pre-authorized Emergency Officers may access Officer Operations routes.',
        }}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <FloodProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Home Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Citizen Portal & Public Safety (CitizenLayout) */}
          <Route element={<CitizenLayout />}>
            <Route
              path="/citizen"
              element={
                <RequireAuth>
                  <CitizenDashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/citizen/report"
              element={
                <RequireAuth>
                  <CitizenReportWizardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/citizen/reports"
              element={
                <RequireAuth>
                  <CitizenReportsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/citizen/notifications"
              element={
                <RequireAuth>
                  <CitizenNotificationsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/citizen/profile"
              element={
                <RequireAuth>
                  <CitizenProfilePage />
                </RequireAuth>
              }
            />
            <Route path="/map-public" element={<PublicMapPage />} />
            <Route path="/safety" element={<SafetyInfoPage />} />
          </Route>

          {/* Officer Operations Center (DashboardLayout + RequireOfficer) */}
          <Route
            path="/officer"
            element={
              <RequireOfficer>
                <DashboardLayout />
              </RequireOfficer>
            }
          >
            <Route index element={<Navigate to="/officer/overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="incidents" element={<OfficerIncidentsPage />} />
            <Route path="map" element={<LiveMapPage />} />
            <Route path="report" element={<ReportFloodPage />} />
            <Route path="hotspots" element={<FloodHotspotsPage />} />
            <Route path="predictions" element={<RiskPredictionsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="blockchain" element={<BlockchainRegistryPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="methodology" element={<MethodologyPage />} />
          </Route>

          {/* Backward Compatibility Redirects */}
          <Route path="/overview" element={<Navigate to="/officer/overview" replace />} />
          <Route path="/incidents" element={<Navigate to="/officer/incidents" replace />} />
          <Route path="/map" element={<Navigate to="/officer/map" replace />} />
          <Route path="/report" element={<Navigate to="/citizen/report" replace />} />
          <Route path="/hotspots" element={<Navigate to="/officer/hotspots" replace />} />
          <Route path="/predictions" element={<Navigate to="/officer/predictions" replace />} />
          <Route path="/analytics" element={<Navigate to="/officer/analytics" replace />} />
          <Route path="/blockchain" element={<Navigate to="/officer/blockchain" replace />} />
          <Route path="/settings" element={<Navigate to="/officer/settings" replace />} />
          <Route path="/methodology" element={<Navigate to="/officer/methodology" replace />} />

          {/* Fallback to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </FloodProvider>
  );
}
