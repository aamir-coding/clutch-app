'use client';

import React, { useState, useEffect } from 'react';
import { useUiStore } from '@/lib/stores/uiStore';
import { useAuth } from '@/components/layout/AuthProvider';
import { firestoreService } from '@/lib/firebase/firestore';
import { ImpactStats, Task } from '@/lib/types';
import { CheckCircle2, Flame, Clock, ShieldAlert, Award, Activity } from 'lucide-react';

export default function AnalyticsPage() {
  const setPageTitle = useUiStore((state: any) => state.setPageTitle);
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [onTimeCount, setOnTimeCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (setPageTitle) {
      setPageTitle('Impact Analytics');
    }

    const fetchData = async () => {
      if (!userId) return;
      try {
        setLoading(true);

        const [impactStats, completedTasks, allTasks] = await Promise.all([
          firestoreService.getImpactStats(userId),
          firestoreService.getTasks(userId, 'completed'),
          firestoreService.getTasks(userId),
        ]);

        setStats(impactStats);
        setCompletedCount(completedTasks.length);
        setTotalCount(allTasks.length);

        // Tasks whose deadline was still in the future when they completed
        // are counted as on-time. Since completedAt is optional, we fall back
        // to using the stored onTimeRate from Firestore.
        const onTime = completedTasks.filter((task: Task) => {
          if (task.completedAt) {
            return task.completedAt.getTime() <= task.deadline.getTime();
          }
          // completedAt not recorded — skip from local count, rely on persisted rate
          return false;
        }).length;
        setOnTimeCount(onTime || Math.round((impactStats.onTimeRate || 0) * completedTasks.length));
      } catch (e) {
        console.error('Failed to fetch analytics data:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [setPageTitle, userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06060A] text-slate-100 p-6 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 font-mono">Gathering impact metrics...</p>
      </div>
    );
  }

  const onTimePercent = totalCount > 0 ? Math.round((onTimeCount / totalCount) * 100) : 0;
  const latePercent = totalCount > 0 ? Math.round(((completedCount - onTimeCount) / Math.max(totalCount, 1)) * 100) : 0;
  const uncompletedPercent = totalCount > 0 ? Math.round(((totalCount - completedCount) / totalCount) * 100) : 0;

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
        {/* Tasks Saved */}
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 flex items-center justify-between shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Tasks Saved</span>
            <div className="text-3xl font-extrabold text-white">{stats?.tasksSaved ?? 0}</div>
            <p className="text-xs text-slate-400">Successfully met goals</p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
        </div>

        {/* Hours Recovered */}
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 flex items-center justify-between shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Hours Recovered</span>
            <div className="text-3xl font-extrabold text-white">{(stats?.hoursRecovered ?? 0).toFixed(1)}h</div>
            <p className="text-xs text-slate-400">Time reclaimed via prevention</p>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <Clock className="w-6 h-6 text-indigo-400" />
          </div>
        </div>

        {/* Current Streak */}
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 flex items-center justify-between shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Active Streak</span>
            <div className="text-3xl font-extrabold text-white">{stats?.currentStreak ?? 0} Days</div>
            <p className="text-xs text-slate-400">All sessions completed</p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <Flame className="w-6 h-6 text-amber-400 animate-pulse" />
          </div>
        </div>

        {/* On-Time Rate */}
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 flex items-center justify-between shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">On-Time Rate</span>
            <div className="text-3xl font-extrabold text-white">{Math.round((stats?.onTimeRate ?? 0) * 100)}%</div>
            <p className="text-xs text-slate-400">Completed before deadline</p>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <Award className="w-6 h-6 text-indigo-400" />
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
                    <div className="bg-rose-500 rounded-t-sm w-full transition-all duration-500" style={{ height: `${lateHeight}px` }} />
                    <div className="bg-emerald-500 rounded-t-sm w-full transition-all duration-500" style={{ height: `${onTimeHeight}px` }} />
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

            <div className="h-3 w-full bg-slate-900 rounded-full flex overflow-hidden">
              <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${onTimePercent || 33}%` }} />
              <div className="bg-rose-500 transition-all duration-500" style={{ width: `${latePercent || 33}%` }} />
              <div className="bg-slate-700 transition-all duration-500" style={{ width: `${uncompletedPercent || 34}%` }} />
            </div>
          </div>

          <div className="bg-[#0A0A0F] border border-slate-800 rounded-lg p-3 text-xs text-slate-400 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
            <span className="font-sans leading-relaxed">
              CLUTCH suggests booking an extra 1.5h buffer session each week to mitigate potential deadline risks.
            </span>
          </div>
        </div>

      </div>

      {/* Placeholder action log — real implementation requires a logs collection */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 space-y-4 shadow-md">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm uppercase tracking-wider font-bold text-white">
            CLUTCH Action Log
          </h3>
        </div>

        <div className="border border-slate-800 rounded-xl bg-[#0A0A0F]">
          <div className="p-8 text-center text-xs text-slate-500 font-mono">
            No logged actions recorded yet. Actions will appear here as CLUTCH schedules sessions and detects risks.
          </div>
        </div>
      </div>

    </div>
  );
}