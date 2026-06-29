'use client';

import React, { useState } from 'react';
import { Map, Calendar, AlertTriangle, CheckCircle, Loader2, ArrowRight, X } from 'lucide-react';

export interface WorkSession {
  id: string;
  taskId: string;
  taskTitle: string;
  start: string; // e.g. "09:00" or ISO
  end: string; // e.g. "11:30" or ISO
  durationHours: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  focusDescription: string;
}

export interface ImpossibleTask {
  taskId: string;
  taskTitle: string;
  reason: string;
}

export interface WorkPlan {
  summary: string;
  totalHours: number;
  impossibleTasks?: ImpossibleTask[];
  days: {
    name: string; // e.g., "Monday, Jun 29"
    totalHours: number;
    sessions: WorkSession[];
  }[];
}

interface BattlePlanViewProps {
  plan: WorkPlan | null;
  loading: boolean;
  onSchedule: () => void;
  onClose: () => void;
}

export default function BattlePlanView({ plan, loading, onSchedule, onClose }: BattlePlanViewProps) {
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [calendarProgress, setCalendarProgress] = useState(0);
  const [totalSessionsToAdd, setTotalSessionsToAdd] = useState(0);
  const [addedSuccessfully, setAddedSuccessfully] = useState(false);

  // Loading Screen
  if (loading) {
    return (
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
          <Map className="w-5 h-5 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm uppercase tracking-wider font-bold text-white font-mono">
            CLUTCH is building your battle plan
          </h3>
          <p className="text-xs text-slate-400">
            Scanning Calendar availability & scheduling optimal focus slots...
          </p>
        </div>
        <div className="flex gap-1.5 items-center justify-center h-4">
          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    );
  }

  // Not Loaded / Prompt Screen
  if (!plan) {
    return (
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 text-center space-y-4 shadow-lg">
        <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center mx-auto shadow-md">
          <Map className="w-6 h-6 text-indigo-400" />
        </div>
        <div className="space-y-1 max-w-sm mx-auto">
          <h3 className="text-sm uppercase tracking-wider font-bold text-white font-sans">
            Chronological Battle Plan
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Generate an AI-driven schedule that maps all of your objectives into clear, distraction-free calendar blocks.
          </p>
        </div>
        <button
          onClick={onSchedule}
          className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/10"
        >
          <span>Generate Battle Plan</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Simulate Add to Calendar Flow
  const handleAddToCalendar = async () => {
    const flatSessions = plan.days.flatMap(d => d.sessions);
    if (flatSessions.length === 0) return;

    setAddingToCalendar(true);
    setCalendarProgress(0);
    setTotalSessionsToAdd(flatSessions.length);

    for (let i = 0; i <= flatSessions.length; i++) {
      await new Promise(res => setTimeout(res, 400));
      setCalendarProgress(i);
    }

    setAddingToCalendar(false);
    setAddedSuccessfully(true);
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const getPriorityColor = (p: 'critical' | 'high' | 'medium' | 'low') => {
    switch (p) {
      case 'critical': return 'border-rose-500/30 bg-rose-500/5 text-rose-400';
      case 'high': return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
      case 'medium': return 'border-indigo-500/30 bg-indigo-500/5 text-indigo-400';
      case 'low': return 'border-slate-500/30 bg-slate-500/5 text-slate-400';
    }
  };

  return (
    <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 md:p-6 space-y-6 shadow-xl relative animate-fade-in">
      
      {/* Close button */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-slate-500 hover:text-white transition cursor-pointer p-1 rounded hover:bg-white/5"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="p-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold uppercase rounded px-2 tracking-wider">
            Chronological Map
          </span>
          <span className="text-xs text-slate-500 font-mono">• {plan.totalHours}h Focus Booked</span>
        </div>
        <h2 className="text-lg font-extrabold text-white tracking-tight uppercase font-sans">
          Your Battle Plan
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed max-w-xl font-sans">
          {plan.summary}
        </p>
      </div>

      {/* Impossible Tasks Alert Panel */}
      {plan.impossibleTasks && plan.impossibleTasks.length > 0 && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2 text-rose-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
                Impossible Goals Detected
              </h4>
              <p className="text-[11px] text-slate-400">
                The following tasks cannot be completed within work hours prior to their deadlines:
              </p>
            </div>
          </div>
          
          <div className="space-y-2 pl-6">
            {plan.impossibleTasks.map((task, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-2 border-rose-500/20 pl-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">{task.taskTitle}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{task.reason}</p>
                </div>
                <button
                  onClick={() => alert(`Drafting an email to negotiate deadline expansion for "${task.taskTitle}"`)}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition underline tracking-wider cursor-pointer font-mono"
                >
                  Draft Extension Request
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day Group Lists */}
      <div className="space-y-6">
        {plan.days.map((day, idx) => (
          <div key={idx} className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
              <span className="text-xs font-bold text-slate-300 font-sans">{day.name}</span>
              <span className="text-[10px] text-slate-500 font-mono">{day.totalHours}h allocated</span>
            </div>

            <div className="space-y-2">
              {day.sessions.map((sess) => (
                <div 
                  key={sess.id} 
                  className={`border rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0A0A0F]/60 ${getPriorityColor(sess.priority)}`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-black/30 px-1.5 py-0.5 rounded border border-white/5">
                        {sess.priority}
                      </span>
                      <h4 className="text-xs font-bold text-white font-sans">{sess.taskTitle}</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-normal">{sess.focusDescription}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-slate-500 font-mono bg-black/10 px-2 py-1 rounded border border-slate-800/40">
                      {sess.start} - {sess.end}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-800/40 px-2 py-0.5 rounded-full">
                      {sess.durationHours}h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Addition Progress / Trigger Section */}
      <div className="border-t border-slate-800/60 pt-5 flex flex-col gap-4">
        {addingToCalendar && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono font-bold text-slate-400">
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                Adding focus sessions...
              </span>
              <span>{calendarProgress} of {totalSessionsToAdd}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(calendarProgress / totalSessionsToAdd) * 100}%` }}
              />
            </div>
          </div>
        )}

        {addedSuccessfully && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Success! All sessions have been scheduled on your Google Calendar.</span>
          </div>
        )}

        {!addingToCalendar && !addedSuccessfully && (
          <button
            onClick={handleAddToCalendar}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/10"
          >
            <Calendar className="w-4 h-4" />
            <span>Add All to Calendar</span>
          </button>
        )}
      </div>

    </div>
  );
}
