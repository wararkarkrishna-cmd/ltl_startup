'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileCheck2,
  Zap,
  KanbanSquare,
  FileText,
  TrendingUp,
  Camera,
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronRight,
  DollarSign,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface SubFeature {
  title: string;
  href?: string;
  tag?: string;
  description?: string;
  isExternal?: boolean;
}

interface NavModule {
  id: string;
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  subFeatures: SubFeature[];
}

export const AppSidebar: React.FC<{
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}> = ({ isCollapsed, onToggleCollapse }) => {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    overview: true,
    review: true,
    rating: false,
    dispatch: false,
    invoices: false,
    quickpay: false,
    analytics: false,
    pod: false,
  });

  const sampleShipmentId = '01916362-7901-7080-867c-9b8895092s01';

  const navModules: NavModule[] = [
    {
      id: 'overview',
      title: 'Executive Command',
      href: '/',
      icon: LayoutDashboard,
      badge: 'v3.8',
      subFeatures: [
        { title: 'Command Overview', href: '/', description: 'Master operational & financial pulse' },
        { title: 'Executive KPI Ribbon', href: '/#kpis', description: 'Realized margins, SLA speed & load count' },
        { title: 'Multi-Phase Simulator', href: '/#sandbox', description: 'Interactive end-to-end freight sandbox' },
      ],
    },
    {
      id: 'review',
      title: 'RFQ Intake & Review',
      href: `/review/${sampleShipmentId}`,
      icon: FileCheck2,
      badge: '15s SLA',
      subFeatures: [
        { title: 'Fast Review Board', href: `/review/${sampleShipmentId}`, description: 'Dual-pane 15s keyboard review desk' },
        { title: 'PCF Density Calculator', href: `/review/${sampleShipmentId}`, description: '11-Tier NMFC automatic class assignment' },
        { title: 'Accessorial Palette (⌘K)', href: `/review/${sampleShipmentId}`, description: '15+ high-liability accessorial detector' },
        { title: 'HITL Confidence Scorer', href: `/review/${sampleShipmentId}`, description: 'Entropy threshold escalation gate' },
      ],
    },
    {
      id: 'rating',
      title: 'Rating & Split Optimizer',
      href: `/quote/${sampleShipmentId}`,
      icon: Zap,
      badge: '5 Carriers',
      subFeatures: [
        { title: 'Multi-Carrier Rate Matrix', href: `/quote/${sampleShipmentId}`, description: 'Direct BYOC + Wholesale tariffs' },
        { title: 'Combinatorial Split Optimizer', href: `/quote/${sampleShipmentId}`, description: 'Knapsack multi-shipment savings engine' },
        { title: 'Volume-LTL Limit Watcher', href: `/quote/${sampleShipmentId}`, description: 'Linear-foot & cubic surcharge alerts' },
        { title: 'Live SSE Progressive Streamer', href: `/quote/${sampleShipmentId}`, description: 'Real-time carrier latency & rate feed' },
      ],
    },
    {
      id: 'dispatch',
      title: 'Dispatch Operations',
      href: '/dispatch',
      icon: KanbanSquare,
      badge: '10 Stages',
      subFeatures: [
        { title: '10-Stage Kanban Board', href: '/dispatch', description: 'State machine from Unassigned to Settled' },
        { title: 'Digital VICS eBOL PDF', href: `/api/v1/shipments/${sampleShipmentId}/ebol?format=pdf`, isExternal: true, description: 'Printable bill of lading with GS1-128 barcode' },
        { title: 'Carrier Tender Desk', href: '/dispatch', description: 'Electronic tender dispatch & EDI 204/990' },
        { title: 'Milestone Tracking & EDI 214', href: '/dispatch', description: 'Real-time tracking webhook receiver' },
      ],
    },
    {
      id: 'pod',
      title: 'Driver Proof of Delivery',
      href: '/pod/demo-pod-token-2026',
      icon: Camera,
      badge: 'Geofenced',
      subFeatures: [
        { title: 'Driver Mobile PWA Portal', href: '/pod/demo-pod-token-2026', description: 'Frictionless mobile upload interface' },
        { title: 'GPS Haversine Geofence', href: '/pod/demo-pod-token-2026', description: '0.5-mile delivery location validation' },
        { title: 'HTML5 Signature Pad', href: '/pod/demo-pod-token-2026', description: 'Receiver touch & pen signature capture' },
        { title: 'Damage Exception Notations', href: '/pod/demo-pod-token-2026', description: 'OCR damaged cartons & shortage flagger' },
      ],
    },
    {
      id: 'invoices',
      title: 'Invoicing & Disputes',
      href: '/invoices',
      icon: FileText,
      badge: '14 Desks',
      subFeatures: [
        { title: 'Sub-60s Automated Billing', href: '/invoices', description: 'Instant invoice generation on clean POD' },
        { title: 'Carrier Re-Bill Audit (EDI 210)', href: '/invoices', description: 'Cross-audits carrier invoices vs original quote' },
        { title: '1-Click Dispute Generator', href: '/invoices', description: 'Carrier-specific dispute packages with evidence' },
        { title: '30-Day FMCSA SLA Tracker', href: '/invoices', description: 'Statutory 49 CFR § 370 claims timer' },
        { title: 'Supplemental Invoicing', href: '/invoices', description: 'Pass-through legitimate accessorials with markup' },
        { title: '20% Recovery Contingency Fees', href: '/invoices', description: 'Broker profit capture on won carrier disputes' },
        { title: 'Carrier Reliability Scorecards', href: '/invoices', description: 'Overcharge frequency & dispute win rates' },
        { title: 'S3 WORM Compliance Vault', href: '/invoices', description: '7-Year immutable Merkle root document lock' },
        { title: 'QuickBooks Online Sync', href: '/invoices', description: 'Automated double-entry general ledger sync' },
      ],
    },
    {
      id: 'quickpay',
      title: 'QuickPay Fintech Rails',
      href: '/quickpay',
      icon: DollarSign,
      badge: '2.5% Spread',
      subFeatures: [
        { title: 'Carrier 1-Click Payout Portal', href: '/quickpay/demo-qp-token-2026', description: 'Instant Same-Day RTP/FedNow & ACH' },
        { title: 'Fintech Management Desk', href: '/quickpay', description: 'Disbursement tracking & gross take-rates' },
        { title: 'FMCSA Safety & Fraud Gatekeeper', href: '/quickpay', description: 'Bank routing change & factoring NOA checks' },
        { title: 'Double-Entry Trial Balance', href: '/quickpay', description: 'Float liability & revenue ledger' },
        { title: 'Form 1099-NEC Tax Compliance', href: '/quickpay', description: 'Annual carrier tax statements & IRS exports' },
      ],
    },
    {
      id: 'analytics',
      title: 'Executive ROI Analytics',
      href: '/analytics',
      icon: TrendingUp,
      badge: 'Provable ROI',
      subFeatures: [
        { title: 'Continuous Economic Value', href: '/analytics', description: '4-Stream provable software & fintech ROI' },
        { title: 'Labor Hours Saved (@$35/hr)', href: '/analytics', description: 'Automated ingestion & billing labor savings' },
        { title: 'Split Linehaul Net Savings', href: '/analytics', description: 'Combinatorial freight savings captured' },
        { title: 'Dispute & QuickPay Spreads', href: '/analytics', description: 'Contingency fees and fintech fee revenue' },
        { title: 'Export Board Report PDF', href: '/api/v1/analytics/roi/pdf?periodDays=30', isExternal: true, description: 'Executive board-ready PDF audit summary' },
      ],
    },
    {
      id: 'shipper-portal',
      title: '1-Click Shipper Portal',
      href: '/quote/accept',
      icon: CheckCircle2,
      badge: 'Self-Serve',
      subFeatures: [
        { title: 'Shipper Quote Acceptance', href: '/quote/accept', description: 'Token-based instant price lock & booking' },
        { title: 'Click-Wrap Commercial Agreement', href: '/quote/accept', description: 'Digital terms of carriage confirmation' },
      ],
    },
  ];

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const isModuleActive = (module: NavModule) => {
    if (module.href === '/' && pathname === '/') return true;
    if (module.href !== '/' && pathname.startsWith(module.href.split('?')[0])) return true;
    return false;
  };

  const filteredModules = navModules.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesModule = m.title.toLowerCase().includes(q);
    const matchesSub = m.subFeatures.some(
      (sf) => sf.title.toLowerCase().includes(q) || (sf.description && sf.description.toLowerCase().includes(q))
    );
    return matchesModule || matchesSub;
  });

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-[#09090b] border-r border-[#27272a]/60 flex flex-col transition-all duration-200 ease-in-out select-none ${
        isCollapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Top Organization Header (Vercel style) */}
      <div className="h-16 px-3.5 border-b border-[#27272a]/60 flex items-center justify-between">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-950 border border-neutral-700/80 flex items-center justify-center flex-shrink-0 text-white font-mono font-bold text-xs shadow-inner">
              ⚡
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-sans font-bold text-xs text-white truncate tracking-tight">
                  Apex Freight OS
                </span>
                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-neutral-800/90 text-neutral-300 border border-neutral-700">
                  Enterprise
                </span>
              </div>
              <div className="text-[10px] text-neutral-400 font-sans truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Live Node (24 Tables)
              </div>
            </div>
            <button
              onClick={onToggleCollapse}
              className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800/60 transition"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="w-full flex items-center justify-center">
            <button
              onClick={onToggleCollapse}
              className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-700/80 flex items-center justify-center text-white hover:bg-neutral-800 transition"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Search / Find Filter Input */}
      {!isCollapsed && (
        <div className="p-3 border-b border-[#27272a]/40">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find feature, rate, tool..."
              className="w-full bg-[#121215] border border-neutral-800 rounded-lg pl-8 pr-8 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 font-sans focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition"
            />
            <span className="absolute right-2 top-2 text-[10px] font-mono text-neutral-500 bg-neutral-800 px-1 py-0.2 rounded">
              F
            </span>
          </div>
        </div>
      )}

      {/* Navigation Modules Accordion List */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {filteredModules.map((module) => {
          const Icon = module.icon;
          const isActive = isModuleActive(module);
          const isExpanded = expandedModules[module.id] || searchQuery.trim().length > 0;

          if (isCollapsed) {
            return (
              <Link
                key={module.id}
                href={module.href}
                className={`w-11 h-11 mx-auto rounded-lg flex items-center justify-center transition group relative ${
                  isActive
                    ? 'bg-[#1c1c21] text-white border border-neutral-700'
                    : 'text-neutral-400 hover:text-white hover:bg-[#141417]'
                }`}
                title={module.title}
              >
                <Icon className="w-4 h-4" />
                <div className="absolute left-14 bg-neutral-900 border border-neutral-700 text-white text-xs px-2.5 py-1 rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition z-50 font-sans font-medium">
                  {module.title}
                </div>
              </Link>
            );
          }

          return (
            <div key={module.id} className="rounded-lg overflow-hidden">
              {/* Parent Item Header */}
              <div
                className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-sans font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-[#18181b] text-white shadow-sm font-semibold'
                    : 'text-neutral-300 hover:text-white hover:bg-[#121215]'
                }`}
                onClick={() => toggleModule(module.id)}
              >
                <Link
                  href={module.href}
                  className="flex items-center gap-2.5 flex-1 min-w-0"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition ${
                      isActive ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200'
                    }`}
                  />
                  <span className="truncate">{module.title}</span>
                  {module.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/60 ml-auto mr-1">
                      {module.badge}
                    </span>
                  )}
                </Link>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleModule(module.id);
                  }}
                  className="p-1 text-neutral-500 hover:text-white transition rounded"
                  title="Toggle sub-features"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Expandable Sub-features Dropdown */}
              {isExpanded && (
                <div className="pl-6 pr-1 py-1 space-y-0.5 border-l border-neutral-800/80 ml-4 my-1">
                  {module.subFeatures.map((sf, idx) => {
                    const isSfActive = sf.href && (pathname === sf.href || pathname.startsWith(sf.href + '/'));

                    if (sf.isExternal && sf.href) {
                      return (
                        <a
                          key={idx}
                          href={sf.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-sans text-neutral-400 hover:text-white hover:bg-neutral-900 transition"
                        >
                          <span className="truncate">{sf.title}</span>
                          <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-neutral-300" />
                        </a>
                      );
                    }

                    return (
                      <Link
                        key={idx}
                        href={sf.href || module.href}
                        className={`block px-2 py-1.5 rounded text-[11px] font-sans transition ${
                          isSfActive
                            ? 'text-white font-semibold bg-neutral-800/70 border border-neutral-700/60'
                            : 'text-neutral-400 hover:text-white hover:bg-neutral-900/60'
                        }`}
                        title={sf.description}
                      >
                        <div className="truncate">{sf.title}</div>
                        {sf.description && (
                          <div className="text-[9px] text-neutral-500 truncate mt-0.5 font-normal">
                            {sf.description}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Footer Details */}
      {!isCollapsed ? (
        <div className="p-3 border-t border-[#27272a]/60 bg-[#0c0c0e]">
          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              API Latency: <strong className="text-white font-data">28ms</strong>
            </span>
            <span className="text-neutral-500">v3.8</span>
          </div>
          <div className="mt-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-300 font-sans">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-white text-black font-bold flex items-center justify-center text-[10px]">
                A
              </div>
              <span className="font-medium text-[11px] text-white">Apex Freight</span>
            </div>
            <span className="text-[10px] text-neutral-500 font-mono">Enterprise</span>
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-[#27272a]/60 flex justify-center">
          <span className="w-2 h-2 rounded-full bg-white" title="Connected to Supabase" />
        </div>
      )}
    </aside>
  );
};
