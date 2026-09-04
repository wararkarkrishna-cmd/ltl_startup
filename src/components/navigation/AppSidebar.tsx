'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  KanbanSquare,
  DollarSign,
  Plug,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface NavModule {
  id: string;
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

export const AppSidebar: React.FC<{
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}> = ({ isCollapsed, onToggleCollapse }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('apex_logged_in');
    }
    router.push('/login');
  };

  const navModules: NavModule[] = [
    {
      id: 'overview',
      title: 'Quoting & Overview',
      href: '/',
      icon: LayoutDashboard,
    },
    {
      id: 'dispatch',
      title: 'Dispatch & Capacity',
      href: '/dispatch',
      icon: KanbanSquare,
    },
    {
      id: 'invoices',
      title: 'Financial Center',
      href: '/invoices',
      icon: DollarSign,
    },
    {
      id: 'integration',
      title: 'System Integration',
      href: '/integration',
      icon: Plug,
    },
  ];

  const isModuleActive = (module: NavModule) => {
    if (module.href === '/' && pathname === '/') return true;
    if (module.href !== '/' && pathname.startsWith(module.href.split('?')[0])) return true;
    return false;
  };

  const filteredModules = navModules.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return m.title.toLowerCase().includes(q);
  });

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-[#09090b] border-r border-[#27272a]/60 flex flex-col transition-all duration-200 ease-in-out select-none ${
        isCollapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Top Organization Header */}
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

      {/* Search / Filter Input */}
      {!isCollapsed && (
        <div className="p-3 border-b border-[#27272a]/40">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter menu..."
              className="w-full bg-[#121215] border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 font-sans focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition"
            />
          </div>
        </div>
      )}

      {/* Navigation Modules */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {filteredModules.map((module) => {
          const Icon = module.icon;
          const isActive = isModuleActive(module);

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
            <Link
              key={module.id}
              href={module.href}
              className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-sans transition ${
                isActive
                  ? 'bg-[#18181b] text-white font-semibold shadow-sm border border-neutral-700/80'
                  : 'text-neutral-300 hover:text-white hover:bg-[#121215]'
              }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 transition ${
                  isActive ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200'
                }`}
              />
              <span className="truncate">{module.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Footer */}
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
            <button
              onClick={handleSignOut}
              className="text-[10px] text-neutral-400 hover:text-white font-mono underline transition"
              title="Sign Out & Return to Login"
            >
              Sign Out
            </button>
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
