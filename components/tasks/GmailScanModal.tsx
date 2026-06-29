'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/layout/AuthProvider';
import { formatRelativeDeadline } from '@/lib/utils/dates';
import { GmailDeadline, Task } from '@/lib/types';
import { toast } from 'sonner';
import { Loader2, Check, X, Mail, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GmailScanModalProps {
  open: boolean;
  onClose: () => void;
  onTasksAdded: (tasks: Task[]) => void;
}

export default function GmailScanModal({ open, onClose, onTasksAdded }: GmailScanModalProps) {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [deadlines, setDeadlines] = useState<GmailDeadline[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    async function fetchDeadlines() {
      if (!user) return;
      setScanning(true);
      setError(null);
      setDeadlines([]);
      setSelected(new Set());

      try {
        const response = await fetch('/api/gmail/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Gmail access required');
          }
          const data = await response.json();
          throw new Error(data.error || 'Failed to scan Gmail');
        }

        const data = await response.json();
        const foundDeadlines: GmailDeadline[] = data.deadlines || [];
        setDeadlines(foundDeadlines);

        // Auto-select all high-confidence deadlines that are not already added
        const initialSelected = new Set<number>();
        foundDeadlines.forEach((d, idx) => {
          if (d.deadlineConfidence === 'high' && !(d as any).alreadyAdded) {
            initialSelected.add(idx);
          }
        });
        setSelected(initialSelected);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'An unexpected error occurred while scanning Gmail');
      } finally {
        setScanning(false);
      }
    }

    fetchDeadlines();
  }, [open, user]);

  const toggleSelected = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelected(next);
  };

  const handleSelectAll = () => {
    const next = new Set<number>();
    deadlines.forEach((d, idx) => {
      if (!(d as any).alreadyAdded) {
        next.add(idx);
      }
    });
    setSelected(next);
  };

  const handleSelectNone = () => {
    setSelected(new Set());
  };

  const handleAddTasks = async () => {
    if (selected.size === 0 || adding || !user) return;
    setAdding(true);

    const createdTasks: Task[] = [];
    const selectedIndices = Array.from(selected);

    try {
      for (const idx of selectedIndices) {
        const d = deadlines[idx];

        // Format deadline safely into future
        let taskDeadline = d.deadline ? new Date(d.deadline) : new Date();
        if (isNaN(taskDeadline.getTime()) || taskDeadline <= new Date()) {
          taskDeadline = new Date();
          taskDeadline.setDate(taskDeadline.getDate() + 1);
          taskDeadline.setHours(17, 0, 0, 0); // Tomorrow at 5 PM
        }

        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            title: d.title,
            description: d.context,
            deadline: taskDeadline.toISOString(),
            estimatedHours: 2,
            notes: 'Added from Gmail',
          }),
        });

        if (res.ok) {
          const task = await res.json();
          createdTasks.push(task);
        } else {
          console.error(`Failed to create task for deadline: ${d.title}`);
        }
      }

      onTasksAdded(createdTasks);
      toast.success(`Added ${createdTasks.length} tasks from Gmail`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add some tasks. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div id="gmail-scan-modal" className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-white"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold font-sans tracking-tight">Gmail Deadline Scan</h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  {scanning
                    ? 'Scanning recent emails for deadlines...'
                    : `Found ${deadlines.length} potential deadline${deadlines.length === 1 ? '' : 's'} in the last 7 days.`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={adding}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {scanning && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <p className="text-slate-400 text-sm">Scanning your Gmail messages...</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4 space-y-4">
                <div className="p-3 bg-red-500/10 text-red-400 rounded-full">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-md font-medium text-white">
                    {error === 'Gmail access required' ? 'Gmail Access Required' : 'Scan Failed'}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1 max-w-sm">
                    {error === 'Gmail access required'
                      ? 'Please authorize Google Calendar and Gmail access in the Settings menu to enable automated email deadline checking.'
                      : error}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition font-medium"
                >
                  Dismiss
                </button>
              </div>
            )}

            {!scanning && !error && deadlines.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-400">No new deadlines detected in your inbox.</p>
              </div>
            )}

            {!scanning && !error && deadlines.length > 0 && (
              <div className="space-y-4">
                {/* Select Actions */}
                <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/50">
                  <span>Select the ones to add as active tasks:</span>
                  <div className="space-x-2">
                    <button onClick={handleSelectAll} className="hover:text-white transition">Select All</button>
                    <span>•</span>
                    <button onClick={handleSelectNone} className="hover:text-white transition">Clear All</button>
                  </div>
                </div>

                {/* Deadlines List */}
                <div className="space-y-3">
                  {deadlines.map((d, idx) => {
                    const alreadyAdded = (d as any).alreadyAdded;
                    const isSelected = selected.has(idx);

                    let formattedDeadline = 'Deadline unclear';
                    let deadlineColorClass = 'text-slate-500';

                    if (d.deadline) {
                      try {
                        const dlDate = new Date(d.deadline);
                        formattedDeadline = formatRelativeDeadline(dlDate);
                        
                        // Set colors based on relative time
                        const diff = dlDate.getTime() - Date.now();
                        if (diff < 0) {
                          deadlineColorClass = 'text-red-400';
                        } else if (diff < 24 * 60 * 60 * 1000) {
                          deadlineColorClass = 'text-orange-400';
                        } else {
                          deadlineColorClass = 'text-emerald-400 font-medium';
                        }
                      } catch {
                        // ignore error
                      }
                    }

                    return (
                      <div
                        key={idx}
                        onClick={() => !alreadyAdded && toggleSelected(idx)}
                        className={`group relative p-4 rounded-xl border transition flex gap-3 text-left ${
                          alreadyAdded
                            ? 'bg-slate-900/40 border-slate-800/40 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-indigo-950/20 border-indigo-500/50 cursor-pointer'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 cursor-pointer'
                        }`}
                      >
                        {/* Checkbox / Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          {alreadyAdded ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                              Already Added
                            </span>
                          ) : (
                            <div
                              className={`h-5 w-5 rounded border flex items-center justify-center transition ${
                                isSelected
                                  ? 'bg-indigo-500 border-indigo-400 text-white'
                                  : 'border-slate-600 group-hover:border-slate-400'
                              }`}
                            >
                              {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-4">
                            <h4 className="font-medium text-white text-sm line-clamp-1">{d.title}</h4>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                d.deadlineConfidence === 'high'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : d.deadlineConfidence === 'medium'
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {d.deadlineConfidence} confidence
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>From: {d.sender}</span>
                            <span>•</span>
                            <span className={deadlineColorClass}>{formattedDeadline}</span>
                          </div>

                          {d.context && (
                            <p className="text-xs text-slate-500 italic line-clamp-2 mt-2 pt-2 border-t border-slate-800/40">
                              &ldquo;{d.context}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={adding}
              className="px-4 py-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleAddTasks}
              disabled={selected.size === 0 || adding || scanning || !!error}
              className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition flex items-center gap-2 shadow-lg shadow-indigo-500/10"
            >
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding Tasks...
                </>
              ) : (
                `Add ${selected.size} Task${selected.size === 1 ? '' : 's'}`
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
