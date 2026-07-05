'use client';

import React, { useState } from 'react';
import { X, Mail, ShieldAlert, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import TaskDetailSheet from '@/components/tasks/TaskDetailSheet';
import AddTaskForm from '@/components/tasks/AddTaskForm';
import { Task } from '@/lib/types';

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (task: Partial<Task>) => void | Promise<void>;
}

export function AddTaskModal({ open, onClose, onAdd }: AddTaskModalProps) {
  if (!open) return null;

  return (
    <>
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in"
      />
      
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6 z-50 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 shrink-0 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
              New Objective
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-550 hover:text-white transition p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <AddTaskForm 
          onTaskAdded={async (task) => {
            await onAdd(task);
            onClose();
          }} 
          onClose={onClose} 
        />
      </div>
    </>
  );
}

interface GmailScanModalProps {
  open: boolean;
  onClose: () => void;
  onCreateTask: (task: Partial<Task>) => Promise<Task>;
  onTasksAdded: () => void;
}

export function GmailScanModal({ open, onClose, onCreateTask, onTasksAdded }: GmailScanModalProps) {
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [foundEmails, setFoundEmails] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  const handleStartScan = async () => {
    setScanning(true);
    setFoundEmails([]);

    // Simulate multi-step scan
    setScanStep(1); // Connecting
    await new Promise(res => setTimeout(res, 800));
    setScanStep(2); // Analyzing emails
    await new Promise(res => setTimeout(res, 1200));
    setScanStep(3); // Extracting high-risk deadlines
    await new Promise(res => setTimeout(res, 800));

    // Results found
    setFoundEmails([
      {
        id: 'email-1',
        sender: 'Engineering Lead <lead@company.com>',
        subject: 'URGENT: Server Migration Deadline Moved Forward',
        snippet: 'Due to provider maintenance, we must move our production migration to Monday morning at 9:00 AM instead of Wednesday.',
        extractedTask: 'Server Migration Q3 Cutover',
        extractedDeadline: new Date(Date.now() + 36 * 3600 * 1000).toISOString(), // 36h from now
        estimatedHours: 4,
        priority: 'critical' as const
      },
      {
        id: 'email-2',
        sender: 'Product Management <pm@company.com>',
        subject: 'Beta Client Feedback Review Request',
        snippet: 'Could you review the user feedback survey docs and draft the action plan by Tuesday evening?',
        extractedTask: 'Review User Feedback Docs',
        extractedDeadline: new Date(Date.now() + 60 * 3600 * 1000).toISOString(), // 60h from now
        estimatedHours: 2,
        priority: 'high' as const
      }
    ]);
    setScanning(false);
    setScanStep(0);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      for (const email of foundEmails) {
        await onCreateTask({
          title: email.extractedTask,
          description: email.snippet,
          deadline: new Date(email.extractedDeadline),
          estimatedHours: email.estimatedHours,
          priority: email.priority,
          status: 'active',
          progressPercent: 0,
          gmailThreadId: email.id,
          subtasks: [],
        });
      }
      onTasksAdded();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in"
      />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6 z-50 shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 shrink-0 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-indigo-400">
              <Mail className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
              Gmail Risk Scanner
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-550 hover:text-white transition p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {scanning ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <div className="space-y-1.5">
                <p className="text-xs font-bold font-mono text-white">
                  {scanStep === 1 && 'CONNECTING SECURELY TO GMAIL...'}
                  {scanStep === 2 && 'ANALYZING PRIORITY INBOX...'}
                  {scanStep === 3 && 'EXTRACTING HIGH-STAKES DEADLINE TARGETS...'}
                </p>
                <p className="text-[10px] text-slate-500">CLUTCH is scanning sender authorities and relative risk factors.</p>
              </div>
            </div>
          ) : foundEmails.length > 0 ? (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-indigo-950/20 border border-indigo-500/15 rounded-xl p-3 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
                <p className="text-xs text-indigo-300 leading-normal">
                  Found <strong className="text-white">2 high-priority commitments</strong> containing specific, high-risk dates/deadlines. Ready to import and schedule.
                </p>
              </div>

              <div className="space-y-3">
                {foundEmails.map((email) => (
                  <div key={email.id} className="bg-[#0A0A0F] border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-850 pb-1.5">
                      <span className="text-[10px] text-slate-450 truncate font-mono">{email.sender}</span>
                      <span className="text-[10px] font-bold text-rose-400 font-mono bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10 uppercase">
                        {email.priority}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white font-sans">{email.subject}</p>
                    <p className="text-[11px] text-slate-400 leading-normal italic bg-slate-950/40 p-2.5 rounded border border-slate-850">
                      &ldquo;{email.snippet}&rdquo;
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 text-[10px] text-slate-500 font-mono border-t border-slate-850/60">
                      <span>🎯 Task: {email.extractedTask}</span>
                      <span>📅 Due: {new Date(email.extractedDeadline).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Importing to Command Center...</span>
                  </>
                ) : (
                  <span>Import & Track Commitments</span>
                )}
              </button>
            </div>
          ) : (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <p className="text-xs font-bold text-white font-sans">Connect & Scan Priority Inbox</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  CLUTCH will scan your inbox contextually to detect commitments, missed deadlines, or moved milestones, and create action interventions automatically.
                </p>
              </div>
              <button
                onClick={handleStartScan}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Start Scanning Inbox
              </button>
            </div>
          )}
        </div>

      </div>
    </>
  );
}

export { TaskDetailSheet };
export type { AddTaskModalProps, GmailScanModalProps };