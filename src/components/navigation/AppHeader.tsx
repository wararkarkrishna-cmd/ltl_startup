'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Zap,
  Camera,
  FileText,
  ShieldCheck,
  ChevronRight,
  Terminal,
  Layers,
} from 'lucide-react';

export const AppHeader: React.FC<{
  isSidebarCollapsed: boolean;
}> = ({ isSidebarCollapsed }) => {
  const pathname = usePathname();

  const getBreadcrumbTitle = () => {
    if (pathname === '/') return 'Executive Command';
    if (pathname.startsWith('/review')) return 'RFQ Intake & High-Velocity Review';
    if (pathname.startsWith('/quote') && !pathname.includes('/accept')) return 'Multi-Carrier Rating & Split Optimizer';
    if (pathname.startsWith('/quote/accept')) return '1-Click Shipper Booking Portal';
    if (pathname.startsWith('/dispatch')) return 'Dispatch Kanban Operations';
    if (pathname.startsWith('/invoices')) return 'Invoicing, Disputes & Settlement Desk';
    if (pathname.startsWith('/quickpay')) return 'Embedded Carrier QuickPay Fintech';
    if (pathname.startsWith('/analytics')) return 'Executive ROI & Economic Value Telemetry';
    if (pathname.startsWith('/pod') || pathname.startsWith('/p/')) return 'Driver Geotagged Proof of Delivery';
    return 'LTL Freight Operating System';
  };

  const sampleShipmentId = '01916362-7901-7080-867c-9b8895092s01';

  return (
    <header
      className={`sticky top-0 z-30 h-14 bg-[#09090b]/90 backdrop-blur-md border-b border-[#27272a]/60 px-4 sm:px-6 flex items-center justify-between transition-all duration-200 ${
        isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-[19rem]'
      }`}
    >
      {/* Breadcrumbs / View Title */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-neutral-500 text-xs font-sans font-medium hidden sm:inline">
          Apex OS
        </span>
        <ChevronRight className="w-3 h-3 text-neutral-600 hidden sm:inline" />
        <h1 className="text-xs sm:text-sm font-sans font-semibold text-white truncate tracking-tight">
          {getBreadcrumbTitle()}
        </h1>
      </div>

      {/* Right Quick Action Rails in Minimal Monochrome */}
      <div className="flex items-center gap-2">
        <Link
          href="/quickpay/demo-qp-token-2026"
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans font-medium text-neutral-300 hover:text-white bg-[#121215] hover:bg-[#1c1c21] border border-neutral-800 rounded-lg transition"
        >
          <Zap className="w-3 h-3 text-white" />
          <span>QuickPay</span>
        </Link>

        <Link
          href="/pod/demo-pod-token-2026"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans font-medium text-neutral-300 hover:text-white bg-[#121215] hover:bg-[#1c1c21] border border-neutral-800 rounded-lg transition"
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

        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono text-neutral-300 bg-neutral-900 border border-neutral-800 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>LIVE PROD</span>
        </div>
      </div>
    </header>
  );
};
