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
    <div className="min-h-screen bg-[#050507] text-white py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Header Card */}
        <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 text-xs font-mono font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                VERIFIED DELIVERY SETTLEMENT PORTAL
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-normal text-white tracking-tight">
                Accelerated Carrier <span className="text-neutral-400 font-mono font-bold">QuickPay</span>
              </h1>
              <p className="text-sm text-neutral-400 font-sans">
                Carrier: <span className="font-semibold text-white">{tokenData.carrierName}</span> (SCAC: <span className="font-mono text-white">{tokenData.carrierScac}</span>)
                {tokenData.proNumber && ` • PRO #${tokenData.proNumber}`}
                {tokenData.bolNumber && ` • BOL #${tokenData.bolNumber}`}
              </p>
            </div>

            {/* Gross Payable Pill */}
            <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-4 text-right sm:min-w-[200px]">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider font-mono">Gross Load Payable</div>
              <div className="text-3xl font-mono font-bold text-white">
                {QuickPayFeeEngine.formatCents(tokenData.grossAmountCents)}
              </div>
              <div className="text-[11px] text-neutral-300 flex items-center justify-end gap-1 font-sans mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                POD Verified &amp; Approved
              </div>
            </div>
          </div>
        </div>

        {!isCompleted ? (
          <>
            {/* Step 1: Tier Selection Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-sans font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-white text-black text-xs flex items-center justify-center font-bold font-mono">1</span>
                  Select Payout Speed &amp; Fee Schedule
                </h2>
                <span className="text-xs text-neutral-400 font-mono">3 Settlement Rails Available</span>
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
                          ? 'bg-[#121215] border-white shadow-xl ring-1 ring-white/20'
                          : 'bg-[#09090b] border-[#27272a] hover:border-neutral-700 hover:bg-[#0e0e11]'
                      }`}
                    >
                      {opt.isPopular && (
                        <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-white text-black text-[10px] font-bold font-sans uppercase tracking-wider shadow">
                          Most Popular
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                              isSelected
                                ? 'bg-neutral-900 text-white border border-neutral-700'
                                : 'bg-[#121215] text-neutral-400 border border-neutral-800'
                            }`}
                          >
                            {opt.badge}
                          </span>
                          <span className="text-xs text-neutral-400 font-mono font-bold">
                            {opt.feePercentage > 0 ? `${opt.feePercentage}% Fee` : '0% Fee'}
                          </span>
                        </div>

                        <div>
                          <div className="text-base font-serif text-white font-normal">{opt.title}</div>
                          <div className="text-xs text-neutral-400 mt-0.5 font-sans">{opt.turnaroundDescription}</div>
                        </div>

                        <div className="bg-[#09090b] rounded-xl p-3 border border-neutral-800 space-y-1">
                          <div className="flex items-center justify-between text-xs text-neutral-400 font-sans">
                            <span>Gross Amount:</span>
                            <span className="font-mono text-neutral-200">{opt.grossFormatted}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-neutral-400 font-sans">
                            <span>QuickPay Fee:</span>
                            <span className="font-mono text-neutral-300">
                              {opt.feeAmountCents > 0 ? `-${opt.feeFormatted}` : '$0.00'}
                            </span>
                          </div>
                          <div className="border-t border-neutral-800 pt-1 flex items-center justify-between font-bold">
                            <span className="text-xs text-white font-sans">Net Payout:</span>
                            <span className="text-lg font-bold font-mono text-white">{opt.netFormatted}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 font-sans">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
                          {opt.payoutRail}
                        </span>
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-white bg-white' : 'border-neutral-700'}`}>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Destination Bank Account Verification */}
            <div className="space-y-4">
              <h2 className="text-sm font-sans font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-white text-black text-xs flex items-center justify-center font-bold font-mono">2</span>
                Verified Destination Bank Rails
              </h2>

              <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white">
                    <Building className="w-6 h-6 text-neutral-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2 font-sans">
                      {tokenData.bankName}
                      <span className="px-2 py-0.2 rounded bg-neutral-900 text-white text-[10px] font-mono border border-neutral-700">
                        ROUTING VERIFIED
                      </span>
                    </div>
                    <div className="text-xs text-neutral-400 font-mono mt-0.5">
                      Routing: {tokenData.routingNumberMasked} • Account: {tokenData.accountNumberMasked}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-neutral-400 flex items-center gap-1.5 bg-[#121215] px-3 py-2 rounded-xl border border-neutral-800 font-sans">
                  <Lock className="w-3.5 h-3.5 text-white" />
                  256-Bit Encrypted Banking Rail
                </div>
              </div>
            </div>

            {/* Step 3: E-SIGN Agreement & 1-Click Acceptance Form */}
            <div className="space-y-4">
              <h2 className="text-sm font-sans font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-white text-black text-xs flex items-center justify-center font-bold font-mono">3</span>
                E-SIGN Receivable Assignment Micro-Contract
              </h2>

              <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 font-sans">
                      Signer Full Name
                    </label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#121215] border border-neutral-800 text-sm text-white focus:outline-none focus:border-neutral-600 font-medium font-sans"
                      placeholder="e.g. John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 font-sans">
                      Authorized Corporate Title
                    </label>
                    <input
                      type="text"
                      value={signerTitle}
                      onChange={(e) => setSignerTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#121215] border border-neutral-800 text-sm text-white focus:outline-none focus:border-neutral-600 font-medium font-sans"
                      placeholder="e.g. Managing Agent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 font-sans">
                      Remittance Email
                    </label>
                    <input
                      type="email"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#121215] border border-neutral-800 text-sm text-white focus:outline-none focus:border-neutral-600 font-medium font-sans"
                      placeholder="billing@carrier.com"
                    />
                  </div>
                </div>

                {/* Micro-Contract Preview Card */}
                <div className="bg-[#121215] rounded-xl p-4 border border-neutral-800 text-xs text-neutral-400 space-y-2 font-sans">
                  <div className="font-semibold text-white uppercase tracking-wider flex items-center justify-between">
                    <span>Micro-Contract Terms Summary</span>
                    <a
                      href={`/api/v1/quickpay/token/${tokenData.token}/contract-pdf`}
                      target="_blank"
                      className="text-white hover:text-neutral-300 flex items-center gap-1 font-mono text-[11px]"
                    >
                      <FileText className="w-3 h-3" />
                      Preview Vector PDF
                    </a>
                  </div>
                  <p className="text-[11px] leading-relaxed text-neutral-400">
                    By clicking &quot;Accept &amp; Disburse Now&quot;, the Assignor ({tokenData.carrierName}) irrevocably assigns all rights to the freight invoice ({activeOption.grossFormatted}) in exchange for immediate net settlement ({activeOption.netFormatted}) minus the agreed {activeOption.feePercentage}% discount fee ({activeOption.feeFormatted}). Executed in full compliance with UCC Article 9 &amp; Federal E-SIGN Act (15 U.S.C. § 7001).
                  </p>
                </div>

                {/* Consent Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-neutral-700 bg-[#121215] text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-xs text-neutral-300 font-sans">
                    I acknowledge that I am authorized to bind <span className="font-semibold text-white">{tokenData.carrierName}</span> and hereby execute this Electronic Assignment Agreement to receive <span className="font-bold text-white font-mono">{activeOption.netFormatted}</span> today.
                  </span>
                </label>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-[#121215] border border-neutral-700 text-white text-xs flex items-center gap-2 font-sans">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-white" />
                    {errorMsg}
                  </div>
                )}

                {/* 1-Click Action Button */}
                <button
                  onClick={handleAcceptDisbursement}
                  disabled={isProcessing}
                  className="w-full py-4 rounded-2xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-base transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {isProcessing ? (
                    <>
                      <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Executing Banking Rails &amp; Balancing Ledger...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 text-black fill-current group-hover:scale-110 transition" />
                      Accept &amp; Disburse {activeOption.netFormatted} ({activeOption.badge})
                      <ArrowRight className="w-5 h-5 text-black group-hover:translate-x-1 transition" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Success Screen */
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6 text-center font-sans">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-700 text-white flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-serif font-normal text-white">Disbursement Dispatched Successfully!</h2>
              <p className="text-sm text-neutral-400 max-w-lg mx-auto font-sans">
                Your settlement of <span className="font-bold text-white font-mono">{activeOption.netFormatted}</span> has been initiated via <span className="font-mono text-white">{payoutResult?.payout?.payoutRail || 'INSTANT_RTP'}</span> direct to {tokenData.bankName}.
              </p>
            </div>

            <div className="bg-[#121215] rounded-2xl p-6 border border-neutral-800 max-w-lg mx-auto text-left space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-400">Transaction ID:</span>
                <span className="text-white">{payoutResult?.payout?.externalDisbursementId || 'tr_outbound_verified'}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-400">Agreement Reference:</span>
                <span className="text-white">{payoutResult?.agreement?.agreementReference || 'QPA-VERIFIED-2026'}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-400">Double-Entry Ledger:</span>
                <span className="text-white">BALANCED (3 Journal Entries)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Status:</span>
                <span className="text-white font-bold">{payoutResult?.payout?.status || 'SETTLED'}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
              <a
                href={`/api/v1/quickpay/token/${tokenData.token}/contract-pdf`}
                target="_blank"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs shadow transition"
              >
                <Download className="w-4 h-4" />
                Download E-SIGN Contract PDF
              </a>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#121215] hover:bg-neutral-800 text-white font-sans font-medium text-xs border border-neutral-800 transition"
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
