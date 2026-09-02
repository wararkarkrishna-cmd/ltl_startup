'use client';

import React, { useState, Suspense } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';

export const AppShell: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#050507] text-[#f4f4f5] flex flex-col font-sans selection:bg-white selection:text-black">
      {/* Left Sidebar */}
      <Suspense fallback={<aside className="fixed top-0 left-0 bottom-0 z-40 bg-[#09090b] w-72 border-r border-[#27272a]/60" />}>
        <AppSidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      </Suspense>

      {/* Top Header */}
      <AppHeader isSidebarCollapsed={isSidebarCollapsed} />

      {/* Main Content Area */}
      <main
        className={`flex-1 transition-all duration-200 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-72'
        }`}
      >
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
