'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Zap,
  Camera,
  FileText,
  ChevronRight,
  Search,
  Command,
  X,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Truck,
  KanbanSquare,
  DollarSign,
  FileCheck2,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

interface AppHeaderProps {
  isSidebarCollapsed?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ isSidebarCollapsed = false }) => {

  const pathname = usePathname();
  const router = useRouter();
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getBreadcrumbTitle = () => {
    if (pathname === '/') return 'Executive Command';
    if (pathname.startsWith('/integration')) return '1-Minute Integration & Onboarding Hub';
    if (pathname.startsWith('/login')) return 'Broker Sign In & Authentication';
    if (pathname.startsWith('/review')) return 'RFQ Fast Review Desk';
    if (pathname.startsWith('/quote') && !pathname.includes('/accept')) return 'Multi-Carrier Rating & Split Optimizer';
    if (pathname.startsWith('/quote/accept')) return '1-Click Shipper Booking';
    if (pathname.startsWith('/dispatch')) return 'Dispatch Operations Kanban';
    if (pathname.startsWith('/invoices')) return 'Invoicing & Dispute Desk';
    if (pathname.startsWith('/quickpay')) return 'Carrier QuickPay Fintech';
    if (pathname.startsWith('/analytics')) return 'Executive Financial ROI Audit';
    if (pathname.startsWith('/pod') || pathname.startsWith('/p/')) return 'Driver Geotagged POD';
    return 'LTL Freight Operating System';
  };

  const sampleShipmentId = '01916362-7901-7080-867c-9b8895092s01';

  // Global Keyboard Shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSpotlightOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isSpotlightOpen) {
        setIsSpotlightOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSpotlightOpen]);

  const spotlightItems = [
    {
      id: 'dash',
      title: 'Executive Command OS',
      category: 'Overview',
      shortcut: '0',
      href: '/',
      icon: Truck,
      desc: 'All systems live bento dashboard & phase simulators',
    },
    {
      id: 'p1',
      title: 'Phase 1: RFQ Fast Review Desk',
      category: 'Intake',
      shortcut: '1',
      href: `/review/${sampleShipmentId}`,
      icon: FileCheck2,
      desc: '15-second dual-pane keyboard audit & 11-tier NMFC classification',
    },
    {
      id: 'p2',
      title: 'Phase 2: Multi-Carrier Rating & Split',
      category: 'Pricing',
      shortcut: '2',
      href: `/quote/${sampleShipmentId}`,
      icon: Zap,
      desc: 'Direct BYOC tariffs vs wholesale contracts with knapsack split optimizer',
    },
    {
      id: 'p3',
      title: 'Phase 3: Dispatch Kanban Board',
      category: 'Operations',
      shortcut: '3',
      href: '/dispatch',
      icon: KanbanSquare,
      desc: '10-stage lifecycle state machine with GS1-128 eBOL generation',
    },
    {
      id: 'p4',
      title: 'Phase 4: Geotagged Proof of Delivery',
      category: 'Delivery',
      shortcut: '4',
      href: '/pod/demo-pod-token-2026',
      icon: Camera,
      desc: 'Driver mobile PWA with 0.5-mile GPS Haversine verification',
    },
    {
      id: 'p5',
      title: 'Phase 5: Invoicing & Dispute Desk',
      category: 'Settlement',
      shortcut: '5',
      href: '/invoices',
      icon: DollarSign,
      desc: 'Sub-60s customer billing, carrier re-bill audits & 30-day FMCSA claims',
    },
    {
      id: 'p6',
      title: 'Phase 6: Carrier QuickPay Fintech',
      category: 'Fintech',
      shortcut: '6',
      href: '/quickpay',
      icon: Zap,
      desc: 'Instant same-day RTP/FedNow settlement with 2.5% take-rate spread',
    },
    {
      id: 'roi',
      title: 'Executive Financial ROI Audit',
      category: 'Analytics',
      shortcut: '7',
      href: '/analytics',
      icon: TrendingUp,
      desc: '4-stream provable economic value attribution & board reporting',
    },
    {
      id: 'shipper',
      title: '1-Click Shipper Booking Portal',
      category: 'Shipper',
      shortcut: '8',
      href: '/quote/accept',
      icon: ArrowRight,
      desc: 'Instant quote acceptance with HMAC-SHA256 token verification',
    },
  ];

  const filteredSpotlight = spotlightItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectItem = (href: string) => {
    setIsSpotlightOpen(false);
    setSearchQuery('');
    router.push(href);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-30 h-14 bg-[#09090b]/90 backdrop-blur-md border-b border-[#27272a]/60 px-4 sm:px-6 flex items-center justify-between transition-all duration-200 ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-[19rem]'
        }`}
      >
        {/* Left: View Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-neutral-500 text-xs font-sans font-medium hidden sm:inline">
            Apex OS
          </span>
          <ChevronRight className="w-3 h-3 text-neutral-600 hidden sm:inline" />
          <h1 className="text-xs sm:text-sm font-sans font-semibold text-white truncate tracking-tight">
            {getBreadcrumbTitle()}
          </h1>
        </div>

        {/* Center: Sleek Quick Jump Pill (⌘K Spotlight) */}
        <button
          onClick={() => setIsSpotlightOpen(true)}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#121215] hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white text-xs font-sans transition shadow-sm"
        >
          <Search className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-[11px]">Quick Jump...</span>
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-900 border border-neutral-700 text-neutral-400">
            ⌘K
          </kbd>
        </button>

        {/* Right: Essential Minimal Actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/quickpay/demo-qp-token-2026"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans font-medium text-neutral-300 hover:text-white bg-[#121215] hover:bg-neutral-800 border border-neutral-800 rounded-lg transition"
          >
            <Zap className="w-3 h-3 text-white" />
            <span>QuickPay</span>
          </Link>

          <Link
            href="/pod/demo-pod-token-2026"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans font-medium text-neutral-300 hover:text-white bg-[#121215] hover:bg-neutral-800 border border-neutral-800 rounded-lg transition"
          >
            <Camera className="w-3 h-3 text-neutral-400" />
            <span>Driver POD</span>
          </Link>

          <a
            href={`/api/v1/shipments/${sampleShipmentId}/ebol?format=pdf`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans font-medium text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 rounded-lg transition shadow-sm"
          >
            <FileText className="w-3 h-3 text-neutral-300" />
            <span>eBOL PDF</span>
          </a>

          <button
            onClick={() => setIsSpotlightOpen(true)}
            className="sm:hidden p-1.5 rounded-lg bg-[#121215] border border-neutral-800 text-neutral-400 hover:text-white"
            title="Open Search (Cmd+K)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Modern Spotlight / Quick Jump Command Modal */}
      {isSpotlightOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl space-y-0">
            {/* Search Input Box */}
            <div className="p-4 border-b border-[#27272a] flex items-center gap-3 bg-[#121215]/80">
              <Search className="w-4 h-4 text-neutral-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Jump to any phase, desk, or tool..."
                className="w-full bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none font-sans"
              />
              <button
                onClick={() => setIsSpotlightOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Navigation Items */}
            <div className="max-h-96 overflow-y-auto p-2 divide-y divide-neutral-900 custom-scrollbar">
              {filteredSpotlight.length > 0 ? (
                filteredSpotlight.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item.href)}
                      className="w-full text-left p-3 rounded-2xl hover:bg-[#121215] transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#18181b] border border-neutral-800 flex items-center justify-center text-white shrink-0 group-hover:border-neutral-600 transition">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white group-hover:text-neutral-100 transition truncate">
                              {item.title}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                              {item.category}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {item.desc}
                          </div>
                        </div>
                      </div>

                      <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-white transition shrink-0 ml-2" />
                    </button>
                  );
                })
              ) : (
                <div className="p-8 text-center text-neutral-500 text-xs italic">
                  No matching features found for &quot;{searchQuery}&quot;
                </div>
              )}
            </div>

            {/* Footer Tip */}
            <div className="p-3 bg-[#0c0c0e] border-t border-[#27272a] flex items-center justify-between text-[11px] text-neutral-500 font-mono">
              <span>ProTip: Press <kbd className="px-1 py-0.2 bg-neutral-900 border border-neutral-700 rounded text-neutral-300">Esc</kbd> to close</span>
              <span>Apex OS v3.8</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
