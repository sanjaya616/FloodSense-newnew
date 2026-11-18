/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useFlood } from '../context/FloodContext';
import {
  BlockchainRecord,
  GENESIS_PREV_HASH,
  verifyBlockchainRecordIntegrity,
} from '../utils/floodLogic';
import { RiskBadge } from '../components/common/RiskBadge';
import {
  Link2,
  ShieldCheck,
  Clock,
  Copy,
  Check,
  Search,
  FileCode,
  Lock,
  Info,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';

export const BlockchainRegistryPage: React.FC = () => {
  const { blockchainRecords } = useFlood();
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<BlockchainRecord | null>(blockchainRecords[0] || null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (blockchainRecords.length === 0) {
      setSelectedTx(null);
      return;
    }
    if (!selectedTx) {
      setSelectedTx(blockchainRecords[0]);
      return;
    }
    const matched = blockchainRecords.find((r) => r.eventId === selectedTx.eventId);
    if (matched) {
      setSelectedTx(matched);
    } else {
      setSelectedTx(blockchainRecords[0]);
    }
  }, [blockchainRecords]);

  // Order ascending by blockNumber to find expected prevHash predecessor
  const chronologicalRecords = useMemo(
    () => [...blockchainRecords].sort((a, b) => a.blockNumber - b.blockNumber),
    [blockchainRecords]
  );

  const getExpectedPrevHash = (rec: BlockchainRecord): string => {
    const idx = chronologicalRecords.findIndex((r) => r.eventId === rec.eventId);
    if (idx <= 0) return GENESIS_PREV_HASH;
    return chronologicalRecords[idx - 1].recordHash || chronologicalRecords[idx - 1].txHash;
  };

  // Filtered records
  const filteredRecords = blockchainRecords.filter((rec) => {
    const q = search.toLowerCase();
    return (
      !search ||
      rec.eventId.toLowerCase().includes(q) ||
      rec.hotspotId.toLowerCase().includes(q) ||
      rec.location.toLowerCase().includes(q) ||
      rec.txHash.toLowerCase().includes(q) ||
      (rec.recordHash && rec.recordHash.toLowerCase().includes(q)) ||
      rec.payloadHash.toLowerCase().includes(q)
    );
  });

  const totalEvents = blockchainRecords.length;
  const verifiedRecords = blockchainRecords.filter((r) => r.status.includes('CONFIRMED')).length;
  const pendingRecords = blockchainRecords.filter((r) => r.status.includes('PENDING')).length;

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleVerifyHashProof = (rec: BlockchainRecord) => {
    const expectedPrev = getExpectedPrevHash(rec);
    const check = verifyBlockchainRecordIntegrity(rec, expectedPrev);
    if (check.valid) {
      setVerificationResult({
        valid: true,
        message: `Cryptographic Check PASSED for Block #${rec.blockNumber} (${rec.eventId}): recomputed SHA-256 recordHash & prevHash chain link match (${check.recomputedRecordHash.slice(0, 14)}...).`,
      });
    } else {
      setVerificationResult({
        valid: false,
        message: `Tamper Alert on Block #${rec.blockNumber} (${rec.eventId}): ${check.reason}`,
      });
    }
  };

  const handleVerifyFullChain = () => {
    if (chronologicalRecords.length === 0) {
      setVerificationResult({ valid: false, message: 'No audit records in ledger to verify.' });
      return;
    }
    let prev = GENESIS_PREV_HASH;
    for (const rec of chronologicalRecords) {
      const check = verifyBlockchainRecordIntegrity(rec, prev);
      if (!check.valid) {
        setVerificationResult({
          valid: false,
          message: `Chain Verification FAILED at Block #${rec.blockNumber} (${rec.eventId}): ${check.reason}`,
        });
        return;
      }
      prev = rec.recordHash || rec.txHash;
    }
    setVerificationResult({
      valid: true,
      message: `Full Audit Chain Verified: All ${chronologicalRecords.length} blocks passed canonical SHA-256 payload digest & previous-hash linkage checks.`,
    });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-sm bg-[#F5F5F2] text-[#171717] border border-[#E5E5E2] text-[10px] font-mono font-semibold uppercase tracking-[0.14em]">
              SHA-256 AUDIT CHAIN
            </span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
            Audit Hash-Chain &amp; Flood Event Registry
          </h2>
          <p className="text-sm text-[#666666] mt-1">
            Tamper-evident, SHA-256 linked audit trail of municipal flood verification snapshots.
          </p>
        </div>

        <button
          type="button"
          onClick={handleVerifyFullChain}
          className="px-4 py-2.5 rounded-md bg-[#171717] hover:bg-black text-white font-semibold text-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors"
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Verify Full Hash Chain</span>
        </button>
      </div>

      {/* Audit Hash-Chain Architecture Callout */}
      <div className="p-4 sm:p-5 bg-[#181818] text-[#D4D4D0] rounded-md border border-[#2A2A2A] flex items-start gap-3.5 text-xs">
        <Lock className="w-5 h-5 text-white shrink-0 mt-0.5" />
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-white uppercase tracking-wider font-mono">
              Tamper-Evident SHA-256 Audit Ledger
            </span>
            <span className="bg-[#262626] text-[#D4D4D0] border border-[#3A3A3A] px-2 py-0.5 rounded-sm text-[10px] font-mono">
              Firestore Integrity Hash-Chain (Zero PII)
            </span>
          </div>
          <p className="text-[#D4D4D0] leading-relaxed">
            Each record computes a canonical SHA-256 <code>payloadHash</code> and chains <code>recordHash = SHA256(prevHash + eventId + timestamp + payloadHash)</code>.
            This verifies whether an incident snapshot has been altered after recording while keeping citizen photographs and contact details off public audit payloads.
          </p>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-md border border-[#E5E5E2] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-[#666666] block mb-1">
              Total Recorded Events
            </span>
            <span className="text-3xl font-bold text-[#171717] font-mono tabular-nums">
              {totalEvents}
            </span>
            <p className="text-xs text-[#666666] mt-1">Anchored flood snapshots</p>
          </div>
          <div className="p-3 bg-[#F5F5F2] border border-[#E5E5E2] text-[#171717] rounded-md">
            <Link2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-md border border-[#E5E5E2] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-[#666666] block mb-1">
              Sealed Hash-Chain Blocks
            </span>
            <span className="text-3xl font-bold text-emerald-700 font-mono tabular-nums">
              {verifiedRecords}
            </span>
            <p className="text-xs text-emerald-800 font-medium mt-1">SHA-256 linked &amp; verified</p>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-md border border-[#E5E5E2] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-[#666666] block mb-1">
              Pending Inclusion
            </span>
            <span className="text-3xl font-bold text-amber-700 font-mono tabular-nums">
              {pendingRecords}
            </span>
            <p className="text-xs text-amber-800 font-medium mt-1">Awaiting next snapshot</p>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-md">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {verificationResult && (
        <div
          className={`p-3.5 rounded-md border text-xs flex items-center gap-2 ${
            verificationResult.valid
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {verificationResult.valid ? (
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
          )}
          <span>{verificationResult.message}</span>
        </div>
      )}

      {/* Main Table + Transaction Details Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Ledger Table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-md border border-[#E5E5E2] overflow-hidden">
          {/* Table Header Bar */}
          <div className="p-4 sm:p-5 border-b border-[#E5E5E2] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#171717]">Cryptographic Event Ledger</h3>
              <p className="text-xs text-[#666666]">
                Chronological tamper-evident log of flood verification and hotspot snapshots
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Search event ID, hash, location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-[#F5F5F2] border border-[#E5E5E2] rounded-md text-[#171717] placeholder-[#666666] focus:bg-white focus:outline-none focus:border-[#171717]"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F5F5F2] border-b border-[#E5E5E2] text-[10px] font-mono font-semibold uppercase tracking-wider text-[#666666]">
                  <th className="py-3 px-4">Record ID</th>
                  <th className="py-3 px-4">Hotspot ID</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Current Record Hash</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E2] font-mono">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#666666] font-sans">
                      No blockchain records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const isSelected = selectedTx?.eventId === rec.eventId;
                    return (
                      <tr
                        key={rec.eventId}
                        onClick={() => setSelectedTx(rec)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#EEEEEB] font-semibold'
                            : 'hover:bg-[#F5F5F2]'
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-[#171717]">{rec.eventId}</td>
                        <td className="py-3 px-4 text-[#666666]">{rec.hotspotId}</td>
                        <td className="py-3 px-4 text-[#171717] font-sans font-medium truncate max-w-[140px]">
                          {rec.location}
                        </td>
                        <td className="py-3 px-4">
                          <RiskBadge level={rec.severity} size="sm" />
                        </td>
                        <td className="py-3 px-4 text-[#666666] truncate max-w-[120px]">
                          {rec.txHash.slice(0, 10)}...{rec.txHash.slice(-6)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider ${
                              rec.status.includes('CONFIRMED')
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {rec.status.includes('CONFIRMED') ? 'CONFIRMED' : 'PENDING'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTx(rec);
                            }}
                            className="text-xs font-semibold text-[#171717] hover:underline cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Inspector Details Panel (4 cols) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-md border border-[#E5E5E2] space-y-4">
          <div className="pb-3 border-b border-[#E5E5E2] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#171717] flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-[#171717]" />
                <span>Hash-Chain Inspector</span>
              </h3>
              <p className="text-xs text-[#666666]">Cryptographic SHA-256 audit parameters</p>
            </div>
            {selectedTx && (
              <span className="font-mono text-xs font-bold text-[#171717] bg-[#F5F5F2] border border-[#E5E5E2] px-2 py-0.5 rounded-sm">
                {selectedTx.eventId}
              </span>
            )}
          </div>

          {selectedTx ? (
            <div className="space-y-3.5 text-xs">
              <div>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[10px] uppercase font-semibold text-[#666666] font-mono">
                    Audit Record ID
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-[#F5F5F2] text-[#171717] border border-[#E5E5E2]">
                    SHA-256 AUDIT
                  </span>
                </div>
                <p className="font-bold text-[#171717] text-sm">{selectedTx.location}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[#666666] font-bold">{selectedTx.hotspotId}</span>
                  <RiskBadge level={selectedTx.severity} size="sm" />
                </div>
              </div>

              {/* Block & Network details */}
              <div className="p-3 bg-[#F5F5F2] rounded-sm border border-[#E5E5E2] font-mono space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#666666] text-[11px]">Ledger Mode:</span>
                  <span className="font-bold text-[#171717] text-right">{selectedTx.network}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#666666] text-[11px]">Block Height:</span>
                  <span className="font-bold text-[#171717]">#{selectedTx.blockNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#666666] text-[11px]">Timestamp:</span>
                  <span className="text-[#666666] text-[10px]">
                    {new Date(selectedTx.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Current Record Hash with Copy Action */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-semibold text-[#666666] font-mono">
                    Current Record Hash (recordHash)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedTx.recordHash || selectedTx.txHash)}
                    className="text-[11px] font-semibold text-[#171717] hover:underline flex items-center gap-1 font-sans cursor-pointer"
                  >
                    {copiedHash === (selectedTx.recordHash || selectedTx.txHash) ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Hash</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="font-mono text-[11px] text-[#171717] bg-[#F5F5F2] p-2 rounded-sm break-all border border-[#E5E5E2]">
                  {selectedTx.recordHash || selectedTx.txHash}
                </p>
              </div>

              {/* Prev Hash Link */}
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#666666] block mb-1 font-mono">
                  Previous Block Hash (prevHash)
                </span>
                <p className="font-mono text-[11px] text-[#666666] bg-[#F5F5F2] p-2 rounded-sm break-all border border-[#E5E5E2]">
                  {selectedTx.prevHash || getExpectedPrevHash(selectedTx)}
                </p>
              </div>

              {/* Canonical Payload Digest */}
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#666666] block mb-1 font-mono">
                  Canonical Payload SHA-256 (payloadHash)
                </span>
                <p className="font-mono text-[11px] text-[#666666] bg-[#F5F5F2] p-2 rounded-sm break-all border border-[#E5E5E2]">
                  {selectedTx.payloadHash}
                </p>
              </div>

              {/* Canonical JSON Payload */}
              {selectedTx.canonicalPayload && (
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[#666666] block mb-1 font-mono">
                    Canonical JSON Payload (Zero PII)
                  </span>
                  <pre className="font-mono text-[10px] text-[#171717] bg-[#F5F5F2] p-2.5 rounded-sm border border-[#E5E5E2] overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(selectedTx.canonicalPayload, null, 2)}
                  </pre>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleVerifyHashProof(selectedTx)}
                className="w-full py-2.5 bg-[#171717] hover:bg-black text-white font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-1.5 font-sans cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Recompute &amp; Verify Block Hash Proof</span>
              </button>

              <div className="pt-2 border-t border-[#E5E5E2] text-[11px] text-[#666666] flex items-start gap-1.5 leading-tight font-sans">
                <Info className="w-3.5 h-3.5 text-[#171717] shrink-0 mt-0.5" />
                <span>
                  Tamper-evident audit record ensures immutable timestamping for relief audits without exposing private citizen data.
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-[#666666]">
              Select any event row to view audit parameters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
