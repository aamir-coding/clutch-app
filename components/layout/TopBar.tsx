'use client';

import React from 'react';
import { Loader2, Bell } from 'lucide-react';
import { useUiStore } from '@/lib/stores/uiStore';

export function TopBar() {
  const pageTitle = useUiStore((state) => state.pageTitle);
  const agentThinking = useUiStore((state) => state.agentThinking);
  const notificationCount = useUiStore((state) => state.notificationCount);
  const clearNotifications = useUiStore((state) => state.clearNotifications);

  return (
    <header className="fixed top-0 right-0 left-0 h-14 bg-[#12121A]/80 backdrop-blur-sm border-b border-[#1E1E2E] z-30 flex items-center px-6 gap-4" id="app-topbar">
      {/* Page Title */}
      <div className="flex items-center" id="topbar-title-container">
        <h1 className="text-white font-semibold text-lg tracking-tight" id="topbar-page-title">
          {pageTitle}
        </h1>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Agent Thinking Indicator */}
      {agentThinking && (
        <div
          className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-indigo-400 text-xs animate-pulse"
          id="topbar-thinking-chip"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>CLUTCH is thinking...</span>
        </div>
      )}

      {/* Notification Bell */}
      <button
        onClick={clearNotifications}
        className="relative p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        aria-label="Notifications"
        id="topbar-notification-btn"
      >
        <Bell className="w-5 h-5" />
        {notificationCount > 0 && (
          <span
            className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"
            id="topbar-notification-badge"
          />
        )}
      </button>

      {/* Active Status Chip */}
      <div
        className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-xs px-3 py-1 rounded-full border border-emerald-500/20 font-mono"
        id="topbar-status-chip"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>⚡ Active</span>
      </div>
    </header>
  );
}

export default TopBar;
