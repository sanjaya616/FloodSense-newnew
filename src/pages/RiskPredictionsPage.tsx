/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFlood } from '../context/FloodContext';
import { RiskGauge } from '../components/common/RiskGauge';
import { RiskBadge } from '../components/common/RiskBadge';
import {
  Activity,
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  AlertCircle,
  FileCode2,
  RefreshCw,
} from 'lucide-react';
import { evaluateRiskLevel } from '../utils/floodLogic';

export const RiskPredictionsPage: React.FC = () => {
  const { hotspots, weather, refreshWeather, riskThresholds } = useFlood();

  // Interactive prototype rule tester sandbox
  const [testReports, setTestReports] = useState(3);
  const [testRainfall, setTestRainfall] = useState(25);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const testEvaluation = evaluateRiskLevel(testReports, testRainfall, riskThresholds);

  const handleRefreshWeather = async () => {
    setIsRefreshing(true);
    await refreshWeather();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Title & Subtitle */}
      <div>
        <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
          Deterministic Flood Risk Rules &amp; Early Warning Model
        </h2>
        <p className="text-sm text-[#666666] mt-1">
          Transparent, rule-driven prototype hazard assessment correlating citizen incident density with radar precipitation forecasts.
        </p>
      </div>

      {/* Deterministic Rule Engine Scope Notice */}
      <div className="p-4 bg-amber-50 rounded-md border border-amber-200 flex items-start gap-3 text-xs text-amber-950">
        <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase tracking-wider block mb-0.5 font-mono text-[10px]">
            Deterministic Flood Risk Rule Engine — Operational Guidance
          </span>
          <p className="leading-relaxed text-amber-900">
            Risk classifications (HIGH, MEDIUM, LOW) are computed using explicit threshold rules combining verified citizen report density and live precipitation forecasts. Use this matrix alongside field officer inspection rather than as a standalone hydrodynamic forecast.
          </p>
        </div>
      </div>

      {/* Weather Telemetry Overview (Open-Meteo Integration) */}
      <div className="bg-white p-5 rounded-md border border-[#E5E5E2]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-[#E5E5E2] gap-2">
          <div>
            <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-[#171717]" />
              <span>Colombo Basin Meteorological Telemetry</span>
            </h3>
            <p className="text-xs text-[#666666]">
              Source: <strong className="text-[#171717]">{weather.source}</strong> ({weather.isLive ? 'Live Open-Meteo' : 'Telemetry Unavailable'})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono bg-[#F5F5F2] text-[#171717] border border-[#E5E5E2] px-2.5 py-1 rounded-sm">
              Updated {weather.updatedAt}
            </span>
            <button
              type="button"
              onClick={handleRefreshWeather}
              disabled={isRefreshing}
              className="p-1.5 rounded-md border border-[#E5E5E2] hover:bg-[#EEEEEB] text-[#171717] transition-colors cursor-pointer"
              title="Refresh meteorological telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2]">
            <div className="flex items-center gap-2 text-[#666666] text-xs mb-1">
              <Droplets className="w-4 h-4 text-[#171717]" />
              <span>Current Precipitation</span>
            </div>
            <span className="text-2xl font-bold text-[#171717] font-mono tabular-nums">
              {weather.currentRainfallMm !== null ? weather.currentRainfallMm : 'N/A'}
              {weather.currentRainfallMm !== null && (
                <span className="text-xs text-[#666666] font-sans font-normal ml-1">mm/hr</span>
              )}
            </span>
            <p className="text-[10px] text-[#666666] mt-0.5">{weather.status}</p>
          </div>

          <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2]">
            <div className="flex items-center gap-2 text-[#666666] text-xs mb-1">
              <Activity className="w-4 h-4 text-[#171717]" />
              <span>3-Hour Rainfall Forecast</span>
            </div>
            <span className="text-2xl font-bold text-[#171717] font-mono tabular-nums">
              {weather.expected3hRainfallMm !== null ? weather.expected3hRainfallMm : 'N/A'}
              {weather.expected3hRainfallMm !== null && (
                <span className="text-xs text-[#666666] font-sans font-normal ml-1">mm</span>
              )}
            </span>
            <p className="text-[10px] text-[#666666] mt-0.5">
              {weather.expected3hRainfallMm !== null
                ? 'Expected cumulative waterload'
                : '3h forecast telemetry unavailable'}
            </p>
          </div>

          <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2]">
            <div className="flex items-center gap-2 text-[#666666] text-xs mb-1">
              <Thermometer className="w-4 h-4 text-amber-600" />
              <span>Temperature &amp; Humidity</span>
            </div>
            <span className="text-2xl font-bold text-[#171717] font-mono tabular-nums">
              {weather.currentTempC !== null ? `${weather.currentTempC}°C` : 'Unavailable'}
              {weather.humidityPercent !== null && (
                <span className="text-xs text-[#666666] font-sans font-normal ml-1">
                  ({weather.humidityPercent}%)
                </span>
              )}
            </span>
            <p className="text-[10px] text-[#666666] mt-0.5">Surface telemetry</p>
          </div>

          <div className="p-3.5 bg-[#F5F5F2] rounded-md border border-[#E5E5E2]">
            <div className="flex items-center gap-2 text-[#666666] text-xs mb-1">
              <Wind className="w-4 h-4 text-[#666666]" />
              <span>Wind Velocity</span>
            </div>
            <span className="text-2xl font-bold text-[#171717] font-mono tabular-nums">
              {weather.windSpeedKmh !== null ? weather.windSpeedKmh : 'N/A'}
              {weather.windSpeedKmh !== null && (
                <span className="text-xs text-[#666666] font-sans font-normal ml-1">
                  km/h {weather.windDirection || ''}
                </span>
              )}
            </span>
            <p className="text-[10px] text-[#666666] mt-0.5">Monsoonal vector</p>
          </div>
        </div>
      </div>

      {/* Prototype Rule Engine Explanation & Interactive Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Logic Rules Definition (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-md border border-[#E5E5E2] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E2]">
            <div>
              <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-[#171717]" />
                <span>Deterministic Rule Engine (Thresholds Configurable in Settings)</span>
              </h3>
              <p className="text-xs text-[#666666]">
                HIGH is evaluated strictly before MEDIUM.
              </p>
            </div>
            <span className="text-[10px] font-mono bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider">
              Active Parameters
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* High Rule */}
            <div className="p-3.5 rounded-md border border-red-200 bg-red-50/60">
              <div className="flex items-center justify-between font-bold text-red-950 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <RiskBadge level="HIGH" size="sm" />
                  <span>CRITICAL HAZARD RULE</span>
                </span>
                <span className="font-mono text-xs">Score: 75 – 100</span>
              </div>
              <p className="text-[#171717] leading-relaxed font-mono bg-white p-2.5 rounded-sm border border-red-200 text-[11px]">
                IF (Citizen Reports ≥ {riskThresholds.highReportCount}) AND (3h Forecast Rainfall &gt; {riskThresholds.highRainfallMm} mm)
              </p>
              <p className="text-[11px] text-[#666666] mt-1.5">
                Triggers when high citizen report volume coincides with heavy precipitation forecast.
              </p>
            </div>

            {/* Medium Rule */}
            <div className="p-3.5 rounded-md border border-amber-200 bg-amber-50/60">
              <div className="flex items-center justify-between font-bold text-amber-950 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <RiskBadge level="MEDIUM" size="sm" />
                  <span>WATCH &amp; CAUTION RULE</span>
                </span>
                <span className="font-mono text-xs">Score: 45 – 74</span>
              </div>
              <p className="text-[#171717] leading-relaxed font-mono bg-white p-2.5 rounded-sm border border-amber-200 text-[11px]">
                IF (Citizen Reports ≥ {riskThresholds.mediumReportCount}) OR (3h Forecast Rainfall &gt; {riskThresholds.mediumRainfallMm} mm)
              </p>
              <p className="text-[11px] text-[#666666] mt-1.5">
                Triggers when either report density is moderate or radar forecast exceeds {riskThresholds.mediumRainfallMm}mm.
              </p>
            </div>

            {/* Low Rule */}
            <div className="p-3.5 rounded-md border border-emerald-200 bg-emerald-50/60">
              <div className="flex items-center justify-between font-bold text-emerald-950 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <RiskBadge level="LOW" size="sm" />
                  <span>NOMINAL SURVEILLANCE</span>
                </span>
                <span className="font-mono text-xs">Score: 10 – 44</span>
              </div>
              <p className="text-[#171717] leading-relaxed font-mono bg-white p-2.5 rounded-sm border border-emerald-200 text-[11px]">
                OTHERWISE (Reports &lt; {riskThresholds.mediumReportCount} AND Rain ≤ {riskThresholds.mediumRainfallMm} mm)
              </p>
              <p className="text-[11px] text-[#666666] mt-1.5">
                Baseline runoff manageable within municipal canal capacity.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Simulator Card (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-md border border-[#E5E5E2] flex flex-col justify-between">
          <div>
            <div className="pb-3 mb-3 border-b border-[#E5E5E2]">
              <h3 className="text-base font-bold text-[#171717]">Interactive Rule Sandbox</h3>
              <p className="text-xs text-[#666666]">
                Adjust input variables to inspect real-time deterministic classification output.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between font-semibold text-[#171717] mb-1">
                  <span>Hypothetical Citizen Reports:</span>
                  <span className="font-mono text-[#171717] text-sm font-bold">{testReports} reports</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={testReports}
                  onChange={(e) => setTestReports(parseInt(e.target.value))}
                  className="w-full accent-[#171717] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold text-[#171717] mb-1">
                  <span>Forecast 3h Rainfall:</span>
                  <span className="font-mono text-[#171717] text-sm font-bold">{testRainfall} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={testRainfall}
                  onChange={(e) => setTestRainfall(parseInt(e.target.value))}
                  className="w-full accent-[#171717] cursor-pointer"
                />
              </div>

              {/* Real-time Calculation Result */}
              <div className="p-4 bg-[#F5F5F2] rounded-md border border-[#E5E5E2] flex items-center justify-between gap-4">
                <RiskGauge
                  score={testEvaluation.score}
                  level={testEvaluation.riskLevel}
                  size={90}
                  strokeWidth={8}
                />
                <div className="flex-1">
                  <div className="mb-1">
                    <RiskBadge level={testEvaluation.riskLevel} size="md" />
                  </div>
                  <p className="text-[11px] text-[#666666] leading-tight">
                    {testEvaluation.reasoning}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E5E5E2] text-[11px] text-[#666666] italic">
            &ldquo;{testEvaluation.precaution}&rdquo;
          </div>
        </div>
      </div>

      {/* Hotspots Predictive Risk Cards with Detailed Rule Breakdown */}
      <div>
        <h3 className="font-serif text-xl sm:text-2xl text-[#171717] mb-3 flex items-center gap-2">
          <span>Sector Hotspot Prediction Matrix with Rule Traceability</span>
          <span className="text-xs font-mono font-normal text-[#666666]">
            ({hotspots.length} Monitored Zones)
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {hotspots.length === 0 ? (
            <div className="col-span-full bg-white p-10 rounded-md border border-[#E5E5E2] text-center">
              <p className="text-sm font-semibold text-[#171717]">No active hotspot clusters</p>
              <p className="text-xs text-[#666666] mt-1">
                Submit citizen flood incidents or adjust clustering windows in Settings to populate risk matrices.
              </p>
            </div>
          ) : (
            hotspots.map((hs) => {
              const evaluation = evaluateRiskLevel(hs.reportCount, hs.forecastRainfallMm, riskThresholds);

              return (
                <div
                  key={hs.id}
                  className="bg-white p-5 rounded-md border border-[#E5E5E2] hover:border-[#171717]/40 transition-colors flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#171717] bg-[#F5F5F2] border border-[#E5E5E2] px-2 py-0.5 rounded-sm">
                          {hs.id}
                        </span>
                        <h4 className="text-sm font-bold text-[#171717] leading-tight mt-1.5">
                          {hs.location}
                        </h4>
                        <p className="text-xs text-[#666666]">{hs.area} Sector</p>
                      </div>
                      <RiskGauge
                        score={evaluation.score}
                        level={evaluation.riskLevel}
                        size={65}
                        strokeWidth={6}
                        showCategory={false}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 my-2 p-2.5 bg-[#F5F5F2] rounded-sm border border-[#E5E5E2] text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-[#666666] uppercase font-sans block">
                          Report Count
                        </span>
                        <span className="font-bold text-[#171717]">
                          {hs.reportCount} unique
                          {hs.duplicateReportCount ? ` (+${hs.duplicateReportCount} dup)` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#666666] uppercase font-sans block">
                          3h Rainfall
                        </span>
                        <span className="font-bold text-[#171717]">
                          {hs.rainfallSource === 'MISSING'
                            ? 'Unavailable (MISSING)'
                            : `${hs.forecastRainfallMm} mm`}
                        </span>
                      </div>
                    </div>

                    {/* Visual Rule Traceability Breakdown */}
                    <div className="p-2.5 bg-[#F5F5F2] rounded-sm border border-[#E5E5E2] text-[11px] space-y-1 font-mono">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block font-sans">
                        Rule Evaluation Trace
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-[#666666]">High Threshold Met:</span>
                        <span className={evaluation.breakdown.highRuleMet ? 'text-red-700 font-bold' : 'text-[#666666]'}>
                          {evaluation.breakdown.highRuleMet ? 'YES (Triggered)' : 'NO'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#666666]">Medium Threshold Met:</span>
                        <span className={evaluation.breakdown.mediumRuleMet ? 'text-amber-700 font-bold' : 'text-[#666666]'}>
                          {evaluation.breakdown.mediumRuleMet ? 'YES' : 'NO'}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#666666] pt-1 border-t border-[#E5E5E2] font-sans">
                        {evaluation.reasoning}
                      </p>
                    </div>

                    <div className="text-xs text-[#171717] bg-[#F5F5F2] p-2.5 rounded-sm border border-[#E5E5E2] mt-2">
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#666666] block mb-0.5">
                        Recommended Precaution
                      </span>
                      <p className="line-clamp-2 italic">{evaluation.precaution}</p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-[#E5E5E2] flex items-center justify-between text-xs">
                    <RiskBadge level={evaluation.riskLevel} size="sm" />
                    <span className="text-[11px] font-mono text-[#666666]">
                      Calculated Score: {evaluation.score}/100
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
