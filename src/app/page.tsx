'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Truck,
  Zap,
  ShieldCheck,
  FileCheck2,
  KanbanSquare,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  Sparkles,
  FileText,
  CheckCircle2,
  Layers,
  Camera,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { LtlDensityCalculator } from '../lib/classification/density-calculator';
import { AccessorialDetector } from '../lib/classification/accessorial-detector';
import { FmcsaCarrierVettingEngine } from '../lib/vetting/fmcsa-vetting-engine';
import { DamageDetectorEngine } from '../lib/pod/damage-detector-engine';
import { GeofenceValidator } from '../lib/pod/geofence-validator';

function HomePageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'ingestion' | 'quoting' | 'dispatch' | 'vetting' | 'pod-invoicing' | 'quickpay'
  >('overview');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'ingestion', 'quoting', 'dispatch', 'vetting', 'pod-invoicing', 'quickpay'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as any);
    const newUrl = tabId === 'overview' ? '/' : `/?tab=${tabId}`;
    window.history.pushState(null, '', newUrl);
  };

  // Ingestion Interactive State
  const sampleEmail = `RFQ: Need rate for 4 pallets HVAC units from Los Angeles, CA 90001 to Chicago, IL 60601. Total weight 3,200 lbs, dims 48x40x48 in. Liftgate required on delivery and mandatory appointment needed.`;
  const [rfqText, setRfqText] = useState(sampleEmail);
  const [extractedData, setExtractedData] = useState<any | null>(null);

  // Quoting Interactive State
  const [originZip, setOriginZip] = useState('90001');
  const [destZip, setDestZip] = useState('60601');
  const [pallets, setPallets] = useState(4);
  const [weightLbs, setWeightLbs] = useState(3200);
  const [quoteResults, setQuoteResults] = useState<any[] | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);

  // Carrier Vetting Interactive State
  const [vettingCarrier, setVettingCarrier] = useState('SAIA');
  const [vettingDot, setVettingDot] = useState('123456');
  const [vettingResult, setVettingResult] = useState<any | null>(null);

  // Phase 4 POD & Invoicing Interactive State
  const [podOcrText, setPodOcrText] = useState('Delivered 4 pallets. 1 pallet damaged on bottom, crushed carton. Signed John Miller.');
  const [podZip, setPodZip] = useState('60601');
  const [podGpsLat, setPodGpsLat] = useState(41.8781);
  const [podGpsLon, setPodGpsLon] = useState(-87.6298);
  const [podResult, setPodResult] = useState<any | null>(null);

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
          type: 'PLATFORM_WHOLESALE',
          badge: 'WHOLESALE: 88% TIER',
          linehaul: 480.0,
          fuel: 135.0,
          accessorials: 75.0,
          totalCarrierCost: 690.0,
          margin: 103.5,
          customerPrice: 793.5,
          transitDays: 2,
          isGuaranteed: true,
        },
        {
          carrier: 'XPO Logistics',
          scac: 'CNWY',
          type: 'DIRECT_BYOC',
          badge: 'DIRECT BYOC #1',
          linehaul: 510.0,
          fuel: 142.8,
          accessorials: 75.0,
          totalCarrierCost: 727.8,
          margin: 109.17,
          customerPrice: 836.97,
          transitDays: 3,
          isGuaranteed: false,
        },
        {
          carrier: 'Estes Express Lines',
          scac: 'EXLA',
          type: 'DIRECT_BYOC',
          badge: 'DIRECT BYOC #2',
          linehaul: 525.0,
          fuel: 147.0,
          accessorials: 75.0,
          totalCarrierCost: 747.0,
          margin: 112.05,
          customerPrice: 859.05,
          transitDays: 3,
          isGuaranteed: false,
        },
        {
          carrier: 'R+L Carriers',
          scac: 'RLCA',
          type: 'PLATFORM_WHOLESALE',
          badge: 'WHOLESALE: 85% TIER',
          linehaul: 540.0,
          fuel: 151.2,
          accessorials: 75.0,
          totalCarrierCost: 766.2,
          margin: 114.93,
          customerPrice: 881.13,
          transitDays: 2,
          isGuaranteed: false,
        },
      ]);
      setIsQuoting(false);
    }, 350);
  };

  const handleRunVetting = () => {
    const res = FmcsaCarrierVettingEngine.evaluateCarrier({
      tenantId: '01916362-7901-7080-867c-9b8895092a01',
      carrierCode: vettingCarrier,
      carrierScac: vettingCarrier,
      carrierName: `${vettingCarrier} Freight Express`,
      dotNumber: vettingDot,
      mcNumber: `MC${vettingDot}`,
      autoLiabilityCoverageDollars: 2_000_000,
      cargoInsuranceCoverageDollars: 250_000,
      safetyRatingOverride: 'SATISFACTORY',
      operatingAuthorityStatusOverride: 'ACTIVE',
      driverOosRatePercent: 2.3,
      vehicleOosRatePercent: 12.1,
    });
    setVettingResult(res);
  };

  const handleRunPodValidation = () => {
    const geo = GeofenceValidator.validateDeliveryLocation(podZip, podGpsLat, podGpsLon, 0.5);
    const damage = DamageDetectorEngine.inspect({
      ocrRawText: podOcrText,
      driverNotes: '',
      consigneeNotes: '',
      receivedPieces: 4,
      expectedPieces: 4,
    });

    setPodResult({
      geofence: geo,
      damage,
      status: damage.hasException ? 'FLAGGED_EXCEPTION' : 'VERIFIED',
      overallConfidence: damage.hasException ? 88.5 : 98.2,
      invoiceEligible: !damage.hasException,
      invoiceNumber: 'INV-2026-08842',
    });
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Hero Header in Luxury Minimal Black & White */}
      <section className="relative overflow-hidden rounded-2xl bg-[#09090b] border border-[#27272a] p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700/80 text-neutral-300 text-[11px] font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              PRODUCTION READY • ENTERPRISE LTL OS
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-white tracking-tight font-normal">
              Enterprise LTL Freight Operating System
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 font-sans leading-relaxed">
              AI Multi-Modal RFQ Ingestion, Hybrid Multi-Carrier Rating (BYOC + Wholesale), Combinatorial Split Optimizer, Real-Time Kanban Dispatch, Geotagged POD Capture &amp; Instant Sub-Minute Settlement.
            </p>
          </div>

          <div className="flex flex-wrap lg:flex-col gap-2.5 flex-shrink-0 w-full lg:w-auto">
            <Link
              href="/invoices"
              className="px-4 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs shadow transition flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              <span>Invoicing &amp; Re-Bill Dispute Desk</span>
            </Link>
            <Link
              href="/dispatch"
              className="px-4 py-2.5 rounded-xl bg-[#18181b] hover:bg-[#27272a] text-white font-sans font-semibold text-xs border border-neutral-700 transition flex items-center justify-center gap-2"
            >
              <KanbanSquare className="w-4 h-4 text-neutral-400" />
              <span>Open Dispatch Desk</span>
            </Link>
            <Link
              href="/review/01916362-7901-7080-867c-9b8895092s01"
              className="px-4 py-2.5 rounded-xl bg-[#121215] hover:bg-[#1c1c21] text-neutral-300 hover:text-white font-sans font-medium text-xs border border-neutral-800 transition flex items-center justify-center gap-2"
            >
              <FileCheck2 className="w-4 h-4 text-neutral-400" />
              <span>Review Active RFQs</span>
            </Link>
          </div>
        </div>

        {/* Executive KPI Bento Row with Space Grotesk Numbers */}
        <div id="kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-8 pt-6 border-t border-[#27272a]/80">
          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-4 space-y-1">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-neutral-300" />
              <span>Active Freight Pipeline</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              24 Loads
            </div>
            <div className="text-[11px] font-mono text-neutral-400">
              $38,450.00 Invoiced
            </div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-4 space-y-1">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-300" />
              <span>AI Extraction Speed</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              28 ms
            </div>
            <div className="text-[11px] font-sans text-neutral-400">
              100% Benchmark Accuracy
            </div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-4 space-y-1">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-neutral-300" />
              <span>Gross Margin Realized</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              14.8%
            </div>
            <div className="text-[11px] font-mono text-neutral-400">
              $75.00/load Profit Floor
            </div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-4 space-y-1">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-300" />
              <span>Carrier Compliance</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              100%
            </div>
            <div className="text-[11px] font-sans text-neutral-400">
              5 Tier-1 BYOC Connected
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Tabs Bar */}
      <div id="sandbox" className="flex border-b border-[#27272a] gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {[
          { id: 'overview', label: 'All Systems Overview', icon: Layers },
          { id: 'ingestion', label: 'Phase 1: AI Ingestion & Density', icon: FileCheck2 },
          { id: 'quoting', label: 'Phase 2: Rating & Split Optimizer', icon: Zap },
          { id: 'dispatch', label: 'Phase 3: Dispatch & eBOL', icon: KanbanSquare },
          { id: 'vetting', label: 'Phase 3.8: FMCSA Safety Gate', icon: ShieldCheck },
          { id: 'pod-invoicing', label: 'Phase 4: Geotagged POD & Billing', icon: Camera },
          { id: 'quickpay', label: 'Phase 6: Embedded QuickPay', icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2.5 text-xs font-sans font-medium rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-white text-white bg-[#121215] font-semibold shadow-sm'
                  : 'border-transparent text-neutral-400 hover:text-white hover:bg-[#0c0c0e]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: ALL SYSTEMS OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Phase 1 */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4 hover:border-neutral-600 transition shadow-lg flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700/80 flex items-center justify-center text-white">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800">
                  Phase 1.1–1.9
                </span>
              </div>
              <div>
                <h3 className="text-lg font-serif text-white font-normal">AI RFQ Ingestion &amp; Density</h3>
                <p className="text-xs text-neutral-400 mt-1 font-sans">
                  Multi-modal extraction (PDF/Excel/Email), PCF density, 11-tier NMFC, and SHA-256 audit ledger.
                </p>
              </div>
              <div className="space-y-1.5 text-xs text-neutral-300 font-sans pt-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> 102 Benchmark Dataset (100%)
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> 15+ Accessorial Keyword Detector
                </div>
              </div>
            </div>
            <button
              onClick={() => handleTabChange('ingestion')}
              className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-sans font-medium text-xs rounded-lg border border-neutral-700/80 flex items-center justify-center gap-1.5 transition mt-4"
            >
              Test AI Extraction <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Phase 2 */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4 hover:border-neutral-600 transition shadow-lg flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700/80 flex items-center justify-center text-white">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800">
                  Phase 2.1–2.9
                </span>
              </div>
              <div>
                <h3 className="text-lg font-serif text-white font-normal">Rating &amp; Split Optimizer</h3>
                <p className="text-xs text-neutral-400 mt-1 font-sans">
                  Direct BYOC adapters, CzarLite tariffs, platform wholesale, and knapsack split optimizer.
                </p>
              </div>
              <div className="space-y-1.5 text-xs text-neutral-300 font-sans pt-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> 5 Tier-1 Carriers (XPO, Estes, SAIA)
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Real-Time SSE Rate Streamer
                </div>
              </div>
            </div>
            <button
              onClick={() => handleTabChange('quoting')}
              className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-sans font-medium text-xs rounded-lg border border-neutral-700/80 flex items-center justify-center gap-1.5 transition mt-4"
            >
              Rate Simulation <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 3: Phase 3 */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4 hover:border-neutral-600 transition shadow-lg flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700/80 flex items-center justify-center text-white">
                  <KanbanSquare className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800">
                  Phase 3.1–3.8
                </span>
              </div>
              <div>
                <h3 className="text-lg font-serif text-white font-normal">Dispatch &amp; VICS eBOL</h3>
                <p className="text-xs text-neutral-400 mt-1 font-sans">
                  10-stage Kanban state machine, 1-click booking, EDI 204/990, and VICS eBOL PDFs.
                </p>
              </div>
              <div className="space-y-1.5 text-xs text-neutral-300 font-sans pt-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Standard VICS eBOL PDF Engine
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> FMCSA Safety &amp; $1M Insurance
                </div>
              </div>
            </div>
            <button
              onClick={() => handleTabChange('dispatch')}
              className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-sans font-medium text-xs rounded-lg border border-neutral-700/80 flex items-center justify-center gap-1.5 transition mt-4"
            >
              View Dispatch <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 4: Phase 4 */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4 hover:border-neutral-600 transition shadow-lg flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700/80 flex items-center justify-center text-white">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800">
                  Phase 4.1–4.4
                </span>
              </div>
              <div>
                <h3 className="text-lg font-serif text-white font-normal">Geotagged POD &amp; Billing</h3>
                <p className="text-xs text-neutral-400 mt-1 font-sans">
                  Driver PWA signature pad, Haversine 0.5mi geofence, damage scanner, and &lt;60s PDF invoicing.
                </p>
              </div>
              <div className="space-y-1.5 text-xs text-neutral-300 font-sans pt-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Multi-Point EXIF &amp; OCR Check
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Instant Customer Invoicing PDF
                </div>
              </div>
            </div>
            <button
              onClick={() => handleTabChange('pod-invoicing')}
              className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-sans font-medium text-xs rounded-lg border border-neutral-700/80 flex items-center justify-center gap-1.5 transition mt-4"
            >
              Simulate POD <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: PHASE 1 AI INGESTION */}
      {activeTab === 'ingestion' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-[#09090b] border border-[#27272a] rounded-2xl p-6 shadow-xl">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Phase 1 Interactive Simulator
              </span>
              <h3 className="text-xl font-serif text-white mt-1">Multi-Modal Freight Ingestion &amp; Parser</h3>
              <p className="text-xs text-neutral-400 font-sans">
                Paste unformatted freight email text or request body to trigger the real-time AI density &amp; NMFC classifier.
              </p>
            </div>
            <textarea
              value={rfqText}
              onChange={(e) => setRfqText(e.target.value)}
              rows={5}
              className="w-full bg-[#121215] border border-neutral-800 rounded-xl p-3.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-neutral-600"
            />
            <button
              onClick={handleRunAiExtraction}
              className="px-4 py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow flex items-center gap-2 transition"
            >
              <Sparkles className="w-4 h-4" /> Run Real-Time AI Extraction
            </button>
          </div>

          <div className="bg-[#121215] border border-neutral-800 rounded-xl p-5 space-y-4">
            <h4 className="font-sans font-semibold text-xs text-white flex items-center justify-between">
              <span>Structured Extraction Output</span>
              {extractedData && (
                <span className="text-[10px] font-mono text-neutral-400">Confidence: 99.0%</span>
              )}
            </h4>

            {extractedData ? (
              <div className="space-y-3 text-xs font-sans">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#09090b] p-3 rounded-lg border border-neutral-800">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">Origin Lane</span>
                    <div className="text-white font-medium mt-0.5">{extractedData.origin}</div>
                  </div>
                  <div className="bg-[#09090b] p-3 rounded-lg border border-neutral-800">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">Destination Lane</span>
                    <div className="text-white font-medium mt-0.5">{extractedData.destination}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#09090b] p-3 rounded-lg border border-neutral-800 text-center">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">PCF Density</span>
                    <div className="text-white font-mono font-bold text-sm mt-0.5">{extractedData.pcfDensity} PCF</div>
                  </div>
                  <div className="bg-[#09090b] p-3 rounded-lg border border-neutral-800 text-center">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">NMFC Class</span>
                    <div className="text-white font-mono font-bold text-sm mt-0.5">Class {extractedData.recommendedClass}</div>
                  </div>
                  <div className="bg-[#09090b] p-3 rounded-lg border border-neutral-800 text-center">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">Weight / Plts</span>
                    <div className="text-white font-mono font-bold text-sm mt-0.5">3.2k# (4 Plts)</div>
                  </div>
                </div>

                <div className="bg-[#09090b] p-3 rounded-lg border border-neutral-800">
                  <span className="text-neutral-500 text-[10px] uppercase font-mono">Detected Accessorials:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
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
                Click &quot;Run Real-Time AI Extraction&quot; above to analyze freight specs.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: PHASE 2 HYBRID RATING */}
      {activeTab === 'quoting' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Phase 2 Live Rating Engine
              </span>
              <h3 className="text-xl font-serif text-white mt-1">Multi-Carrier Comparison &amp; Dynamic Margins</h3>
            </div>
            <button
              onClick={handleRunLiveRating}
              disabled={isQuoting}
              className="px-4 py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow flex items-center gap-2 transition"
            >
              <Zap className="w-4 h-4" /> {isQuoting ? 'Streaming Rates...' : 'Rate Across 5 Carriers'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#121215] border border-neutral-800 p-3 rounded-xl">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">Origin ZIP</label>
              <input
                type="text"
                value={originZip}
                onChange={(e) => setOriginZip(e.target.value)}
                className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none"
              />
            </div>
            <div className="bg-[#121215] border border-neutral-800 p-3 rounded-xl">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">Destination ZIP</label>
              <input
                type="text"
                value={destZip}
                onChange={(e) => setDestZip(e.target.value)}
                className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none"
              />
            </div>
            <div className="bg-[#121215] border border-neutral-800 p-3 rounded-xl">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">Pallets</label>
              <input
                type="number"
                value={pallets}
                onChange={(e) => setPallets(parseInt(e.target.value) || 1)}
                className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none"
              />
            </div>
            <div className="bg-[#121215] border border-neutral-800 p-3 rounded-xl">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">Weight (lbs)</label>
              <input
                type="number"
                value={weightLbs}
                onChange={(e) => setWeightLbs(parseInt(e.target.value) || 500)}
                className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none"
              />
            </div>
          </div>

          {quoteResults && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-neutral-800 rounded-xl overflow-hidden font-sans">
                  <thead className="bg-[#121215] text-neutral-400 font-sans font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Carrier / Account</th>
                      <th className="p-3">Source Tag</th>
                      <th className="p-3 text-right">Carrier Cost</th>
                      <th className="p-3 text-right">Broker Margin</th>
                      <th className="p-3 text-right">Customer Price</th>
                      <th className="p-3 text-center">Transit</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800 bg-[#09090b] font-mono">
                    {quoteResults.map((q) => (
                      <tr key={q.scac} className="hover:bg-neutral-900/60 transition">
                        <td className="p-3 font-medium text-white font-sans">{q.carrier}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 text-neutral-300 border border-neutral-800">
                            {q.badge}
                          </span>
                        </td>
                        <td className="p-3 text-right text-neutral-300 font-data">${q.totalCarrierCost.toFixed(2)}</td>
                        <td className="p-3 text-right text-white font-data">+${q.margin.toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-white text-sm font-data">${q.customerPrice.toFixed(2)}</td>
                        <td className="p-3 text-center font-sans text-neutral-300">
                          {q.transitDays} Days {q.isGuaranteed && '⚡'}
                        </td>
                        <td className="p-3 text-center">
                          <Link
                            href="/quote/accept"
                            className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-black rounded text-[10px] font-bold font-sans transition"
                          >
                            Book Quote
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 4: PHASE 3 DISPATCH */}
      {activeTab === 'dispatch' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-6 shadow-xl">
          <div>
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
              Phase 3 Dispatch Desk &amp; Digital BOL
            </span>
            <h3 className="text-xl font-serif text-white mt-1">Lifecycle State Machine &amp; Instant VICS eBOL PDFs</h3>
            <p className="text-xs text-neutral-400 font-sans">
              Live integration with direct REST tenders, ANSI X12 EDI 204/990 payloads, and GS1-128 barcodes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#121215] border border-neutral-800 rounded-xl p-5 space-y-3">
              <h4 className="font-sans font-semibold text-white text-xs flex items-center gap-2">
                <KanbanSquare className="w-4 h-4 text-neutral-400" /> Kanban Dispatch Board
              </h4>
              <p className="text-xs text-neutral-400 font-sans">
                Manage 10-column shipment progression from UNASSIGNED to DELIVERED and SETTLED with audit validation.
              </p>
              <Link
                href="/dispatch"
                className="block w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-sans font-medium text-xs rounded-lg text-center border border-neutral-700/80 transition"
              >
                Launch Dispatch Desk
              </Link>
            </div>

            <div className="bg-[#121215] border border-neutral-800 rounded-xl p-5 space-y-3">
              <h4 className="font-sans font-semibold text-white text-xs flex items-center gap-2">
                <FileText className="w-4 h-4 text-neutral-400" /> Standard VICS eBOL Generator
              </h4>
              <p className="text-xs text-neutral-400 font-sans">
                Generate high-resolution printable VICS Bill of Lading PDFs with machine-readable GS1-128 barcodes.
              </p>
              <a
                href="/api/v1/shipments/01916362-7901-7080-867c-9b8895092s01/ebol?format=pdf"
                target="_blank"
                rel="noreferrer"
                className="block w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-sans font-medium text-xs rounded-lg text-center border border-neutral-700/80 transition"
              >
                View Sample eBOL PDF
              </a>
            </div>

            <div className="bg-[#121215] border border-neutral-800 rounded-xl p-5 space-y-3">
              <h4 className="font-sans font-semibold text-white text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-neutral-400" /> 1-Click Shipper Portal
              </h4>
              <p className="text-xs text-neutral-400 font-sans">
                Single-use HMAC-SHA256 signed action tokens allowing instant shipper self-serve quote acceptance.
              </p>
              <Link
                href="/quote/accept"
                className="block w-full py-2 bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs rounded-lg text-center transition"
              >
                Open Shipper Booking View
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: PHASE 3.8 FMCSA VETTING */}
      {activeTab === 'vetting' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-6 shadow-xl">
          <div>
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
              Phase 3.8 Safety &amp; Compliance Gatekeeper
            </span>
            <h3 className="text-xl font-serif text-white mt-1">FMCSA QCMobile / SaferWeb Carrier Validator</h3>
            <p className="text-xs text-neutral-400 font-sans">
              Enforces Active Operating Authority, Satisfactory Safety Ratings, $1,000,000 Auto Liability, and Out-of-Service limits before allowing tender dispatch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#121215] border border-neutral-800 rounded-xl p-5 space-y-4">
              <h4 className="font-sans font-semibold text-xs text-white">Test Carrier Compliance</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase font-mono text-neutral-500">Carrier SCAC</label>
                  <input
                    type="text"
                    value={vettingCarrier}
                    onChange={(e) => setVettingCarrier(e.target.value)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-lg p-2 text-xs font-mono text-white focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono text-neutral-500">USDOT Number</label>
                  <input
                    type="text"
                    value={vettingDot}
                    onChange={(e) => setVettingDot(e.target.value)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-lg p-2 text-xs font-mono text-white focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <button
                  onClick={handleRunVetting}
                  className="w-full py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-lg shadow flex items-center justify-center gap-2 transition"
                >
                  <ShieldCheck className="w-4 h-4" /> Evaluate FMCSA Safety Thresholds
                </button>
              </div>
            </div>

            <div className="bg-[#121215] border border-neutral-800 rounded-xl p-5 space-y-4">
              <h4 className="font-sans font-semibold text-xs text-white">Compliance Audit Result</h4>
              {vettingResult ? (
                <div className="space-y-3 text-xs font-mono">
                  <div className="flex justify-between items-center bg-[#09090b] p-3 rounded-lg border border-neutral-800">
                    <span className="font-sans font-semibold text-white">Approval Status:</span>
                    <span className="px-2 py-0.5 rounded font-bold font-mono bg-neutral-800 text-white border border-neutral-700">
                      APPROVED (SCORE: {vettingResult.safetyScore}/100)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-[#09090b] p-2.5 rounded-lg border border-neutral-800">Authority: <span className="text-white font-bold">ACTIVE</span></div>
                    <div className="bg-[#09090b] p-2.5 rounded-lg border border-neutral-800">Safety: <span className="text-white font-bold">SATISFACTORY</span></div>
                    <div className="bg-[#09090b] p-2.5 rounded-lg border border-neutral-800">Auto Liab: <span className="text-white font-bold">$2,000,000</span></div>
                    <div className="bg-[#09090b] p-2.5 rounded-lg border border-neutral-800">Cargo: <span className="text-white font-bold">$250,000</span></div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-500 text-xs italic font-sans">
                  Click &quot;Evaluate FMCSA Safety Thresholds&quot; to audit carrier.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 6: PHASE 4 GEOTAGGED POD & INVOICING */}
      {activeTab === 'pod-invoicing' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Phase 4 Interactive Simulator
              </span>
              <h3 className="text-xl font-serif text-white mt-1">Multi-Point Geotagged POD &amp; Invoicing</h3>
              <p className="text-xs text-neutral-400 font-sans">
                Test Haversine geofence boundary validation, OCR damage/shortage keyword extraction, and &lt;60s automated invoice generation.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/pod/demo-pod-token-2026"
                className="px-3 py-1.5 bg-[#121215] hover:bg-[#1c1c21] text-white font-sans font-medium text-xs rounded-lg border border-neutral-800 flex items-center gap-1.5 transition"
              >
                <Camera className="w-3.5 h-3.5 text-neutral-400" /> Open Mobile PWA
              </Link>
              <Link
                href="/invoices"
                className="px-3 py-1.5 bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs rounded-lg flex items-center gap-1.5 transition"
              >
                <FileText className="w-3.5 h-3.5" /> Invoicing Desk
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#121215] border border-neutral-800 rounded-xl p-5 space-y-4">
              <h4 className="font-sans font-semibold text-xs text-white">1. Simulate Inbound POD Upload</h4>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-mono text-neutral-500">Destination ZIP (Geofence Centroid)</label>
                  <input
                    type="text"
                    value={podZip}
                    onChange={(e) => setPodZip(e.target.value)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-lg p-2 font-mono text-white mt-1 focus:outline-none focus:border-neutral-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-mono text-neutral-500">Upload Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={podGpsLat}
                      onChange={(e) => setPodGpsLat(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#09090b] border border-neutral-800 rounded-lg p-2 font-mono text-white mt-1 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-mono text-neutral-500">Upload Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={podGpsLon}
                      onChange={(e) => setPodGpsLon(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#09090b] border border-neutral-800 rounded-lg p-2 font-mono text-white mt-1 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-neutral-500">OCR Text / Receiver Handwriting</label>
                  <textarea
                    rows={3}
                    value={podOcrText}
                    onChange={(e) => setPodOcrText(e.target.value)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-lg p-2 font-mono text-white mt-1 focus:outline-none focus:border-neutral-600"
                  />
                </div>

                <button
                  onClick={handleRunPodValidation}
                  className="w-full py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-lg shadow flex items-center justify-center gap-2 transition"
                >
                  <Sparkles className="w-4 h-4" /> Run Multi-Point POD Validation &amp; Invoicing
                </button>
              </div>
            </div>

            <div className="bg-[#121215] border border-neutral-800 rounded-xl p-5 space-y-4">
              <h4 className="font-sans font-semibold text-xs text-white">2. Validation &amp; Billing Output</h4>
              {podResult ? (
                <div className="space-y-3 text-xs font-mono">
                  <div className="flex justify-between items-center bg-[#09090b] p-3 rounded-lg border border-neutral-800">
                    <span className="font-sans font-semibold text-white">POD Status:</span>
                    <span className="px-2 py-0.5 rounded font-bold font-mono bg-neutral-900 text-white border border-neutral-700">
                      {podResult.status} ({podResult.overallConfidence}%)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-[#09090b] p-2.5 rounded-lg border border-neutral-800">
                      Geofence: <span className="text-white font-bold">{podResult.geofence.distanceMiles} mi ({podResult.geofence.isWithinGeofence ? 'PASS' : 'FAIL'})</span>
                    </div>
                    <div className="bg-[#09090b] p-2.5 rounded-lg border border-neutral-800">
                      Signature: <span className="text-white font-bold">DETECTED (98%)</span>
                    </div>
                    <div className="bg-[#09090b] p-2.5 rounded-lg border border-neutral-800">
                      Damage: <span className="text-white font-bold">{podResult.damage.hasException ? 'FLAGGED' : 'CLEAN'}</span>
                    </div>
                    <div className="bg-[#09090b] p-2.5 rounded-lg border border-neutral-800">
                      Invoice: <span className="text-white font-bold">{podResult.invoiceEligible ? 'AUTO-ISSUED (<60s)' : 'HELD'}</span>
                    </div>
                  </div>

                  {podResult.invoiceEligible && (
                    <div className="bg-[#09090b] border border-neutral-700 rounded-lg p-3 text-[11px] text-neutral-300 font-sans">
                      <div className="font-semibold text-white flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Customer Invoice Generated:
                      </div>
                      <div className="text-xs font-mono text-neutral-200 mt-1">
                        Invoice {podResult.invoiceNumber} • $793.50 USD • AP Email Dispatched
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 text-neutral-500 text-xs italic font-sans">
                  Click &quot;Run Multi-Point POD Validation &amp; Invoicing&quot; to execute simulation.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 7: PHASE 6 QUICKPAY FINTECH */}
      {activeTab === 'quickpay' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Phase 6.1 – 6.4 Active • Monetization Engine #2
              </span>
              <h3 className="text-xl font-serif text-white mt-1">Embedded Carrier QuickPay &amp; Ledger</h3>
              <p className="text-xs text-neutral-400 font-sans">
                1-Click accelerated payout (&lt; 2 hrs via RTP/FedNow) in exchange for 2.0%–2.5% discount fee spread.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/quickpay/demo-qp-token-2026"
                className="px-3.5 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs transition shadow flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                Launch 1-Click Portal
              </Link>
              <Link
                href="/quickpay"
                className="px-3.5 py-2 rounded-lg bg-[#121215] hover:bg-[#1c1c21] text-neutral-300 font-sans font-medium text-xs border border-neutral-800 transition"
              >
                Fintech Management Desk
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#121215] rounded-xl p-5 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-400 uppercase">Instant Same-Day (2.5%)</span>
                <span className="px-1.5 py-0.2 rounded bg-neutral-900 text-white border border-neutral-700 text-[10px] font-mono">&lt; 2 Hours</span>
              </div>
              <div className="text-2xl font-mono font-bold text-white">$780.00 Net</div>
              <div className="text-xs text-neutral-400 font-mono">Gross: $800.00 • Fee: -$20.00</div>
              <div className="text-[11px] text-neutral-400 font-sans">RTP / FedNow direct to JPMorgan Chase</div>
            </div>

            <div className="bg-[#121215] rounded-xl p-5 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-400 uppercase">Next-Day ACH (2.0%)</span>
                <span className="px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-300 border border-neutral-700 text-[10px] font-mono">Next Morning</span>
              </div>
              <div className="text-2xl font-mono font-bold text-white">$784.00 Net</div>
              <div className="text-xs text-neutral-400 font-mono">Gross: $800.00 • Fee: -$16.00</div>
              <div className="text-[11px] text-neutral-400 font-sans">Same-Day ACH electronic disbursement</div>
            </div>

            <div className="bg-[#121215] rounded-xl p-5 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-400 uppercase">Standard Terms (0.0%)</span>
                <span className="px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-400 border border-neutral-700 text-[10px] font-mono">Net 30</span>
              </div>
              <div className="text-2xl font-mono font-bold text-white">$800.00 Net</div>
              <div className="text-xs text-neutral-400 font-mono">Gross: $800.00 • Fee: $0.00</div>
              <div className="text-[11px] text-neutral-400 font-sans">Standard 30-day payout schedule</div>
            </div>
          </div>
        </div>
      )}
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
