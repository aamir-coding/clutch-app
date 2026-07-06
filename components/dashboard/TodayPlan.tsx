'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { formatTimeRange } from '@/lib/utils/formatDate';

export interface TaskSession {
  id: string;
  taskId: string;
  taskTitle: string;
  start: string;
  end: string;
  durationHours: number;
  status: 'scheduled' | 'completed' | 'missed';
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
}

interface TodayPlanProps {
  sessions: TaskSession[];
  events: CalendarEvent[];
  workStart: string;
  workEnd: string;
}

export default function TodayPlan({ sessions, events, workStart, workEnd }: TodayPlanProps) {
  /**
   * Combine focus sessions and calendar events into a single chronological list.
   * formatTimeRange uses date-fns format() so server and client render the
   * same string — avoiding React hydration warnings from toLocaleTimeString().
   */
  const items = [
    ...sessions.map((s) => ({
      id:        s.id,
      title:     s.taskTitle,
      time:      formatTimeRange(new Date(s.start), new Date(s.end)),
      isSession: true,
      duration:  `${s.durationHours}h`,
    })),
    ...events.map((e) => ({
      id:        e.id,
      title:     e.summary,
      time:      formatTimeRange(new Date(e.start), new Date(e.end)),
      isSession: false,
      duration:  '',
    })),
  ].sort((a, b) => {
    // Sort chronologically using the underlying source objects
    const aSession = sessions.find(s => s.id === a.id);
    const aEvent   = events.find(e => e.id === a.id);
    const bSession = sessions.find(s => s.id === b.id);
    const bEvent   = events.find(e => e.id === b.id);

    const aStart = aSession ? new Date(aSession.start).getTime() : aEvent ? new Date(aEvent.start).getTime() : 0;
    const bStart = bSession ? new Date(bSession.start).getTime() : bEvent ? new Date(bEvent.start).getTime() : 0;
    return aStart - bStart;
  });

  return (
    <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 space-y-4 shadow-lg">
      <div className="flex justify-between items-center pb-2 border-b border-slate-800/40">
        <h2 className="text-xs uppercase tracking-wider font-bold text-slate-400">
          Today&apos;s Battle Plan
        </h2>
        <span className="text-[10px] text-slate-500 font-mono">
          {workStart} – {workEnd}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 space-y-2 bg-[#0A0A0F]/40 border border-[#1E1E2E]/40 rounded-lg p-4">
          <Calendar className="w-5 h-5 text-slate-650 mx-auto" />
          <p className="text-xs text-slate-400 font-medium">No schedule items today</p>
          <p className="text-[10px] text-slate-500 font-mono">
            Generate a Battle Plan to schedule focus slots automatically.
          </p>
        </div>
      ) : (
        <div className="relative border-l border-slate-800 pl-4 space-y-4">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="relative group">
              {/* Timeline dot */}
              <div
                className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border border-black transition duration-200
                  ${item.isSession
                    ? 'bg-indigo-500 ring-4 ring-indigo-500/10'
                    : 'bg-emerald-500 ring-4 ring-emerald-500/10'
                  }
                `}
              />

              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 font-mono block">
                  {item.time}{item.duration && ` (Effort: ${item.duration})`}
                </span>
                <h4
                  className={`text-xs font-bold leading-relaxed
                    ${item.isSession ? 'text-white font-sans' : 'text-slate-400 font-sans'}
                  `}
                >
                  {item.isSession ? `⚡ Focus Slot: ${item.title}` : item.title}
                </h4>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}