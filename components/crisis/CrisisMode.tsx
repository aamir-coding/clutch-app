'use client';

import React, { useState, useEffect } from 'react';
import CountdownTimer from './CountdownTimer';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useUiStore } from '@/lib/stores/uiStore';
import { AlertTriangle, Clock, ShieldAlert, Sparkles, Copy, Check, Send, ArrowRight } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description?: string;
  deadline: any; // Can be Firebase Timestamp or ISO string
  status: string;
  userId: string;
}

interface CrisisModeProps {
  taskId: string;
  onComplete: () => void;
  onDismiss: () => void;
}

export default function CrisisMode({ taskId, onComplete, onDismiss }: CrisisModeProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentInstruction, setAgentInstruction] = useState<string>('');
  const [fetchingInstruction, setFetchingInstruction] = useState(false);
  const [checkInNote, setCheckInNote] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [copiedExtension, setCopiedExtension] = useState(false);
  const [expired, setExpired] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const setCrisisTaskId = useUiStore((state) => state.setCrisisTaskId);

  // Fetch Task and AI Instructions
  useEffect(() => {
    let active = true;

    async function fetchData() {
      try {
        setLoading(true);
        // Get Task from Firestore
        const taskDocRef = doc(db, 'tasks', taskId);
        const taskSnap = await getDoc(taskDocRef);

        if (taskSnap.exists()) {
          const data = taskSnap.data() as Omit<Task, 'id'>;
          if (active) {
            setTask({ id: taskId, ...data });
          }

          // Fetch tailored AI instruction from API
          if (active) setFetchingInstruction(true);
          const response = await fetch('/api/tasks/instructions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, title: data.title, description: data.description }),
          });
          
          if (response.ok) {
            const result = await response.json();
            if (active) setAgentInstruction(result.instruction || result.text || '');
          } else {
            // Fallback instruction
            if (active) {
              setAgentInstruction(
                "Focus on finishing the absolute core requirements. Strip out all secondary features. Write down your next 3 concrete steps, put your phone in another room, and execute. You've got this."
              );
            }
          }
        } else {
          if (active) setFeedbackMsg({ type: 'error', text: 'Task not found.' });
        }
      } catch (error: any) {
        console.error('Error fetching crisis details:', error);
        if (active) setFeedbackMsg({ type: 'error', text: 'Error loading task data.' });
      } finally {
        if (active) {
          setLoading(false);
          setFetchingInstruction(false);
        }
      }
    }

    fetchData();

    return () => {
      active = false;
    };
  }, [taskId]);

  // Handle Mark as Complete
  const handleMarkAsComplete = async () => {
    try {
      setFeedbackMsg(null);
      const taskDocRef = doc(db, 'tasks', taskId);
      await updateDoc(taskDocRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
      });
      setFeedbackMsg({ type: 'success', text: 'Task completed! Crisis averted.' });
      setCrisisTaskId(null);
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error: any) {
      console.error('Error completing task:', error);
      setFeedbackMsg({ type: 'error', text: 'Failed to complete task in Firestore.' });
    }
  };

  // Handle Check-In ("I'm working on it")
  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInNote.trim()) return;

    try {
      setIsCheckingIn(true);
      setFeedbackMsg(null);

      // Create a session log / check-in record in subcollection or logs
      const logRef = collection(db, 'tasks', taskId, 'logs');
      await addDoc(logRef, {
        note: checkInNote,
        timestamp: serverTimestamp(),
        type: 'crisis_check_in',
      });

      // Optionally update task last check-in timestamp
      const taskDocRef = doc(db, 'tasks', taskId);
      await updateDoc(taskDocRef, {
        lastCheckInNote: checkInNote,
        lastCheckInAt: serverTimestamp(),
      });

      setCheckInNote('');
      setFeedbackMsg({ type: 'success', text: 'Check-in logged! Keep pushing forward.' });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (error: any) {
      console.error('Error logging check-in:', error);
      setFeedbackMsg({ type: 'error', text: 'Failed to log check-in.' });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Timer Expiration Handler
  const handleTimerExpired = () => {
    setExpired(true);
  };

  // Pre-drafted Extension Request Email
  const getExtensionEmailDraft = () => {
    const taskTitle = task?.title || 'Project';
    return `Subject: Urgent Update & Extension Request - ${taskTitle}

Dear [Supervisor/Client Name],

I am writing to provide an urgent, transparent update regarding the "${taskTitle}" task. Due to unforeseen complexities in implementation, I am currently tracking behind our planned delivery schedule.

To ensure the output meets our quality standards, I request a brief extension of [e.g., 24 hours] to complete the remaining core components. I am currently working through the implementation of these components with maximum focus.

Thank you for your understanding and support.

Best regards,
[Your Name]`;
  };

  const copyExtensionDraft = () => {
    navigator.clipboard.writeText(getExtensionEmailDraft());
    setCopiedExtension(true);
    setTimeout(() => setCopiedExtension(false), 2000);
  };

  // Format Date for countdown / fallback display
  const getDeadlineDate = () => {
    if (!task) return new Date();
    if (task.deadline && typeof task.deadline.toDate === 'function') {
      return task.deadline.toDate();
    }
    return new Date(task.deadline);
  };

  if (loading) {
    return (
      <div id="crisis-loading-screen" className="fixed inset-0 bg-[#0A0A0F] text-white flex flex-col items-center justify-center z-50">
        <ShieldAlert className="w-12 h-12 text-red-500 animate-pulse mb-4" />
        <h1 className="text-xl font-medium tracking-wide">INITIALIZING CRISIS SYSTEM...</h1>
      </div>
    );
  }

  if (!task) {
    return (
      <div id="crisis-error-screen" className="fixed inset-0 bg-[#0A0A0F] text-white flex flex-col items-center justify-center p-6 z-50">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">CRITICAL ACCESS ERROR</h1>
        <p className="text-slate-400 text-center mb-6 max-w-md">
          Unable to retrieve the task profile. The crisis event may have expired or been resolved.
        </p>
        <button
          onClick={onDismiss}
          className="px-6 py-2 bg-[#12121A] border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition"
        >
          Exit System
        </button>
      </div>
    );
  }

  return (
    <div id="crisis-takeover-layout" className="fixed inset-0 bg-[#0A0A0F] text-white overflow-y-auto flex flex-col z-50">
      {/* Red Ambient Top Beacon */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600 animate-pulse" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 flex flex-col justify-center">
        {/* Header Indicator */}
        <div id="crisis-alert-header" className="flex items-center justify-center gap-3 mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500 rounded-full blur-sm opacity-75 animate-ping" />
            <ShieldAlert className="relative w-8 h-8 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-widest text-red-500 uppercase">CRISIS INTERVENTION</h1>
            <p className="text-xs text-slate-400 tracking-wider uppercase font-mono mt-0.5">
              Strict Focus Mode Active • All Secondary Features Silenced
            </p>
          </div>
        </div>

        {/* Task Card Grid / Layout */}
        <div id="crisis-content-grid" className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Main Focus Column */}
          <div className="md:col-span-7 space-y-6">
            {/* Task Info Box */}
            <div className="bg-[#12121A] border border-red-500/20 rounded-xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl" />
              <span className="text-xs font-mono text-red-400 uppercase tracking-widest border border-red-500/20 px-2 py-0.5 rounded bg-red-500/5">
                Active Objective
              </span>
              <h2 className="text-2xl font-bold mt-3 tracking-tight text-white">{task.title}</h2>
              {task.description && (
                <p className="text-slate-400 text-sm mt-3 leading-relaxed border-t border-slate-800/60 pt-3">
                  {task.description}
                </p>
              )}
            </div>

            {/* AI Assistant Core Suggestions */}
            <div className="bg-[#12121A] border border-red-500/20 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3 text-red-400">
                <Sparkles className="w-5 h-5 text-red-400" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">AI Tactical Advice</h3>
              </div>
              <div className="text-slate-300 text-sm leading-relaxed font-sans bg-[#0A0A0F] border border-slate-800 rounded-lg p-4">
                {fetchingInstruction ? (
                  <div className="flex items-center gap-2 text-slate-500 animate-pulse">
                    <Clock className="w-4 h-4" />
                    <span>Analyzing task profile and formulating tactical guide...</span>
                  </div>
                ) : (
                  agentInstruction || "No instructions provided. Focus completely on the immediate goal."
                )}
              </div>
            </div>

            {/* Check-In Logging Form */}
            <form onSubmit={handleCheckIn} className="bg-[#12121A] border border-red-500/20 rounded-xl p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-2 text-slate-300">
                Logged Work Progress
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Log what you have done in the last hour to preserve historical logs and notify colleagues.
              </p>
              <div className="flex gap-2">
                <input
                  id="crisis-checkin-input"
                  type="text"
                  placeholder="e.g., Completed API routes, debugging tests now..."
                  value={checkInNote}
                  onChange={(e) => setCheckInNote(e.target.value)}
                  disabled={isCheckingIn}
                  className="flex-1 bg-[#0A0A0F] border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-red-500/50 transition placeholder-slate-600"
                />
                <button
                  type="submit"
                  disabled={isCheckingIn || !checkInNote.trim()}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm transition flex items-center gap-2 font-medium disabled:opacity-40 disabled:hover:bg-red-500/10 cursor-pointer"
                >
                  {isCheckingIn ? 'Sending...' : (
                    <>
                      <span>Check In</span>
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Countdown & Action Controls Column */}
          <div className="md:col-span-5 space-y-6">
            {/* Timer Wrapper */}
            <div className="bg-[#12121A] border border-red-500/20 rounded-xl p-6 flex flex-col items-center">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-500" />
                Time Remaining
              </h3>
              {!expired ? (
                <CountdownTimer deadline={getDeadlineDate()} onExpired={handleTimerExpired} />
              ) : (
                <div id="crisis-deadline-breached-box" className="text-center p-4 bg-red-950/20 border border-red-500/40 rounded-lg">
                  <h4 className="text-red-500 text-xl font-black uppercase tracking-widest animate-pulse mb-2">
                    DEADLINE BREACHED
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Immediately notify your team or supervisor. Complete core components now to mitigate fallout.
                  </p>
                </div>
              )}
            </div>

            {/* Feedback / Status Msg */}
            {feedbackMsg && (
              <div
                id="crisis-feedback-message"
                className={`p-4 rounded-xl text-sm border ${
                  feedbackMsg.type === 'success'
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-red-950/20 border-red-500/30 text-red-400'
                }`}
              >
                {feedbackMsg.text}
              </div>
            )}

            {/* Core Action Terminal Buttons */}
            <div className="bg-[#12121A] border border-red-500/20 rounded-xl p-4 space-y-3">
              <button
                id="crisis-action-complete"
                onClick={handleMarkAsComplete}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-red-500/10 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Mark Objective Completed</span>
              </button>

              <button
                id="crisis-action-draft-extension"
                onClick={() => setShowExtensionModal(true)}
                className="w-full py-3 bg-[#0A0A0F] border border-red-500/30 text-red-400 hover:bg-red-500/5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Draft Extension Request</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                id="crisis-action-dismiss"
                onClick={onDismiss}
                className="w-full py-2 text-slate-500 hover:text-slate-300 text-xs font-mono transition text-center cursor-pointer"
              >
                [ Minimize Intervention Screen ]
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Extension Draft Modal */}
      {showExtensionModal && (
        <div id="extension-modal-overlay" className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#12121A] border border-red-500/20 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h4 className="text-md font-bold text-red-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-red-400" />
                Draft Extension Email
              </h4>
              <button
                onClick={() => setShowExtensionModal(false)}
                className="text-slate-500 hover:text-slate-300 font-bold"
              >
                ✕
              </button>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Copy and adjust this communication draft. Transparency during critical delays builds client trust.
            </p>

            <textarea
              readOnly
              value={getExtensionEmailDraft()}
              className="w-full h-64 bg-[#0A0A0F] border border-slate-800 rounded-lg p-3 text-xs text-slate-300 leading-relaxed font-mono focus:outline-none resize-none"
            />

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowExtensionModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={copyExtensionDraft}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-semibold flex items-center gap-2 transition"
              >
                {copiedExtension ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Draft</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
