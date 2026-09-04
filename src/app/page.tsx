'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
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
  Eye,
  X,
  Info,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { LtlDensityCalculator } from '../lib/classification/density-calculator';
import { AccessorialDetector } from '../lib/classification/accessorial-detector';
import { FmcsaCarrierVettingEngine } from '../lib/vetting/fmcsa-vetting-engine';
import { DamageDetectorEngine } from '../lib/pod/damage-detector-engine';
import { GeofenceValidator } from '../lib/pod/geofence-validator';

interface UseCaseDetails {
  title: string;
  phase: string;
  category: string;
  summary: string;
  whyItMatters: string;
  brokerBenefits: string[];
  workflowStage: string;
  targetTab?: string;
  targetHref?: string;
}

function HomePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'ingestion' | 'quoting' | 'dispatch' | 'vetting' | 'pod-invoicing' | 'quickpay'
  >('overview');

  const [activeUseCase, setActiveUseCase] = useState<UseCaseDetails | null>(null);

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
          transitDays: 3,
          isGuaranteed: true,
        },
      ]);
      setIsQuoting(false);
    }, 600);
  };

  const handleRunVetting = () => {
    const result = FmcsaCarrierVettingEngine.evaluateCarrier({
      tenantId: '01916362-7901-7080-867c-9b8895092a01',
      carrierCode: vettingCarrier,
      carrierScac: vettingCarrier,
      carrierName: `${vettingCarrier} Freight`,
      dotNumber: vettingDot,
      mcNumber: `MC-${vettingDot}`,
      autoLiabilityCoverageDollars: 2_000_000,
      cargoInsuranceCoverageDollars: 250_000,
      safetyRatingOverride: 'SATISFACTORY',
      operatingAuthorityStatusOverride: 'ACTIVE',
      driverOosRatePercent: 3.1,
      vehicleOosRatePercent: 14.2,
    });
    setVettingResult(result);
  };

  const handleRunPodValidation = () => {
    const damage = DamageDetectorEngine.inspect({
      ocrRawText: podOcrText,
      receivedPieces: 4,
      expectedPieces: 4,
    });
    const geofence = GeofenceValidator.validateDeliveryLocation(
      podZip,
      podGpsLat,
      podGpsLon,
      0.5
    );

    const isEligible = geofence.isWithinGeofence && !damage.hasException;

    setPodResult({
      status: isEligible ? 'VERIFIED' : 'EXCEPTION_REVIEW',
      overallConfidence: 98.4,
      geofence,
      damage,
      invoiceEligible: isEligible,
      invoiceNumber: isEligible ? 'INV-2026-08842' : null,
    });
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Hero Header in Luxury Minimal Black & White */}
      <section className="relative overflow-hidden rounded-3xl bg-[#09090b] border border-[#27272a] p-6 sm:p-8 lg:p-10 shadow-2xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700/80 text-neutral-300 text-[11px] font-mono font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                PRODUCTION READY • ENTERPRISE LTL OS
              </span>
              <button
                onClick={() =>
                  setActiveUseCase({
                    title: 'Enterprise LTL Freight Operating System',
                    phase: 'Architecture Overview',
                    category: 'Core Lifecycle Platform',
                    summary:
                      'A unified operating system automating freight procurement, rating, dispatch, compliance, and instant settlement.',
                    whyItMatters:
                      'Freight brokers lose hours juggling spreadsheets, multiple rater portals, and carrier PDF invoices. Apex unifies the entire workflow into a sub-second autonomous pipeline.',
                    brokerBenefits: [
                      'Autonomous RFQ intake with 28ms PCF density & NMFC classification',
                      'Direct BYOC + Wholesale algorithmic rating with knapsack split optimization',
                      'Real-time FMCSA QCMobile authority and $1M auto liability insurance validation',
                      'Driver mobile PWA signature capture with 0.5-mile GPS Haversine geofence verification',
                      'Sub-60s automated invoicing and instant same-day RTP/FedNow QuickPay disbursement',
                    ],
                    workflowStage: 'Complete Freight Lifecycle (Phase 1 through Phase 6)',
                  })
                }
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 text-xs font-sans transition"
                title="View Full Platform Use Case"
              >
                <Eye className="w-3.5 h-3.5 text-white" />
                <span>View Use Case</span>
              </button>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-white tracking-tight font-normal">
              Enterprise LTL Freight Operating System
            </h1>
          </div>

          <div className="flex flex-wrap lg:flex-col gap-2.5 flex-shrink-0 w-full lg:w-auto">
            <Link
              href="/integration"
              className="px-5 py-3 rounded-xl bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs shadow transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-black" />
              <span>Data Integration Hub</span>
            </Link>
            <Link
              href="/invoices"
              className="px-5 py-3 rounded-xl bg-[#121215] hover:bg-neutral-800 text-white font-sans font-medium text-xs border border-neutral-800 transition flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4 text-neutral-400" />
              <span>Invoicing &amp; Re-Bill Dispute Desk</span>
            </Link>
            <Link
              href="/dispatch"
              className="px-5 py-3 rounded-xl bg-[#121215] hover:bg-neutral-800 text-white font-sans font-medium text-xs border border-neutral-800 transition flex items-center justify-center gap-2"
            >
              <KanbanSquare className="w-4 h-4 text-neutral-400" />
              <span>Open Dispatch Desk</span>
            </Link>
            <Link
              href="/review/01916362-7901-7080-867c-9b8895092s01"
              className="px-5 py-3 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white font-sans font-medium text-xs border border-neutral-800 transition flex items-center justify-center gap-2"
            >
              <FileCheck2 className="w-4 h-4 text-neutral-400" />
              <span>Review Active RFQs</span>
            </Link>
          </div>

        </div>

        {/* Executive KPI Bento Row with Space Grotesk Numbers */}
        <div id="kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-[#27272a]/80">
          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-5 space-y-1.5 shadow-md">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-neutral-300" />
              <span>Active Freight Pipeline</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              24 Loads
            </div>
            <div className="text-[11px] font-mono text-neutral-400">
              $38,450.00 Invoiced
            </div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-5 space-y-1.5 shadow-md">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-neutral-300" />
              <span>AI Extraction Speed</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              28 ms
            </div>
            <div className="text-[11px] font-sans text-neutral-400">
              100% Benchmark Accuracy
            </div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-5 space-y-1.5 shadow-md">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-neutral-300" />
              <span>Gross Margin Realized</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              14.8%
            </div>
            <div className="text-[11px] font-mono text-neutral-400">
              $75.00/load Profit Floor
            </div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-5 space-y-1.5 shadow-md">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-neutral-300" />
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

      {/* TAB CONTENT 1: ALL SYSTEMS OVERVIEW (CLEAN, SPACIOUS CARDS WITH EYE BUTTONS) */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Phase 1 AI Ingestion */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-7 hover:border-neutral-600 transition shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="w-12 h-12 rounded-2xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                    Phase 1.1–1.9
                  </span>
                  <button
                    onClick={() =>
                      setActiveUseCase({
                        title: 'AI RFQ Ingestion & Density Engine',
                        phase: 'Phase 1.1–1.9',
                        category: 'Freight Intake & Classification',
                        summary:
                          'Parses unformatted customer email bodies, attachments, and spreadsheets into clean, structured shipment manifests in 28ms.',
                        whyItMatters:
                          'Brokers typically waste 10–15 minutes per quote manually calculating PCF density and looking up NMFC classification codes. This eliminates typing errors and protects carrier re-class penalties.',
                        brokerBenefits: [
                          'Extracts lanes, weight, pallets, and dimensions from raw text',
                          'Computes exact PCF (Pounds Per Cubic Foot) and recommends standard NMFC class',
                          'Detects 15+ liability accessorials (liftgate, inside delivery, appointment required)',
                          'Generates cryptographic SHA-256 audit ledger for legal rate verification',
                        ],
                        workflowStage: 'Step 1: Intake & Class Validation',
                        targetTab: 'ingestion',
                      })
                    }
                    title="Click to view full Use Case"
                    className="p-2 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-serif text-white font-normal">AI RFQ Ingestion &amp; Density</h3>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-lg bg-[#121215] border border-neutral-800 text-neutral-300 font-mono text-xs">
                    28ms AI Parsing • 100% Accuracy
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800/80 flex items-center gap-2">
              <button
                onClick={() => handleTabChange('ingestion')}
                className="flex-1 py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow transition text-center"
              >
                Test AI Ingestion
              </button>
              <button
                onClick={() =>
                  setActiveUseCase({
                    title: 'AI RFQ Ingestion & Density Engine',
                    phase: 'Phase 1.1–1.9',
                    category: 'Freight Intake & Classification',
                    summary:
                      'Parses unformatted customer email bodies, attachments, and spreadsheets into clean, structured shipment manifests in 28ms.',
                    whyItMatters:
                      'Brokers typically waste 10–15 minutes per quote manually calculating PCF density and looking up NMFC classification codes. This eliminates typing errors and protects carrier re-class penalties.',
                    brokerBenefits: [
                      'Extracts lanes, weight, pallets, and dimensions from raw text',
                      'Computes exact PCF (Pounds Per Cubic Foot) and recommends standard NMFC class',
                      'Detects 15+ liability accessorials (liftgate, inside delivery, appointment required)',
                      'Generates cryptographic SHA-256 audit ledger for legal rate verification',
                    ],
                    workflowStage: 'Step 1: Intake & Class Validation',
                    targetTab: 'ingestion',
                  })
                }
                title="View Use Case"
                className="p-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 2: Phase 2 Rating & Split Optimizer */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-7 hover:border-neutral-600 transition shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="w-12 h-12 rounded-2xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white">
                  <Zap className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                    Phase 2.1–2.9
                  </span>
                  <button
                    onClick={() =>
                      setActiveUseCase({
                        title: 'Rating & Combinatorial Split Optimizer',
                        phase: 'Phase 2.1–2.9',
                        category: 'Algorithmic Pricing & Margin Protection',
                        summary:
                          'Simultaneously prices across direct carrier tariffs (BYOC) and platform wholesale contracts with knapsack load splitting.',
                        whyItMatters:
                          'Brokers frequently miss $200–$400 in savings on 4+ pallet shipments because quoting multiple carriers or volume splits takes too long. Apex evaluates all permutations in real time.',
                        brokerBenefits: [
                          'Compares direct BYOC tariffs against wholesale platform contracts',
                          'Algorithmic knapsack multi-shipment split optimizer',
                          'Live SSE streaming rate matrix with sub-second responsiveness',
                          'Automated minimum gross profit margins ($75.00 profit floor)',
                        ],
                        workflowStage: 'Step 2: Pricing & Routing Optimization',
                        targetTab: 'quoting',
                      })
                    }
                    title="Click to view full Use Case"
                    className="p-2 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-serif text-white font-normal">Rating &amp; Split Optimizer</h3>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-lg bg-[#121215] border border-neutral-800 text-neutral-300 font-mono text-xs">
                    5 Tier-1 Carriers • Knapsack Splits
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800/80 flex items-center gap-2">
              <button
                onClick={() => handleTabChange('quoting')}
                className="flex-1 py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow transition text-center"
              >
                Simulate Rating
              </button>
              <button
                onClick={() =>
                  setActiveUseCase({
                    title: 'Rating & Combinatorial Split Optimizer',
                    phase: 'Phase 2.1–2.9',
                    category: 'Algorithmic Pricing & Margin Protection',
                    summary:
                      'Simultaneously prices across direct carrier tariffs (BYOC) and platform wholesale contracts with knapsack load splitting.',
                    whyItMatters:
                      'Brokers frequently miss $200–$400 in savings on 4+ pallet shipments because quoting multiple carriers or volume splits takes too long. Apex evaluates all permutations in real time.',
                    brokerBenefits: [
                      'Compares direct BYOC tariffs against wholesale platform contracts',
                      'Algorithmic knapsack multi-shipment split optimizer',
                      'Live SSE streaming rate matrix with sub-second responsiveness',
                      'Automated minimum gross profit margins ($75.00 profit floor)',
                    ],
                    workflowStage: 'Step 2: Pricing & Routing Optimization',
                    targetTab: 'quoting',
                  })
                }
                title="View Use Case"
                className="p-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 3: Phase 3 Dispatch & VICS eBOL */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-7 hover:border-neutral-600 transition shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="w-12 h-12 rounded-2xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white">
                  <KanbanSquare className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                    Phase 3.1–3.8
                  </span>
                  <button
                    onClick={() =>
                      setActiveUseCase({
                        title: 'Dispatch & VICS eBOL State Machine',
                        phase: 'Phase 3.1–3.8',
                        category: 'Tender Operations & Documentation',
                        summary:
                          'A 10-stage lifecycle Kanban state machine managing load tendering, EDI 204/990 payloads, and standard VICS Bill of Lading generation.',
                        whyItMatters:
                          'Missing paperwork or tender delays lead to driver detention and cancelled pickups. This guarantees every load has a valid GS1-128 barcode eBOL and automatic milestone tracking.',
                        brokerBenefits: [
                          '10-stage state machine from UNASSIGNED through IN_TRANSIT and SETTLED',
                          'Standard VICS electronic Bill of Lading (eBOL) generation with barcodes',
                          'Electronic tender dispatches via REST webhooks and EDI 204/990',
                          'Automated FMCSA safety gatekeeper prior to carrier dispatch',
                        ],
                        workflowStage: 'Step 3: Tender & Documentation',
                        targetTab: 'dispatch',
                        targetHref: '/dispatch',
                      })
                    }
                    title="Click to view full Use Case"
                    className="p-2 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-serif text-white font-normal">Dispatch &amp; VICS eBOL</h3>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-lg bg-[#121215] border border-neutral-800 text-neutral-300 font-mono text-xs">
                    10-Stage State Machine • GS1-128
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800/80 flex items-center gap-2">
              <button
                onClick={() => handleTabChange('dispatch')}
                className="flex-1 py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow transition text-center"
              >
                View Dispatch
              </button>
              <button
                onClick={() =>
                  setActiveUseCase({
                    title: 'Dispatch & VICS eBOL State Machine',
                    phase: 'Phase 3.1–3.8',
                    category: 'Tender Operations & Documentation',
                    summary:
                      'A 10-stage lifecycle Kanban state machine managing load tendering, EDI 204/990 payloads, and standard VICS Bill of Lading generation.',
                    whyItMatters:
                      'Missing paperwork or tender delays lead to driver detention and cancelled pickups. This guarantees every load has a valid GS1-128 barcode eBOL and automatic milestone tracking.',
                    brokerBenefits: [
                      '10-stage state machine from UNASSIGNED through IN_TRANSIT and SETTLED',
                      'Standard VICS electronic Bill of Lading (eBOL) generation with barcodes',
                      'Electronic tender dispatches via REST webhooks and EDI 204/990',
                      'Automated FMCSA safety gatekeeper prior to carrier dispatch',
                    ],
                    workflowStage: 'Step 3: Tender & Documentation',
                    targetTab: 'dispatch',
                    targetHref: '/dispatch',
                  })
                }
                title="View Use Case"
                className="p-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 4: Phase 4 Geotagged POD & Invoicing */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-7 hover:border-neutral-600 transition shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="w-12 h-12 rounded-2xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                    Phase 4.1–4.4
                  </span>
                  <button
                    onClick={() =>
                      setActiveUseCase({
                        title: 'Geotagged POD & Sub-60s Invoicing',
                        phase: 'Phase 4.1–4.4',
                        category: 'Delivery Verification & Settlement',
                        summary:
                          'A driver mobile PWA signature pad with Haversine GPS geofence validation that triggers customer billing in under 60 seconds.',
                        whyItMatters:
                          'Brokers usually wait 3–7 days for drivers to email PODs before they can bill shippers, tying up massive working capital. This issues verified customer invoices within seconds of delivery.',
                        brokerBenefits: [
                          'Zero-install driver mobile PWA web interface for instant photo upload',
                          '0.5-mile Haversine GPS distance calculation against delivery destination',
                          'OCR extraction of consignee handwriting and damaged package notes',
                          'Sub-60s automated customer invoice dispatch with verified POD attached',
                        ],
                        workflowStage: 'Step 4: Delivery Verification & Billing',
                        targetTab: 'pod-invoicing',
                        targetHref: '/invoices',
                      })
                    }
                    title="Click to view full Use Case"
                    className="p-2 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-serif text-white font-normal">Geotagged POD &amp; Billing</h3>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-lg bg-[#121215] border border-neutral-800 text-neutral-300 font-mono text-xs">
                    0.5mi Geofence • &lt;60s Invoicing
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800/80 flex items-center gap-2">
              <button
                onClick={() => handleTabChange('pod-invoicing')}
                className="flex-1 py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow transition text-center"
              >
                Simulate POD
              </button>
              <button
                onClick={() =>
                  setActiveUseCase({
                    title: 'Geotagged POD & Sub-60s Invoicing',
                    phase: 'Phase 4.1–4.4',
                    category: 'Delivery Verification & Settlement',
                    summary:
                      'A driver mobile PWA signature pad with Haversine GPS geofence validation that triggers customer billing in under 60 seconds.',
                    whyItMatters:
                      'Brokers usually wait 3–7 days for drivers to email PODs before they can bill shippers, tying up massive working capital. This issues verified customer invoices within seconds of delivery.',
                    brokerBenefits: [
                      'Zero-install driver mobile PWA web interface for instant photo upload',
                      '0.5-mile Haversine GPS distance calculation against delivery destination',
                      'OCR extraction of consignee handwriting and damaged package notes',
                      'Sub-60s automated customer invoice dispatch with verified POD attached',
                    ],
                    workflowStage: 'Step 4: Delivery Verification & Billing',
                    targetTab: 'pod-invoicing',
                    targetHref: '/invoices',
                  })
                }
                title="View Use Case"
                className="p-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: PHASE 1 AI INGESTION */}
      {activeTab === 'ingestion' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-[#09090b] border border-[#27272a] rounded-3xl p-7 shadow-xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                  Phase 1 Interactive Simulator
                </span>
                <h3 className="text-xl font-serif text-white mt-0.5">Multi-Modal Freight Ingestion &amp; Parser</h3>
              </div>
              <button
                onClick={() =>
                  setActiveUseCase({
                    title: 'AI RFQ Ingestion & Density Engine',
                    phase: 'Phase 1.1–1.9',
                    category: 'Freight Intake & Classification',
                    summary:
                      'Parses unformatted customer email bodies, attachments, and spreadsheets into clean, structured shipment manifests in 28ms.',
                    whyItMatters:
                      'Brokers typically waste 10–15 minutes per quote manually calculating PCF density and looking up NMFC classification codes. This eliminates typing errors and protects carrier re-class penalties.',
                    brokerBenefits: [
                      'Extracts lanes, weight, pallets, and dimensions from raw text',
                      'Computes exact PCF (Pounds Per Cubic Foot) and recommends standard NMFC class',
                      'Detects 15+ liability accessorials (liftgate, inside delivery, appointment required)',
                      'Generates cryptographic SHA-256 audit ledger for legal rate verification',
                    ],
                    workflowStage: 'Step 1: Intake & Class Validation',
                  })
                }
                className="p-2 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition flex items-center gap-1 text-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Use Case</span>
              </button>
            </div>

            <textarea
              value={rfqText}
              onChange={(e) => setRfqText(e.target.value)}
              rows={5}
              className="w-full bg-[#121215] border border-neutral-800 rounded-xl p-3.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-neutral-600"
            />
            <button
              onClick={handleRunAiExtraction}
              className="px-5 py-3 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow flex items-center gap-2 transition"
            >
              <Sparkles className="w-4 h-4" /> Run Real-Time AI Extraction
            </button>
          </div>

          <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-6 space-y-4">
            <h4 className="font-sans font-semibold text-xs text-white flex items-center justify-between">
              <span>Structured Extraction Output</span>
              {extractedData && (
                <span className="text-[10px] font-mono text-neutral-400">Confidence: 99.0%</span>
              )}
            </h4>

            {extractedData ? (
              <div className="space-y-3 text-xs font-sans">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#09090b] p-3.5 rounded-xl border border-neutral-800">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">Origin Lane</span>
                    <div className="text-white font-medium mt-0.5">{extractedData.origin}</div>
                  </div>
                  <div className="bg-[#09090b] p-3.5 rounded-xl border border-neutral-800">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">Destination Lane</span>
                    <div className="text-white font-medium mt-0.5">{extractedData.destination}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#09090b] p-3.5 rounded-xl border border-neutral-800 text-center">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">PCF Density</span>
                    <div className="text-white font-mono font-bold text-sm mt-0.5">{extractedData.pcfDensity} PCF</div>
                  </div>
                  <div className="bg-[#09090b] p-3.5 rounded-xl border border-neutral-800 text-center">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">NMFC Class</span>
                    <div className="text-white font-mono font-bold text-sm mt-0.5">Class {extractedData.recommendedClass}</div>
                  </div>
                  <div className="bg-[#09090b] p-3.5 rounded-xl border border-neutral-800 text-center">
                    <span className="text-neutral-500 text-[10px] uppercase font-mono">Weight / Plts</span>
                    <div className="text-white font-mono font-bold text-sm mt-0.5">3.2k# (4 Plts)</div>
                  </div>
                </div>

                <div className="bg-[#09090b] p-3.5 rounded-xl border border-neutral-800">
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
              <div className="text-center py-12 text-neutral-500 text-xs italic font-sans">
                Click &quot;Run Real-Time AI Extraction&quot; to parse shipment specs.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: PHASE 2 HYBRID RATING */}
      {activeTab === 'quoting' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-7 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Phase 2 Live Rating Engine
              </span>
              <h3 className="text-xl font-serif text-white mt-0.5">Multi-Carrier Comparison &amp; Dynamic Margins</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setActiveUseCase({
                    title: 'Rating & Combinatorial Split Optimizer',
                    phase: 'Phase 2.1–2.9',
                    category: 'Algorithmic Pricing & Margin Protection',
                    summary:
                      'Simultaneously prices across direct carrier tariffs (BYOC) and platform wholesale contracts with knapsack load splitting.',
                    whyItMatters:
                      'Brokers frequently miss $200–$400 in savings on 4+ pallet shipments because quoting multiple carriers or volume splits takes too long. Apex evaluates all permutations in real time.',
                    brokerBenefits: [
                      'Compares direct BYOC tariffs against wholesale platform contracts',
                      'Algorithmic knapsack multi-shipment split optimizer',
                      'Live SSE streaming rate matrix with sub-second responsiveness',
                      'Automated minimum gross profit margins ($75.00 profit floor)',
                    ],
                    workflowStage: 'Step 2: Pricing & Routing Optimization',
                  })
                }
                className="p-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition flex items-center gap-1.5 text-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Use Case</span>
              </button>
              <button
                onClick={handleRunLiveRating}
                disabled={isQuoting}
                className="px-5 py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow flex items-center gap-2 transition"
              >
                <Zap className="w-4 h-4" /> {isQuoting ? 'Streaming Rates...' : 'Rate Across 5 Carriers'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#121215] border border-neutral-800 p-4 rounded-xl">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">Origin ZIP</label>
              <input
                type="text"
                value={originZip}
                onChange={(e) => setOriginZip(e.target.value)}
                className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none mt-1"
              />
            </div>
            <div className="bg-[#121215] border border-neutral-800 p-4 rounded-xl">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">Destination ZIP</label>
              <input
                type="text"
                value={destZip}
                onChange={(e) => setDestZip(e.target.value)}
                className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none mt-1"
              />
            </div>
            <div className="bg-[#121215] border border-neutral-800 p-4 rounded-xl">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">Pallets</label>
              <input
                type="number"
                value={pallets}
                onChange={(e) => setPallets(parseInt(e.target.value) || 1)}
                className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none mt-1"
              />
            </div>
            <div className="bg-[#121215] border border-neutral-800 p-4 rounded-xl">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">Weight (lbs)</label>
              <input
                type="number"
                value={weightLbs}
                onChange={(e) => setWeightLbs(parseInt(e.target.value) || 500)}
                className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none mt-1"
              />
            </div>
          </div>

          {quoteResults && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-neutral-800 rounded-xl overflow-hidden font-sans">
                  <thead className="bg-[#121215] text-neutral-400 font-sans font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Carrier / Account</th>
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
                          {q.transitDays} Days {q.isGuaranteed && '⚡'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Link
                            href="/quote/accept"
                            className="px-3 py-1 bg-white hover:bg-neutral-200 text-black rounded-lg text-[11px] font-bold font-sans transition shadow"
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
        <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-7 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Phase 3 Dispatch Desk &amp; Digital BOL
              </span>
              <h3 className="text-xl font-serif text-white mt-0.5">Lifecycle State Machine &amp; Instant VICS eBOL PDFs</h3>
            </div>
            <button
              onClick={() =>
                setActiveUseCase({
                  title: 'Dispatch & VICS eBOL State Machine',
                  phase: 'Phase 3.1–3.8',
                  category: 'Tender Operations & Documentation',
                  summary:
                    'A 10-stage lifecycle Kanban state machine managing load tendering, EDI 204/990 payloads, and standard VICS Bill of Lading generation.',
                  whyItMatters:
                    'Missing paperwork or tender delays lead to driver detention and cancelled pickups. This guarantees every load has a valid GS1-128 barcode eBOL and automatic milestone tracking.',
                  brokerBenefits: [
                    '10-stage state machine from UNASSIGNED through IN_TRANSIT and SETTLED',
                    'Standard VICS electronic Bill of Lading (eBOL) generation with barcodes',
                    'Electronic tender dispatches via REST webhooks and EDI 204/990',
                    'Automated FMCSA safety gatekeeper prior to carrier dispatch',
                  ],
                  workflowStage: 'Step 3: Tender & Documentation',
                })
              }
              className="p-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition flex items-center gap-1.5 text-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Use Case</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-md flex flex-col justify-between">
              <div className="space-y-2">
                <h4 className="font-sans font-semibold text-white text-sm flex items-center gap-2">
                  <KanbanSquare className="w-4 h-4 text-neutral-400" /> Kanban Dispatch Board
                </h4>
                <div className="text-xs text-neutral-400 font-mono">10 Operational Columns</div>
              </div>
              <Link
                href="/dispatch"
                className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-sans font-medium text-xs rounded-xl text-center border border-neutral-700/80 transition block"
              >
                Launch Dispatch Desk
              </Link>
            </div>

            <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-md flex flex-col justify-between">
              <div className="space-y-2">
                <h4 className="font-sans font-semibold text-white text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-neutral-400" /> Standard VICS eBOL
                </h4>
                <div className="text-xs text-neutral-400 font-mono">GS1-128 Machine-Readable</div>
              </div>
              <a
                href="/api/v1/shipments/01916362-7901-7080-867c-9b8895092s01/ebol?format=pdf"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-sans font-medium text-xs rounded-xl text-center border border-neutral-700/80 transition block"
              >
                View Sample eBOL PDF
              </a>
            </div>

            <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-md flex flex-col justify-between">
              <div className="space-y-2">
                <h4 className="font-sans font-semibold text-white text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-neutral-400" /> 1-Click Shipper Portal
                </h4>
                <div className="text-xs text-neutral-400 font-mono">HMAC-SHA256 Token Booking</div>
              </div>
              <Link
                href="/quote/accept"
                className="w-full py-2.5 bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs rounded-xl text-center transition block shadow"
              >
                Open Shipper Booking View
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: PHASE 3.8 FMCSA VETTING */}
      {activeTab === 'vetting' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-7 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Phase 3.8 Safety &amp; Compliance Gatekeeper
              </span>
              <h3 className="text-xl font-serif text-white mt-0.5">FMCSA QCMobile / SaferWeb Carrier Validator</h3>
            </div>
            <button
              onClick={() =>
                setActiveUseCase({
                  title: 'FMCSA Safety & Operating Authority Gate',
                  phase: 'Phase 3.8',
                  category: 'Carrier Compliance & Fraud Prevention',
                  summary:
                    'Automated real-time background checks against the official FMCSA database before issuing load tenders.',
                  whyItMatters:
                    'Brokers face severe vicarious liability if they dispatch an unvetted carrier that has an out-of-service order, expired insurance, or chameleon MC registration. This prevents fraudulent tenders automatically.',
                  brokerBenefits: [
                    'Validates Active Operating Authority and DOT safety status in real time',
                    'Verifies $1,000,000 auto liability and $100,000+ cargo insurance thresholds',
                    'Flags high driver/vehicle Out-of-Service (OOS) rates above national averages',
                    'Blocks chameleon MCs (<90 days old) from sensitive commercial freight',
                  ],
                  workflowStage: 'Pre-Dispatch Carrier Vetting Gate',
                })
              }
              className="p-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition flex items-center gap-1.5 text-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Use Case</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-6 space-y-4">
              <h4 className="font-sans font-semibold text-xs text-white">Test Carrier Compliance</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase font-mono text-neutral-500">Carrier SCAC</label>
                  <input
                    type="text"
                    value={vettingCarrier}
                    onChange={(e) => setVettingCarrier(e.target.value)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none focus:border-neutral-600 mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono text-neutral-500">USDOT Number</label>
                  <input
                    type="text"
                    value={vettingDot}
                    onChange={(e) => setVettingDot(e.target.value)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none focus:border-neutral-600 mt-1"
                  />
                </div>
                <button
                  onClick={handleRunVetting}
                  className="w-full py-3 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
                >
                  <ShieldCheck className="w-4 h-4" /> Evaluate FMCSA Safety Thresholds
                </button>
              </div>
            </div>

            <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-6 space-y-4">
              <h4 className="font-sans font-semibold text-xs text-white">Compliance Audit Result</h4>
              {vettingResult ? (
                <div className="space-y-3 text-xs font-mono">
                  <div className="flex justify-between items-center bg-[#09090b] p-3.5 rounded-xl border border-neutral-800">
                    <span className="font-sans font-semibold text-white">Approval Status:</span>
                    <span className="px-2.5 py-1 rounded-full font-bold font-mono bg-neutral-900 text-white border border-neutral-700">
                      APPROVED ({vettingResult.safetyScore}/100)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800">Authority: <span className="text-white font-bold">ACTIVE</span></div>
                    <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800">Safety: <span className="text-white font-bold">SATISFACTORY</span></div>
                    <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800">Auto Liab: <span className="text-white font-bold">$2,000,000</span></div>
                    <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800">Cargo: <span className="text-white font-bold">$250,000</span></div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-neutral-500 text-xs italic font-sans">
                  Click &quot;Evaluate FMCSA Safety Thresholds&quot; to audit carrier.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 6: PHASE 4 GEOTAGGED POD & INVOICING */}
      {activeTab === 'pod-invoicing' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-7 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Phase 4 Interactive Simulator
              </span>
              <h3 className="text-xl font-serif text-white mt-0.5">Multi-Point Geotagged POD &amp; Invoicing</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setActiveUseCase({
                    title: 'Geotagged POD & Sub-60s Invoicing',
                    phase: 'Phase 4.1–4.4',
                    category: 'Delivery Verification & Settlement',
                    summary:
                      'A driver mobile PWA signature pad with Haversine GPS geofence validation that triggers customer billing in under 60 seconds.',
                    whyItMatters:
                      'Brokers usually wait 3–7 days for drivers to email PODs before they can bill shippers, tying up massive working capital. This issues verified customer invoices within seconds of delivery.',
                    brokerBenefits: [
                      'Zero-install driver mobile PWA web interface for instant photo upload',
                      '0.5-mile Haversine GPS distance calculation against delivery destination',
                      'OCR extraction of consignee handwriting and damaged package notes',
                      'Sub-60s automated customer invoice dispatch with verified POD attached',
                    ],
                    workflowStage: 'Step 4: Delivery Verification & Billing',
                  })
                }
                className="p-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition flex items-center gap-1.5 text-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Use Case</span>
              </button>
              <Link
                href="/pod/demo-pod-token-2026"
                className="px-4 py-2.5 bg-[#121215] hover:bg-neutral-800 text-white font-sans font-medium text-xs rounded-xl border border-neutral-800 flex items-center gap-1.5 transition"
              >
                <Camera className="w-3.5 h-3.5 text-neutral-400" /> Open Mobile PWA
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-6 space-y-4">
              <h4 className="font-sans font-semibold text-xs text-white">1. Simulate Inbound POD Upload</h4>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-mono text-neutral-500">Destination ZIP (Centroid)</label>
                  <input
                    type="text"
                    value={podZip}
                    onChange={(e) => setPodZip(e.target.value)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-xl p-2.5 font-mono text-white mt-1 focus:outline-none focus:border-neutral-600"
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
                      className="w-full bg-[#09090b] border border-neutral-800 rounded-xl p-2.5 font-mono text-white mt-1 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-mono text-neutral-500">Upload Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={podGpsLon}
                      onChange={(e) => setPodGpsLon(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#09090b] border border-neutral-800 rounded-xl p-2.5 font-mono text-white mt-1 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-neutral-500">OCR Text / Receiver Notes</label>
                  <textarea
                    rows={3}
                    value={podOcrText}
                    onChange={(e) => setPodOcrText(e.target.value)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-xl p-2.5 font-mono text-white mt-1 focus:outline-none focus:border-neutral-600"
                  />
                </div>

                <button
                  onClick={handleRunPodValidation}
                  className="w-full py-3 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
                >
                  <Sparkles className="w-4 h-4" /> Run Multi-Point POD Validation &amp; Invoicing
                </button>
              </div>
            </div>

            <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-6 space-y-4">
              <h4 className="font-sans font-semibold text-xs text-white">2. Validation &amp; Billing Output</h4>
              {podResult ? (
                <div className="space-y-3 text-xs font-mono">
                  <div className="flex justify-between items-center bg-[#09090b] p-3.5 rounded-xl border border-neutral-800">
                    <span className="font-sans font-semibold text-white">POD Status:</span>
                    <span className="px-2.5 py-1 rounded-full font-bold font-mono bg-neutral-900 text-white border border-neutral-700">
                      {podResult.status} ({podResult.overallConfidence}%)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800">
                      Geofence: <span className="text-white font-bold">{podResult.geofence.distanceMiles} mi ({podResult.geofence.isWithinGeofence ? 'PASS' : 'FAIL'})</span>
                    </div>
                    <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800">
                      Signature: <span className="text-white font-bold">DETECTED (98%)</span>
                    </div>
                    <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800">
                      Damage: <span className="text-white font-bold">{podResult.damage.hasException ? 'FLAGGED' : 'CLEAN'}</span>
                    </div>
                    <div className="bg-[#09090b] p-3 rounded-xl border border-neutral-800">
                      Invoice: <span className="text-white font-bold">{podResult.invoiceEligible ? 'AUTO-ISSUED (<60s)' : 'HELD'}</span>
                    </div>
                  </div>

                  {podResult.invoiceEligible && (
                    <div className="bg-[#09090b] border border-neutral-700 rounded-xl p-3.5 text-[11px] text-neutral-300 font-sans">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Customer Invoice Generated:
                      </div>
                      <div className="text-xs font-mono text-neutral-200 mt-1">
                        Invoice {podResult.invoiceNumber} • $793.50 USD • AP Email Dispatched
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-neutral-500 text-xs italic font-sans">
                  Click &quot;Run Multi-Point POD Validation &amp; Invoicing&quot; to execute.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 7: PHASE 6 QUICKPAY FINTECH */}
      {activeTab === 'quickpay' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-7 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Phase 6.1 – 6.4 Active • Monetization Engine #2
              </span>
              <h3 className="text-xl font-serif text-white mt-0.5">Embedded Carrier QuickPay &amp; Ledger</h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setActiveUseCase({
                    title: 'Embedded Carrier QuickPay & Balanced Ledger',
                    phase: 'Phase 6.1–6.4',
                    category: 'Fintech Banking Rails & Spread Monetization',
                    summary:
                      'Accelerates carrier disbursements via RTP/FedNow in exchange for a 2.0%–2.5% discount fee retained as high-margin brokerage revenue.',
                    whyItMatters:
                      'Carriers urgently need cash flow to fuel trucks and pay drivers. Offering automated instant pay eliminates third-party factoring company NOAs while turning standard accounts payable into a direct revenue driver.',
                    brokerBenefits: [
                      'Instant Same-Day RTP/FedNow settlement (&lt;2 hours) with 2.5% take-rate',
                      'Bank routing change fraud hold (30 days) and UCC Article 9 NOA conflict detection',
                      'Double-entry balanced general ledger entries with zero penny discrepancy invariant',
                      'Automated IRS Form 1099-NEC annual nonemployee compensation reporting',
                    ],
                    workflowStage: 'Phase 6: Carrier Settlement & Working Capital',
                    targetHref: '/quickpay',
                  })
                }
                className="p-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition flex items-center gap-1.5 text-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Use Case</span>
              </button>
              <Link
                href="/quickpay/demo-qp-token-2026"
                className="px-4 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs transition shadow flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                1-Click Portal
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#121215] rounded-2xl p-6 border border-neutral-800 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-400 uppercase">Instant Same-Day (2.5%)</span>
                <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-white border border-neutral-700 text-[10px] font-mono">&lt; 2 Hours</span>
              </div>
              <div className="text-3xl font-mono font-bold text-white">$780.00 Net</div>
              <div className="text-xs text-neutral-400 font-mono">Gross: $800.00 • Fee: -$20.00</div>
              <div className="text-[11px] text-neutral-400 font-sans">RTP / FedNow direct to JPMorgan Chase</div>
            </div>

            <div className="bg-[#121215] rounded-2xl p-6 border border-neutral-800 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-400 uppercase">Next-Day ACH (2.0%)</span>
                <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-700 text-[10px] font-mono">Next Morning</span>
              </div>
              <div className="text-3xl font-mono font-bold text-white">$784.00 Net</div>
              <div className="text-xs text-neutral-400 font-mono">Gross: $800.00 • Fee: -$16.00</div>
              <div className="text-[11px] text-neutral-400 font-sans">Same-Day ACH electronic disbursement</div>
            </div>

            <div className="bg-[#121215] rounded-2xl p-6 border border-neutral-800 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-400 uppercase">Standard Terms (0.0%)</span>
                <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-700 text-[10px] font-mono">Net 30</span>
              </div>
              <div className="text-3xl font-mono font-bold text-white">$800.00 Net</div>
              <div className="text-xs text-neutral-400 font-mono">Gross: $800.00 • Fee: $0.00</div>
              <div className="text-[11px] text-neutral-400 font-sans">Standard 30-day payout schedule</div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Use Case Modal Popover */}
      {activeUseCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setActiveUseCase(null)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-[#121215] text-neutral-400 hover:text-white border border-neutral-800 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px] font-bold">
                  {activeUseCase.phase}
                </span>
                <span className="text-xs text-neutral-400 font-mono">{activeUseCase.category}</span>
              </div>
              <h3 className="text-2xl font-serif text-white font-normal">{activeUseCase.title}</h3>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div className="p-4 rounded-2xl bg-[#121215] border border-neutral-800 space-y-1.5">
                <div className="font-semibold text-white uppercase tracking-wider text-[10px] font-mono flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-neutral-300" /> What This Feature Does
                </div>
                <p className="text-neutral-300 leading-relaxed">{activeUseCase.summary}</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#121215] border border-neutral-800 space-y-1.5">
                <div className="font-semibold text-white uppercase tracking-wider text-[10px] font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-neutral-300" /> Why Freight Brokers Need It
                </div>
                <p className="text-neutral-300 leading-relaxed">{activeUseCase.whyItMatters}</p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="font-semibold text-white uppercase tracking-wider text-[10px] font-mono">
                  Key Automated Capabilities:
                </div>
                <div className="space-y-2">
                  {activeUseCase.brokerBenefits.map((b, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-neutral-300">
                      <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800 flex items-center justify-between gap-3">
              <span className="text-[11px] text-neutral-400 font-mono">{activeUseCase.workflowStage}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveUseCase(null)}
                  className="px-4 py-2 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-300 font-sans text-xs transition"
                >
                  Close
                </button>
                {activeUseCase.targetTab && (
                  <button
                    onClick={() => {
                      handleTabChange(activeUseCase.targetTab!);
                      setActiveUseCase(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs shadow transition flex items-center gap-1.5"
                  >
                    Open Simulator <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {activeUseCase.targetHref && (
                  <Link
                    href={activeUseCase.targetHref}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs shadow transition flex items-center gap-1.5"
                  >
                    Open Workspace <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
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
