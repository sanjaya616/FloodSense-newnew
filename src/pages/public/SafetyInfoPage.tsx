/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  PhoneCall,
  Car,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';

export const SafetyInfoPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Header */}
      <div className="pb-6 border-b border-[#E5E5E2]">
        <div className="flex items-center gap-2 text-xs font-medium text-[#666666] mb-2">
          <NavLink to="/" className="hover:text-[#171717] transition-colors">
            Home
          </NavLink>
          <ChevronRight className="w-3 h-3 text-[#666666]" />
          <span className="text-[#171717] font-semibold">Community Safety Information</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#171717] tracking-tight">
          Colombo Monsoon Flood Safety Guide
        </h1>
        <p className="text-[#666666] text-sm mt-2 max-w-3xl leading-relaxed">
          Educational flood-safety precautions, vehicle protocols, and Sri Lanka emergency hotlines
          (referencing public DMC 117 and Met Dept advisories; always follow official DMC directives during active emergencies).
        </p>
      </div>

      {/* Emergency Hotlines Directory Cards */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-[#171717] uppercase tracking-wider flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-[#171717]" />
          <span>Emergency Hotlines · Sri Lanka (24/7 Toll-Free)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white border border-red-200 rounded-lg flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">
                Disaster Ops Centre
              </span>
              <h3 className="text-sm font-bold text-[#171717] mt-1">Disaster Management (DMC)</h3>
              <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                Flood rescues, river bund breach warnings &amp; relief coordination.
              </p>
            </div>
            <a
              href="tel:117"
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-mono font-bold text-xs rounded-sm text-center transition-colors block"
            >
              Call 117
            </a>
          </div>

          <div className="p-5 bg-white border border-emerald-200 rounded-lg flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Emergency Medical
              </span>
              <h3 className="text-sm font-bold text-[#171717] mt-1">Suwa Seriya Ambulance</h3>
              <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                Paramedic dispatch, drowning resuscitation &amp; urgent trauma transit.
              </p>
            </div>
            <a
              href="tel:1990"
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-mono font-bold text-xs rounded-sm text-center transition-colors block"
            >
              Call 1990
            </a>
          </div>

          <div className="p-5 bg-white border border-[#E5E5E2] rounded-lg flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider block">
                Law &amp; Rescue
              </span>
              <h3 className="text-sm font-bold text-[#171717] mt-1">Sri Lanka Police Service</h3>
              <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                Traffic cordons, missing persons &amp; security during evacuations.
              </p>
            </div>
            <a
              href="tel:119"
              className="w-full py-2.5 bg-[#171717] hover:bg-black text-white font-mono font-bold text-xs rounded-sm text-center transition-colors block"
            >
              Call 119
            </a>
          </div>

          <div className="p-5 bg-white border border-[#E5E5E2] rounded-lg flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider block">
                Municipal Services
              </span>
              <h3 className="text-sm font-bold text-[#171717] mt-1">Colombo Municipal (CMC)</h3>
              <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                Drainage maintenance, tree clearing &amp; mobile gully sucker trucks.
              </p>
            </div>
            <a
              href="tel:0112684293"
              className="w-full py-2.5 bg-[#171717] hover:bg-black text-white font-mono font-bold text-xs rounded-sm text-center transition-colors block"
            >
              011 268 4293
            </a>
          </div>
        </div>
      </div>

      {/* Vehicle Safety Section */}
      <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#E5E5E2] space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-md bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717] flex items-center justify-center shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#171717]">
              Vehicle Safety: Turn Around, Don&apos;t Drown
            </h2>
            <p className="text-xs sm:text-sm text-[#666666] mt-1">
              Driving into submerged roadways carries severe risk of engine stall, hidden culvert hazards,
              and rapid loss of traction even in shallow moving water.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-5 rounded-md bg-[#F5F5F2] border border-[#E5E5E2] space-y-2">
            <span className="font-mono font-bold text-xs text-amber-800 block">6 INCHES (15 CM)</span>
            <h3 className="text-sm font-bold text-[#171717]">Loss of Control &amp; Stalling</h3>
            <p className="text-xs text-[#666666] leading-relaxed">
              Six inches of standing water will reach the bottom of most passenger cars, soaking
              exhaust systems and causing engine stall.
            </p>
          </div>

          <div className="p-5 rounded-md bg-[#F5F5F2] border border-[#E5E5E2] space-y-2">
            <span className="font-mono font-bold text-xs text-orange-700 block">12 INCHES (30 CM)</span>
            <h3 className="text-sm font-bold text-[#171717]">Vehicles Float Away</h3>
            <p className="text-xs text-[#666666] leading-relaxed">
              One foot of rushing water exerts immense hydraulic force, easily sweeping away small
              cars, three-wheelers, and motorcycles into roadside canals.
            </p>
          </div>

          <div className="p-5 rounded-md bg-[#F5F5F2] border border-[#E5E5E2] space-y-2">
            <span className="font-mono font-bold text-xs text-red-700 block">24 INCHES (60 CM)</span>
            <h3 className="text-sm font-bold text-[#171717]">SUVs &amp; Trucks Swept Off</h3>
            <p className="text-xs text-[#666666] leading-relaxed">
              Two feet of surging runoff can float heavy 4WD pickups, delivery lorries, and buses,
              pushing them into deep culverts.
            </p>
          </div>
        </div>

        <div className="p-4 bg-amber-50/80 rounded-md border border-amber-200 text-xs text-amber-950 space-y-1">
          <span className="font-bold">Colombo Underpass Warning</span>
          <p>
            Underpasses at Maradana Railway Station, Dematagoda Baseline Road, and Panchikawatte often
            accumulate 3 to 5 feet of stormwater within 20 minutes of intense cloudbursts. Do not
            assume water depth from surface reflections.
          </p>
        </div>
      </div>

      {/* Do's and Don'ts Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-[#E5E5E2] space-y-4">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            <span>Essential Flood Precautions (DO)</span>
          </div>

          <ul className="space-y-3 text-xs text-[#171717] divide-y divide-[#E5E5E2]">
            <li className="pt-2 first:pt-0">
              <strong>Elevate valuable electronics:</strong> Unplug household appliances and move
              documents to upper shelves if residing in low-lying Kolonnawa or Sedawatte.
            </li>
            <li className="pt-3">
              <strong>Store clean drinking water:</strong> Fill sealed containers; municipal mains
              can become contaminated by canal overflow during inundation.
            </li>
            <li className="pt-3">
              <strong>Check on vulnerable neighbors:</strong> Assist elderly residents, infants,
              and persons with mobility challenges early in an evacuation advisory.
            </li>
            <li className="pt-3">
              <strong>File a photo report:</strong> Submit road conditions on FloodSense to alert
              nearby commuters and support municipal drainage triage.
            </li>
          </ul>
        </div>

        <div className="bg-white p-6 rounded-lg border border-[#E5E5E2] space-y-4">
          <div className="flex items-center gap-2 text-red-700 font-bold text-sm uppercase tracking-wider">
            <XCircle className="w-4 h-4" />
            <span>Dangerous Actions to Avoid (DON&apos;T)</span>
          </div>

          <ul className="space-y-3 text-xs text-[#171717] divide-y divide-[#E5E5E2]">
            <li className="pt-2 first:pt-0">
              <strong>Never walk in floodwaters:</strong> Open manhole covers can be displaced by
              sewer pressure, creating deadly concealed suction vortexes.
            </li>
            <li className="pt-3">
              <strong>Avoid electrical posts &amp; fallen cables:</strong> Submerged electrical lines
              can electrify standing water over a 15-meter radius.
            </li>
            <li className="pt-3">
              <strong>Do not let children play in canal runoff:</strong> Contaminated urban water
              harbors Leptospirosis (rat fever), dengue vectors, and enteric pathogens.
            </li>
            <li className="pt-3">
              <strong>Do not drive around police barriers:</strong> Emergency road closures are
              instituted for structural safety or submerged bridge decks.
            </li>
          </ul>
        </div>
      </div>

      {/* Call to action */}
      <div className="bg-[#181818] text-white p-8 rounded-lg border border-[#2A2A2A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <h3 className="font-serif text-2xl text-white">Have Eyes on a Flooded Street?</h3>
          <p className="text-neutral-400 text-xs">
            Help your community and municipal responders by submitting a quick photograph report.
          </p>
        </div>

        <NavLink
          to="/citizen/report"
          className="px-6 py-3 rounded-sm bg-white text-[#171717] font-bold text-xs uppercase tracking-wider hover:bg-[#EEEEEB] transition-colors shrink-0 flex items-center gap-2"
        >
          <span>Submit a Report Now</span>
          <ArrowRight className="w-4 h-4" />
        </NavLink>
      </div>
    </div>
  );
};
