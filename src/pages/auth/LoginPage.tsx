/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail,
  Lock,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  User,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { EditorialImage } from '../../components/common/EditorialMedia';

type LoginPortalMode = 'citizen' | 'officer';

export const LoginPage: React.FC = () => {
  const {
    loginWithEmail,
    loginWithOfficerEmail,
    loginWithGoogle,
    loginWithOfficerGoogle,
    requestPasswordReset,
    isFirebaseAvailable,
    firebaseConfigError,
  } = useFlood();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const routeState = (location.state as {
    from?: string;
    portal?: LoginPortalMode;
    accessDeniedMessage?: string;
  } | null) || null;

  const initialPortal: LoginPortalMode =
    searchParams.get('portal') === 'officer' || routeState?.portal === 'officer'
      ? 'officer'
      : 'citizen';

  const [loginPortal, setLoginPortal] = useState<LoginPortalMode>(initialPortal);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(
    routeState?.accessDeniedMessage || null
  );
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [showRedirectFallback, setShowRedirectFallback] = useState(false);

  // Forgot password inline panel
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetFeedback, setResetFeedback] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (searchParams.get('portal') === 'officer' || routeState?.portal === 'officer') {
      setLoginPortal('officer');
    }
    if (routeState?.accessDeniedMessage) {
      setLocalError(routeState.accessDeniedMessage);
    }
  }, [searchParams, routeState?.portal, routeState?.accessDeniedMessage]);

  const handleSelectPortal = (nextPortal: LoginPortalMode) => {
    setLoginPortal(nextPortal);
    setLocalError(null);
    const nextParams = new URLSearchParams(searchParams);
    if (nextPortal === 'officer') {
      nextParams.set('portal', 'officer');
    } else {
      nextParams.delete('portal');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLocalError('Please enter both your email and password.');
      return;
    }
    setLocalError(null);
    setIsSubmitting(true);

    try {
      const result =
        loginPortal === 'officer'
          ? await loginWithOfficerEmail(email, password, rememberMe)
          : await loginWithEmail(email, password, rememberMe);

      if (result.success) {
        if (loginPortal === 'officer' || result.role === 'officer') {
          navigate('/officer/overview', { replace: true });
        } else {
          navigate('/citizen', { replace: true });
        }
      } else {
        setLocalError(result.message || 'Login failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await requestPasswordReset(resetEmail || email);
    setResetFeedback(res);
  };

  const handleGoogleSignIn = async (forceRedirect = false) => {
    setLocalError(null);
    setLocalNotice(null);
    setIsSubmitting(true);
    try {
      const res =
        loginPortal === 'officer'
          ? await loginWithOfficerGoogle(forceRedirect)
          : await loginWithGoogle(forceRedirect);

      if (res.redirected) {
        setLocalNotice('Redirecting to Google Sign-In... please wait.');
        return;
      }

      if (res.success) {
        navigate(
          loginPortal === 'officer' || res.role === 'officer' ? '/officer/overview' : '/citizen',
          { replace: true }
        );
      } else if (res.message) {
        setLocalError(res.message);
        if (/popup|cross-origin|blocked|closed/i.test(res.message)) {
          setShowRedirectFallback(true);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOfficerPortal = loginPortal === 'officer';

  return (
    <div className="min-h-screen bg-[#F5F5F2] text-[#171717] grid grid-cols-1 lg:grid-cols-12 font-sans">
      {/* Left Architectural Editorial Backdrop */}
      <aside className="hidden lg:flex lg:col-span-5 relative bg-[#181818] text-white flex-col justify-between p-10 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <EditorialImage
            src="/assets/images/login-background.jpg"
            fallbackSrc="/images/flood_canal_drainage_1794422511595.jpg"
            alt="Colombo urban flood monitoring canal infrastructure"
            className="w-full h-full object-cover opacity-45"
            darkSurface
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/85" />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <NavLink
            to="/"
            className="font-sans font-extrabold text-sm tracking-[0.22em] uppercase text-white"
          >
            FLOODSENSE
          </NavLink>
          <span className="text-[11px] font-mono text-white/70">Colombo Basin Network</span>
        </div>

        <div className="relative z-10 space-y-4 max-w-md">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/70 font-semibold">
            {isOfficerPortal ? 'AUTHORIZED OPERATIONS ACCESS' : 'CITIZEN & OFFICER ACCESS'}
          </p>
          <h1 className="font-serif text-4xl leading-[1.12] text-white [text-wrap:balance]">
            {isOfficerPortal
              ? 'Coordinated Emergency Operations Center.'
              : 'Every ground observation protects a neighborhood.'}
          </h1>
          <p className="text-sm text-white/80 leading-relaxed">
            {isOfficerPortal
              ? 'Authenticate with your municipal officer credentials to triage flood clusters, review visual evidence, and issue public advisories.'
              : 'Sign in to report flooded corridors, monitor verification updates, and view active advisories across Colombo sectors.'}
          </p>
        </div>

        <div className="relative z-10 pt-6 border-t border-white/15 flex items-center justify-between text-xs text-white/70">
          <span>Firebase Authentication · RBAC Verified</span>
          <NavLink to="/map-public" className="text-white hover:underline font-medium">
            Public Map →
          </NavLink>
        </div>
      </aside>

      {/* Right Authentication Form Canvas */}
      <main className="lg:col-span-7 flex flex-col justify-center py-10 px-4 sm:px-8 lg:px-16">
        <div className="mx-auto w-full max-w-md space-y-6">
          {/* Mobile Brand Back Link */}
          <div className="flex items-center justify-between lg:hidden">
            <NavLink
              to="/"
              className="font-sans font-extrabold text-sm tracking-[0.22em] uppercase text-[#171717]"
            >
              FLOODSENSE
            </NavLink>
            <NavLink to="/map-public" className="text-xs font-medium text-[#666666] hover:text-[#171717]">
              Public Map
            </NavLink>
          </div>

          <div>
            <h2 className="font-serif text-3xl text-[#171717] tracking-tight">
              {isOfficerPortal ? 'Emergency Officer Sign In' : 'Sign In to FloodSense'}
            </h2>
            <p className="mt-1.5 text-xs text-[#666666]">
              {isOfficerPortal
                ? 'Restricted access for pre-authorized Municipal Emergency Operations Officers.'
                : 'Access the Citizen Reporting Portal or switch to Emergency Officer Login.'}
            </p>
          </div>

          <div
            className={`bg-white py-7 px-6 sm:px-8 rounded-lg border border-[#E5E5E2] space-y-5 transition-colors ${
              isOfficerPortal ? 'border-t-2 border-t-[#D97706]' : ''
            }`}
          >
            {/* Portal Selector Tabs: Citizen Login vs Emergency Officer Login */}
            <div
              role="tablist"
              aria-label="Select FloodSense login portal"
              className="grid grid-cols-2 gap-1 p-1 bg-[#F5F5F2] rounded-md border border-[#E5E5E2]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!isOfficerPortal}
                data-testid="tab-citizen-login"
                onClick={() => handleSelectPortal('citizen')}
                className={`py-2 px-3 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  !isOfficerPortal
                    ? 'bg-[#171717] text-white'
                    : 'text-[#666666] hover:text-[#171717]'
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>Citizen Login</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={isOfficerPortal}
                data-testid="tab-officer-login"
                onClick={() => handleSelectPortal('officer')}
                className={`py-2 px-3 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  isOfficerPortal
                    ? 'bg-[#171717] text-white'
                    : 'text-[#666666] hover:text-[#171717]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Emergency Officer Login</span>
              </button>
            </div>

            {/* Officer Authorization Notice or Firebase Status Notice */}
            {isOfficerPortal && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-950 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-amber-950">Pre-Authorized Emergency Officers Only</p>
                  <p className="text-amber-900 leading-relaxed">
                    Officer identity is authenticated by Firebase Authentication and verified on the backend via trusted role claims. Public officer self-registration is disabled.
                  </p>
                </div>
              </div>
            )}

            {!isFirebaseAvailable ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  {firebaseConfigError || 'Firebase client configuration is missing in .env. Set VITE_FIREBASE_* variables to enable sign-in.'}
                </span>
              </div>
            ) : !isOfficerPortal ? (
              <div className="p-3 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[11px] text-[#666666] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#171717] shrink-0" />
                <span>Firebase Authentication connected. Sign in with your Citizen account or select Emergency Officer Login above.</span>
              </div>
            ) : null}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {localNotice && (
                <div
                  role="status"
                  className="p-3 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-xs text-[#171717] flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>{localNotice}</span>
                </div>
              )}

              {localError && (
                <div
                  role="alert"
                  data-testid="login-error-alert"
                  className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    <span>{localError}</span>
                  </div>
                  {showRedirectFallback && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleGoogleSignIn(true)}
                      className="text-[11px] font-bold text-[#171717] underline cursor-pointer"
                    >
                      Try full-page Google redirect sign-in instead
                    </button>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-[#171717] mb-1.5">
                  {isOfficerPortal ? 'Authorized Officer Email' : 'Email Address'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder={
                      isOfficerPortal
                        ? 'e.g. officer@municipality.gov.lk'
                        : 'e.g. nimalka.senanayake@gmail.com'
                    }
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666]/70 focus:bg-white focus:outline-none focus:border-[#171717]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-semibold text-[#171717]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(!showForgotPassword);
                      setResetFeedback(null);
                      setResetEmail(email);
                    }}
                    className="text-[11px] text-[#666666] hover:text-[#171717] hover:underline font-medium cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666]/70 focus:bg-white focus:outline-none focus:border-[#171717]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#171717] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2 text-xs text-[#666666] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded-sm border-[#E5E5E2] text-[#171717] focus:ring-[#171717]"
                />
                <span>Remember me on this device</span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="login-submit-button"
                className="w-full py-3 px-4 rounded-sm bg-[#171717] hover:bg-black text-white font-semibold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>
                    {isOfficerPortal ? 'Verifying Officer Authorization...' : 'Verifying credentials...'}
                  </span>
                ) : (
                  <>
                    <span>
                      {isOfficerPortal ? 'Sign In to Emergency Officer Portal' : 'Sign In to Citizen Account'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Forgot Password Inline Panel */}
            {showForgotPassword && (
              <form
                onSubmit={handleForgotPasswordSubmit}
                className="p-4 bg-[#F5F5F2] border border-[#E5E5E2] rounded-md space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#171717]">
                  <KeyRound className="w-4 h-4" />
                  <span>Password Recovery</span>
                </div>
                <p className="text-[11px] text-[#666666]">
                  Enter your account email to receive password reset instructions.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-[#E5E5E2] rounded-md text-[#171717] focus:outline-none focus:border-[#171717]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-[#171717] hover:bg-black text-white text-xs font-semibold rounded-md cursor-pointer"
                  >
                    Send Link
                  </button>
                </div>
                {resetFeedback && (
                  <div
                    className={`p-2.5 rounded-md text-[11px] flex items-start gap-2 border ${
                      resetFeedback.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-red-50 border-red-200 text-red-900'
                    }`}
                  >
                    {resetFeedback.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-700 shrink-0 mt-0.5" />
                    )}
                    <span>{resetFeedback.message}</span>
                  </div>
                )}
              </form>
            )}

            {/* Google Firebase Sign In */}
            <button
              type="button"
              disabled={isSubmitting}
              data-testid="google-signin-button"
              onClick={() => handleGoogleSignIn(false)}
              className="w-full py-2.5 px-4 rounded-sm bg-white hover:bg-[#F5F5F2] text-[#171717] border border-[#E5E5E2] text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>
                {isOfficerPortal
                  ? 'Sign in as Emergency Officer with Google'
                  : 'Continue with Google Account'}
              </span>
            </button>

            {isOfficerPortal ? (
              <div className="text-center text-xs text-[#666666] pt-1">
                <span>Citizen contributor? </span>
                <button
                  type="button"
                  onClick={() => handleSelectPortal('citizen')}
                  className="text-[#171717] font-semibold hover:underline cursor-pointer"
                >
                  Switch to Citizen Login
                </button>
                <span> or </span>
                <NavLink to="/register" className="text-[#171717] font-semibold hover:underline">
                  Register Citizen Account
                </NavLink>
              </div>
            ) : (
              <div className="text-center text-xs text-[#666666] pt-1">
                <span>Don&apos;t have an account yet? </span>
                <NavLink to="/register" className="text-[#171717] font-semibold hover:underline">
                  Create Citizen Account
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
