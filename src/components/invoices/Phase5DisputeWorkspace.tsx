'use client';

import React, { useState } from 'react';
import {
  Scale,
  ShieldAlert,
  Clock,
  PlusCircle,
  Percent,
  Award,
  AlertTriangle,
  CheckCircle2,
  FileText,
  DollarSign,
  Download,
  Send,
  Eye,
  Sparkles,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  FileCheck,
  Building2,
  RefreshCw,
  Check,
} from 'lucide-react';

// ============================================================================
// PHASE 5: MOCK DATA & INTERFACES
// ============================================================================

export interface CarrierAuditItem {
  id: string;
  carrierScac: string;
  carrierName: string;
  carrierInvoiceNumber: string;
  proNumber: string;
  bolNumber: string;
  shipmentRef: string;
  invoicedTotal: number;
  quotedTotal: number;
  deltaTotal: number;
  deltaLinehaul: number;
  deltaFuel: number;
  deltaAccessorial: number;
  deltaWeightLbs: number;
  invoicedWeightLbs: number;
  quotedWeightLbs: number;
  invoicedClass: string;
  quotedClass: string;
  status: 'AUDITED_CLEAN' | 'DISCREPANCY_FLAGGED' | 'DISPUTED' | 'SETTLED';
  discrepancyType?: string;
  isWithinTolerance: boolean;
  unapprovedAccessorials: string[];
}

export interface DisputeItem {
  id: string;
  disputeReferenceNumber: string;
  carrierScac: string;
  carrierName: string;
  carrierProNumber: string;
  bolNumber: string;
  disputedAmount: number;
  quotedAmount: number;
  billedAmount: number;
  disputeCategory: string;
  claimDeskEmail: string;
  confidenceScore: number;
  status: 'FLAGGED' | 'DISPUTE_GENERATED' | 'SUBMITTED' | 'IN_REVIEW' | 'CREDIT_ISSUED' | 'ESCALATED';
  daysElapsed: number;
  creditMemoNumber?: string;
  recoveredAmount?: number;
  fmcsaViolated?: boolean;
}

export interface SupplementalInvoiceItem {
  id: string;
  invoiceNumber: string;
  parentInvoiceNumber: string;
  customerPoNumber: string;
  customerName: string;
  reason: string;
  passedThroughCost: number;
  markupPercent: number;
  markupAmount: number;
  totalCustomerPrice: number;
  supportingEvidence: string;
  status: 'ISSUED' | 'PAID' | 'DISPUTED';
  invoiceDate: string;
}

export interface CarrierScorecardItem {
  scac: string;
  name: string;
  reliabilityScore: number;
  cleanInvoiceRatePct: number;
  totalInvoices: number;
  totalOverchargeAttempted: number;
  totalCreditsRecovered: number;
  winRatePct: number;
  avgResolutionDays: number;
  ratingPenaltyBps: number;
  tier: 'EXCELLENT' | 'GOOD' | 'MARGINAL' | 'HIGH_FRICTION';
  topDiscrepancy: string;
}

// ============================================================================
// COMPONENT: PHASE 5 DISPUTE & AUDITING WORKSPACE
// ============================================================================

export const Phase5DisputeWorkspace: React.FC<{
  activeSubTab: 'rebill' | 'disputes' | 'claims_lifecycle' | 'supplemental' | 'recovery_billing' | 'scorecards';
}> = ({ activeSubTab }) => {
  // Carrier Invoices State
  const [carrierInvoices, setCarrierInvoices] = useState<CarrierAuditItem[]>([
    {
      id: 'cinv-001',
      carrierScac: 'XPO',
      carrierName: 'XPO Logistics',
      carrierInvoiceNumber: 'INV-XPO-984210',
      proNumber: 'XPO-984210',
      bolNumber: 'BOL-2026-8941',
      shipmentRef: 'LTL-2026-8941',
      invoicedTotal: 1470.0,
      quotedTotal: 1250.0,
      deltaTotal: 220.0,
      deltaLinehaul: 180.0,
      deltaFuel: 40.0,
      deltaAccessorial: 0,
      deltaWeightLbs: 600,
      invoicedWeightLbs: 3800,
      quotedWeightLbs: 3200,
      invoicedClass: '70',
      quotedClass: '70',
      status: 'DISCREPANCY_FLAGGED',
      discrepancyType: 'UNAUTHORIZED_REWEIGH',
      isWithinTolerance: false,
      unapprovedAccessorials: [],
    },
    {
      id: 'cinv-002',
      carrierScac: 'EXLA',
      carrierName: 'Estes Express Lines',
      carrierInvoiceNumber: 'INV-EXLA-774021',
      proNumber: 'EXLA-774021',
      bolNumber: 'BOL-2026-8942',
      shipmentRef: 'LTL-2026-8942',
      invoicedTotal: 540.0,
      quotedTotal: 540.0,
      deltaTotal: 0.0,
      deltaLinehaul: 0.0,
      deltaFuel: 0.0,
      deltaAccessorial: 0.0,
      deltaWeightLbs: 0,
      invoicedWeightLbs: 2100,
      quotedWeightLbs: 2100,
      invoicedClass: '70',
      quotedClass: '70',
      status: 'AUDITED_CLEAN',
      isWithinTolerance: true,
      unapprovedAccessorials: [],
    },
    {
      id: 'cinv-003',
      carrierScac: 'SAIA',
      carrierName: 'Saia Motor Freight Line',
      carrierInvoiceNumber: 'INV-SAIA-441029',
      proNumber: 'SAIA-441029',
      bolNumber: 'BOL-2026-8943',
      shipmentRef: 'LTL-2026-8943',
      invoicedTotal: 885.0,
      quotedTotal: 760.0,
      deltaTotal: 125.0,
      deltaLinehaul: 0.0,
      deltaFuel: 0.0,
      deltaAccessorial: 125.0,
      deltaWeightLbs: 0,
      invoicedWeightLbs: 3500,
      quotedWeightLbs: 3500,
      invoicedClass: '70',
      quotedClass: '70',
      status: 'DISCREPANCY_FLAGGED',
      discrepancyType: 'BOGUS_ACCESSORIAL',
      isWithinTolerance: false,
      unapprovedAccessorials: ['Liftgate Delivery ($125.00)'],
    },
    {
      id: 'cinv-004',
      carrierScac: 'ODFL',
      carrierName: 'Old Dominion Freight Line',
      carrierInvoiceNumber: 'INV-ODFL-119284',
      proNumber: 'ODFL-119284',
      bolNumber: 'BOL-2026-8944',
      shipmentRef: 'LTL-2026-8944',
      invoicedTotal: 685.0,
      quotedTotal: 682.5,
      deltaTotal: 2.5,
      deltaLinehaul: 2.5,
      deltaFuel: 0.0,
      deltaAccessorial: 0.0,
      deltaWeightLbs: 0,
      invoicedWeightLbs: 2400,
      quotedWeightLbs: 2400,
      invoicedClass: '70',
      quotedClass: '70',
      status: 'AUDITED_CLEAN',
      isWithinTolerance: true,
      unapprovedAccessorials: [],
    },
    {
      id: 'cinv-005',
      carrierScac: 'ABFS',
      carrierName: 'ABF Freight',
      carrierInvoiceNumber: 'INV-ABF-773190',
      proNumber: 'ABFS-773190',
      bolNumber: 'BOL-2026-8945',
      shipmentRef: 'LTL-2026-8945',
      invoicedTotal: 1120.0,
      quotedTotal: 890.0,
      deltaTotal: 230.0,
      deltaLinehaul: 230.0,
      deltaFuel: 0.0,
      deltaAccessorial: 0.0,
      deltaWeightLbs: 0,
      invoicedWeightLbs: 2800,
      quotedWeightLbs: 2800,
      invoicedClass: '92.5',
      quotedClass: '70',
      status: 'DISPUTED',
      discrepancyType: 'RECLASSIFICATION_DISPUTE',
      isWithinTolerance: false,
      unapprovedAccessorials: [],
    },
  ]);

  // Disputes State
  const [disputes, setDisputes] = useState<DisputeItem[]>([
    {
      id: 'disp-001',
      disputeReferenceNumber: 'DISP-2026-XPO-98421',
      carrierScac: 'XPO',
      carrierName: 'XPO Logistics',
      carrierProNumber: 'XPO-984210',
      bolNumber: 'BOL-2026-8941',
      disputedAmount: 220.0,
      quotedAmount: 1250.0,
      billedAmount: 1470.0,
      disputeCategory: 'UNAUTHORIZED_REWEIGH',
      claimDeskEmail: 'disputes@xpo.com',
      confidenceScore: 98.5,
      status: 'CREDIT_ISSUED',
      daysElapsed: 12,
      creditMemoNumber: 'CM-XPO-88201',
      recoveredAmount: 220.0,
    },
    {
      id: 'disp-002',
      disputeReferenceNumber: 'DISP-2026-SAIA-44102',
      carrierScac: 'SAIA',
      carrierName: 'Saia Motor Freight Line',
      carrierProNumber: 'SAIA-441029',
      bolNumber: 'BOL-2026-8943',
      disputedAmount: 125.0,
      quotedAmount: 760.0,
      billedAmount: 885.0,
      disputeCategory: 'BOGUS_ACCESSORIAL',
      claimDeskEmail: 'billingclaims@saia.com',
      confidenceScore: 99.0,
      status: 'IN_REVIEW',
      daysElapsed: 18,
    },
    {
      id: 'disp-003',
      disputeReferenceNumber: 'DISP-2026-ABF-77319',
      carrierScac: 'ABFS',
      carrierName: 'ABF Freight',
      carrierProNumber: 'ABFS-773190',
      bolNumber: 'BOL-2026-8945',
      disputedAmount: 230.0,
      quotedAmount: 890.0,
      billedAmount: 1120.0,
      disputeCategory: 'RECLASSIFICATION_DISPUTE',
      claimDeskEmail: 'billingaudit@arcb.com',
      confidenceScore: 96.0,
      status: 'SUBMITTED',
      daysElapsed: 4,
    },
    {
      id: 'disp-004',
      disputeReferenceNumber: 'DISP-2026-RL-11048',
      carrierScac: 'RLCA',
      carrierName: 'R+L Carriers',
      carrierProNumber: 'RLCA-110482',
      bolNumber: 'BOL-2026-8946',
      disputedAmount: 165.0,
      quotedAmount: 820.0,
      billedAmount: 985.0,
      disputeCategory: 'FUEL_INDEX_MISMATCH',
      claimDeskEmail: 'claims@rlcarriers.com',
      confidenceScore: 94.0,
      status: 'ESCALATED',
      daysElapsed: 34,
      fmcsaViolated: true,
    },
  ]);

  // Supplemental Invoices State
  const [supplementals, setSupplementals] = useState<SupplementalInvoiceItem[]>([
    {
      id: 'sup-001',
      invoiceNumber: 'INV-2026-08842-SUP1',
      parentInvoiceNumber: 'INV-2026-08842',
      customerPoNumber: 'PO-77492-AC',
      customerName: 'Acme Thermal Systems Inc',
      reason: 'WEIGHT_CORRECTION',
      passedThroughCost: 340.0,
      markupPercent: 15.0,
      markupAmount: 51.0,
      totalCustomerPrice: 391.0,
      supportingEvidence: 'Origin certified scale certificate confirmed cargo was 4,800 lbs vs 3,000 lbs stated.',
      status: 'ISSUED',
      invoiceDate: '2026-09-01',
    },
    {
      id: 'sup-002',
      invoiceNumber: 'INV-2026-08844-SUP1',
      parentInvoiceNumber: 'INV-2026-08844',
      customerPoNumber: 'PO-91024-DF',
      customerName: 'Delta Precision Machinery',
      reason: 'SITE_ACCESSORIAL_REQUEST',
      passedThroughCost: 150.0,
      markupPercent: 15.0,
      markupAmount: 22.5,
      totalCustomerPrice: 172.5,
      supportingEvidence: 'Consignee requested inside delivery at site; verified by signed delivery receipt.',
      status: 'PAID',
      invoiceDate: '2026-08-30',
    },
  ]);

  // Scorecards State
  const scorecards: CarrierScorecardItem[] = [
    {
      scac: 'ODFL',
      name: 'Old Dominion Freight Line',
      reliabilityScore: 98.4,
      cleanInvoiceRatePct: 97.2,
      totalInvoices: 142,
      totalOverchargeAttempted: 410.0,
      totalCreditsRecovered: 410.0,
      winRatePct: 100.0,
      avgResolutionDays: 6.2,
      ratingPenaltyBps: 0,
      tier: 'EXCELLENT',
      topDiscrepancy: 'Minor Rounding Cents',
    },
    {
      scac: 'EXLA',
      name: 'Estes Express Lines',
      reliabilityScore: 95.1,
      cleanInvoiceRatePct: 94.0,
      totalInvoices: 118,
      totalOverchargeAttempted: 890.0,
      totalCreditsRecovered: 890.0,
      winRatePct: 100.0,
      avgResolutionDays: 7.8,
      ratingPenaltyBps: 0,
      tier: 'EXCELLENT',
      topDiscrepancy: 'Terminal Reweigh Variance',
    },
    {
      scac: 'SAIA',
      name: 'Saia Motor Freight Line',
      reliabilityScore: 82.4,
      cleanInvoiceRatePct: 79.5,
      totalInvoices: 88,
      totalOverchargeAttempted: 2450.0,
      totalCreditsRecovered: 2320.0,
      winRatePct: 94.7,
      avgResolutionDays: 14.2,
      ratingPenaltyBps: 45,
      tier: 'GOOD',
      topDiscrepancy: 'Unverified Liftgate Accessorial',
    },
    {
      scac: 'XPO',
      name: 'XPO Logistics',
      reliabilityScore: 74.8,
      cleanInvoiceRatePct: 68.2,
      totalInvoices: 96,
      totalOverchargeAttempted: 4890.0,
      totalCreditsRecovered: 4620.0,
      winRatePct: 94.5,
      avgResolutionDays: 16.5,
      ratingPenaltyBps: 95,
      tier: 'MARGINAL',
      topDiscrepancy: 'Unauthorized Weight Increases',
    },
    {
      scac: 'ABFS',
      name: 'ABF Freight',
      reliabilityScore: 62.1,
      cleanInvoiceRatePct: 55.4,
      totalInvoices: 56,
      totalOverchargeAttempted: 5400.0,
      totalCreditsRecovered: 4980.0,
      winRatePct: 92.2,
      avgResolutionDays: 22.4,
      ratingPenaltyBps: 150,
      tier: 'HIGH_FRICTION',
      topDiscrepancy: 'NMFC Class Bumps (W&I)',
    },
  ];

  // Selected Item Modals
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [showCreateDisputeModal, setShowCreateDisputeModal] = useState<CarrierAuditItem | null>(null);
  const [showCreditMemoModal, setShowCreditMemoModal] = useState<DisputeItem | null>(null);
  const [showSupplementalModal, setShowSupplementalModal] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);

  // Settlement Form State
  const [creditMemoInput, setCreditMemoInput] = useState('');
  const [creditAmountInput, setCreditAmountInput] = useState('');

  // 1-Click Run Audit
  const handleRunAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      setIsAuditing(false);
      alert('Line-item cross audit completed across 5 carrier invoices! 2 clean match, 3 discrepancies flagged.');
    }, 600);
  };

  // Settle Credit Memo
  const handleSettleCreditMemo = () => {
    if (!showCreditMemoModal) return;
    const recovered = parseFloat(creditAmountInput) || showCreditMemoModal.disputedAmount;
    const memoNum = creditMemoInput || `CM-${showCreditMemoModal.carrierScac}-${Math.floor(10000 + Math.random() * 90000)}`;

    setDisputes((prev) =>
      prev.map((d) =>
        d.id === showCreditMemoModal.id
          ? {
              ...d,
              status: 'CREDIT_ISSUED',
              creditMemoNumber: memoNum,
              recoveredAmount: recovered,
            }
          : d
      )
    );

    // Update Carrier Invoice to SETTLED
    setCarrierInvoices((prev) =>
      prev.map((inv) =>
        inv.proNumber === showCreditMemoModal.carrierProNumber
          ? { ...inv, status: 'SETTLED' }
          : inv
      )
    );

    setShowCreditMemoModal(null);
    setCreditMemoInput('');
    setCreditAmountInput('');
    alert(`Credit memo ${memoNum} recorded successfully! $${recovered.toFixed(2)} recovered. Carrier invoice settled.`);
  };

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* TAB: RE-BILL AUDIT & INGESTION (5.1 & 5.2) */}
      {/* ===================================================================== */}
      {activeSubTab === 'rebill' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-400" /> Carrier Re-Bill Auditing Desk (EDI 210 & PDF OCR)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Automated cross-comparison of carrier final invoices against contracted rate baselines. Standard $5.00 tolerance rule enforced.
              </p>
            </div>
            <button
              onClick={handleRunAudit}
              disabled={isAuditing}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
              {isAuditing ? 'Running Cross-Audit...' : 'Run Automated Audit'}
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[10px] tracking-wider font-mono">
                  <tr>
                    <th className="p-3.5">Carrier / PRO #</th>
                    <th className="p-3.5">Shipment Ref</th>
                    <th className="p-3.5">Quoted Rate</th>
                    <th className="p-3.5">Carrier Billed</th>
                    <th className="p-3.5">Variance (Δ)</th>
                    <th className="p-3.5">Weight / Class Δ</th>
                    <th className="p-3.5">Audit Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {carrierInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                          {inv.carrierName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">PRO: {inv.proNumber}</div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300 font-semibold">{inv.shipmentRef}</td>
                      <td className="p-3.5 font-mono text-slate-200 font-semibold">${inv.quotedTotal.toFixed(2)}</td>
                      <td className="p-3.5 font-mono text-white font-bold">${inv.invoicedTotal.toFixed(2)}</td>
                      <td className="p-3.5">
                        {inv.deltaTotal > 0 ? (
                          <span className="font-mono font-bold text-rose-400">
                            +${inv.deltaTotal.toFixed(2)}
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-emerald-400">$0.00</span>
                        )}
                      </td>
                      <td className="p-3.5 text-[11px] text-slate-300">
                        {inv.deltaWeightLbs > 0 && (
                          <div className="text-amber-400 font-bold font-mono">+{inv.deltaWeightLbs} lbs reweigh</div>
                        )}
                        {inv.invoicedClass !== inv.quotedClass && (
                          <div className="text-rose-400 font-bold font-mono">Class {inv.quotedClass} → {inv.invoicedClass}</div>
                        )}
                        {inv.unapprovedAccessorials.length > 0 && (
                          <div className="text-purple-400 font-medium text-[10px]">{inv.unapprovedAccessorials.join(', ')}</div>
                        )}
                        {inv.deltaWeightLbs === 0 && inv.invoicedClass === inv.quotedClass && inv.unapprovedAccessorials.length === 0 && (
                          <span className="text-slate-400">Match 100%</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {inv.status === 'AUDITED_CLEAN' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> CLEAN (≤$5.00)
                          </span>
                        )}
                        {inv.status === 'DISCREPANCY_FLAGGED' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3" /> OVERCHARGE
                          </span>
                        )}
                        {inv.status === 'DISPUTED' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> DISPUTE FILED
                          </span>
                        )}
                        {inv.status === 'SETTLED' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1 w-fit">
                            <Check className="w-3 h-3" /> CREDIT WON
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {inv.status === 'DISCREPANCY_FLAGGED' && (
                          <button
                            onClick={() => setShowCreateDisputeModal(inv)}
                            className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] rounded-lg shadow transition flex items-center gap-1 ml-auto"
                          >
                            <ShieldAlert className="w-3 h-3" /> Dispute Overcharge
                          </button>
                        )}
                        {inv.status === 'AUDITED_CLEAN' && (
                          <span className="text-[11px] text-emerald-400 font-bold">Auto-Approved</span>
                        )}
                        {inv.status === 'SETTLED' && (
                          <span className="text-[11px] text-sky-400 font-bold">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB: LEGAL DISPUTE DESK (5.3 & 5.4) */}
      {/* ===================================================================== */}
      {activeSubTab === 'disputes' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-400" /> 49 CFR § 378 Legal Dispute Desk
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Automated compilation of formal legal dispute packages pursuant to <strong>49 CFR § 378</strong> and <strong>49 U.S.C. § 14708</strong> with certified eBOL & Geotagged POD evidence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {disputes.map((d) => (
              <div
                key={d.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-3.5 shadow-lg transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold font-mono text-indigo-400 uppercase tracking-wider">
                      {d.disputeReferenceNumber}
                    </span>
                    <h4 className="text-base font-black text-white mt-0.5">{d.carrierName}</h4>
                    <span className="text-xs text-slate-400 font-mono">PRO: {d.carrierProNumber}</span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      d.status === 'CREDIT_ISSUED'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : d.status === 'ESCALATED'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {d.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Dispute Category:</span>
                    <span className="font-bold text-amber-400 font-mono">{d.disputeCategory}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Disputed Overcharge:</span>
                    <span className="font-bold text-rose-400 font-mono text-sm">${d.disputedAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Evidence Confidence:</span>
                    <span className="font-bold text-emerald-400">{d.confidenceScore}% (Certified eBOL + POD)</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Assigned Claims Intake:</span>
                    <span className="font-mono text-sky-400">{d.claimDeskEmail}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400">
                    FMCSA Clock: <strong className="text-white font-mono">Day {d.daysElapsed}/30</strong>
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedDispute(d)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" /> View 2-Page Legal PDF
                    </button>
                    {d.status !== 'CREDIT_ISSUED' && (
                      <button
                        onClick={() => {
                          setShowCreditMemoModal(d);
                          setCreditAmountInput(d.disputedAmount.toString());
                        }}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1 transition"
                      >
                        <DollarSign className="w-3.5 h-3.5" /> Record Credit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB: CLAIMS LIFECYCLE & 30-DAY FMCSA TRACKER (5.5) */}
      {/* ===================================================================== */}
      {activeSubTab === 'claims_lifecycle' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-400" /> Carrier Claims State Machine & 30-Day FMCSA Tracker
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Monitors carrier response deadlines under <strong>49 CFR § 378.7 (Statutory 30-Day Claim Rule)</strong> and triggers automatic STB complaints if carriers delay.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h4 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
              Dispute Pipeline State Machine
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { stage: '1. FLAGGED', count: '1 Load', color: 'border-slate-700 text-slate-300' },
                { stage: '2. GENERATED', count: '1 Legal Pkg', color: 'border-indigo-500/50 text-indigo-300' },
                { stage: '3. SUBMITTED', count: '1 Dispatched', color: 'border-sky-500/50 text-sky-300' },
                { stage: '4. IN REVIEW', count: '1 Adjustor Assigned', color: 'border-amber-500/50 text-amber-300' },
                { stage: '5. CREDIT WON', count: '1 Settled ($220.00)', color: 'border-emerald-500/50 text-emerald-300 bg-emerald-950/20' },
              ].map((st, i) => (
                <div key={i} className={`p-3 rounded-xl border bg-slate-950 ${st.color}`}>
                  <div className="text-[11px] font-black">{st.stage}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">{st.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold font-mono text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> 30-Day Statutory FMCSA Overdue Alerts
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                1 Claim Non-Compliant
              </span>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-rose-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>DISP-2026-RL-11048 (R+L Carriers)</span>
                  <span className="px-2 py-0.5 bg-rose-500 text-slate-950 font-black text-[9px] rounded">
                    34 DAYS ELAPSED (VIOLATION)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Carrier failed to acknowledge or resolve $165.00 Fuel Index Mismatch overcharge within statutory 30-day window under 49 CFR § 378.7.
                </p>
              </div>
              <button
                onClick={() =>
                  alert('STB (Surface Transportation Board) Complaint Letter compiled pursuant to 49 U.S.C. § 14708 & § 14901! Ready for regulatory submission.')
                }
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow whitespace-nowrap"
              >
                Download STB / FMCSA Complaint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB: SUPPLEMENTAL INVOICES (PASS-THROUGH) (5.6) */}
      {/* ===================================================================== */}
      {activeSubTab === 'supplemental' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" /> Customer Supplemental Invoicing (Pass-Through Engine)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Passes through legitimate shipper-caused extra charges (actual weight overage or signed on-site accessorials) with an automatic <strong>+15.0% broker gross profit markup</strong>.
              </p>
            </div>
            <button
              onClick={() => setShowSupplementalModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition"
            >
              <PlusCircle className="w-4 h-4" /> Create Supplemental Invoice
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {supplementals.map((sup) => (
              <div
                key={sup.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold font-mono text-indigo-400 uppercase tracking-wider">
                      {sup.invoiceNumber}
                    </span>
                    <h4 className="text-base font-black text-white mt-0.5">{sup.customerName}</h4>
                    <span className="text-xs text-slate-400 font-mono">Linked Parent: {sup.parentInvoiceNumber}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                    {sup.status}
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Supplemental Reason:</span>
                    <span className="font-bold text-teal-300 font-mono">{sup.reason}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Passed Carrier Cost:</span>
                    <span className="font-mono font-bold text-white">${sup.passedThroughCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Broker Markup (+{sup.markupPercent}%):</span>
                    <span className="font-mono font-bold text-emerald-400">+${sup.markupAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white text-sm font-black pt-1.5 border-t border-slate-800">
                    <span>Total Invoiced to Shipper:</span>
                    <span className="font-mono text-emerald-400">${sup.totalCustomerPrice.toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                  "{sup.supportingEvidence}"
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB: RECOVERY CONTINGENCY BILLING (20% FEE) (5.7) */}
      {/* ===================================================================== */}
      {activeSubTab === 'recovery_billing' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold font-mono text-emerald-400 uppercase tracking-wider">
                  Apex Revenue Engine #1
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">20% Performance Contingency Recovery Billing</h3>
              </div>
              <span className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs rounded-full shadow">
                20.0% Success Fee
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Monetizes recovered carrier overcharges by generating monthly performance billing statements for broker clients.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-slate-400 text-xs font-semibold">Total Overcharges Disputed</div>
              <div className="text-xl font-black text-white mt-1 font-mono">$8,400.00</div>
              <div className="text-[10px] text-slate-400 mt-0.5">14 Discrepancy Claims</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-slate-400 text-xs font-semibold">Total Credits Recovered</div>
              <div className="text-xl font-black text-emerald-400 mt-1 font-mono">$8,400.00</div>
              <div className="text-[10px] text-emerald-400 mt-0.5">100.0% Recovery Yield</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-slate-400 text-xs font-semibold">Performance Fee Revenue (20%)</div>
              <div className="text-xl font-black text-teal-300 mt-1 font-mono">$1,680.00</div>
              <div className="text-[10px] text-teal-400 mt-0.5">Apex Platform Profit</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-slate-400 text-xs font-semibold">Broker Net Retained Savings</div>
              <div className="text-xl font-black text-sky-400 mt-1 font-mono">$6,720.00</div>
              <div className="text-[10px] text-sky-300 mt-0.5">Net Broker Cost Reduction</div>
            </div>
          </div>

          {/* Highlight Callout */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 border border-indigo-500/40 p-5 rounded-2xl space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-300 font-mono">
              Monthly Statement Callout (September 2026)
            </div>
            <div className="text-base font-black text-white">
              "Apex Freight Dispute Engine recovered <span className="text-emerald-400">$8,400.00</span> in carrier overcharges this month. Performance fee (20%): <span className="text-teal-300">$1,680.00</span>."
            </div>
          </div>

          {/* Double-Entry Ledger Box */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
              Double-Entry Financial Ledger Settlement Certification
            </h4>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2 font-mono text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="text-emerald-400 font-bold">• DEBIT  DISPUTE_RECOVERY (Asset Realization):</span>
                <span className="font-bold text-white">$8,400.00</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-sky-400 font-bold">• CREDIT CARRIER_PAYABLE (Broker Net Retained Savings):</span>
                <span className="font-bold text-white">$6,720.00</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-teal-400 font-bold">• CREDIT PLATFORM_REVENUE (20% Contingency Performance Fee):</span>
                <span className="font-bold text-teal-300">$1,680.00</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB: CARRIER BILLING SCORECARDS (5.8) */}
      {/* ===================================================================== */}
      {activeSubTab === 'scorecards' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" /> Carrier Billing Accuracy & Reliability Scorecards
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Evaluates historical billing error rates and assigns automated routing friction penalties (+bps) during load dispatch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scorecards.map((sc) => (
              <div
                key={sc.scac}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                      SCAC: {sc.scac}
                    </span>
                    <h4 className="text-base font-black text-white mt-0.5">{sc.name}</h4>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-white font-mono">{sc.reliabilityScore}</div>
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                        sc.tier === 'EXCELLENT'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : sc.tier === 'GOOD'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : sc.tier === 'MARGINAL'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {sc.tier.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <div className="flex justify-between text-slate-300">
                    <span>Clean Invoice Rate:</span>
                    <span className="font-bold text-emerald-400 font-mono">{sc.cleanInvoiceRatePct}%</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Dispute Win Rate:</span>
                    <span className="font-bold text-sky-400 font-mono">{sc.winRatePct}%</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Avg Resolution Time:</span>
                    <span className="font-mono text-white">{sc.avgResolutionDays} days</span>
                  </div>
                  <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
                    <span>Routing Friction Penalty:</span>
                    <span
                      className={`font-mono font-bold ${
                        sc.ratingPenaltyBps > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      +{sc.ratingPenaltyBps} bps
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400">
                  Frequent Error: <strong className="text-slate-200">{sc.topDiscrepancy}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: 2-PAGE 49 CFR § 378 LEGAL DISPUTE PREVIEW */}
      {/* ===================================================================== */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white">
                  49 CFR § 378 Legal Dispute Packet Preview
                </h3>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                className="text-slate-400 hover:text-white text-sm font-bold bg-slate-950 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Document Simulation Preview */}
            <div className="bg-white text-slate-950 p-6 rounded-2xl space-y-4 font-sans text-xs shadow-inner">
              <div className="border-b border-slate-300 pb-3 flex justify-between items-start">
                <div>
                  <div className="text-sm font-black text-slate-900 uppercase">
                    Apex Freight Solutions — Dispute & Claims Desk
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Ref: {selectedDispute.disputeReferenceNumber} | Date: September 1, 2026
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-slate-900 text-white font-mono text-[9px] font-bold rounded">
                  49 CFR § 378 MANDATE
                </span>
              </div>

              <div className="space-y-1">
                <div className="font-bold text-slate-900">TO CARRIER CLAIMS DEPARTMENT:</div>
                <div className="text-[11px] text-slate-700">
                  {selectedDispute.carrierName} ({selectedDispute.carrierScac}) • PRO #{selectedDispute.carrierProNumber}
                </div>
                <div className="text-[10px] text-slate-500">
                  Email: {selectedDispute.claimDeskEmail}
                </div>
              </div>

              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 font-semibold">
                FORMAL NOTICE OF OVERCHARGE DISPUTE PURSUANT TO 49 CFR § 378 & 49 U.S.C. § 14708
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2">Item Description</th>
                      <th className="p-2">Quoted Contract</th>
                      <th className="p-2">Invoiced Amount</th>
                      <th className="p-2 text-rose-600">Disputed Overcharge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    <tr>
                      <td className="p-2 font-sans font-medium text-slate-800">{selectedDispute.disputeCategory.replace('_', ' ')}</td>
                      <td className="p-2">${selectedDispute.quotedAmount.toFixed(2)}</td>
                      <td className="p-2">${selectedDispute.billedAmount.toFixed(2)}</td>
                      <td className="p-2 font-bold text-rose-600">${selectedDispute.disputedAmount.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-[11px] text-slate-700 leading-relaxed">
                Carrier is required pursuant to <strong>49 CFR § 378.7</strong> to acknowledge receipt in writing within 30 days and pay or refund the overcharged amount of <strong>${selectedDispute.disputedAmount.toFixed(2)}</strong>.
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[10px] text-slate-600">
                <div className="font-bold text-slate-900">ATTACHED EVIDENCE BUNDLE (PAGE 2):</div>
                <div>• Certified Shipper VICS Digital BOL ({selectedDispute.bolNumber}) with signed piece count.</div>
                <div>• Geotagged Proof of Delivery (POD) confirming dock-height commercial delivery with consignee signature.</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedDispute(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert(`Dispute packet ${selectedDispute.disputeReferenceNumber} dispatched directly to ${selectedDispute.claimDeskEmail}!`);
                  setSelectedDispute(null);
                }}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow"
              >
                <Send className="w-3.5 h-3.5" /> Dispatch to {selectedDispute.claimDeskEmail}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: RECORD CREDIT MEMO */}
      {/* ===================================================================== */}
      {showCreditMemoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-black text-white">Record Carrier Credit Memo</h3>
              </div>
              <button
                onClick={() => setShowCreditMemoModal(null)}
                className="text-slate-400 hover:text-white text-sm font-bold bg-slate-950 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Credit Memo Reference Number</label>
                <input
                  type="text"
                  placeholder={`CM-${showCreditMemoModal.carrierScac}-88901`}
                  value={creditMemoInput}
                  onChange={(e) => setCreditMemoInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Recovered Credit Amount ($)</label>
                <input
                  type="number"
                  placeholder={showCreditMemoModal.disputedAmount.toString()}
                  value={creditAmountInput}
                  onChange={(e) => setCreditAmountInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowCreditMemoModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSettleCreditMemo}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow"
              >
                <Check className="w-3.5 h-3.5" /> Settle Overcharge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CREATE SUPPLEMENTAL INVOICE */}
      {/* ===================================================================== */}
      {showSupplementalModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white">Create Supplemental Customer Invoice</h3>
              </div>
              <button
                onClick={() => setShowSupplementalModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold bg-slate-950 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-400 text-[11px]">
                Passes through legitimate customer-caused variance with an automatic <strong>+15.0% broker gross profit markup</strong>.
              </p>
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Select Parent Customer Invoice</label>
                <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none">
                  <option>INV-2026-08842 (Acme Thermal Systems - $793.50)</option>
                  <option>INV-2026-08843 (Delta Precision - $1,035.60)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Reason for Supplemental Cost</label>
                <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none">
                  <option>WEIGHT_CORRECTION (+1,500 lbs Scale Ticket Verified)</option>
                  <option>SITE_ACCESSORIAL_REQUEST (Consignee requested Liftgate on-site)</option>
                  <option>DETENTION_SURCHARGE (Driver detained &gt;120 min at dock)</option>
                  <option>REDELIVERY_FEE (Facility closed during scheduled appointment)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Carrier Invoiced Extra Cost ($)</label>
                <input
                  type="number"
                  defaultValue="200.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Broker Margin Markup (+15%):</span>
                  <span className="text-emerald-400 font-bold font-mono">+$30.00</span>
                </div>
                <div className="flex justify-between text-white font-bold">
                  <span>Customer Supplemental Bill:</span>
                  <span className="text-emerald-400 font-bold font-mono">$230.00</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowSupplementalModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSupplementals((prev) => [
                    {
                      id: `sup-${Date.now()}`,
                      invoiceNumber: `INV-2026-08842-SUP${prev.length + 1}`,
                      parentInvoiceNumber: 'INV-2026-08842',
                      customerPoNumber: 'PO-77492-AC',
                      customerName: 'Acme Thermal Systems Inc',
                      reason: 'WEIGHT_CORRECTION',
                      passedThroughCost: 200.0,
                      markupPercent: 15.0,
                      markupAmount: 30.0,
                      totalCustomerPrice: 230.0,
                      supportingEvidence: 'Carrier scale inspection ticket attached.',
                      status: 'ISSUED',
                      invoiceDate: '2026-09-01',
                    },
                    ...prev,
                  ]);
                  setShowSupplementalModal(false);
                  alert('Customer Supplemental Invoice INV-2026-08842-SUP2 generated with +15% broker markup ($230.00)!');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Generate Supplemental Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
