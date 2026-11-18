/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Lock,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { EditorialImage } from '../../components/common/EditorialMedia';

export const RegisterPage: React.FC = () => {
  const { registerWithEmail, loginWithGoogle, isFirebaseAvailable, firebaseConfigError } = useFlood();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: 'None', color: 'bg-[#E5E5E2]' };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score === 1) return { score: 1, label: 'Weak', color: 'bg-red-600' };
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-[#171717]' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-700' };
  }, [password]);

  const handleGoogleRegister = async (forceRedirect = false) => {
    setErrorMessage(null);
    const res = await loginWithGoogle(forceRedirect);
    if (res.redirected) {
      return;
    }
    if (res.success) {
      navigate(res.role === 'officer' ? '/officer/overview' : '/citizen');
    } else if (res.message) {
      setErrorMessage(res.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (!agreeTerms) {
      setErrorMessage('Please confirm agreement to the FloodSense Privacy Policy and Community Safety Terms.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerWithEmail(name, email, password, phone);
      if (result.success) {
        navigate('/citizen');
      } else {
        setErrorMessage(result.message || 'Registration failed.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Registration error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F2] text-[#171717] grid grid-cols-1 lg:grid-cols-12 font-sans">
      {/* Left Architectural Editorial Backdrop */}
      <aside className="hidden lg:flex lg:col-span-5 relative bg-[#181818] text-white flex-col justify-between p-10 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <EditorialImage
            src="/assets/images/login-background.jpg"
            fallbackSrc="/images/flood_canal_drainage_1794422511595.jpg"
            alt="Colombo urban drainage and monsoon preparedness"
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
          <span className="text-[11px] font-mono text-white/70">Citizen Network</span>
        </div>

        <div className="relative z-10 space-y-4 max-w-md">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/70 font-semibold">
            CITIZEN REPORTER REGISTRATION
          </p>
          <h1 className="font-serif text-4xl leading-[1.12] text-white [text-wrap:balance]">
            Join Colombo residents strengthening urban flood awareness.
          </h1>
          <p className="text-sm text-white/80 leading-relaxed">
            Your verified geotagged photographs and street depth notes help emergency teams
            prioritize drainage dispatches and keep motorists safe.
          </p>
        </div>

        <div className="relative z-10 pt-6 border-t border-white/15 flex items-center justify-between text-xs text-white/70">
          <span>Privacy Protected Public Coordinates</span>
          <NavLink to="/safety" className="text-white hover:underline font-medium">
            Safety Guide →
          </NavLink>
        </div>
      </aside>

      {/* Right Registration Canvas */}
      <main className="lg:col-span-7 flex flex-col justify-center py-10 px-4 sm:px-8 lg:px-16">
        <div className="mx-auto w-full max-w-md space-y-6">
          {/* Mobile Header */}
          <div className="flex items-center justify-between lg:hidden">
            <NavLink
              to="/"
              className="font-sans font-extrabold text-sm tracking-[0.22em] uppercase text-[#171717]"
            >
              FLOODSENSE
            </NavLink>
            <NavLink to="/login" className="text-xs font-medium text-[#666666] hover:text-[#171717]">
              Sign In
            </NavLink>
          </div>

          <div>
            <h2 className="font-serif text-3xl text-[#171717] tracking-tight">
              Create Citizen Account
            </h2>
            <p className="mt-1.5 text-xs text-[#666666]">
              Join Colombo residents in reporting street waterlogging and protecting communities.
            </p>
          </div>

          <div className="bg-white py-7 px-6 sm:px-8 rounded-lg border border-[#E5E5E2] space-y-5">
            {!isFirebaseAvailable && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  {firebaseConfigError || 'Firebase client configuration is missing in .env. Citizen registration requires Firebase Authentication.'}
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label htmlFor="reg-name" className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-name"
                    type="text"
                    required
                    placeholder="e.g. Amali Wickramasinghe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666]/70 focus:bg-white focus:outline-none focus:border-[#171717]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    placeholder="e.g. resident@colombo.lk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666]/70 focus:bg-white focus:outline-none focus:border-[#171717]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Contact Phone (for emergency updates)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-phone"
                    type="tel"
                    placeholder="+94 77 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666]/70 focus:bg-white focus:outline-none focus:border-[#171717]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="reg-password" className="block text-xs font-semibold text-[#171717]">
                    Password
                  </label>
                  {password && (
                    <span className="text-[10px] font-mono font-semibold text-[#666666]">
                      Strength: <span className="text-[#171717]">{passwordStrength.label}</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Create a strong password (min 6 chars)"
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

                {/* Password strength meter bar */}
                {password && (
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-1 rounded-sm ${
                          passwordStrength.score >= step ? passwordStrength.color : 'bg-[#EEEEEB]'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="reg-confirm" className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666]/70 focus:bg-white focus:outline-none focus:border-[#171717]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#171717] cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Privacy Policy & Terms Checkbox */}
              <label className="flex items-start gap-2.5 text-xs text-[#666666] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded-sm border-[#E5E5E2] text-[#171717] focus:ring-[#171717]"
                />
                <span>
                  I agree to the{' '}
                  <NavLink to="/safety" className="text-[#171717] font-semibold hover:underline">
                    FloodSense Privacy Policy
                  </NavLink>{' '}
                  and submit ground-truth flood observations in good faith.
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-sm bg-[#171717] hover:bg-black text-white font-semibold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Creating Citizen Account...</span>
                ) : (
                  <>
                    <span>Complete Citizen Registration</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[#E5E5E2]" />
              <span className="flex-shrink mx-4 text-[10px] text-[#666666] uppercase tracking-wider font-mono">
                or quick sign up
              </span>
              <div className="flex-grow border-t border-[#E5E5E2]" />
            </div>

            <button
              type="button"
              onClick={() => handleGoogleRegister(false)}
              className="w-full py-2.5 px-4 rounded-sm bg-white hover:bg-[#F5F5F2] text-[#171717] border border-[#E5E5E2] text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
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
              <span>Sign up with Google</span>
            </button>

            <div className="text-center text-xs text-[#666666]">
              <span>Already have an account? </span>
              <NavLink to="/login" className="text-[#171717] font-semibold hover:underline">
                Sign In Here
              </NavLink>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
