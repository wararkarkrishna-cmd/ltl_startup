'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Zap,
  Scale,
  ShieldAlert,
  ArrowUpRight,
  Database,
  Calendar,
  Lock,
  Download,
  Check,
} from 'lucide-react';
import { Phase5DisputeWorkspace } from './Phase5DisputeWorkspace';

function InvoiceManagementDashboardContent() {
  const searchParams = useSearchParams();

  // 3 Primary Tabs: 'invoices' (Customer Invoices), 'quickpay' (Carrier QuickPay), 'rebill' (Re-Bill Audits & Disputes)
  const [activeTab, setActiveTab] = useState<'invoices' | 'quickpay' | 'rebill'>('invoices');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'quickpay') {
      setActiveTab('quickpay');
    } else if (tab === 'rebill' || tab === 'disputes' || tab === 'audits') {
      setActiveTab('rebill');
    } else {
      setActiveTab('invoices');
    }
  }, [searchParams]);

  const handleTabClick = (tabId: 'invoices' | 'quickpay' | 'rebill') => {
    setActiveTab(tabId);
    const newUrl = tabId === 'invoices' ? '/invoices' : `/invoices?tab=${tabId}`;
    window.history.pushState(null, '', newUrl);
  };

  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDisbursing, setIsDisbursing] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Mock Invoices
  const [invoices, setInvoices] = useState<any[]>([
    {
      id: 'inv-01916362-0001',
      invoiceNumber: 'INV-2026-08842',
      customerPoNumber: 'PO-77492-AC',
      shipmentRef: 'LTL-2026-8941',
      shipperName: 'Acme Thermal Systems Inc',
      origin: 'Los Angeles, CA',
      destination: 'Chicago, IL',
      totalAmount: 793.5,
      carrierCost: 615.0,
      grossProfit: 178.5,
      invoiceDate: '2026-09-01',
      dueDate: '2026-10-01',
      status: 'ISSUED',
      qboSynced: true,
      podVerified: true,
    },
    {
      id: 'inv-01916362-0002',
      invoiceNumber: 'INV-2026-08843',
      customerPoNumber: 'PO-91024-DF',
      shipmentRef: 'LTL-2026-8942',
      shipperName: 'Delta Precision Machinery',
      origin: 'Dallas, TX',
      destination: 'Atlanta, GA',
      totalAmount: 1035.6,
      carrierCost: 840.0,
      grossProfit: 195.6,
      invoiceDate: '2026-08-31',
      dueDate: '2026-09-30',
      status: 'PAID',
      qboSynced: true,
      podVerified: true,
    },
    {
      id: 'inv-01916362-0003',
      invoiceNumber: 'INV-2026-08844',
      customerPoNumber: 'PO-33821-BL',
      shipmentRef: 'LTL-2026-8943',
      shipperName: 'BlueLine Consumer Goods',
      origin: 'Seattle, WA',
      destination: 'Denver, CO',
      totalAmount: 1085.8,
      carrierCost: 910.0,
      grossProfit: 175.8,
      invoiceDate: '2026-08-15',
      dueDate: '2026-09-14',
      status: 'ISSUED',
      qboSynced: true,
      podVerified: true,
    },
    {
      id: 'inv-01916362-0004',
      invoiceNumber: 'INV-2026-08845',
      customerPoNumber: 'PO-88120-TX',
      shipmentRef: 'LTL-2026-8945',
      shipperName: 'Titan Heavy Industries',
      origin: 'Houston, TX',
      destination: 'Phoenix, AZ',
      totalAmount: 1595.0,
      carrierCost: 1310.0,
      grossProfit: 285.0,
      invoiceDate: '2026-07-20',
      dueDate: '2026-08-19',
      status: 'OVERDUE',
      qboSynced: true,
      podVerified: true,
    },
  ]);

  // QuickPay Payables
  const [quickPayItems, setQuickPayItems] = useState<any[]>([
    {
      id: 'qp-001',
      carrierName: 'SAIA LTL Freight',
      scac: 'SAIA',
      shipmentRef: 'LTL-2026-8941',
      grossAmount: 615.0,
      payoutTier: 'RTP_INSTANT',
      feePct: 2.5,
      feeAmount: 15.38,
      netPayout: 599.62,
      status: 'DISBURSED',
      disbursedAt: 'Today 10:42 AM',
      bankRouting: 'JPMorgan Chase (•••• 9912)',
    },
    {
      id: 'qp-002',
      carrierName: 'XPO Logistics',
      scac: 'CNWY',
      shipmentRef: 'LTL-2026-8942',
      grossAmount: 840.0,
      payoutTier: 'ACH_NEXT_DAY',
      feePct: 2.0,
      feeAmount: 16.8,
      netPayout: 823.2,
      status: 'APPROVED',
      disbursedAt: 'Scheduled Tomorrow',
      bankRouting: 'Bank of America (•••• 4410)',
    },
    {
      id: 'qp-003',
      carrierName: 'Estes Express Lines',
      scac: 'EXLA',
      shipmentRef: 'LTL-2026-8945',
      grossAmount: 1310.0,
      payoutTier: 'STANDARD_NET30',
      feePct: 0.0,
      feeAmount: 0.0,
      netPayout: 1310.0,
      status: 'PENDING',
      disbursedAt: 'Net 30 Terms',
      bankRouting: 'Wells Fargo (•••• 1029)',
    },
  ]);

  // Financial KPI totals
  const totalReceivables = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPayables = quickPayItems.reduce((s, i) => s + i.grossAmount, 0);
  const totalRecoveries = 4850.0;
  const netSpread = 2.5;

  const handleSimulateInstantInvoice = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const newInv = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-2026-0884${invoices.length + 2}`,
        customerPoNumber: `PO-${Math.floor(10000 + Math.random() * 90000)}-AP`,
        shipmentRef: `LTL-2026-${Math.floor(8950 + Math.random() * 50)}`,
        shipperName: 'Vanguard Industrial Logistics',
        origin: 'Phoenix, AZ',
        destination: 'Houston, TX',
        totalAmount: 860.0,
        carrierCost: 690.0,
        grossProfit: 170.0,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'ISSUED',
        qboSynced: false,
        podVerified: true,
      };
      setInvoices([newInv, ...invoices]);
      setIsGenerating(false);
    }, 500);
  };

  const handleDisburseRtp = (qpId: string) => {
    setIsDisbursing(true);
    setTimeout(() => {
      setQuickPayItems((prev) =>
        prev.map((item) =>
          item.id === qpId ? { ...item, status: 'DISBURSED', disbursedAt: 'Just Now' } : item
        )
      );
      setIsDisbursing(false);
    }, 600);
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      inv.shipperName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      inv.customerPoNumber.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans text-white">
      {/* Financial Center Header */}
      <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700/80 text-neutral-300 text-[10px] font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              FINANCIAL CENTER &amp; SETTLEMENT HUB
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif text-white tracking-tight font-normal mt-1">
              Billing &amp; Financial Center
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSimulateInstantInvoice}
              disabled={isGenerating}
              className="px-4 py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow flex items-center gap-2 transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-black" />
              {isGenerating ? 'Generating Invoice PDF...' : 'Instant POD Billing (<60s)'}
            </button>
          </div>
        </div>

        {/* Clean Financial Metric Summary Counters (Replaces Wordy Banners) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#27272a]">
          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-4 space-y-1">
            <div className="text-[11px] text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-neutral-300" /> Customer Receivables
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              ${totalReceivables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-neutral-500 font-mono">{invoices.length} Active Customer Invoices</div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-4 space-y-1">
            <div className="text-[11px] text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-neutral-300" /> Carrier QuickPay Payables
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              ${totalPayables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-neutral-500 font-mono">RTP &amp; ACH Disbursements</div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-4 space-y-1">
            <div className="text-[11px] text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-neutral-300" /> Re-Bill Dispute Recoveries
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              ${totalRecoveries.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-neutral-500 font-mono">Overcharge Audits Won</div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-4 space-y-1">
            <div className="text-[11px] text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-300" /> QuickPay Net Spread
            </div>
            <div className="text-2xl font-mono font-bold text-white">{netSpread}% Take-Rate</div>
            <div className="text-[10px] text-neutral-500 font-mono">Instant RTP Monetization</div>
          </div>
        </div>
      </div>

      {/* 3 Top Primary Tab Buttons */}
      <div className="flex border-b border-[#27272a] gap-2 overflow-x-auto pb-1 custom-scrollbar font-sans">
        {[
          { id: 'invoices', label: 'Tab 1: Customer Invoices (Receivables)', icon: FileText },
          { id: 'quickpay', label: 'Tab 2: Carrier QuickPay (Payables)', icon: Zap },
          { id: 'rebill', label: 'Tab 3: Re-Bill Audits & Disputes', icon: Scale },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id as any)}
              className={`px-4 py-3 text-xs font-sans rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-white text-white bg-[#121215] font-bold shadow-sm'
                  : 'border-transparent text-neutral-400 hover:text-white hover:bg-[#0c0c0e]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CUSTOMER INVOICES */}
      {activeTab === 'invoices' && (
        <div className="space-y-4 font-sans">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#09090b] border border-neutral-800 p-4 rounded-xl">
            <div className="flex items-center gap-2">
              {(['ALL', 'ISSUED', 'PAID', 'OVERDUE'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition ${
                    statusFilter === st
                      ? 'bg-white text-black font-bold'
                      : 'bg-[#121215] text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter invoice #, shipper, PO..."
              className="bg-[#121215] border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 font-sans focus:outline-none focus:border-neutral-600 sm:w-64"
            />
          </div>

          <div className="bg-[#09090b] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#0c0c0e] text-neutral-400 font-mono text-[10px] uppercase border-b border-neutral-800">
                  <tr>
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Customer PO</th>
                    <th className="p-4">Shipment Ref</th>
                    <th className="p-4">Shipper Name</th>
                    <th className="p-4">Lane</th>
                    <th className="p-4 text-right">Total Amount</th>
                    <th className="p-4 text-center">POD Verified</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 text-neutral-300 font-mono">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#121215]/80 transition">
                      <td className="p-4 font-bold text-white">{inv.invoiceNumber}</td>
                      <td className="p-4 text-neutral-400">{inv.customerPoNumber}</td>
                      <td className="p-4 text-neutral-300 font-bold">{inv.shipmentRef}</td>
                      <td className="p-4 text-white font-sans font-medium">{inv.shipperName}</td>
                      <td className="p-4 font-sans text-neutral-400">{inv.origin} $\rightarrow$ {inv.destination}</td>
                      <td className="p-4 text-right font-bold text-white text-sm">${inv.totalAmount.toFixed(2)}</td>
                      <td className="p-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] border border-emerald-500/30">
                          VERIFIED
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : inv.status === 'OVERDUE'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                              : 'bg-neutral-900 text-neutral-300 border border-neutral-700'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <a
                          href={`/api/v1/shipments/${inv.shipmentRef}/ebol?format=pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-black rounded text-[11px] font-bold font-sans transition inline-flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3 text-black" />
                          <span>PDF</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CARRIER QUICKPAY */}
      {activeTab === 'quickpay' && (
        <div className="space-y-6 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#09090b] border border-neutral-800 rounded-2xl p-6 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-300 uppercase">Instant Same-Day (2.5%)</span>
                <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-white border border-neutral-700 text-[10px] font-mono">&lt; 2 Hours</span>
              </div>
              <div className="text-3xl font-mono font-bold text-white">$599.62 Net</div>
              <div className="text-xs text-neutral-400 font-mono">Gross: $615.00 • Fee: -$15.38</div>
              <div className="text-[11px] text-neutral-400">RTP / FedNow direct payout</div>
            </div>

            <div className="bg-[#09090b] border border-neutral-800 rounded-2xl p-6 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-300 uppercase">Next-Day ACH (2.0%)</span>
                <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-700 text-[10px] font-mono">Next Morning</span>
              </div>
              <div className="text-3xl font-mono font-bold text-white">$823.20 Net</div>
              <div className="text-xs text-neutral-400 font-mono">Gross: $840.00 • Fee: -$16.80</div>
              <div className="text-[11px] text-neutral-400">Same-Day ACH electronic transfer</div>
            </div>

            <div className="bg-[#09090b] border border-neutral-800 rounded-2xl p-6 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-300 uppercase">Form 1099-NEC Tax Compliance</span>
                <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-700 text-[10px] font-mono">IRS Ready</span>
              </div>
              <div className="text-3xl font-mono font-bold text-white">100% Tax Compliant</div>
              <div className="text-xs text-neutral-400 font-mono">Carrier TIN &amp; W-9 Verification</div>
              <button
                onClick={() => alert('IRS Form 1099-NEC tax summary exported to CSV!')}
                className="w-full py-1.5 bg-[#121215] hover:bg-neutral-800 text-white rounded-lg text-xs font-sans font-medium border border-neutral-800 transition"
              >
                Export 1099-NEC Summary
              </button>
            </div>
          </div>

          <div className="bg-[#09090b] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl space-y-3 p-5">
            <h3 className="font-serif text-base text-white">Carrier QuickPay Payables &amp; E-Sign Contracts</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#0c0c0e] text-neutral-400 font-mono text-[10px] uppercase border-b border-neutral-800">
                  <tr>
                    <th className="p-3">Carrier / SCAC</th>
                    <th className="p-3">Shipment Ref</th>
                    <th className="p-3 text-right">Gross Pay</th>
                    <th className="p-3 text-right">Spread Fee</th>
                    <th className="p-3 text-right">Net Payout</th>
                    <th className="p-3">Bank Routing</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 text-neutral-300 font-mono">
                  {quickPayItems.map((qp) => (
                    <tr key={qp.id} className="hover:bg-[#121215]/80 transition">
                      <td className="p-3 font-bold text-white font-sans">{qp.carrierName} ({qp.scac})</td>
                      <td className="p-3 text-neutral-300">{qp.shipmentRef}</td>
                      <td className="p-3 text-right text-neutral-300">${qp.grossAmount.toFixed(2)}</td>
                      <td className="p-3 text-right text-emerald-400">-${qp.feeAmount.toFixed(2)} ({qp.feePct}%)</td>
                      <td className="p-3 text-right font-bold text-white">${qp.netPayout.toFixed(2)}</td>
                      <td className="p-3 font-sans text-neutral-400">{qp.bankRouting}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${qp.status === 'DISBURSED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-900 text-neutral-300 border border-neutral-700'}`}>
                          {qp.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {qp.status !== 'DISBURSED' ? (
                          <button
                            onClick={() => handleDisburseRtp(qp.id)}
                            disabled={isDisbursing}
                            className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-black rounded text-[11px] font-bold font-sans transition inline-flex items-center gap-1"
                          >
                            <Zap className="w-3 h-3 text-black" />
                            <span>Instant RTP Pay</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-neutral-500 font-mono">Settled</span>
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

      {/* TAB 3: RE-BILL AUDITS & DISPUTES */}
      {activeTab === 'rebill' && (
        <div className="space-y-4 font-sans">
          <Phase5DisputeWorkspace activeSubTab="rebill" />
        </div>
      )}
    </div>
  );
}

export const InvoiceManagementDashboard: React.FC = () => {
  return (
    <Suspense fallback={<div className="p-8 text-center text-neutral-400 font-mono text-xs">Loading Financial Center...</div>}>
      <InvoiceManagementDashboardContent />
    </Suspense>
  );
};
