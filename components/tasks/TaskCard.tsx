'use client';

import React from 'react';
import { Clock, ShieldAlert, CheckCircle2, Circle, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Task, TaskPriority } from '@/lib/types';

interface TaskCardProps {
  task: Task;
  onUpdate: (updates: Partial<Task>) => void;
  onOpenDetails: () => void;
  onDelete: () => void;
}

export default function TaskCard({ task, onUpdate, onOpenDetails, onDelete }: TaskCardProps) {
  const isCompleted = task.status === 'completed';
  const deadlineDate = task.deadline;
  const priority: TaskPriority = task.priority || 'medium';
  const subtasks = task.subtasks || [];

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({ status: isCompleted ? 'active' : 'completed', progressPercent: isCompleted ? 0 : 100 });
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'critical': return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      case 'high': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'medium': return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'low': return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const doneSubtasks = subtasks.filter((s) => s.done).length;
  const totalSubtasks = subtasks.length;

  return (
    <div 
      onClick={onOpenDetails}
      className={`bg-[#12121A] border border-[#1E1E2E] hover:border-indigo-500/30 rounded-xl p-5 space-y-4 shadow-md hover:shadow-indigo-500/5 transition duration-300 cursor-pointer select-none group relative
        ${isCompleted ? 'opacity-60 hover:opacity-100' : ''}
      `}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="space-y-1 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getPriorityBadge(priority)}`}>
              {priority}
            </span>
            {totalSubtasks > 0 && (
              <span className="text-[10px] text-slate-500 font-mono">
                {doneSubtasks}/{totalSubtasks} steps
              </span>
            )}
          </div>
          
          <h3 className={`text-sm font-bold leading-snug font-sans group-hover:text-indigo-300 transition-colors
            ${isCompleted ? 'line-through text-slate-500' : 'text-white'}
          `}>
            {task.title}
          </h3>
        </div>

        <button
          onClick={handleToggleComplete}
          className="p-1 text-slate-500 hover:text-white transition cursor-pointer"
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <Circle className="w-5 h-5 text-slate-650" />
          )}
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Progress slider / bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>PROGRESS</span>
          <span>{task.progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full bg-[#0A0A0F] rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-300" 
            style={{ width: `${task.progressPercent}%` }} 
          />
        </div>
      </div>

      {/* Deadline Info */}
      <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-slate-500 border-t border-slate-800/40">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          {deadlineDate.toLocaleDateString()}
        </span>
        <span className="group-hover:text-indigo-400 transition-colors flex items-center gap-0.5">
          View Detail
          <ArrowUpRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}
export type { TaskCardProps };