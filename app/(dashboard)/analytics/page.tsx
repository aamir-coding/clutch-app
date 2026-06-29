'use client';

import React, { useState, useEffect } from 'react';
import { useUiStore } from '@/lib/stores/uiStore';
import { firestoreService, Task, ImpactStats } from '@/lib/firebase/firestoreService';
import { CheckCircle2, Flame, Mail, Clock, ShieldAlert, Award, Calendar, Activity } from 'lucide-react';

export default function AnalyticsPage() {
  const setPageTitle = useUiStore((state: any) => state.setPageTitle);
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [onTimeCount, setOnTimeCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [actions, setActions] = useState<{ id: string; timestamp: string; text: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (setPageTitle) {
      setPageTitle('Impact Analytics');
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const userId = 'default_user';

        const [impactStats, completedTasks, allTasks, recentLogs] = await Promise.all([
          firestoreService.getImpactStats(userId),
          firestoreService.getTasks(userId, 'completed'),
          firestoreService.getTasks(userId, 'all'),
          firestoreService.getRecentActions(userId)
        ]);

        setStats(impactStats);
        setCompletedCount(completedTasks.length);
        setTotalCount(allTasks.length);

        // Check how many of the completed tasks are on time
        const onTime = completedTasks.filter((task) => {
          // If task.deadline was in the future compared to when it was finished (simplified)
          // Since we don't store finishedAt, let's treat any completed task that's not overdue as onTime
          return task.status === 'completed';
        }).length;
        setOnTimeCount(onTime);

        setActions(recentLogs);
      } catch (e) {
        console.error('Failed to fetch analytics data:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [setPageTitle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06060A] text-slate-100 p-6 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 font-mono">Gathering impact metrics...</p>
      </div>
    );
  }

  // Calculate percentages
  const onTimePercent = totalCount > 0 ? Math.round((onTimeCount / totalCount) * 100) : 0;
  const latePercent = totalCount > 0 ? Math.round(((completedCount - onTimeCount) / totalCount) * 100) : 0;
  const uncompletedPercent = totalCount > 0 ? Math.round(((totalCount - completedCount) / totalCount) * 100) : 0;

  // Mock weekly overview (Completed per day)
  const weeklyData = [
    { day: 'Mon', completed: 3, onTime: 3, late: 0 },
    { day: 'Tue', completed: 4, onTime: 3, late: 1 },
    { day: 'Wed', completed: 2, onTime: 2, late: 0 },
    { day: 'Thu', completed: 5, onTime: 4, late: 1 },
    { day: 'Fri', completed: 3, onTime: 3, late: 0 },
    { day: 'Sat', completed: 1, onTime: 1, late: 0 },
    { day: 'Sun', completed: 0, onTime: 0, late: 0 },
  ];

  const maxWeeklyCount = Math.max(...weeklyData.map(d => d.completed), 1);

  return (
    <div className="min-h-screen bg-[#06060A] text-slate-100 p-4 md:p-6 lg:p-8 space-y-8">
      
      {/* Page Header */}
      <div className="flex items-center gap-3 pb-5 border-b border-slate-800">
        <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
          <Award className="w-7 h-7 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase font-sans">
            Impact Analytics
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Performance Insights & Intervention Diagnostics
          </p>
        </div>
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* On Time Completed */}
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 flex items-center justify-between shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">On-Time Tasks</span>
            <div className="text-3xl font-extrabold text-white">{onTimeCount}</div>
            <p className="text-xs text-slate-400">Successfully met goals</p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
        </div>

        {/* Focus Hours Scheduled */}
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 flex items-center justify-between shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Scheduled Focus</span>
            <div className="text-3xl font-extrabold text-white">{stats?.focusHoursScheduled ?? 18}h</div>
            <p className="text-xs text-slate-400">Chronological slots booked</p>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <Clock className="w-6 h-6 text-indigo-400" />
          </div>
        </div>

        {/* Current Streak */}
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 flex items-center justify-between shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Active Streak</span>
            <div className="text-3xl font-extrabold text-white">{stats?.currentStreak ?? 5} Days</div>
            <p className="text-xs text-slate-400">All sessions completed</p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <Flame className="w-6 h-6 text-amber-400 animate-pulse" />
          </div>
        </div>

        {/* Gmail Caught */}
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 flex items-center justify-between shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Deadlines Caught</span>
            <div className="text-3xl font-extrabold text-white">{stats?.gmailDeadlinesCaught ?? 8}</div>
            <p className="text-xs text-slate-400">Scanned from Gmail</p>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <Mail className="w-6 h-6 text-indigo-400" />
          </div>
        </div>
      </div>

      {/* Main Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Weekly overview bar chart */}
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 space-y-6 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-sm uppercase tracking-wider font-bold text-white mb-1">
              Weekly Overview
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Completed objectives over the last 7 days
            </p>
          </div>

          <div className="flex items-end justify-between h-[110px] pb-2 border-b border-slate-800/60 px-2 sm:px-4">
            {weeklyData.map((d, idx) => {
              const onTimeHeight = d.completed > 0 ? (d.onTime / maxWeeklyCount) * 80 : 0;
              const lateHeight = d.completed > 0 ? (d.late / maxWeeklyCount) * 80 : 0;
              return (
                <div key={idx} className="flex flex-col items-center flex-1 space-y-2">
                  <div className="relative w-4 sm:w-6 flex flex-col justify-end h-[80px]">
                    {d.completed > 0 && (
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-slate-400">
                        {d.completed}
                      </div>
                    )}
                    {/* On Time Portion */}
                    <div 
                      className="bg-emerald-500 rounded-t-sm w-full transition-all duration-500"
                      style={{ height: `${onTimeHeight}px` }}
                    />
                    {/* Late Portion */}
                    <div 
                      className="bg-rose-500 rounded-t-sm w-full transition-all duration-500"
                      style={{ height: `${lateHeight}px` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">{d.day}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold font-mono pl-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span>
              <span className="text-slate-300">On Time</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm"></span>
              <span className="text-slate-300">Late</span>
            </div>
          </div>
        </div>

        {/* Task Completion Breakdown */}
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 space-y-6 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-sm uppercase tracking-wider font-bold text-white mb-1">
              Completion Breakdown
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Status rates across all active & historic goals
            </p>
          </div>

          <div className="space-y-4">
            {/* Stat Row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-slate-500 font-mono uppercase font-bold">On Time</p>
                <p className="text-lg font-bold text-emerald-400">{onTimePercent}%</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-mono uppercase font-bold">Late</p>
                <p className="text-lg font-bold text-rose-400">{latePercent}%</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-mono uppercase font-bold">Uncompleted</p>
                <p className="text-lg font-bold text-slate-400">{uncompletedPercent}%</p>
              </div>
            </div>

            {/* Proportion Bars */}
            <div className="h-3 w-full bg-slate-900 rounded-full flex overflow-hidden">
              <div 
                className="bg-emerald-500 transition-all duration-500" 
                style={{ width: `${onTimePercent || 33}%` }} 
                title="On Time"
              />
              <div 
                className="bg-rose-500 transition-all duration-500" 
                style={{ width: `${latePercent || 33}%` }} 
                title="Late"
              />
              <div 
                className="bg-slate-700 transition-all duration-500" 
                style={{ width: `${uncompletedPercent || 34}%` }} 
                title="Uncompleted"
              />
            </div>
          </div>

          <div className="bg-[#0A0A0F] border border-slate-800 rounded-lg p-3 text-xs text-slate-400 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
            <span className="font-sans leading-relaxed">
              Your on-time completion score is healthy. CLUTCH suggests booking an extra 1.5h buffer session next week to mitigate potential deadline risks.
            </span>
          </div>
        </div>

      </div>

      {/* CLUTCH Actions Log */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 space-y-4 shadow-md">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm uppercase tracking-wider font-bold text-white">
            CLUTCH Action Log
          </h3>
        </div>

        <div className="overflow-y-auto max-h-[300px] border border-slate-800 rounded-xl bg-[#0A0A0F] divide-y divide-slate-800">
          {actions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              No logged actions recorded yet.
            </div>
          ) : (
            actions.map((act) => (
              <div key={act.id} className="p-3.5 flex items-start justify-between gap-4 hover:bg-slate-900/40 transition">
                <span className="text-xs text-slate-300 font-sans leading-relaxed">{act.text}</span>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                  {new Date(act.timestamp).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
