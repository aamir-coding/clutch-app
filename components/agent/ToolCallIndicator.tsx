'use client';

import React from 'react';
import { Loader2, CheckCircle } from 'lucide-react';

interface ToolCall {
  name: string;
  status: 'running' | 'done';
  summary: string;
}

interface ToolCallIndicatorProps {
  toolCalls: ToolCall[];
}

export default function ToolCallIndicator({ toolCalls }: ToolCallIndicatorProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  const getLabel = (name: string) => {
    switch (name) {
      case 'scan_calendar': return '📅 Scanning calendar';
      case 'find_free_slots': return '🔍 Finding free slots';
      case 'schedule_work_session': return '📌 Scheduling session';
      case 'get_all_tasks': return '📋 Loading tasks';
      case 'add_task': return '✅ Adding task';
      case 'update_task_progress': return '✏️ Updating progress';
      case 'analyze_deadline_risk': return '⚡ Analyzing risk';
      case 'scan_gmail_for_deadlines': return '📧 Scanning Gmail';
      case 'draft_email': return '✉️ Drafting email';
      case 'activate_crisis_mode': return '🚨 Activating Crisis Mode';
      case 'generate_battle_plan': return '🗓 Building battle plan';
      default: return `⚙️ Running ${name}`;
    }
  };

  return (
    <div className="animate-fade-in space-y-1.5 mb-2">
      {toolCalls.map((call, idx) => (
        <div key={idx} className="flex flex-row items-center gap-2 text-xs">
          {call.status === 'running' ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
              <span className="text-indigo-400">{getLabel(call.name)}</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-3 h-3 text-emerald-500" />
              <span className="text-slate-400">{getLabel(call.name)}</span>
              {call.summary && (
                <span className="text-slate-600 truncate max-w-[50px] sm:max-w-[200px]">
                  - {call.summary.length > 50 ? call.summary.substring(0, 50) + '...' : call.summary}
                </span>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
