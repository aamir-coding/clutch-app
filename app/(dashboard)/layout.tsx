'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUiStore } from '@/lib/stores/uiStore';
import { useAuth } from '@/components/layout/AuthProvider';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { ShieldAlert, Zap, LayoutGrid, Award, MessageSquare, Calendar, Settings } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const pageTitle = useUiStore((state: any) => state.pageTitle);
  const { user } = useAuth();

  const navItems = [
    { name: 'Command Center', href: '/dashboard', icon: LayoutGrid },
    { name: 'Calendar Timeline', href: '/timeline', icon: Calendar },
    { name: 'CLUTCH Agent', href: '/chat', icon: MessageSquare },
    { name: 'Impact Analytics', href: '/analytics', icon: Award },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <AuthGuard>
      <div className="flex h-screen w-full overflow-hidden bg-[#06060A] text-slate-150">

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-[#0A0A0F] border-r border-[#1E1E2E] shrink-0 h-full justify-between">
          <div className="flex flex-col flex-1 p-5 space-y-8">
            {/* Logo Brand Header */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-sm">
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-widest text-white font-sans uppercase">
                  CLUTCH
                </h2>
                <span className="text-[9px] text-slate-500 uppercase font-mono tracking-wider font-semibold">
                  Risk Controller
                </span>
              </div>
            </div>

            {/* Nav Links */}
            <nav className="flex flex-col space-y-1.5 flex-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition duration-150 border
                      ${isActive
                        ? 'bg-indigo-600/10 text-white border-indigo-500/25 shadow-inner'
                        : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-450'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Workspace Info Footer */}
          <div className="p-5 border-t border-slate-800/40 bg-[#08080C] text-center">
            <p className="text-[10px] text-slate-500 font-mono uppercase truncate">{user?.email || 'Signed in'}</p>
            <p className="text-[8px] text-slate-600 font-mono mt-0.5">ESTABLISHED PRO SESSION</p>
          </div>
        </aside>

        {/* Main Layout Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">

          {/* Mobile Navigation Header */}
          <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0A0A0F] border-b border-[#1E1E2E] shrink-0">
            <div className="flex items-center gap-2">
              <Zap className="w-4.5 h-4.5 text-indigo-400" />
              <h1 className="text-xs font-black text-white uppercase tracking-widest">{pageTitle}</h1>
            </div>

            <nav className="flex items-center gap-1 bg-[#12121A] border border-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-2.5 py-1 rounded-md transition ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    title={item.name}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </Link>
                );
              })}
            </nav>
          </header>

          {/* Active Workspace Title Bar (Desktop only) */}
          <header className="hidden md:flex items-center justify-between px-6 py-4.5 bg-[#06060A] border-b border-slate-900 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">
                WORKSPACE: {pageTitle}
              </span>
            </div>
          </header>

          {/* Scrollable View Content */}
          <main className="flex-1 overflow-y-auto bg-[#06060A]">
            {children}
          </main>

        </div>

      </div>
    </AuthGuard>
  );
}