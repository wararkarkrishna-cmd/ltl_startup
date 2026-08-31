'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Truck,
  LayoutDashboard,
  FileCheck2,
  Zap,
  KanbanSquare,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Ship,
  Database,
} from 'lucide-react';

export const TopNavbar: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Executive Dashboard',
      href: '/',
      icon: LayoutDashboard,
      active: pathname === '/',
    },
    {
      label: 'RFQ Fast Review',
      href: '/review/01916362-7901-7080-867c-9b8895092s01',
      icon: FileCheck2,
      active: pathname.startsWith('/review'),
    },
    {
      label: 'Multi-Carrier Rating & Split',
      href: '/quote/01916362-7901-7080-867c-9b8895092s01',
      icon: Zap,
      active: pathname.startsWith('/quote') && !pathname.includes('/accept'),
    },
    {
      label: 'Dispatch Kanban',
      href: '/dispatch',
      icon: KanbanSquare,
      active: pathname.startsWith('/dispatch'),
    },
    {
      label: '1-Click Shipper Portal',
      href: '/quote/accept',
      icon: CheckCircle2,
      active: pathname.startsWith('/quote/accept'),
    },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-emerald-500 to-teal-400 p-0.5 shadow-lg group-hover:scale-105 transition">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Truck className="w-5 h-5 text-emerald-400 group-hover:text-indigo-400 transition" />
                </div>
              </div>
              <div>
                <div className="font-black text-base text-white tracking-tight flex items-center gap-1.5">
                  APEX <span className="text-emerald-400 font-mono">LTL OS</span>
                  <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    v3.8
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Supabase (24 Tables)
                </div>
              </div>
            </Link>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    item.active
                      ? 'bg-slate-800/90 text-emerald-400 border border-emerald-500/30 shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900/80 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${item.active ? 'text-emerald-400' : 'text-slate-400'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5">
            <a
              href="/api/v1/shipments/01916362-7901-7080-867c-9b8895092s01/ebol?format=pdf"
              target="_blank"
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition shadow"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              eBOL PDF
            </a>
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Apex Freight LLC
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
