/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Layers,
  Database,
  AlertTriangle,
} from 'lucide-react';

export const MethodologyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      {/* Title */}
      <div>
        <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
          System Methodology &amp; Data Transparency
        </h2>
        <p className="text-sm text-[#666666] mt-1">
          System architecture documentation outlining live data pipelines, clustering algorithms, AI vision states, and privacy safeguards.
        </p>
      </div>

      {/* Summary Matrix: System Integrations */}
      <div className="bg-white p-5 sm:p-6 rounded-md border border-[#E5E5E2] space-y-3">
        <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
          <Database className="w-4 h-4 text-[#171717]" />
          <span>Integration &amp; Component Architecture Matrix</span>
        </h3>
        <p className="text-xs text-[#666666]">
          Live connected external web services, persistence layers, and deterministic geospatial engines.
        </p>

        <div className="overflow-x-auto pt-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E2] bg-[#F5F5F2] text-[10px] font-mono font-semibold uppercase tracking-wider text-[#666666]">
                <th className="py-2.5 px-3">Subsystem</th>
                <th className="py-2.5 px-3">Implementation Nature</th>
                <th className="py-2.5 px-3">Source / Protocol</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2] font-mono text-[11px]">
              <tr>
                <td className="py-2.5 px-3 font-bold text-[#171717]">Weather Telemetry</td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">LIVE EXTERNAL API</td>
                <td className="py-2.5 px-3 text-[#666666] font-sans">Open-Meteo API (Lat 6.9271, Lng 79.8653)</td>
                <td className="py-2.5 px-3 text-emerald-700">Returns Unavailable if offline</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-[#171717]">Multimodal AI Inspection</td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">SERVER-SIDE GEMINI</td>
                <td className="py-2.5 px-3 text-[#666666] font-sans">Google Gemini Vision via @google/genai server proxy</td>
                <td className="py-2.5 px-3 text-[#171717]">Live AI / Explicit Unconfigured State</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-[#171717]">Map Geospatial Tiles</td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">LIVE GIS TILES</td>
                <td className="py-2.5 px-3 text-[#666666] font-sans">OpenStreetMap Standard Carto Tile Server</td>
                <td className="py-2.5 px-3 text-emerald-700">Live GIS Tiles</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-[#171717]">Geospatial Clustering</td>
                <td className="py-2.5 px-3 text-[#171717] font-bold">REAL ALGORITHM</td>
                <td className="py-2.5 px-3 text-[#666666] font-sans">Haversine spherical distance formula with 2h temporal threshold</td>
                <td className="py-2.5 px-3 text-[#171717]">Deterministic Engine</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-[#171717]">Risk Rule Engine</td>
                <td className="py-2.5 px-3 text-[#171717] font-bold">DETERMINISTIC RULES</td>
                <td className="py-2.5 px-3 text-[#666666] font-sans">Configurable citizen report count &amp; 3h rain thresholds</td>
                <td className="py-2.5 px-3 text-[#171717]">Live Rule Engine</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-[#171717]">Cloud Persistence &amp; Auth</td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">FIREBASE SPARK STACK</td>
                <td className="py-2.5 px-3 text-[#666666] font-sans">Firebase Auth, Cloud Firestore (subcollection evidence) + Admin SDK</td>
                <td className="py-2.5 px-3 text-emerald-700">Strictly 2 Roles (Citizen / Officer)</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-[#171717]">Analytics Aggregation</td>
                <td className="py-2.5 px-3 text-[#171717] font-bold">WINDOWED COMPUTATION</td>
                <td className="py-2.5 px-3 text-[#666666] font-sans">Real-time filtering &amp; Recharts visualizations</td>
                <td className="py-2.5 px-3 text-[#171717]">Live Firestore Queries</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-[#171717]">Audit Hash-Chain</td>
                <td className="py-2.5 px-3 text-[#171717] font-bold">CRYPTOGRAPHIC AUDIT LOG</td>
                <td className="py-2.5 px-3 text-[#666666] font-sans">SHA-256 chained digests persisted in Firestore audit_logs</td>
                <td className="py-2.5 px-3 text-[#171717]">Tamper-Evident Chain</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 9-Step End-to-End Architecture Pipeline */}
      <div className="bg-white p-5 sm:p-6 rounded-md border border-[#E5E5E2] space-y-3">
        <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#171717]" />
          <span>End-to-End System Architecture Pipeline (9 Stages)</span>
        </h3>
        <p className="text-xs text-[#666666]">
          Primary services include Multimodal AI verification via Gemini, Cloud Computing (Firebase Auth, Cloud Firestore subcollection evidence, and Express Admin sync), deterministic Haversine hotspot clustering, and SHA-256 audit chaining.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
          {[
            '1. Citizen Report (Photo + GPS Pin)',
            '2. AI Assessment (Server Gemini Vision)',
            '3. Cloud Firestore (Report + Evidence)',
            '4. Spatial-Temporal Clustering (500m / 2h)',
            '5. Weather-Based Risk Assessment (Open-Meteo)',
            '6. Officer Review (Server-Enforced RBAC)',
            '7. Citizen Alert & Public Map (100m Grid)',
            '8. Analytics (Windowed Aggregations)',
            '9. Audit Record (SHA-256 Hash-Chain)',
          ].map((step) => (
            <div
              key={step}
              className="p-3 rounded-sm bg-[#F5F5F2] border border-[#E5E5E2] font-semibold text-[#171717]"
            >
              {step}
            </div>
          ))}
        </div>
      </div>

      {/* Methodology Chapters */}
      <div className="space-y-4">
        {/* Chapter 1 */}
        <div className="bg-white p-5 sm:p-6 rounded-md border border-[#E5E5E2] space-y-2 text-xs">
          <div className="flex items-center gap-2.5 text-[#171717] font-bold text-sm">
            <span className="w-6 h-6 rounded-sm bg-[#181818] text-white flex items-center justify-center font-mono text-xs">
              01
            </span>
            <h4>Citizen Incident Reporting, Image Sanitization &amp; Geospatial Capture</h4>
          </div>
          <p className="text-[#666666] leading-relaxed">
            Citizens submit field observations through the 5-step reporting wizard (<code>/citizen/report</code>) or the operations console form.
            Uploaded photos undergo client and server binary magic-byte inspection (JPEG/PNG/WEBP, ≤ 5 MB) plus client-side HTML5 canvas
            re-encoding to strip embedded EXIF/GPS metadata prior to upload.
          </p>
          <p className="text-[#666666] leading-relaxed">
            Geographic coordinates require explicit user selection via W3C Geolocation, municipal sector lookup, or manual lat/lng entry
            with explicit map-pin confirmation. Near-duplicate submissions within 25 meters and 5 minutes are flagged as duplicates
            and preserved for audit without inflating unique incident counts.
          </p>
        </div>

        {/* Chapter 2 */}
        <div className="bg-white p-5 sm:p-6 rounded-md border border-[#E5E5E2] space-y-2 text-xs">
          <div className="flex items-center gap-2.5 text-[#171717] font-bold text-sm">
            <span className="w-6 h-6 rounded-sm bg-[#181818] text-white flex items-center justify-center font-mono text-xs">
              02
            </span>
            <h4>Photograph Assessment (Server-Side Gemini Vision &amp; Explicit AI States)</h4>
          </div>
          <p className="text-[#666666] leading-relaxed">
            When a photograph is attached, it is resized/compressed client-side and routed through the server-side API endpoint (<code>/api/ai/verify</code>) enforcing a strict
            schema response from Google Gemini Vision (configurable <code>GEMINI_MODEL</code>, default 75-second timeout per attempt with bounded exponential-backoff retries).
          </p>
          <p className="text-[#666666] leading-relaxed">
            AI verification uses explicit states: <code>NOT_RUN</code> (no photograph submitted; confidence is <code>null</code>),{' '}
            <code>PENDING</code> (queued/processing), <code>COMPLETED</code> (live Gemini vision assessment), <code>FAILED</code> (upstream API error safely preserving the report for retry), and <code>UNCONFIGURED</code> (when <code>GEMINI_API_KEY</code> is not configured on the server — no fake score is generated). AI never overrides human emergency officer verification.
          </p>
        </div>

        {/* Chapter 3 */}
        <div className="bg-white p-5 sm:p-6 rounded-md border border-[#E5E5E2] space-y-2 text-xs">
          <div className="flex items-center gap-2.5 text-[#171717] font-bold text-sm">
            <span className="w-6 h-6 rounded-sm bg-[#181818] text-white flex items-center justify-center font-mono text-xs">
              03
            </span>
            <h4>Geospatial Connected-Component Clustering (500m &amp; 2-Hour Window)</h4>
          </div>
          <p className="text-[#666666] leading-relaxed">
            Valid reports are grouped using single-linkage BFS connected-component clustering over the Great-Circle Haversine distance formula:
          </p>
          <div className="bg-[#F5F5F2] p-3 rounded-sm border border-[#E5E5E2] font-mono text-[11px] text-[#171717] space-y-1">
            <p>d = 2 * R * asin(sqrt(sin²(Δφ/2) + cos(φ₁) * cos(φ₂) * sin²(Δλ/2)))</p>
            <p className="text-[#666666]">where R = 6,371,000 meters (mean Earth radius)</p>
          </div>
          <p className="text-[#666666] leading-relaxed">
            Two valid reports link when both spatial distance ≤ 500 meters and temporal separation ≤ 2 hours. Cluster identifiers (<code>HS-...</code>)
            are derived deterministically via SHA-256 hashing of sorted member IDs so cluster IDs remain stable regardless of input ordering.
            Each hotspot tracks unique reports, audited duplicates, and independent confirmations separately.
          </p>
        </div>

        {/* Chapter 4 */}
        <div className="bg-white p-5 sm:p-6 rounded-md border border-[#E5E5E2] space-y-2 text-xs">
          <div className="flex items-center gap-2.5 text-[#171717] font-bold text-sm">
            <span className="w-6 h-6 rounded-sm bg-[#181818] text-white flex items-center justify-center font-mono text-xs">
              04
            </span>
            <h4>Deterministic Risk Classification &amp; Missing Rainfall Honesty</h4>
          </div>
          <p className="text-[#666666] leading-relaxed">
            Hotspots are categorized into HIGH, MEDIUM, or LOW risk using explicit deterministic threshold rules aligned to future Open-Meteo <code>Asia/Colombo</code> hourly slots:
          </p>
          <div className="bg-[#F5F5F2] p-3 rounded-sm border border-[#E5E5E2] font-mono text-[11px] text-[#171717] space-y-1">
            <p className="text-red-700 font-bold">1. HIGH: (Unique Reports ≥ 3) AND (3h Forecast Rainfall &gt; 20 mm)</p>
            <p className="text-amber-700 font-bold">2. MEDIUM: (Unique Reports ≥ 2) OR (3h Forecast Rainfall &gt; 10 mm)</p>
            <p className="text-emerald-700 font-bold">3. LOW: Otherwise (Baseline manageable runoff)</p>
          </div>
          <p className="text-[#666666] leading-relaxed">
            HIGH is evaluated strictly before MEDIUM. When weather forecast data is unavailable, rainfall is explicitly flagged as{' '}
            <code>MISSING</code> (0 mm fallback) rather than invented from existing severity labels.
          </p>
        </div>

        {/* Chapter 5 */}
        <div className="bg-white p-5 sm:p-6 rounded-md border border-[#E5E5E2] space-y-2 text-xs">
          <div className="flex items-center gap-2.5 text-[#171717] font-bold text-sm">
            <span className="w-6 h-6 rounded-sm bg-[#181818] text-white flex items-center justify-center font-mono text-xs">
              05
            </span>
            <h4>Tamper-Evident SHA-256 Hash-Chain Audit Trail</h4>
          </div>
          <p className="text-[#666666] leading-relaxed">
            The Audit Registry records immutable event hashes using pure-TypeScript FIPS 180-4 SHA-256 cryptographic digests
            chained via <code>recordHash = SHA256(prevHash + eventId + timestamp + payloadHash)</code> across canonicalized event snapshots.
          </p>
          <p className="text-[#666666] leading-relaxed">
            Photographs and citizen PII are never written into hashed ledger payloads. Any post-hoc modification breaks cryptographic chain verification inside the inspector.
          </p>
        </div>

        {/* Chapter 6 */}
        <div className="bg-amber-50 p-5 sm:p-6 rounded-md border border-amber-200 space-y-2 text-xs text-amber-950">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <h4>Operational Scope &amp; Engineering Notes</h4>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-amber-900 leading-relaxed">
            <li>
              <strong>Two-Role Security Model:</strong> Access is strictly partitioned between Citizen and Emergency Officer roles, verified by Firebase Auth tokens and Firestore security rules.
            </li>
            <li>
              <strong>Hydrological Calibration &amp; Rule Heuristics:</strong> Deterministic rainfall/report count thresholds do not incorporate DEM terrain elevation, soil saturation, canal bathymetry, or drainage pump flow telemetry.
            </li>
            <li>
              <strong>Dataset Scale:</strong> Analytics charts run client-side over Firestore collections suited to municipal sector scale.
            </li>
            <li>
              <strong>Audit Chain Immutability:</strong> While SHA-256 digests are cryptographically valid, public decentralized finality would require anchoring Merkle roots to an external immutable ledger or WORM storage bucket.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
