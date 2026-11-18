/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  MapPin,
  ShieldCheck,
  Cpu,
  ArrowRight,
  ArrowDown,
  PhoneCall,
  Layers,
  Menu,
  X,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { FloodMap } from '../../components/map/FloodMap';
import { RiskBadge } from '../../components/common/RiskBadge';
import { EditorialImage, Reveal } from '../../components/common/EditorialMedia';

export const LandingPage: React.FC = () => {
  const { hotspots, reports, weather, isAuthenticated, authenticatedRole, getAnalytics } = useFlood();
  const analytics = getAnalytics('all');

  const [scrolled, setScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const activeHotspots = hotspots.slice(0, 4);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F2] text-[#171717] flex flex-col font-sans">
      {/* Transparent-to-White Editorial Top Bar */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md text-[#171717] border-b border-[#E5E5E2]'
            : 'bg-transparent text-white border-b border-white/15'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <NavLink
            to="/"
            className="font-sans font-extrabold text-sm sm:text-base tracking-[0.22em] uppercase whitespace-nowrap shrink-0"
          >
            FLOODSENSE
          </NavLink>

          {/* Zone 2: Primary Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium tracking-wide">
            <NavLink
              to="/"
              className={`whitespace-nowrap shrink-0 transition-opacity hover:opacity-70 ${
                scrolled ? 'text-[#171717]' : 'text-white'
              }`}
            >
              Home
            </NavLink>
            <a
              href="#how-it-works"
              className={`whitespace-nowrap shrink-0 transition-opacity hover:opacity-70 ${
                scrolled ? 'text-[#666666] hover:text-[#171717]' : 'text-white/80 hover:text-white'
              }`}
            >
              How It Works
            </a>
            <NavLink
              to="/map-public"
              className={`whitespace-nowrap shrink-0 transition-opacity hover:opacity-70 ${
                scrolled ? 'text-[#666666] hover:text-[#171717]' : 'text-white/80 hover:text-white'
              }`}
            >
              Live Flood Map
            </NavLink>
            <NavLink
              to="/safety"
              className={`whitespace-nowrap shrink-0 transition-opacity hover:opacity-70 ${
                scrolled ? 'text-[#666666] hover:text-[#171717]' : 'text-white/80 hover:text-white'
              }`}
            >
              Safety Information
            </NavLink>
            {!isAuthenticated && (
              <NavLink
                to="/login"
                className={`whitespace-nowrap shrink-0 transition-opacity hover:opacity-70 ${
                  scrolled ? 'text-[#666666] hover:text-[#171717]' : 'text-white/80 hover:text-white'
                }`}
              >
                Login
              </NavLink>
            )}
          </nav>

          {/* Zone 3: Single Primary Action + Mobile Drawer Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            {isAuthenticated && authenticatedRole ? (
              <NavLink
                to={authenticatedRole === 'officer' ? '/officer/overview' : '/citizen'}
                className={`hidden md:inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wide rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                  scrolled
                    ? 'bg-[#171717] text-white hover:bg-black'
                    : 'bg-white text-[#171717] hover:bg-[#EEEEEB]'
                }`}
              >
                <span>{authenticatedRole === 'officer' ? 'Open Officer EOC' : 'Open Citizen Portal'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </NavLink>
            ) : (
              <NavLink
                to="/register"
                className={`hidden md:inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wide rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                  scrolled
                    ? 'bg-[#171717] text-white hover:bg-black'
                    : 'bg-white text-[#171717] hover:bg-[#EEEEEB]'
                }`}
              >
                <span>Register</span>
              </NavLink>
            )}

            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label="Toggle navigation menu"
              className={`md:hidden p-2 rounded-sm transition-colors ${
                scrolled
                  ? 'text-[#171717] hover:bg-[#EEEEEB]'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileNavOpen && (
          <div className="md:hidden bg-white text-[#171717] border-b border-[#E5E5E2] px-6 py-5 space-y-3 shadow-lg">
            <div className="flex flex-col space-y-2.5 text-sm font-medium">
              <NavLink to="/" onClick={() => setMobileNavOpen(false)} className="py-1.5">
                Home
              </NavLink>
              <a
                href="#how-it-works"
                onClick={() => setMobileNavOpen(false)}
                className="py-1.5 text-[#666666]"
              >
                How It Works
              </a>
              <NavLink
                to="/map-public"
                onClick={() => setMobileNavOpen(false)}
                className="py-1.5 text-[#666666]"
              >
                Live Flood Map
              </NavLink>
              <NavLink
                to="/safety"
                onClick={() => setMobileNavOpen(false)}
                className="py-1.5 text-[#666666]"
              >
                Safety Information
              </NavLink>
              <NavLink
                to="/login"
                onClick={() => setMobileNavOpen(false)}
                className="py-1.5 text-[#666666]"
              >
                Login
              </NavLink>
              <NavLink
                to="/login?portal=officer"
                onClick={() => setMobileNavOpen(false)}
                className="py-1.5 text-[#666666]"
              >
                Emergency Officer Portal
              </NavLink>
            </div>
            <div className="pt-3 border-t border-[#E5E5E2]">
              <NavLink
                to={
                  isAuthenticated && authenticatedRole
                    ? authenticatedRole === 'officer'
                      ? '/officer/overview'
                      : '/citizen'
                    : '/register'
                }
                onClick={() => setMobileNavOpen(false)}
                className="w-full py-2.5 px-4 bg-[#171717] text-white text-xs font-semibold uppercase tracking-wider rounded-sm flex items-center justify-center gap-2"
              >
                <span>
                  {isAuthenticated && authenticatedRole
                    ? authenticatedRole === 'officer'
                      ? 'Open Officer EOC'
                      : 'Open Citizen Portal'
                    : 'Create Citizen Account'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </NavLink>
            </div>
          </div>
        )}
      </header>

      {/* 1. Full-Viewport Cinematic Hero */}
      <section className="relative min-h-screen w-full bg-[#181818] text-white flex flex-col justify-end overflow-hidden">
        {/* Background Media Layer: Poster / Fallback Image underneath Local Loop Video */}
        <div className="absolute inset-0 z-0">
          <EditorialImage
            src="/assets/images/floodsense-hero-poster.jpg"
            fallbackSrc="/images/flood_street_water_1794422510568.jpg"
            alt="Colombo urban flood monitoring landscape"
            className="w-full h-full object-cover opacity-55"
            darkSurface
          />

          {!videoFailed && !prefersReducedMotion && (
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/assets/images/floodsense-hero-poster.jpg"
              onError={() => setVideoFailed(true)}
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src="/assets/videos/floodsense-hero.mp4" type="video/mp4" />
            </video>
          )}

          {/* Measured dark architectural overlay scrim */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/45 to-black/85" />
        </div>

        {/* Hero Foreground Editorial Content */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-32 pb-12 sm:pb-16 lg:pb-20">
          <div className="max-w-3xl space-y-6 fs-fade-up">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.28em] text-white/80">
              FLOODSENSE · COLOMBO BASIN EARLY WARNING
            </p>

            <h1 className="font-serif text-4xl sm:text-6xl lg:text-[4.25rem] leading-[1.06] tracking-tight text-white [text-wrap:balance]">
              See Risk Sooner.
              <br />
              Respond With Clarity.
            </h1>

            <p className="text-base sm:text-lg text-white/85 leading-relaxed max-w-2xl font-normal">
              Connecting citizens, artificial intelligence and emergency response teams to improve
              flood awareness and support safer communities.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
              <NavLink
                to="/citizen/report"
                className="px-6 py-3.5 bg-white hover:bg-[#EEEEEB] text-[#171717] text-xs font-bold uppercase tracking-[0.14em] rounded-sm transition-colors inline-flex items-center justify-center gap-2.5"
              >
                <span>REPORT A FLOOD</span>
                <ArrowRight className="w-4 h-4" />
              </NavLink>

              <NavLink
                to="/map-public"
                className="px-6 py-3.5 bg-[#171717]/80 hover:bg-[#171717] text-white border border-white/35 text-xs font-semibold uppercase tracking-[0.14em] rounded-sm transition-colors inline-flex items-center justify-center gap-2.5 backdrop-blur-xs"
              >
                <MapPin className="w-4 h-4" />
                <span>EXPLORE LIVE FLOOD MAP</span>
              </NavLink>
            </div>
          </div>

          {/* Bottom Hero Baseline & Scroll Indicator */}
          <div className="mt-12 sm:mt-16 pt-6 border-t border-white/15 flex flex-wrap items-center justify-between gap-4 text-xs text-white/75">
            <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 font-mono tabular-nums">
              <span>
                Weather:{' '}
                <strong className="text-white font-semibold">
                  {weather.isLive && weather.currentRainfallMm !== null
                    ? `${weather.currentRainfallMm} mm/h (${weather.condition})`
                    : 'Telemetry Unavailable'}
                </strong>
              </span>
              <span aria-hidden="true" className="hidden sm:inline text-white/35">|</span>
              <span>
                Active Risk Clusters:{' '}
                <strong className="text-white font-semibold">{hotspots.length}</strong>
              </span>
            </div>

            <a
              href="#intelligence"
              className="inline-flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] font-semibold text-white/80 hover:text-white transition-colors"
            >
              <span>Scroll</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* 2. Live Flood Intelligence Strip (Real Firebase / Context Metrics) */}
      <section id="intelligence" className="bg-white border-b border-[#E5E5E2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x lg:divide-[#E5E5E2]">
            <div className="lg:pr-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666666] mb-2">
                Citizen Observations
              </p>
              <p className="font-mono tabular-nums text-3xl sm:text-4xl font-bold text-[#171717]">
                {reports.length}
              </p>
              <p className="text-xs text-[#666666] mt-1.5">Recorded across Colombo sectors</p>
            </div>

            <div className="lg:px-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666666] mb-2">
                Active Flood Clusters
              </p>
              <p className="font-mono tabular-nums text-3xl sm:text-4xl font-bold text-[#171717]">
                {hotspots.length}
              </p>
              <p className="text-xs text-[#666666] mt-1.5">500m geospatial proximity radius</p>
            </div>

            <div className="lg:px-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666666] mb-2">
                {analytics.avgReviewMinutes !== null ? 'Avg Officer Triage' : 'Verified Ratio'}
              </p>
              <p className="font-mono tabular-nums text-3xl sm:text-4xl font-bold text-[#171717]">
                {analytics.avgReviewMinutes !== null
                  ? `${analytics.avgReviewMinutes} min`
                  : `${analytics.verifiedPercentage}%`}
              </p>
              <p className="text-xs text-[#666666] mt-1.5">Human-verified response workflow</p>
            </div>

            <div className="lg:pl-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#666666] mb-2">
                3-Hour Rainfall Forecast
              </p>
              <p className="font-mono tabular-nums text-3xl sm:text-4xl font-bold text-[#171717]">
                {weather.expected3hRainfallMm !== null
                  ? `${weather.expected3hRainfallMm} mm`
                  : 'N/A'}
              </p>
              <p className="text-xs text-[#666666] mt-1.5">
                {weather.isLive ? 'Open-Meteo live telemetry' : 'Weather service unavailable'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Editorial Story Section: Community Ground Truth */}
      <section className="bg-[#F5F5F2] py-20 sm:py-24 border-b border-[#E5E5E2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
                <div className="space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#666666]">
                    COMMUNITY-POWERED RESILIENCE
                  </p>
                  <h2 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.12] text-[#171717] [text-wrap:balance]">
                    Street-level ground truth when urban canals rise.
                  </h2>
                  <p className="text-sm sm:text-base text-[#666666] leading-relaxed">
                    During intense monsoonal cloudbursts, Colombo's road culverts and drainage canals
                    can flood within minutes. Fixed canal gauges alone cannot see every blocked
                    street drain—residents provide the immediate situational clarity authorities need.
                  </p>
                </div>

                <div className="divide-y divide-[#E5E5E2] border-y border-[#E5E5E2]">
                  <div className="py-4">
                    <h3 className="text-sm font-bold text-[#171717]">
                      01. Rapid Drainage &amp; Pump Dispatch
                    </h3>
                    <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                      Municipal teams identify blocked grates and deploy mobile dewatering pumps
                      before standing water enters residential zones.
                    </p>
                  </div>
                  <div className="py-4">
                    <h3 className="text-sm font-bold text-[#171717]">
                      02. Passability Warnings for Commuters
                    </h3>
                    <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                      Real-time depth classification alerts motorists and public transit before they
                      reach submerged underpasses at Maradana, Dematagoda, or Wellawatte.
                    </p>
                  </div>
                  <div className="py-4">
                    <h3 className="text-sm font-bold text-[#171717]">
                      03. Privacy-First Public Transparency
                    </h3>
                    <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                      Public GIS maps redact reporter identities and coarsen coordinates to a ~100m
                      safety grid while keeping verified emergency evidence available to officers.
                    </p>
                  </div>
                </div>

                <div>
                  <NavLink
                    to="/citizen/report"
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-[#171717] hover:bg-black text-white text-xs font-semibold uppercase tracking-[0.14em] rounded-sm transition-colors"
                  >
                    <span>Submit a Flood Report</span>
                    <ArrowRight className="w-4 h-4" />
                  </NavLink>
                </div>
              </div>

              <div className="lg:col-span-6 min-h-[380px] lg:min-h-0">
                <div className="w-full h-full rounded-sm overflow-hidden border border-[#E5E5E2] bg-[#EEEEEB]">
                  <EditorialImage
                    src="/assets/images/section-citizen-reporting.jpg"
                    fallbackSrc="/images/flood_junction_inundation_1794422511158.jpg"
                    alt="Colombo street-level stormwater observation"
                    className="w-full h-full object-cover min-h-[380px]"
                    darkSurface={false}
                    caption="Colombo Urban Drainage Observation"
                  />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 4. End-to-End Early Warning Architecture */}
      <section id="how-it-works" className="bg-white py-20 sm:py-24 border-b border-[#E5E5E2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="max-w-2xl mb-14 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#666666]">
                OPERATIONAL WORKFLOW
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl text-[#171717] leading-tight">
                From Street Observation to Verified Response
              </h2>
              <p className="text-sm text-[#666666] leading-relaxed">
                Every citizen submission follows a transparent, human-in-the-loop verification pipeline
                backed by spatial clustering and cryptographic audit logging.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border border-[#E5E5E2] divide-y md:divide-y-0 md:divide-x divide-[#E5E5E2] bg-white">
              <div className="p-7 space-y-4">
                <span className="font-mono text-xs font-semibold text-[#666666] block">01</span>
                <h3 className="text-base font-bold text-[#171717]">Citizens Report</h3>
                <p className="text-xs text-[#666666] leading-relaxed">
                  Capture roadway conditions, confirm GPS coordinates, and record observed water
                  depth through our guided 5-step mobile submission wizard.
                </p>
              </div>

              <div className="p-7 space-y-4">
                <span className="font-mono text-xs font-semibold text-[#666666] block">02</span>
                <h3 className="text-base font-bold text-[#171717]">AI Visual Screening</h3>
                <p className="text-xs text-[#666666] leading-relaxed">
                  Multimodal vision models inspect submitted photos to estimate submersion depth and
                  vehicular passability as assistive triage evidence.
                </p>
              </div>

              <div className="p-7 space-y-4">
                <span className="font-mono text-xs font-semibold text-[#666666] block">03</span>
                <h3 className="text-base font-bold text-[#171717]">Officer Triage</h3>
                <p className="text-xs text-[#666666] leading-relaxed">
                  Pre-authorized municipal emergency officers review clustered hotspots, validate field
                  photographs, and authorize official flood alerts.
                </p>
              </div>

              <div className="p-7 space-y-4">
                <span className="font-mono text-xs font-semibold text-[#666666] block">04</span>
                <h3 className="text-base font-bold text-[#171717]">Audited Public Advisory</h3>
                <p className="text-xs text-[#666666] leading-relaxed">
                  Public GIS advisories update cleanly while verified emergency events anchor to an
                  immutable SHA-256 audit chain.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 5. Live GIS Map Preview */}
      <section className="bg-[#EEEEEB] py-20 sm:py-24 border-b border-[#E5E5E2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
              <div className="space-y-2 max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#666666]">
                  GEOSPATIAL MONITORING
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl text-[#171717]">
                  Colombo Live GIS Situation Map
                </h2>
                <p className="text-xs sm:text-sm text-[#666666]">
                  Reports within a 500m radius and 2-hour sliding window cluster automatically with live
                  Open-Meteo precipitation telemetry.
                </p>
              </div>

              <NavLink
                to="/map-public"
                className="inline-flex items-center gap-2 px-5 py-3 bg-[#171717] hover:bg-black text-white text-xs font-semibold uppercase tracking-[0.14em] rounded-sm transition-colors shrink-0"
              >
                <span>Open Full GIS Map</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </NavLink>
            </div>

            <div className="bg-white p-2 rounded-lg border border-[#E5E5E2]">
              <FloodMap
                hotspots={hotspots}
                reports={reports}
                heightClass="h-[440px]"
                showLegendOverlay={false}
                showSectorControls={false}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 6. Active Colombo Flood Hotspots */}
      <section className="bg-white py-20 sm:py-24 border-b border-[#E5E5E2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#666666]">
                  CLUSTERED RISK ZONES
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl text-[#171717]">
                  Active Colombo Flood Hotspots
                </h2>
              </div>

              <NavLink
                to="/map-public"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#171717] hover:opacity-70 transition-opacity"
              >
                <span>Explore all clusters</span>
                <ArrowRight className="w-4 h-4" />
              </NavLink>
            </div>

            {activeHotspots.length === 0 ? (
              <div className="bg-[#F5F5F2] p-10 rounded-lg border border-[#E5E5E2] text-center space-y-2">
                <p className="text-sm font-bold text-[#171717]">No active flood hotspots reported</p>
                <p className="text-xs text-[#666666] max-w-md mx-auto">
                  Real-time hotspot clusters appear here automatically as citizen flood reports arrive
                  and are clustered by the spatial engine.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {activeHotspots.map((hotspot) => (
                  <div
                    key={hotspot.id}
                    className="bg-[#F5F5F2] p-5 rounded-lg border border-[#E5E5E2] flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-[#666666]">
                          {hotspot.id}
                        </span>
                        <RiskBadge level={hotspot.riskLevel} size="sm" />
                      </div>

                      <div>
                        <h3 className="font-bold text-[#171717] text-sm leading-snug">
                          {hotspot.location}
                        </h3>
                        <p className="text-xs text-[#666666] mt-1">{hotspot.area} Municipal Ward</p>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-3 border-t border-[#E5E5E2]">
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[#171717]">
                        <span>{hotspot.reportCount} unique reports</span>
                        <span>
                          {hotspot.rainfallSource === 'MISSING'
                            ? 'Rain: N/A'
                            : `${hotspot.forecastRainfallMm} mm`}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#666666] line-clamp-2 leading-relaxed">
                        {hotspot.precaution}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* 7. Assistive AI Governance & Emergency Hotlines (Dark Obsidian Band) */}
      <section className="bg-[#181818] text-white py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <Reveal>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-5 space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  GOVERNANCE &amp; SAFETY PROTOCOL
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl text-white leading-tight [text-wrap:balance]">
                  AI assists the review. Officers make the call.
                </h2>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Computer vision models flag depth cues and vehicle hazards, while strict municipal
                  safety controls guarantee zero automated public alerts without human officer
                  verification.
                </p>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="p-6 rounded-lg bg-[#202020] border border-white/10 space-y-3">
                  <Cpu className="w-5 h-5 text-white" />
                  <h3 className="text-sm font-bold text-white">Depth Estimation</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Inspects reflections, curbs, and tire submersion to support severity triage.
                  </p>
                </div>

                <div className="p-6 rounded-lg bg-[#202020] border border-white/10 space-y-3">
                  <Layers className="w-5 h-5 text-white" />
                  <h3 className="text-sm font-bold text-white">Passability Cues</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Flags road status from passable to impassable across urban corridors.
                  </p>
                </div>

                <div className="p-6 rounded-lg bg-[#202020] border border-white/10 space-y-3">
                  <ShieldCheck className="w-5 h-5 text-white" />
                  <h3 className="text-sm font-bold text-white">Human Sign-Off</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Every official status change is authenticated and logged under RBAC governance.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Immediate Emergency Response Hotlines */}
          <div className="pt-12 border-t border-white/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-white" />
                <span>Life-Threatening Emergency? Call Immediate Response</span>
              </h3>
              <p className="text-neutral-400 text-xs">
                For active rescues, medical emergencies, or downed power lines, contact Sri Lanka
                emergency services directly.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="tel:117"
                className="px-4 py-2.5 rounded-sm bg-red-600 hover:bg-red-700 text-white font-mono font-semibold text-xs transition-colors"
              >
                DMC Hotline: 117
              </a>
              <a
                href="tel:1990"
                className="px-4 py-2.5 rounded-sm bg-emerald-700 hover:bg-emerald-800 text-white font-mono font-semibold text-xs transition-colors"
              >
                Suwa Seriya: 1990
              </a>
              <a
                href="tel:119"
                className="px-4 py-2.5 rounded-sm bg-[#202020] hover:bg-white/10 text-white border border-white/25 font-mono font-semibold text-xs transition-colors"
              >
                Sri Lanka Police: 119
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Editorial Footer */}
      <footer className="bg-[#181818] text-neutral-400 text-xs border-t border-white/10 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-sans font-extrabold text-sm tracking-[0.22em] uppercase text-white">
                FLOODSENSE
              </span>
              <span className="text-white/25" aria-hidden="true">/</span>
              <span className="text-xs font-mono text-neutral-400">Colombo Basin Early Warning</span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-neutral-300">
              <NavLink to="/map-public" className="hover:text-white transition-colors">
                Live Flood Map
              </NavLink>
              <NavLink to="/citizen/report" className="hover:text-white transition-colors">
                Report a Flood
              </NavLink>
              <NavLink to="/safety" className="hover:text-white transition-colors">
                Safety Guidelines
              </NavLink>
              <NavLink to="/login?portal=officer" className="hover:text-white transition-colors">
                Officer Sign In
              </NavLink>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-neutral-500">
            <span>© 2026 FloodSense — Urban Flood Intelligence &amp; Early Warning Platform.</span>
            <span>Real-time citizen reporting, AI screening &amp; municipal EOC coordination.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
