'use client';

import React from 'react';
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { Task } from '@/lib/types';

interface AtRiskPanelProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
}

export default function AtRiskPanel({ tasks, onTaskClick, onUpdateTask }: AtRiskPanelProps) {
  // Filters active tasks that have high risks (deadline is soon, priority is critical, progress is low)
  const atRiskList = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    const hoursLeft = (t.deadline.getTime() - Date.now()) / (3600 * 1000);
    return hoursLeft < 48 || (hoursLeft < 72 && t.priority === 'critical');
  });

  return (
    <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 space-y-4 shadow-lg">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
        <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
        <h3 className="text-xs uppercase tracking-wider font-bold text-white font-mono">
          Deadline Risk Interventions
        </h3>
      </div>

      {atRiskList.length === 0 ? (
        <div className="text-center py-6 space-y-1.5 bg-[#0A0A0F]/40 border border-[#1E1E2E]/40 rounded-lg p-4">
          <p className="text-xs text-slate-400 font-medium">All systems normal</p>
          <p className="text-[10px] text-slate-500 font-mono">No active high-stakes deadline threats detected.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {atRiskList.map((task) => {
            const hoursLeft = Math.max(0, (task.deadline.getTime() - Date.now()) / (3600 * 1000));

            return (
              <div 
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="p-3.5 bg-[#0A0A0F]/60 border border-rose-500/10 hover:border-rose-500/30 rounded-lg cursor-pointer transition flex items-start gap-3 hover:bg-[#0C0C14] group"
              >
                <div className="p-1.5 bg-rose-500/10 rounded-lg shrink-0 border border-rose-500/25">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors truncate font-sans">
                    {task.title}
                  </h4>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="text-rose-400 font-bold uppercase">{task.priority || 'medium'}</span>
                    <span className="text-slate-500">
                      {Math.round(hoursLeft)}h remaining
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export type { AtRiskPanelProps };