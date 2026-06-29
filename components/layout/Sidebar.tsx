'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Zap,
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  Calendar,
  BarChart2,
  Settings2,
  LogOut,
} from 'lucide-react';
import { useUiStore } from '@/lib/stores/uiStore';
import { useAuth } from '@/components/layout/AuthProvider';

export function Sidebar() {
  const sidebarExpanded = useUiStore((state) => state.sidebarExpanded);
  const setSidebarExpanded = useUiStore((state) => state.setSidebarExpanded);
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Chat', icon: MessageSquare, href: '/chat' },
    { label: 'Tasks', icon: CheckSquare, href: '/tasks' },
    { label: 'Timeline', icon: Calendar, href: '/timeline' },
    { label: 'Analytics', icon: BarChart2, href: '/analytics' },
    { label: 'Settings', icon: Settings2, href: '/settings' },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-screen z-40 bg-[#12121A] border-r border-[#1E1E2E] transition-all duration-200 ease-in-out flex flex-col ${
        sidebarExpanded ? 'w-60' : 'w-16'
      }`}
      onMouseEnter={() => setSidebarExpanded(true)}
      onMouseLeave={() => setSidebarExpanded(false)}
      id="app-sidebar"
    >
      {/* Header section */}
      <div className="py-4 px-3 flex items-center gap-3 border-b border-[#1E1E2E]/50 h-14" id="sidebar-header">
        <Zap className="w-8 h-8 text-indigo-500 flex-shrink-0" />
        {sidebarExpanded && (
          <span className="text-white font-bold text-lg tracking-wider animate-fade-in" id="sidebar-logo-text">
            CLUTCH
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto overflow-x-hidden" id="sidebar-nav">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 ${
                isActive
                  ? 'bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
              id={`sidebar-link-${item.label.toLowerCase()}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {sidebarExpanded && (
                <span className="text-sm font-medium animate-fade-in whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="py-4 px-3 border-t border-[#1E1E2E]/50 flex items-center gap-3 bg-[#0D0D14]" id="sidebar-footer">
        <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-indigo-500/30 flex-shrink-0 flex items-center justify-center" id="sidebar-avatar-container">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="bg-indigo-600 text-white text-xs font-bold w-full h-full flex items-center justify-center">
              {user?.displayName ? user.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
            </div>
          )}
        </div>

        {sidebarExpanded && (
          <div className="flex flex-col flex-1 min-w-0 animate-fade-in" id="sidebar-user-info">
            <span className="text-xs font-medium text-slate-200 truncate">
              {user?.displayName || 'User'}
            </span>
            <button
              onClick={() => signOut()}
              className="text-left text-slate-500 hover:text-red-400 text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
              id="sidebar-signout-btn-footer"
            >
              <LogOut size={10} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
export default Sidebar;
