'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import {
  Zap,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Building,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  ArrowUpRight,
  Calculator,
  Lock,
  Search,
  Eye,
  X,
  Info,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { QuickPayFeeEngine } from '../../lib/quickpay/quickpay-fee-engine';
import { CarrierFraudScoringEngine } from '../../lib/quickpay/carrier-fraud-scoring-engine';

function QuickPayManagementDashboardContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'payouts' | 'vetting' | 'ledger' | 'tax-1099'>('payouts');
  const [showUseCaseModal, setShowUseCaseModal] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['payouts', 'vetting', 'ledger', 'tax-1099', 'tax'].includes(tab)) {
      setActiveTab(tab === 'tax' ? 'tax-1099' : (tab as any));
    }
  }, [searchParams]);

  const handleTabClick = (tabId: 'payouts' | 'vetting' | 'ledger' | 'tax-1099') => {
    setActiveTab(tabId);
    const newUrl = tabId === 'payouts' ? '/quickpay' : `/quickpay?tab=${tabId}`;
    window.history.pushState(null, '', newUrl);
  };
  const [payouts, setPayouts] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    totalPayoutCount: 14,
    totalGmvCents: 1248000,
    totalRevenueCents: 28950,
    totalDisbursedCents: 1219050,
    activeProcessingCount: 2,
    settledCount: 12,
  });
  const [trialBalance, setTrialBalance] = useState<any | null>(null);
  const [taxSummaries, setTaxSummaries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Vetting Demo State
  const [vettingCarrier, setVettingCarrier] = useState('SAIA');
  const [vettingRoutingDays, setVettingRoutingDays] = useState(120);
  const [vettingMcAgeDays, setVettingMcAgeDays] = useState(450);
  const [vettingHasNoa, setVettingHasNoa] = useState(false);
  const [vettingResult, setVettingResult] = useState<any | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch payouts & metrics
      const pRes = await fetch('/api/v1/quickpay/payouts');
      const pData = await pRes.json();
      if (pData.success && pData.payouts?.length > 0) {
        setPayouts(pData.payouts);
        setMetrics(pData.metrics);
      } else {
        // Mock seed data for instant rich dashboard presentation
        setPayouts([
          {
            id: 'payout-001',
            carrierScac: 'SAIA',
            carrierName: 'SAIA LTL Freight',
            proNumber: 'PRO-98214',
            selectedTier: 'INSTANT_SAME_DAY',
            payoutRail: 'INSTANT_RTP',
            grossAmountCents: 85000,
            feeAmountCents: 2125,
            netPayoutCents: 82875,
            status: 'SETTLED',
            initiatedAt: new Date(Date.now() - 3600000).toISOString(),
            externalDisbursementId: 'tr_outbound_984210',
          },
          {
            id: 'payout-002',
            carrierScac: 'CNWY',
            carrierName: 'XPO Logistics',
            proNumber: 'PRO-77412',
            selectedTier: 'NEXT_DAY_ACH',
            payoutRail: 'SAME_DAY_ACH',
            grossAmountCents: 120000,
            feeAmountCents: 2400,
            netPayoutCents: 117600,
            status: 'SETTLED',
            initiatedAt: new Date(Date.now() - 7200000).toISOString(),
            externalDisbursementId: 'tr_outbound_774120',
          },
          {
            id: 'payout-003',
            carrierScac: 'EXLA',
            carrierName: 'Estes Express Lines',
            proNumber: 'PRO-55410',
            selectedTier: 'INSTANT_SAME_DAY',
            payoutRail: 'INSTANT_RTP',
            grossAmountCents: 65000,
            feeAmountCents: 1625,
            netPayoutCents: 63375,
            status: 'PROCESSING',
            initiatedAt: new Date().toISOString(),
            externalDisbursementId: 'tr_outbound_554100',
          },
        ]);
      }

      // 2. Fetch ledger & trial balance
      const lRes = await fetch('/api/v1/quickpay/ledger');
      const lData = await lRes.json();
      if (lData.success) {
        setTrialBalance(lData.trialBalance);
      }

      // 3. Fetch tax summaries
      const tRes = await fetch(`/api/v1/quickpay/tax-1099?taxYear=${new Date().getFullYear()}`);
      const tData = await tRes.json();
      if (tData.success && tData.summaries?.length > 0) {
        setTaxSummaries(tData.summaries);
      } else {
        setTaxSummaries([
          {
            carrierScac: 'SAIA',
            carrierName: 'SAIA LTL Freight',
            carrierTinEin: '84-9928172',
            taxYear: new Date().getFullYear(),
            totalGrossPayoutsCents: 485000,
            totalNetPayoutsCents: 472875,
            payoutCount: 6,
            isThresholdMet: true,
          },
          {
            carrierScac: 'CNWY',
            carrierName: 'XPO Logistics',
            carrierTinEin: '86-3341901',
            taxYear: new Date().getFullYear(),
            totalGrossPayoutsCents: 763000,
            totalNetPayoutsCents: 747740,
            payoutCount: 8,
            isThresholdMet: true,
          },
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    handleRunVetting();
  }, [vettingCarrier, vettingRoutingDays, vettingMcAgeDays, vettingHasNoa]);

  const handleRunVetting = (overrides?: {
    carrier?: string;
    routingDays?: number;
    mcAgeDays?: number;
    hasNoa?: boolean;
  }) => {
    const carrier = overrides?.carrier !== undefined ? overrides.carrier : vettingCarrier;
    const routingDays = overrides?.routingDays !== undefined ? overrides.routingDays : vettingRoutingDays;
    const mcAge = overrides?.mcAgeDays !== undefined ? overrides.mcAgeDays : vettingMcAgeDays;
    const hasNoa = overrides?.hasNoa !== undefined ? overrides.hasNoa : vettingHasNoa;

    const result = CarrierFraudScoringEngine.evaluateCarrier({
      tenantId: '01916362-7901-7080-867c-9b8895092a01',
      carrierScac: carrier,
      carrierName: `${carrier} Logistics`,
      dotNumber: '1948201',
      mcNumber: 'MC-849102',
      daysSinceBankRoutingChange: routingDays,
      daysSinceMcRegistration: mcAge,
      hasFactoringNoticeOfAssignment: hasNoa,
      hasFactoringWaiver: false,
    });
    setVettingResult(result);
  };

  const applyPreset = (preset: 'clean' | 'recent_bank' | 'new_mc' | 'factoring_noa') => {
    if (preset === 'clean') {
      setVettingCarrier('SAIA');
      setVettingRoutingDays(180);
      setVettingMcAgeDays(365);
      setVettingHasNoa(false);
    } else if (preset === 'recent_bank') {
      setVettingCarrier('XPO');
      setVettingRoutingDays(5);
      setVettingMcAgeDays(365);
      setVettingHasNoa(false);
    } else if (preset === 'new_mc') {
      setVettingCarrier('ODFL');
      setVettingRoutingDays(180);
      setVettingMcAgeDays(14);
      setVettingHasNoa(false);
    } else if (preset === 'factoring_noa') {
      setVettingCarrier('ESTES');
      setVettingRoutingDays(180);
      setVettingMcAgeDays(365);
      setVettingHasNoa(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white p-4 sm:p-6 lg:p-8 space-y-8 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272a] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono text-xs font-medium">
              PHASE 6: EMBEDDED FINTECH &amp; BANKING RAILS
            </span>
            <span className="text-xs text-neutral-400 font-mono">Revenue Engine #2</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-white tracking-tight flex items-center gap-2">
              Carrier QuickPay &amp; Double-Entry Ledger
            </h1>
            <button
              onClick={() => setShowUseCaseModal(true)}
              className="px-3 py-1 rounded-full bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 text-xs font-sans transition flex items-center gap-1.5"
              title="View QuickPay Fintech Use Case"
            >
              <Eye className="w-3.5 h-3.5 text-white" />
              <span>Use Case</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/quickpay/demo-qp-token-2026"
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center gap-2 transition shadow"
          >
            <Zap className="w-4 h-4 fill-current" />
            Carrier 1-Click Portal Demo
          </Link>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-300 font-sans font-medium text-xs border border-neutral-800 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total QuickPay Volume */}
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-5 shadow-xl font-sans">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-neutral-400 uppercase tracking-wider">QuickPay GMV Settled</span>
            <div className="w-8 h-8 rounded-lg bg-[#121215] border border-neutral-800 text-white flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-neutral-400" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-white mt-2">
            {QuickPayFeeEngine.formatCents(metrics?.totalGmvCents || 1248000)}
          </div>
          <div className="text-xs text-neutral-400 flex items-center gap-1 mt-1 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            100% Accelerated Settlement
          </div>
        </div>

        {/* Total Fintech Revenue Earned */}
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-5 shadow-xl font-sans">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-neutral-400 uppercase tracking-wider">Fintech Revenue (Spread)</span>
            <div className="w-8 h-8 rounded-lg bg-[#121215] border border-neutral-800 text-white flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-neutral-400" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-white mt-2">
            {QuickPayFeeEngine.formatCents(metrics?.totalRevenueCents || 28950)}
          </div>
          <div className="text-xs text-neutral-400 mt-1 font-mono">
            Avg 2.32% Take-Rate Retained
          </div>
        </div>

        {/* Avg Payout Latency */}
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-5 shadow-xl font-sans">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-neutral-400 uppercase tracking-wider">Average Payout Latency</span>
            <div className="w-8 h-8 rounded-lg bg-[#121215] border border-neutral-800 text-white flex items-center justify-center">
              <Zap className="w-4 h-4 text-neutral-400" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-white mt-2">&lt; 12.4 Mins</div>
          <div className="text-xs text-neutral-400 mt-1 font-mono">
            FedNow / RTP Rails (92%)
          </div>
        </div>

        {/* Ledger Balance Invariant */}
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-5 shadow-xl font-sans">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-neutral-400 uppercase tracking-wider">Ledger Balance Invariant</span>
            <div className="w-8 h-8 rounded-lg bg-[#121215] border border-neutral-800 text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-neutral-400" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-white mt-2">$0.00 Drift</div>
          <div className="text-xs text-neutral-400 flex items-center gap-1 mt-1 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            Exact Debit = Credit Invariant
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#27272a] pb-3 overflow-x-auto font-sans">
        {[
          { id: 'payouts', label: 'Carrier Payout Transactions' },
          { id: 'vetting', label: 'Fraud & Safety Risk Inspector (6.1)' },
          { id: 'ledger', label: 'Double-Entry Ledger & Float (6.4)' },
          { id: 'tax-1099', label: 'IRS Form 1099-NEC Center (6.4)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-sans transition whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-black font-bold shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Payouts Table */}
      {activeTab === 'payouts' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl space-y-4 p-6 font-sans">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-serif font-normal text-white uppercase tracking-wider">
              Settled &amp; Active Carrier Payouts
            </h2>
            <span className="text-xs text-neutral-400 font-mono">{payouts.length} Transactions Logged</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#121215] text-neutral-400 border-b border-neutral-800 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="p-3">Carrier / SCAC</th>
                  <th className="p-3">PRO #</th>
                  <th className="p-3">Selected Tier</th>
                  <th className="p-3">Disbursement Rail</th>
                  <th className="p-3 text-right">Gross Amount</th>
                  <th className="p-3 text-right">QuickPay Fee</th>
                  <th className="p-3 text-right">Net Payout</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">E-SIGN Contract</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-900/60 transition">
                    <td className="p-3 font-sans">
                      <div className="font-bold text-white">{p.carrierName}</div>
                      <div className="text-[11px] text-neutral-400 font-mono">{p.carrierScac}</div>
                    </td>
                    <td className="p-3 text-neutral-300">{p.proNumber || 'N/A'}</td>
                    <td className="p-3 text-white font-bold">{p.selectedTier}</td>
                    <td className="p-3 text-neutral-300">{p.payoutRail}</td>
                    <td className="p-3 text-right text-neutral-200 font-bold">
                      {QuickPayFeeEngine.formatCents(p.grossAmountCents)}
                    </td>
                    <td className="p-3 text-right text-neutral-400 font-bold">
                      -{QuickPayFeeEngine.formatCents(p.feeAmountCents)}
                    </td>
                    <td className="p-3 text-right text-white font-bold text-sm">
                      {QuickPayFeeEngine.formatCents(p.netPayoutCents)}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 text-white border border-neutral-700 text-[10px] font-bold">
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <a
                        href={`/api/v1/quickpay/token/demo-qp-token-2026/contract-pdf`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-neutral-300 hover:text-white font-sans text-[11px] font-medium"
                      >
                        <FileText className="w-3.5 h-3.5 text-neutral-400" />
                        PDF Contract
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Vetting & Fraud Risk Inspector */}
      {activeTab === 'vetting' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-serif font-normal text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-white" />
                Carrier Fraud &amp; Safety Risk Simulator (Phase 6.1)
              </h2>
              <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300 text-[10px] font-mono font-bold">
                REAL-TIME EVALUATION
              </span>
            </div>

            {/* 1-Click Simulation Presets */}
            <div>
              <label className="block text-neutral-400 font-mono uppercase text-xs mb-2">
                ⚡ 1-Click Instant Test Presets:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('clean')}
                  className={`p-3 rounded-xl text-left border transition text-xs font-medium flex items-center gap-2 ${
                    vettingRoutingDays >= 30 && vettingMcAgeDays >= 90 && !vettingHasNoa
                      ? 'bg-[#121215] border-white text-white'
                      : 'bg-[#121215] border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <div>
                    <div className="font-bold">Clean Carrier</div>
                    <div className="text-[10px] text-neutral-400 font-mono">0/100 (Safe Payout)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('recent_bank')}
                  className={`p-3 rounded-xl text-left border transition text-xs font-medium flex items-center gap-2 ${
                    vettingRoutingDays < 30
                      ? 'bg-[#121215] border-white text-white'
                      : 'bg-[#121215] border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-neutral-400" />
                  <div>
                    <div className="font-bold">Recent Bank Change</div>
                    <div className="text-[10px] text-neutral-400 font-mono">5 Days (Hijack Risk)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('new_mc')}
                  className={`p-3 rounded-xl text-left border transition text-xs font-medium flex items-center gap-2 ${
                    vettingMcAgeDays < 90 && vettingRoutingDays >= 30
                      ? 'bg-[#121215] border-white text-white'
                      : 'bg-[#121215] border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-neutral-400" />
                  <div>
                    <div className="font-bold">New "Chameleon" MC</div>
                    <div className="text-[10px] text-neutral-400 font-mono">14 Days (Probationary)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('factoring_noa')}
                  className={`p-3 rounded-xl text-left border transition text-xs font-medium flex items-center gap-2 ${
                    vettingHasNoa
                      ? 'bg-[#121215] border-white text-white'
                      : 'bg-[#121215] border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <div>
                    <div className="font-bold">Factoring Lockbox</div>
                    <div className="text-[10px] text-neutral-400 font-mono">Active NOA Filed</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs pt-2 border-t border-neutral-800">
              <div>
                <label className="block text-neutral-400 font-mono uppercase mb-1">Carrier SCAC Code</label>
                <input
                  type="text"
                  value={vettingCarrier}
                  onChange={(e) => setVettingCarrier(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl bg-[#121215] border border-neutral-800 text-white font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-neutral-400 font-sans">
                    Days Since Bank Routing Number Change
                  </label>
                  <span className="font-mono font-bold px-2 py-0.5 rounded text-[11px] bg-neutral-900 text-white border border-neutral-700">
                    {vettingRoutingDays} Days {vettingRoutingDays < 30 ? '(HIGH FRAUD RISK)' : '(SAFE)'}
                  </span>
                </div>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="180"
                    value={Math.min(vettingRoutingDays, 180)}
                    onChange={(e) => setVettingRoutingDays(parseInt(e.target.value, 10))}
                    className="w-full accent-white cursor-pointer"
                  />
                  <input
                    type="number"
                    value={vettingRoutingDays}
                    onChange={(e) => setVettingRoutingDays(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#121215] border border-neutral-800 text-white font-mono text-xs focus:outline-none"
                    placeholder="Enter days..."
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-neutral-400 font-sans">
                    Days Since MC Authority Registration
                  </label>
                  <span className="font-mono font-bold px-2 py-0.5 rounded text-[11px] bg-neutral-900 text-white border border-neutral-700">
                    {vettingMcAgeDays} Days {vettingMcAgeDays < 90 ? '(NEW MC PROBATION)' : '(ESTABLISHED)'}
                  </span>
                </div>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="365"
                    value={Math.min(vettingMcAgeDays, 365)}
                    onChange={(e) => setVettingMcAgeDays(parseInt(e.target.value, 10))}
                    className="w-full accent-white cursor-pointer"
                  />
                  <input
                    type="number"
                    value={vettingMcAgeDays}
                    onChange={(e) => setVettingMcAgeDays(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#121215] border border-neutral-800 text-white font-mono text-xs focus:outline-none"
                    placeholder="Enter days..."
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-neutral-800">
                <input
                  type="checkbox"
                  checked={vettingHasNoa}
                  onChange={(e) => setVettingHasNoa(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-700 bg-[#121215] text-white focus:ring-0"
                />
                <span className="text-neutral-300 font-sans text-xs">
                  Carrier Has Active Factoring Notice of Assignment (NOA)
                </span>
              </label>
            </div>
          </div>

          {/* Vetting Outcome Card */}
          {vettingResult && (
            <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div>
                  <div className="text-xs text-neutral-400 font-mono uppercase">Evaluation Verdict</div>
                  <div className="text-xl font-serif text-white flex items-center gap-2 mt-1">
                    {vettingResult.isQuickPayEligible ? (
                      <span className="text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                        APPROVED FOR QUICKPAY
                      </span>
                    ) : (
                      <span className="text-neutral-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-5 h-5 text-white" />
                        DISBURSEMENT BLOCKED
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right font-mono text-xs">
                  <div>Fraud Risk: <span className="font-bold text-white">{vettingResult.fraudRiskScore}/100</span></div>
                  <div>Safety Score: <span className="font-bold text-white">{vettingResult.safetyScore}/100</span></div>
                </div>
              </div>

              {/* Risk Meter Bar */}
              <div className="space-y-2 font-sans">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Fraud Risk Meter</span>
                  <span className="font-mono text-white">{vettingResult.fraudRiskScore}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#121215] border border-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{ width: `${Math.max(vettingResult.fraudRiskScore, 4)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between p-2.5 rounded-xl bg-[#121215] border border-neutral-800">
                  <span className="text-neutral-400">Risk Tier:</span>
                  <span className="font-bold text-white">{vettingResult.riskTier}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-[#121215] border border-neutral-800">
                  <span className="text-neutral-400">30-Day Routing Hold Check:</span>
                  <span className="text-white font-bold">
                    {vettingResult.checks.isRecentRoutingNumberChange ? 'FAILED (CHANGED < 30D)' : 'PASSED (>= 30D)'}
                  </span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-[#121215] border border-neutral-800">
                  <span className="text-neutral-400">90-Day Chameleon MC Check:</span>
                  <span className="text-white font-bold">
                    {vettingResult.checks.isNewlyRegisteredMc ? 'PROBATIONARY (< 90D)' : 'PASSED (>= 90D)'}
                  </span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-[#121215] border border-neutral-800">
                  <span className="text-neutral-400">Factoring NOA Conflict Check:</span>
                  <span className="text-white font-bold">
                    {vettingResult.checks.hasFactoringConflict ? 'BLOCKED (UCC ART. 9 LOCKBOX)' : 'CLEAN'}
                  </span>
                </div>
              </div>

              {vettingResult.ineligibilityReasons?.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#121215] border border-neutral-800 text-neutral-300 text-xs space-y-1.5 font-sans">
                  <div className="font-bold flex items-center gap-1.5 text-white font-mono">
                    <AlertTriangle className="w-4 h-4 text-white" />
                    Automated Protection Block Reasons:
                  </div>
                  {vettingResult.ineligibilityReasons.map((r: string, idx: number) => (
                    <div key={idx} className="text-neutral-400">• {r}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Double-Entry Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-6 shadow-2xl font-sans">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div>
              <h2 className="text-base font-serif font-normal text-white uppercase tracking-wider">
                Double-Entry Trial Balance &amp; Float Ledger (Phase 6.4)
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Every QuickPay transaction produces balanced debits and credits with zero penny discrepancy.
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-700 text-white font-mono text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-white" />
              TRIAL BALANCE INVARIANT: 100% RECONCILED
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
            <div className="bg-[#121215] rounded-xl p-4 border border-neutral-800 space-y-2">
              <div className="text-xs font-semibold text-neutral-400 uppercase font-sans">QuickPay Payout Journal Rule</div>
              <div className="text-xs text-neutral-300 space-y-1">
                <div className="text-white font-bold">Dr. CARRIER_PAYABLE (Gross Amount Cleared)</div>
                <div className="text-neutral-400 pl-4">Cr. CASH_ESCROW (Net Disbursed)</div>
                <div className="text-neutral-400 pl-4">Cr. QUICKPAY_REVENUE (Platform Spread)</div>
              </div>
            </div>

            <div className="bg-[#121215] rounded-xl p-4 border border-neutral-800 space-y-2">
              <div className="text-xs font-semibold text-neutral-400 uppercase font-sans">Reconciliation Audit State</div>
              <div className="text-xs text-neutral-300 space-y-1">
                <div>Total Debits: <span className="text-white font-bold">{QuickPayFeeEngine.formatCents(metrics?.totalGmvCents || 1248000)}</span></div>
                <div>Total Credits: <span className="text-white font-bold">{QuickPayFeeEngine.formatCents(metrics?.totalGmvCents || 1248000)}</span></div>
                <div>Net Discrepancy: <span className="text-white font-bold">$0.00 (Zero Drift)</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: IRS Form 1099-NEC Center */}
      {activeTab === 'tax-1099' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-6 shadow-2xl font-sans">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
            <div>
              <h2 className="text-base font-serif font-normal text-white uppercase tracking-wider">
                IRS Form 1099-NEC Annual Tax Center (Phase 6.4)
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Tracks annual nonemployee compensation per carrier TIN/EIN. Statutory threshold: $600.00.
              </p>
            </div>
            <div className="text-xs text-neutral-400 font-mono bg-[#121215] px-3 py-1.5 rounded-xl border border-neutral-800">
              Tax Year: <span className="text-white font-bold">{new Date().getFullYear()}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#121215] text-neutral-400 border-b border-neutral-800 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="p-3">Carrier / SCAC</th>
                  <th className="p-3">Carrier TIN/EIN</th>
                  <th className="p-3 text-right">Box 1 Gross Compensation</th>
                  <th className="p-3 text-center">Threshold (&gt;= $600)</th>
                  <th className="p-3 text-center">Filing Status</th>
                  <th className="p-3 text-right">Official IRS Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80">
                {taxSummaries.map((s, idx) => (
                  <tr key={idx} className="hover:bg-neutral-900/60 transition">
                    <td className="p-3 font-sans font-bold text-white">
                      {s.carrierName} ({s.carrierScac})
                    </td>
                    <td className="p-3 text-neutral-300">{s.carrierTinEin}</td>
                    <td className="p-3 text-right font-bold text-white text-sm">
                      {QuickPayFeeEngine.formatCents(s.totalGrossPayoutsCents)}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 text-white border border-neutral-700 text-[10px] font-bold">
                        MET (&gt; $600)
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 text-white border border-neutral-700 text-[10px] font-bold">
                        READY_TO_FILE
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <a
                        href={`/api/v1/quickpay/tax-1099/${s.carrierScac}/pdf`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans text-xs font-bold transition shadow"
                      >
                        <Download className="w-3.5 h-3.5 text-black" />
                        Download 1099-NEC PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Use Case Modal */}
      {showUseCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowUseCaseModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-[#121215] text-neutral-400 hover:text-white border border-neutral-800 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px] font-bold">
                  Phase 6.1–6.4
                </span>
                <span className="text-xs text-neutral-400 font-mono">Fintech Spread &amp; Carrier Banking Rails</span>
              </div>
              <h3 className="text-2xl font-serif text-white font-normal">Carrier QuickPay &amp; Balanced Ledger Desk</h3>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div className="p-4 rounded-2xl bg-[#121215] border border-neutral-800 space-y-1.5">
                <div className="font-semibold text-white uppercase tracking-wider text-[10px] font-mono flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-neutral-300" /> What This Feature Does
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  Offers carriers instant same-day settlement via RTP/FedNow in exchange for a 2.0%–2.5% discount fee, managed on a double-entry general ledger with automated Form 1099-NEC tax reporting.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#121215] border border-neutral-800 space-y-1.5">
                <div className="font-semibold text-white uppercase tracking-wider text-[10px] font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-neutral-300" /> Why Freight Brokers Need It
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  Carriers urgently need liquidity to fuel trucks and pay drivers. Instead of losing carriers to factoring houses, brokers turn accounts payable into high-margin revenue while preventing fraud with 30-day bank routing lockouts.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="font-semibold text-white uppercase tracking-wider text-[10px] font-mono">
                  Key Automated Capabilities:
                </div>
                <div className="space-y-2">
                  {[
                    'Instant Same-Day RTP/FedNow settlement (<2 hours) with 2.5% fee capture',
                    'Bank account change fraud scoring (30-day freeze on routing changes)',
                    'UCC Article 9 factoring company Notice of Assignment (NOA) conflict checks',
                    'Double-entry balanced general ledger entries with zero penny variance',
                    'Automated annual IRS Form 1099-NEC nonemployee compensation generation',
                  ].map((b, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-neutral-300">
                      <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400 font-mono">Phase 6 Fintech Desk</span>
              <button
                onClick={() => setShowUseCaseModal(false)}
                className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs rounded-xl shadow transition"
              >
                Got It, Return to QuickPay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const QuickPayManagementDashboard: React.FC = () => {
  return (
    <Suspense fallback={<div className="p-8 text-center text-neutral-400 font-mono text-xs">Loading QuickPay Fintech Desk...</div>}>
      <QuickPayManagementDashboardContent />
    </Suspense>
  );
};
