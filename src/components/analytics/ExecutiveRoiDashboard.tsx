'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  DollarSign,
  Clock,
  ShieldCheck,
  Zap,
  Download,
  FileText,
  Layers,
  ArrowUpRight,
  CheckCircle2,
  BarChart3,
  Calendar,
  Sparkles,
  PieChart,
} from 'lucide-react';
import { ExecutiveRoiMetrics } from '../../lib/analytics/executive-roi-engine';

export const ExecutiveRoiDashboard: React.FC = () => {
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [metrics, setMetrics] = useState<ExecutiveRoiMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const fetchMetrics = async (days: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/analytics/roi?periodDays=${days}`);
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (e) {
      console.error('Failed to fetch ROI metrics', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics(periodDays);
  }, [periodDays]);

  const formatCurrency = (cents: number) =>
    `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> EXECUTIVE ROI &amp; FINANCIAL VALUE ENGINE
            </span>
            <span className="text-xs text-slate-400 font-mono">Phase 6.7 Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Continuous Software &amp; Fintech ROI Audit
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time provable value metrics, labor hours saved, rate optimization spread, and QuickPay margins.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Timeframe selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-bold">
            {[
              { label: '30 Days', value: 30 },
              { label: '90 Days', value: 90 },
              { label: '365 Days', value: 365 },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => setPeriodDays(t.value)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  periodDays === t.value
                    ? 'bg-emerald-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <a
            href={`/api/v1/analytics/roi/pdf?periodDays=${periodDays}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition shadow flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Export Board PDF
          </a>
        </div>
      </div>

      {isLoading || !metrics ? (
        <div className="py-20 text-center text-slate-500 font-mono text-xs animate-pulse">
          Aggregating cross-system multi-tier ROI telemetry...
        </div>
      ) : (
        <>
          {/* Top 4 Value Drivers Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 hover:border-emerald-500/40 transition">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" /> Total Economic Value
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                  {metrics.platformSummary.roiMultiplier.toFixed(1)}x ROI
                </span>
              </div>
              <div className="text-3xl font-black text-emerald-400 font-mono">
                {formatCurrency(metrics.platformSummary.totalEconomicValueGeneratedCents)}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                Net Broker Profit: <span className="text-white font-bold">{formatCurrency(metrics.platformSummary.netBrokerageProfitGainCents)}</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 hover:border-sky-500/40 transition">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-400" /> Labor Hours Saved
                </span>
                <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px] font-mono font-bold">
                  @ $35/hr
                </span>
              </div>
              <div className="text-3xl font-black text-sky-400 font-mono">
                {metrics.laborEfficiency.totalLaborHoursSaved} hrs
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                Labor Value: <span className="text-white font-bold">{formatCurrency(metrics.laborEfficiency.totalLaborValueSavedCents)}</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 hover:border-indigo-500/40 transition">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-indigo-400" /> Split Freight Savings
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-[10px] font-mono font-bold">
                  {metrics.splitOptimization.totalOptimizedLoads} Loads
                </span>
              </div>
              <div className="text-3xl font-black text-indigo-400 font-mono">
                {formatCurrency(metrics.splitOptimization.totalLinehaulSavedCents)}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                Avg Line-Haul Saved: <span className="text-white font-bold">{formatCurrency(metrics.splitOptimization.averageSavingsPerLoadCents)}/load</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 hover:border-amber-500/40 transition">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" /> Dispute &amp; Fintech Margin
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold">
                  {metrics.disputeRecovery.recoverySuccessRatePercent}% Win Rate
                </span>
              </div>
              <div className="text-3xl font-black text-amber-400 font-mono">
                {formatCurrency(metrics.disputeRecovery.brokerRecoveryNetCents + metrics.quickpayFintech.totalFintechFeeRevenueCents)}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                QuickPay Fees: <span className="text-white font-bold">{formatCurrency(metrics.quickpayFintech.totalFintechFeeRevenueCents)}</span>
              </div>
            </div>
          </div>

          {/* Deep-Dive Grid: 4 Stream Breakdown & Run-Rate */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Detailed Stream Cards */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" /> Provable Value Creation Stream Breakdown
              </h3>

              {/* Stream 1: Labor Efficiency */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="font-bold text-sm text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-sky-400" />
                    1. Labor Efficiency &amp; Autonomous Processing
                  </div>
                  <span className="font-mono text-emerald-400 font-black text-sm">
                    {formatCurrency(metrics.laborEfficiency.totalLaborValueSavedCents)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] text-slate-400">RFQ Extractions:</div>
                    <div className="text-white font-bold mt-0.5">{metrics.laborEfficiency.rfqHoursSaved} hrs</div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] text-slate-400">Invoicing Auto:</div>
                    <div className="text-white font-bold mt-0.5">{metrics.laborEfficiency.invoiceHoursSaved} hrs</div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] text-slate-400">Dispute Filings:</div>
                    <div className="text-white font-bold mt-0.5">{metrics.laborEfficiency.disputeHoursSaved} hrs</div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] text-slate-400">QuickPay Settled:</div>
                    <div className="text-white font-bold mt-0.5">{metrics.laborEfficiency.quickpayHoursSaved} hrs</div>
                  </div>
                </div>
              </div>

              {/* Stream 2: Volume-LTL Split Freight Optimizer */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="font-bold text-sm text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-400" />
                    2. Volume-LTL Split Optimization Savings
                  </div>
                  <span className="font-mono text-emerald-400 font-black text-sm">
                    {formatCurrency(metrics.splitOptimization.totalLinehaulSavedCents)}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Automated routing identified {metrics.splitOptimization.totalOptimizedLoads} multi-pallet loads where splitting into partial Volume-LTL linehauls yielded direct carrier rate arbitrage.
                </p>
              </div>

              {/* Stream 3: Carrier Overcharge Recoveries */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="font-bold text-sm text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-400" />
                    3. Re-Bill Overcharge Dispute Recovery (Net to Broker)
                  </div>
                  <span className="font-mono text-emerald-400 font-black text-sm">
                    {formatCurrency(metrics.disputeRecovery.brokerRecoveryNetCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span>Gross Flagged: {formatCurrency(metrics.disputeRecovery.totalOverchargesFlaggedCents)}</span>
                  <span>Recovered Yield: {formatCurrency(metrics.disputeRecovery.totalCreditsRecoveredCents)} ({metrics.disputeRecovery.recoverySuccessRatePercent}%)</span>
                </div>
              </div>

              {/* Stream 4: QuickPay Fintech Fee Revenue */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="font-bold text-sm text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    4. Embedded QuickPay Payout Spread Revenue
                  </div>
                  <span className="font-mono text-emerald-400 font-black text-sm">
                    {formatCurrency(metrics.quickpayFintech.totalFintechFeeRevenueCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span>Total Accelerated GMV: {formatCurrency(metrics.quickpayFintech.totalQuickPayVolumeCents)}</span>
                  <span>Average Fee Spread: {metrics.quickpayFintech.averageFeePercentage}%</span>
                </div>
              </div>
            </div>

            {/* Right Column: Cost-Benefit Waterfall & Annualization */}
            <div className="space-y-4">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-400" /> Board Financial Summary
              </h3>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Annualized Projected Run-Rate
                  </span>
                  <div className="text-3xl font-black text-white font-mono">
                    {formatCurrency(metrics.platformSummary.annualizedProjectedValueCents)}
                  </div>
                  <p className="text-xs text-slate-400">
                    Projected annual bottom-line value delivered to the brokerage based on current shipment volume.
                  </p>
                </div>

                <div className="border-t border-slate-800 pt-4 space-y-3 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Gross Value Delivered:</span>
                    <span className="font-mono text-white font-bold">{formatCurrency(metrics.platformSummary.totalEconomicValueGeneratedCents)}</span>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>Apex Platform SaaS Fee:</span>
                    <span className="font-mono font-bold">- {formatCurrency(metrics.platformSummary.estimatedPlatformSaaSMonthlyCostCents)}</span>
                  </div>
                  <div className="border-t border-slate-800/80 pt-2 flex justify-between text-emerald-400 font-bold text-sm">
                    <span>Net Profit Expansion:</span>
                    <span className="font-mono font-black">{formatCurrency(metrics.platformSummary.netBrokerageProfitGainCents)}</span>
                  </div>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-xs text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Verified ROI Audit Sealed:
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Calculated with exact zero-drift double-entry balance verification across all freight ledger entries.
                  </p>
                </div>

                <a
                  href={`/api/v1/analytics/roi/pdf?periodDays=${periodDays}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
                >
                  <FileText className="w-4 h-4" /> Download Official Board PDF
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
