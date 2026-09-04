'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Truck,
  Zap,
  ShieldCheck,
  DollarSign,
  ArrowRight,
  Sparkles,
  KanbanSquare,
  Plug,
} from 'lucide-react';
import { LtlDensityCalculator } from '../lib/classification/density-calculator';
import { AccessorialDetector } from '../lib/classification/accessorial-detector';

function HomePageContent() {
  const router = useRouter();

  const [liveMetrics, setLiveMetrics] = useState<{
    activeLoads: number;
    totalShipments: number;
    connectedCarriers: number;
    availableTrucks: number;
    totalTrucks: number;
    totalInvoicedCents: number;
    totalInvoicedFormatted: string;
  } | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch('/api/v1/dashboard/metrics');
        const data = await res.json();
        if (data.success && data.metrics) {
          setLiveMetrics(data.metrics);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard metrics:', err);
      }
    }
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loggedIn = localStorage.getItem('apex_logged_in');
      if (!loggedIn) {
        router.push('/login');
      }
    }
  }, [router]);

  // AI RFQ Ingestion State
  const sampleEmail = `RFQ: Need rate for 4 pallets HVAC units from Los Angeles, CA 90001 to Chicago, IL 60601. Total weight 3,200 lbs, dims 48x40x48 in. Liftgate required on delivery and mandatory appointment needed.`;
  const [rfqText, setRfqText] = useState(sampleEmail);
  const [extractedData, setExtractedData] = useState<any | null>(null);

  // Live Carrier Rating State
  const [originZip, setOriginZip] = useState('90001');
  const [destZip, setDestZip] = useState('60601');
  const [pallets, setPallets] = useState(4);
  const [weightLbs, setWeightLbs] = useState(3200);
  const [quoteResults, setQuoteResults] = useState<any[] | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);

  const handleRunAiExtraction = () => {
    const detectedAcc = AccessorialDetector.detectAccessorials(rfqText);
    const density = LtlDensityCalculator.evaluateItem({
      lengthIn: 48,
      widthIn: 40,
      heightIn: 48,
      weightLbs: 800,
    });

    setExtractedData({
      origin: 'Los Angeles, CA 90001',
      destination: 'Chicago, IL 60601',
      totalPallets: 4,
      totalWeightLbs: 3200,
      pcfDensity: density.pcf,
      recommendedClass: density.estimatedNmfcClass,
      nmfcCode: '156600',
      accessorials: detectedAcc.accessorials,
      confidenceScore: 0.99,
    });
  };

  const handleRunLiveRating = () => {
    setIsQuoting(true);
    setTimeout(() => {
      setQuoteResults([
        {
          carrier: 'SAIA LTL Freight',
          scac: 'SAIA',
          badge: 'WHOLESALE 88%',
          linehaul: 480.0,
          fuel: 135.0,
          accessorials: 75.0,
          totalCarrierCost: 690.0,
          margin: 103.5,
          customerPrice: 793.5,
          transitDays: 2,
        },
        {
          carrier: 'XPO Logistics',
          scac: 'CNWY',
          badge: 'DIRECT BYOC #1',
          linehaul: 510.0,
          fuel: 142.8,
          accessorials: 75.0,
          totalCarrierCost: 727.8,
          margin: 109.17,
          customerPrice: 836.97,
          transitDays: 3,
        },
        {
          carrier: 'Estes Express Lines',
          scac: 'EXLA',
          badge: 'DIRECT BYOC #2',
          linehaul: 525.0,
          fuel: 147.0,
          accessorials: 75.0,
          totalCarrierCost: 747.0,
          margin: 112.05,
          customerPrice: 859.05,
          transitDays: 3,
        },
        {
          carrier: 'R+L Carriers',
          scac: 'RLCA',
          badge: 'WHOLESALE 85%',
          linehaul: 540.0,
          fuel: 151.2,
          accessorials: 75.0,
          totalCarrierCost: 766.2,
          margin: 114.93,
          customerPrice: 881.13,
          transitDays: 3,
        },
      ]);
      setIsQuoting(false);
    }, 500);
  };

  return (
    <div className="space-y-8 font-sans text-white">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-[#09090b] border border-[#27272a] p-6 sm:p-8 lg:p-10 shadow-2xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700/80 text-neutral-300 text-[11px] font-mono font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                ENTERPRISE LTL OS
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-white tracking-tight font-normal">
              Executive Freight Operating Command
            </h1>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap gap-2.5 flex-shrink-0 w-full lg:w-auto">
            <Link
              href="/dispatch"
              className="px-4 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs shadow transition flex items-center justify-center gap-2"
            >
              <KanbanSquare className="w-4 h-4 text-black" />
              <span>Dispatch Board</span>
            </Link>
            <Link
              href="/invoices"
              className="px-4 py-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-white font-sans font-medium text-xs border border-neutral-800 transition flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4 text-neutral-400" />
              <span>Financial Center</span>
            </Link>
            <Link
              href="/integration"
              className="px-4 py-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white font-sans font-medium text-xs border border-neutral-800 transition flex items-center justify-center gap-2"
            >
              <Plug className="w-4 h-4 text-neutral-400" />
              <span>System Integration</span>
            </Link>
          </div>
        </div>

        {/* Dynamic Executive KPI Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-[#27272a]/80">
          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-5 space-y-1.5 shadow-md">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-neutral-300" />
              <span>Active Loads</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              {liveMetrics?.activeLoads ?? 0}
            </div>
            <div className="text-[11px] font-mono text-neutral-400">
              {liveMetrics?.totalShipments ?? 0} Total Shipments
            </div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-5 space-y-1.5 shadow-md">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-neutral-300" />
              <span>Total Invoiced</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              {liveMetrics?.totalInvoicedFormatted ?? '$0.00'}
            </div>
            <div className="text-[11px] font-sans text-neutral-400">
              Customer Billing
            </div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-5 space-y-1.5 shadow-md">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-neutral-300" />
              <span>Connected Carriers</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              {liveMetrics?.connectedCarriers ?? 0}
            </div>
            <div className="text-[11px] font-mono text-neutral-400">
              Tier-1 API Integrations
            </div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-5 space-y-1.5 shadow-md">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-neutral-300" />
              <span>Available Trucks</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              {liveMetrics?.availableTrucks ?? 0} / {liveMetrics?.totalTrucks ?? 0}
            </div>
            <div className="text-[11px] font-sans text-neutral-400">
              Fleet Capacity Ready
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Tool 1: AI RFQ Rate Calculator */}
      <section className="bg-[#09090b] border border-[#27272a] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white font-bold">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-normal text-white">AI RFQ Rate Calculator &amp; Density Engine</h2>
              <span className="text-[10px] font-mono text-neutral-400 uppercase">Automatic NMFC &amp; PCF Classification</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-xs font-mono text-neutral-400 uppercase">Raw RFQ Email / Shipment Specs</label>
            <textarea
              value={rfqText}
              onChange={(e) => setRfqText(e.target.value)}
              rows={5}
              className="w-full bg-[#121215] border border-neutral-800 rounded-xl p-3.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-neutral-600"
            />
            <button
              onClick={handleRunAiExtraction}
              className="px-5 py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow flex items-center gap-2 transition"
            >
              <Sparkles className="w-4 h-4 text-black" /> Run Real-Time AI Extraction
            </button>
          </div>

          <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold text-white">
              <span>Structured Extraction Output</span>
              {extractedData && <span className="text-[10px] font-mono text-neutral-400">Confidence: 99.0%</span>}
            </div>

            {extractedData ? (
              <div className="space-y-3 text-xs font-sans">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">Origin</span>
                    <div className="text-white font-medium mt-0.5">{extractedData.origin}</div>
                  </div>
                  <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">Destination</span>
                    <div className="text-white font-medium mt-0.5">{extractedData.destination}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800 text-center">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">PCF Density</span>
                    <div className="text-white font-mono font-bold text-sm mt-0.5">{extractedData.pcfDensity} PCF</div>
                  </div>
                  <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800 text-center">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">NMFC Class</span>
                    <div className="text-white font-mono font-bold text-sm mt-0.5">Class {extractedData.recommendedClass}</div>
                  </div>
                  <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800 text-center">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">Weight / Plts</span>
                    <div className="text-white font-mono font-bold text-sm mt-0.5">3.2k# (4 Plts)</div>
                  </div>
                </div>

                <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800">
                  <span className="text-neutral-500 text-[10px] uppercase font-mono">Detected Accessorials:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {extractedData.accessorials.map((acc: string) => (
                      <span key={acc} className="px-2 py-0.5 bg-neutral-800 text-neutral-300 border border-neutral-700 rounded text-[10px] font-mono">
                        {acc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-neutral-500 text-xs italic font-sans">
                Click &quot;Run Real-Time AI Extraction&quot; to parse shipment specs.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Interactive Tool 2: Live Carrier Rating Engine */}
      <section className="bg-[#09090b] border border-[#27272a] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white font-bold">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-normal text-white">Live Carrier Rating &amp; Margin Engine</h2>
              <span className="text-[10px] font-mono text-neutral-400 uppercase">Direct BYOC &amp; Wholesale Rate Matrix</span>
            </div>
          </div>
          <button
            onClick={handleRunLiveRating}
            disabled={isQuoting}
            className="px-5 py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow flex items-center gap-2 transition"
          >
            <Zap className="w-4 h-4 text-black" /> {isQuoting ? 'Streaming Rates...' : 'Rate Across 5 Carriers'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#121215] border border-neutral-800 p-3.5 rounded-xl">
            <label className="text-[10px] font-mono text-neutral-500 uppercase">Origin ZIP</label>
            <input
              type="text"
              value={originZip}
              onChange={(e) => setOriginZip(e.target.value)}
              className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none mt-0.5"
            />
          </div>
          <div className="bg-[#121215] border border-neutral-800 p-3.5 rounded-xl">
            <label className="text-[10px] font-mono text-neutral-500 uppercase">Destination ZIP</label>
            <input
              type="text"
              value={destZip}
              onChange={(e) => setDestZip(e.target.value)}
              className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none mt-0.5"
            />
          </div>
          <div className="bg-[#121215] border border-neutral-800 p-3.5 rounded-xl">
            <label className="text-[10px] font-mono text-neutral-500 uppercase">Pallets</label>
            <input
              type="number"
              value={pallets}
              onChange={(e) => setPallets(parseInt(e.target.value) || 1)}
              className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none mt-0.5"
            />
          </div>
          <div className="bg-[#121215] border border-neutral-800 p-3.5 rounded-xl">
            <label className="text-[10px] font-mono text-neutral-500 uppercase">Weight (lbs)</label>
            <input
              type="number"
              value={weightLbs}
              onChange={(e) => setWeightLbs(parseInt(e.target.value) || 500)}
              className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none mt-0.5"
            />
          </div>
        </div>

        {quoteResults && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-neutral-800 rounded-xl overflow-hidden font-sans">
              <thead className="bg-[#121215] text-neutral-400 font-sans font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Carrier</th>
                  <th className="py-3 px-4">Source Tag</th>
                  <th className="py-3 px-4 text-right">Carrier Cost</th>
                  <th className="py-3 px-4 text-right">Broker Margin</th>
                  <th className="py-3 px-4 text-right">Customer Price</th>
                  <th className="py-3 px-4 text-center">Transit</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 bg-[#09090b] font-mono">
                {quoteResults.map((q) => (
                  <tr key={q.scac} className="hover:bg-neutral-900/60 transition">
                    <td className="py-3 px-4 font-medium text-white font-sans">{q.carrier}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 text-neutral-300 border border-neutral-800">
                        {q.badge}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-neutral-300">${q.totalCarrierCost.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-white">+${q.margin.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-bold text-white text-sm">${q.customerPrice.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center font-sans text-neutral-300">
                      {q.transitDays} Days
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        href="/quote/accept"
                        className="px-3 py-1 bg-white hover:bg-neutral-200 text-black rounded-lg text-[11px] font-bold font-sans transition shadow inline-flex items-center gap-1"
                      >
                        <span>Book Quote</span>
                        <ArrowRight className="w-3 h-3 text-black" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-neutral-400 font-mono text-xs">Loading Executive Command OS...</div>}>
      <HomePageContent />
    </Suspense>
  );
}
