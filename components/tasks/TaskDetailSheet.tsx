'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Plus, CheckCircle2, Circle, Clock, Mail, Trash2, Loader2 } from 'lucide-react';
import { firestoreService } from '@/lib/firebase/firestore';
import { Task, TaskSession } from '@/lib/types';

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<Task>) => void;
  onDelete: () => void;
}

export default function TaskDetailSheet({ task, open, onClose, onUpdate, onDelete }: TaskDetailSheetProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [sessions, setSessions] = useState<TaskSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [schedulingSession, setSchedulingSession] = useState(false);
  
  const titleInputRef = useRef<HTMLInputElement>(null);
  const confirmTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync title input
  useEffect(() => {
    if (task) {
      setEditedTitle(task.title);
    }
    setConfirmDelete(false);
  }, [task]);

  // Fetch task sessions
  useEffect(() => {
    if (task && open) {
      const loadSessions = async () => {
        try {
          setLoadingSessions(true);
          const data = await firestoreService.getSessionsForTask(task.id);
          setSessions(data);
        } catch (e) {
          console.error('Failed to load sessions:', e);
        } finally {
          setLoadingSessions(false);
        }
      };
      loadSessions();
    }
  }, [task, open]);

  // Focus title input when editing
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditingTitle]);

  if (!task || !open) return null;

  const subtasks = task.subtasks || [];

  // Title edit handler
  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (editedTitle.trim() && editedTitle !== task.title) {
      onUpdate({ title: editedTitle.trim() });
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    }
  };

  // Subtask handlers
  const handleToggleSubtask = (subId: string) => {
    const updatedSubtasks = subtasks.map((st) =>
      st.id === subId ? { ...st, done: !st.done } : st
    );
    onUpdate({ subtasks: updatedSubtasks });
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskText.trim()) return;
    const newSub = {
      id: crypto.randomUUID(),
      title: newSubtaskText.trim(),
      done: false,
    };
    onUpdate({ subtasks: [...subtasks, newSub] });
    setNewSubtaskText('');
  };

  // Delete handler with timeout
  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => {
        setConfirmDelete(false);
      }, 3000);
    }
  };

  // Simulate Calendar Session Scheduling (UI-only — does not persist to
  // Firestore or Google Calendar; use the Battle Plan / Timeline flows for
  // real session booking)
  const handleScheduleNewSession = async () => {
    setSchedulingSession(true);
    try {
      await new Promise((res) => setTimeout(res, 1200));
      const newSession: TaskSession = {
        id: crypto.randomUUID(),
        taskId: task.id,
        userId: task.userId,
        scheduledStart: new Date(Date.now() + 3600 * 1000),
        scheduledEnd: new Date(Date.now() + 3 * 3600 * 1000),
        completed: false,
        skipped: false,
      };
      setSessions((prev) => [...prev, newSession]);
    } catch (e) {
      console.error(e);
    } finally {
      setSchedulingSession(false);
    }
  };

  // Deadline calculation details
  const deadlineDate = task.deadline;
  const hoursLeft = Math.max(0, (deadlineDate.getTime() - Date.now()) / (3600 * 1000));
  const estimatedHours = task.estimatedHours ?? 2;
  const workHoursRemaining = Math.max(0.5, estimatedHours * (1 - task.progressPercent / 100));

  // Risk levels
  const riskScore = hoursLeft > 0 ? Math.min(100, Math.round((workHoursRemaining / hoursLeft) * 100)) : 100;
  let riskLabel = 'HEALTHY';
  let riskColor = 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
  let riskBarBg = 'bg-emerald-500';

  if (riskScore > 75 || hoursLeft === 0) {
    riskLabel = 'CRITICAL OVERLOAD';
    riskColor = 'text-rose-400 border-rose-500/20 bg-rose-500/5';
    riskBarBg = 'bg-rose-500';
  } else if (riskScore > 40) {
    riskLabel = 'ELEVATED RISK';
    riskColor = 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    riskBarBg = 'bg-amber-500';
  }

  const subtasksCompleted = subtasks.filter((s) => s.done).length;
  const subtasksTotal = subtasks.length;

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in"
      />

      {/* Side Sheet */}
      <div className="fixed top-0 right-0 h-full w-full sm:max-w-lg bg-[#12121A] border-l border-[#1E1E2E] z-50 shadow-2xl flex flex-col animate-slide-in">
        
        {/* Top Sticky Header */}
        <div className="p-4 md:p-6 border-b border-[#1E1E2E] flex items-center justify-between bg-[#12121A] shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${riskColor}`}>
              {riskLabel}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-white transition p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-8">
          
          {/* 1. Title & Status */}
          <div className="space-y-3">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                className="w-full text-xl font-bold bg-[#0A0A0F] border border-indigo-500/40 rounded-lg px-3 py-1.5 text-white outline-none"
              />
            ) : (
              <h2 
                onClick={() => setIsEditingTitle(true)}
                className="text-xl font-bold text-white hover:text-indigo-300 transition cursor-pointer select-none leading-tight"
                title="Click to rename"
              >
                {task.title}
              </h2>
            )}

            {/* Segmented Priority Selector */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-500">Priority Level</span>
              <div className="grid grid-cols-4 gap-1.5 bg-[#0A0A0F] p-1 border border-slate-800 rounded-lg">
                {(['critical', 'high', 'medium', 'low'] as const).map((p) => {
                  const isSelected = task.priority === p;
                  return (
                    <button
                      key={p}
                      onClick={() => onUpdate({ priority: p })}
                      className={`text-[10px] py-1 px-1 rounded-md font-bold uppercase transition-all tracking-wider
                        ${isSelected 
                          ? p === 'critical' ? 'bg-rose-500 text-white' 
                            : p === 'high' ? 'bg-amber-500 text-black'
                            : p === 'medium' ? 'bg-indigo-600 text-white'
                            : 'bg-slate-700 text-white'
                          : 'text-slate-500 hover:text-slate-300'
                        }
                      `}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. Deadline & Risk Alert Indicator */}
          <div className="bg-[#0A0A0F] border border-slate-800 rounded-xl p-4.5 space-y-4 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-300">Target Deadline</span>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-400">
                {deadlineDate.toLocaleDateString()} at {deadlineDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>

            {/* Risk Indicator Section */}
            <div className="space-y-2 border-t border-slate-800/60 pt-3">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500 uppercase">Clutch Risk Metric</span>
                <span className={`font-bold ${riskColor.split(' ')[0]}`}>{riskScore}%</span>
              </div>
              
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${riskBarBg} transition-all duration-500`} 
                  style={{ width: `${riskScore}%` }} 
                />
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed pt-1 font-mono">
                Deadline risk: {workHoursRemaining.toFixed(1)}h left to complete vs {Math.round(hoursLeft)}h remaining until targeted deadline.
              </p>
            </div>
          </div>

          {/* 3. Progress Percent bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-mono uppercase">
              <span className="text-slate-500 font-bold">Progress Rate</span>
              <span className="text-indigo-400 font-bold">{task.progressPercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={task.progressPercent}
              onChange={(e) => onUpdate({ progressPercent: Number(e.target.value) })}
              className="w-full h-1.5 bg-[#0A0A0F] rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <p className="text-[11px] text-slate-500 font-mono">
              {task.progressPercent}% complete · ~{workHoursRemaining.toFixed(1)}h effort remaining
            </p>
          </div>

          {/* 4. Subtasks Checklist List */}
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-white">Subtasks</h3>
              <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                {subtasksCompleted}/{subtasksTotal} done
              </span>
            </div>

            <div className="space-y-1.5">
              {subtasks.map((st) => (
                <div 
                  key={st.id} 
                  onClick={() => handleToggleSubtask(st.id)}
                  className="flex items-center gap-2.5 p-2 bg-[#0A0A0F]/40 border border-[#1E1E2E]/60 rounded-lg hover:border-slate-800 transition cursor-pointer select-none"
                >
                  {st.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className={`text-xs ${st.done ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                    {st.title}
                  </span>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <input
                type="text"
                placeholder="Add subtask..."
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                className="flex-1 bg-[#0A0A0F] border border-slate-800 rounded-lg text-xs text-white px-3 py-2 outline-none focus:border-indigo-500/50"
              />
              <button
                type="submit"
                className="p-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg hover:text-white transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* 5. Scheduled Sessions List */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-bold text-white border-b border-slate-800 pb-1.5">
              Google Calendar Focus Sessions
            </h3>

            {loadingSessions ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500 font-mono italic">
                No active focus slots scheduled.
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((sess) => {
                  const durationHours = (sess.scheduledEnd.getTime() - sess.scheduledStart.getTime()) / (3600 * 1000);
                  return (
                    <div key={sess.id} className="bg-[#0A0A0F]/60 border border-slate-850 p-3 rounded-lg flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="font-bold text-slate-300">
                            {sess.completed ? 'Completed Slot' : sess.skipped ? 'Skipped Slot' : 'Focus Slot'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {sess.scheduledStart.toLocaleDateString()} • {sess.scheduledStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>

                      <span className="text-[10px] font-bold text-slate-400 bg-slate-800 rounded px-2 py-0.5">
                        {durationHours.toFixed(1)}h Block
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={handleScheduleNewSession}
              disabled={schedulingSession}
              className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {schedulingSession ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Scheduling with Calendar...</span>
                </>
              ) : (
                <>
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Schedule New Session</span>
                </>
              )}
            </button>
          </div>

          {/* 6. Gmail Source Badge */}
          {task.gmailThreadId && (
            <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-lg p-3 flex items-center gap-2 text-xs">
              <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-indigo-300">Imported automatically via high-priority alert email</span>
            </div>
          )}

          {/* 7. Notes Area */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-500">Task Notes</span>
            <textarea
              placeholder="Add additional research, links, context or ideas here..."
              defaultValue={task.notes || ''}
              onBlur={(e) => onUpdate({ notes: e.target.value })}
              className="w-full bg-[#0A0A0F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500/50 min-h-[90px] resize-none"
            />
          </div>

          {/* 8. Danger Zone - Deletion */}
          <div className="border-t border-slate-800 pt-5">
            <button
              onClick={handleDeleteClick}
              className={`w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all flex items-center justify-center gap-2 cursor-pointer
                ${confirmDelete 
                  ? 'bg-rose-600 text-white border-transparent' 
                  : 'bg-transparent text-rose-400 border-rose-500/20 hover:border-rose-500/40 hover:bg-rose-500/5'
                }
              `}
            >
              <Trash2 className="w-4 h-4" />
              <span>{confirmDelete ? 'Confirm Delete (3s)' : 'Delete Objective'}</span>
            </button>
          </div>

        </div>

      </div>
    </>
  );
}
export type { TaskDetailSheetProps };