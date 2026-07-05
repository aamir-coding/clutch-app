'use client';

import React from 'react';
import { CheckCircle2, Flame, Clock } from 'lucide-react';
import { ImpactStats as ImpactStatsType } from '@/lib/types';

interface ImpactStatsProps {
  stats: ImpactStatsType;
}

export default function ImpactStats({ stats }: ImpactStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      
      {/* 1. Tasks Saved */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 flex items-center justify-between shadow-md">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Tasks Saved</span>
          <div className="text-2xl font-extrabold text-white">{stats.tasksSaved} Objectives</div>
          <p className="text-[10px] text-slate-400">Goals completed before deadline</p>
        </div>
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
      </div>

      {/* 2. Hours Recovered */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 flex items-center justify-between shadow-md">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Hours Recovered</span>
          <div className="text-2xl font-extrabold text-white">{stats.hoursRecovered.toFixed(1)}h</div>
          <p className="text-[10px] text-slate-400">Time reclaimed from crisis prevention</p>
        </div>
        <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
          <Clock className="w-5 h-5 text-indigo-400" />
        </div>
      </div>

      {/* 3. Streak */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 flex items-center justify-between shadow-md">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Active Streak</span>
          <div className="text-2xl font-extrabold text-white">{stats.currentStreak} Days</div>
          <p className="text-[10px] text-slate-400">All planned sessions complete</p>
        </div>
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
        </div>
      </div>

    </div>
  );
}
export type { ImpactStatsType };