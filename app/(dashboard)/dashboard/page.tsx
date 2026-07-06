'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUiStore } from '@/lib/stores/uiStore';
import { useTasks } from '@/lib/hooks/useTasks';
import { useAuth } from '@/components/layout/AuthProvider';
import { firestoreService } from '@/lib/firebase/firestore';
import { Task, User } from '@/lib/types';
import OnboardingWizard from '@/components/layout/OnboardingWizard';
import AtRiskPanel from '@/components/dashboard/AtRiskPanel';
import TodayPlan, { TaskSession, CalendarEvent } from '@/components/dashboard/TodayPlan';
import ImpactStats, { ImpactStatsType } from '@/components/dashboard/ImpactStats';
import TaskCard from '@/components/tasks/TaskCard';
import { TaskDetailSheet, AddTaskModal, GmailScanModal } from '@/components/dashboard/Modals';
import { toast } from 'sonner';
import { Mail, Map, Plus, ShieldAlert, Sparkles, RefreshCw, LayoutGrid } from 'lucide-react';

export default function DashboardPage() {
  const setPageTitle = useUiStore((state: any) => state.setPageTitle);
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const { tasks, loading, atRiskTasks, refetch, updateTask, deleteTask, createTask } = useTasks();

  const [sessions,        setSessions]        = useState<TaskSession[]>([]);
  const [calendarEvents,  setCalendarEvents]  = useState<CalendarEvent[]>([]);
  const [impactStats,     setImpactStats]     = useState<ImpactStatsType | null>(null);
  const [workHours,       setWorkHours]       = useState({ workStart: '09:00', workEnd: '18:00' });
  const [userProfile,     setUserProfile]     = useState<User | null>(null);
  const [showOnboarding,  setShowOnboarding]  = useState(false);
  const [selectedTask,    setSelectedTask]    = useState<Task | null>(null);
  const [showAddTask,     setShowAddTask]     = useState(false);
  const [showGmailScan,   setShowGmailScan]   = useState(false);
  const [filterTab,       setFilterTab]       = useState<'all' | 'today' | 'week'>('all');
  const [isRefreshing,    setIsRefreshing]    = useState(false);

  // ── Page title ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (setPageTitle) setPageTitle('Command Center');
  }, [setPageTitle]);

  // ── Onboarding trigger ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && tasks.length === 0 && userProfile) {
      const hoursSinceCreation = (Date.now() - userProfile.createdAt.getTime()) / (3600 * 1000);
      if (hoursSinceCreation <= 24) setShowOnboarding(true);
    }
  }, [loading, tasks.length, userProfile]);

  // ── Dashboard data fetch ───────────────────────────────────────────────────
  /**
   * useCallback so that handleRefreshAll (which calls fetchDashboardData) is
   * stable across renders. Without this, handleRefreshAll is a new reference
   * every render, preventing the dependency array from stabilising.
   */
  const fetchDashboardData = useCallback(async () => {
    if (!userId) return;
    try {
      setIsRefreshing(true);

      const [calendarRes, statsRes, userRes] = await Promise.allSettled([
        fetch(`/api/calendar?userId=${userId}`).then((res) => {
          if (!res.ok) throw new Error(`Calendar fetch failed: ${res.status}`);
          return res.json();
        }),
        firestoreService.getImpactStats(userId),
        firestoreService.getUser(userId),
      ]);

      if (calendarRes.status === 'fulfilled') {
        setSessions(calendarRes.value.sessions || []);
        setCalendarEvents(calendarRes.value.events || []);
      } else {
        console.error('Calendar fetch error:', calendarRes.reason);
        toast.error('Could not load calendar data.');
      }

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setImpactStats(statsRes.value);
      }

      if (userRes.status === 'fulfilled' && userRes.value) {
        const u = userRes.value;
        setWorkHours({ workStart: u.workHours.start, workEnd: u.workHours.end });
        setUserProfile(u);
      }
    } catch (e: any) {
      console.error('Error loading dashboard payload:', e);
      toast.error('Dashboard failed to load. Pull to refresh.');
    } finally {
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchDashboardData();
  }, [userId, fetchDashboardData]);

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([refetch(), fetchDashboardData()]);
  }, [refetch, fetchDashboardData]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredTasks = tasks.filter((task) => {
    if (filterTab === 'all') return true;
    const now      = Date.now();
    const timeDiff = task.deadline.getTime() - now;
    if (filterTab === 'today') return timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000;
    if (filterTab === 'week')  return timeDiff > 0 && timeDiff <= 7 * 24 * 60 * 60 * 1000;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#06060A] text-slate-100 p-4 md:p-6 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-md">
            <ShieldAlert className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white uppercase font-sans">
              Clutch Dashboard
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Workspace Risk Controller • High-Stakes Deadline Engine
            </p>
          </div>
        </div>

        <button
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center cursor-pointer self-start md:self-auto"
          title="Force synchronization"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">

        {/* Left Column */}
        <div className="space-y-6">
          <AtRiskPanel
            tasks={tasks}
            onTaskClick={(task) => setSelectedTask(task)}
            onUpdateTask={updateTask}
          />
          <TodayPlan
            sessions={sessions}
            events={calendarEvents}
            workStart={workHours.workStart}
            workEnd={workHours.workEnd}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0A0A0F] border border-[#1E1E2E] p-4 rounded-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
              <p className="text-xs text-slate-300 font-mono">Smart Interventions:</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowGmailScan(true)}
                className="flex-1 sm:flex-initial py-2 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="w-4 h-4 text-indigo-400" />
                <span>Scan Gmail</span>
              </button>

              <button
                onClick={() => toast.info('Battle Plan feature is coming soon!')}
                className="flex-1 sm:flex-initial py-2 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Map className="w-4 h-4 text-emerald-400" />
                <span>Battle Plan</span>
              </button>

              <button
                onClick={() => setShowAddTask(true)}
                className="flex-1 sm:flex-initial py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/10"
              >
                <Plus className="w-4 h-4" />
                <span>Add Task</span>
              </button>
            </div>
          </div>

          {/* Impact Stats */}
          {impactStats ? (
            <ImpactStats stats={impactStats} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 space-y-3 animate-pulse">
                  <div className="h-4 bg-slate-800 rounded w-1/3" />
                  <div className="h-8 bg-slate-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {/* Task Grid */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm uppercase tracking-wider font-bold text-white">
                  Active Objectives
                </h3>
              </div>

              <div className="flex bg-[#0A0A0F] border border-slate-800 p-1 rounded-lg text-xs font-semibold">
                {(['all', 'today', 'week'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                    className={`px-3 py-1 rounded-md transition capitalize ${
                      filterTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab === 'week' ? 'This Week' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-[#12121A] border border-slate-800/80 rounded-xl p-5 space-y-4 animate-pulse h-40">
                    <div className="h-4 bg-slate-800 rounded w-2/3" />
                    <div className="h-3 bg-slate-800 rounded w-1/2" />
                    <div className="space-y-2">
                      <div className="h-2 bg-slate-800 rounded w-full" />
                      <div className="h-2 bg-slate-800 rounded w-5/6" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-850 rounded-2xl bg-[#09090D] space-y-3">
                <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-sm font-medium">No tasks found matching this criteria.</p>
                <button
                  onClick={() => setShowAddTask(true)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Create Task
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onUpdate={(updates) => updateTask(task.id, updates)}
                    onOpenDetails={() => setSelectedTask(task)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Modals */}
      <TaskDetailSheet
        open={!!selectedTask}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={(updates) => {
          if (selectedTask) {
            updateTask(selectedTask.id, updates);
            setSelectedTask({ ...selectedTask, ...updates });
          }
        }}
        onDelete={() => {
          if (selectedTask) {
            deleteTask(selectedTask.id);
            setSelectedTask(null);
          }
        }}
      />

      <AddTaskModal
        open={showAddTask}
        onClose={() => setShowAddTask(false)}
        onAdd={async (newTask) => {
          await createTask(newTask);
          await handleRefreshAll();
        }}
      />

      <GmailScanModal
        open={showGmailScan}
        onClose={() => setShowGmailScan(false)}
        onCreateTask={createTask}
        onTasksAdded={handleRefreshAll}
      />

      <OnboardingWizard
        showOnboarding={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onRefreshTasks={handleRefreshAll}
      />

    </div>
  );
}