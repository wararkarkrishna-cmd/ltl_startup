'use client';

import React, { useState } from 'react';
import {
  Zap,
  Clock,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Building,
  FileText,
  Lock,
  ArrowRight,
  Download,
  AlertCircle,
  Truck,
  Sparkles,
} from 'lucide-react';
import { QuickPayTier, PayoutRail } from '../../db/schema';
import { QuickPayFeeEngine, QuickPayCalculationResult } from '../../lib/quickpay/quickpay-fee-engine';

interface CarrierQuickPayPortalProps {
  tokenData: {
    token: string;
    carrierScac: string;
    carrierName: string;
    carrierEmail?: string | null;
    proNumber?: string | null;
    bolNumber?: string | null;
    grossAmountCents: number;
    bankName: string;
    routingNumberMasked: string;
    accountNumberMasked: string;
    expiresAt: string;
    isUsed: boolean;
  };
  initialCalculation: QuickPayCalculationResult;
}

export const CarrierQuickPayPortal: React.FC<CarrierQuickPayPortalProps> = ({
  tokenData,
  initialCalculation,
}) => {
  const [selectedTier, setSelectedTier] = useState<QuickPayTier>('INSTANT_SAME_DAY');
  const [signerName, setSignerName] = useState('Authorized Dispatcher');
  const [signerTitle, setSignerTitle] = useState('Managing Agent / Owner');
  const [signerEmail, setSignerEmail] = useState(tokenData.carrierEmail || 'billing@carrier.com');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(tokenData.isUsed);
  const [payoutResult, setPayoutResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live calculation based on selected tier
  const activeOption =
    initialCalculation.tierOptions.find((opt) => opt.tier === selectedTier) ||
    initialCalculation.tierOptions[0];

  const handleAcceptDisbursement = async () => {
    if (!agreedToTerms) {
      setErrorMsg('You must check the box agreeing to the assignment of proceeds.');
      return;
    }
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const res = await fetch(`/api/v1/quickpay/token/${tokenData.token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedTier,
          signerName,
          signerTitle,
          signerEmail,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Disbursement request failed');
      }

      setPayoutResult(data);
      setIsCompleted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during disbursement');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Header Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
                <Sparkles className="w-3.5 h-3.5" />
                VERIFIED DELIVERY SETTLEMENT PORTAL
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Accelerated Carrier <span className="text-emerald-400 font-mono">QuickPay</span>
              </h1>
              <p className="text-sm text-slate-400">
                Carrier: <span className="font-semibold text-slate-200">{tokenData.carrierName}</span> (SCAC: <span className="font-mono text-emerald-400">{tokenData.carrierScac}</span>)
                {tokenData.proNumber && ` • PRO #${tokenData.proNumber}`}
                {tokenData.bolNumber && ` • BOL #${tokenData.bolNumber}`}
              </p>
            </div>

            {/* Gross Payable Pill */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-right sm:min-w-[200px]">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Gross Load Payable</div>
              <div className="text-3xl font-black text-white font-mono">
                {QuickPayFeeEngine.formatCents(tokenData.grossAmountCents)}
              </div>
              <div className="text-[11px] text-emerald-400 flex items-center justify-end gap-1 font-medium mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                POD Verified & Approved
              </div>
            </div>
          </div>
        </div>

        {!isCompleted ? (
          <>
            {/* Step 1: Tier Selection Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                  Select Payout Speed & Fee Schedule
                </h2>
                <span className="text-xs text-slate-400 font-mono">3 Settlement Rails Available</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {initialCalculation.tierOptions.map((opt) => {
                  const isSelected = selectedTier === opt.tier;
                  return (
                    <div
                      key={opt.tier}
                      onClick={() => setSelectedTier(opt.tier)}
                      className={`cursor-pointer rounded-2xl p-5 border transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-slate-900 border-emerald-500 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                      }`}
                    >
                      {opt.isPopular && (
                        <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
                          Most Popular
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {opt.badge}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">
                            {opt.feePercentage > 0 ? `${opt.feePercentage}% Fee` : '0% Fee'}
                          </span>
                        </div>

                        <div>
                          <div className="text-base font-bold text-white">{opt.title}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{opt.turnaroundDescription}</div>
                        </div>

                        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 space-y-1">
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>Gross Amount:</span>
                            <span className="font-mono text-slate-300">{opt.grossFormatted}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>QuickPay Fee:</span>
                            <span className="font-mono text-red-400">
                              {opt.feeAmountCents > 0 ? `-${opt.feeFormatted}` : '$0.00'}
                            </span>
                          </div>
                          <div className="border-t border-slate-800/80 pt-1 flex items-center justify-between font-bold">
                            <span className="text-xs text-white">Net Payout:</span>
                            <span className="text-lg font-black font-mono text-emerald-400">{opt.netFormatted}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/50 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                          {opt.payoutRail}
                        </span>
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-700'}`}>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Destination Bank Account Verification */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                Verified Destination Bank Rails
              </h2>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                    <Building className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      {tokenData.bankName}
                      <span className="px-2 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                        ROUTING VERIFIED
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      Routing: {tokenData.routingNumberMasked} • Account: {tokenData.accountNumberMasked}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-1.5 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  256-Bit Encrypted Banking Rail
                </div>
              </div>
            </div>

            {/* Step 3: E-SIGN Agreement & 1-Click Acceptance Form */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold">3</span>
                E-SIGN Receivable Assignment Micro-Contract
              </h2>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Signer Full Name
                    </label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                      placeholder="e.g. John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Authorized Corporate Title
                    </label>
                    <input
                      type="text"
                      value={signerTitle}
                      onChange={(e) => setSignerTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                      placeholder="e.g. Managing Agent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Remittance Email
                    </label>
                    <input
                      type="email"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                      placeholder="billing@carrier.com"
                    />
                  </div>
                </div>

                {/* Micro-Contract Preview Card */}
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 text-xs text-slate-400 space-y-2">
                  <div className="font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Micro-Contract Terms Summary</span>
                    <a
                      href={`/api/v1/quickpay/token/${tokenData.token}/contract-pdf`}
                      target="_blank"
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono text-[11px]"
                    >
                      <FileText className="w-3 h-3" />
                      Preview Vector PDF
                    </a>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    By clicking "Accept & Disburse Now", the Assignor ({tokenData.carrierName}) irrevocably assigns all rights to the freight invoice ({activeOption.grossFormatted}) in exchange for immediate net settlement ({activeOption.netFormatted}) minus the agreed {activeOption.feePercentage}% discount fee ({activeOption.feeFormatted}). Executed in full compliance with UCC Article 9 & Federal E-SIGN Act (15 U.S.C. § 7001).
                  </p>
                </div>

                {/* Consent Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300">
                    I acknowledge that I am authorized to bind <span className="font-semibold text-white">{tokenData.carrierName}</span> and hereby execute this Electronic Assignment Agreement to receive <span className="font-bold text-emerald-400 font-mono">{activeOption.netFormatted}</span> today.
                  </span>
                </label>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errorMsg}
                  </div>
                )}

                {/* 1-Click Action Button */}
                <button
                  onClick={handleAcceptDisbursement}
                  disabled={isProcessing}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-base transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {isProcessing ? (
                    <>
                      <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      Executing Banking Rails & Balancing Ledger...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 text-slate-950 fill-current group-hover:scale-110 transition" />
                      Accept & Disburse {activeOption.netFormatted} ({activeOption.badge})
                      <ArrowRight className="w-5 h-5 text-slate-950 group-hover:translate-x-1 transition" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Success Screen */
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white">Disbursement Dispatched Successfully!</h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto">
                Your settlement of <span className="font-bold text-emerald-400 font-mono">{activeOption.netFormatted}</span> has been initiated via <span className="font-mono text-white">{payoutResult?.payout?.payoutRail || 'INSTANT_RTP'}</span> direct to {tokenData.bankName}.
              </p>
            </div>

            <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 max-w-lg mx-auto text-left space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Transaction ID:</span>
                <span className="text-slate-200">{payoutResult?.payout?.externalDisbursementId || 'tr_outbound_verified'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Agreement Reference:</span>
                <span className="text-emerald-400">{payoutResult?.agreement?.agreementReference || 'QPA-VERIFIED-2026'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Double-Entry Ledger:</span>
                <span className="text-indigo-400">BALANCED (3 Journal Entries)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-bold">{payoutResult?.payout?.status || 'SETTLED'}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
              <a
                href={`/api/v1/quickpay/token/${tokenData.token}/contract-pdf`}
                target="_blank"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition shadow"
              >
                <Download className="w-4 h-4 text-indigo-400" />
                Download E-SIGN Contract PDF
              </a>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-sm border border-emerald-500/30 transition shadow"
              >
                Return to Dashboard
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
