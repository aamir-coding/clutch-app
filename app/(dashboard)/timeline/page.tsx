'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUiStore } from '@/lib/stores/uiStore';
import { useCalendar, CalendarEvent } from '@/lib/hooks/useCalendar';
import { useTasks } from '@/lib/hooks/useTasks';
import { Task, TaskSession, firestoreService } from '@/lib/firebase/firestoreService';
import { TaskDetailSheet } from '@/components/dashboard/Modals';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Zap, Clock, Play, Plus, Loader2, X, AlertCircle, Info 
} from 'lucide-react';

const HOUR_HEIGHT = 55; // Pixels per hour in timeline
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM through 11 PM (18 hours)

export default function TimelinePage() {
  const setPageTitle = useUiStore((state: any) => state.setPageTitle);
  const { events, sessions, loading: calendarLoading, fetchForDateRange, scheduleSession } = useCalendar();
  const { tasks, loading: tasksLoading, updateTask, deleteTask } = useTasks();

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
  
  // Schedule Modal State
  const [schedulingSlot, setSchedulingSlot] = useState<{ date: Date; startHour: number; durationMinutes: number } | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [booking, setBooking] = useState(false);

  // Set Page Title on mount
  useEffect(() => {
    if (setPageTitle) {
      setPageTitle('Timeline');
    }
  }, [setPageTitle]);

  // Sync calendar data when week changes
  useEffect(() => {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    fetchForDateRange(currentWeekStart, weekEnd);
  }, [currentWeekStart, fetchForDateRange]);

  // Shift current week helper
  const handlePrevWeek = () => {
    setCurrentWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 7);
      return next;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
  };

  const handleResetToToday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  // List of 7 days for the current week starting Monday
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(currentWeekStart);
      day.setDate(day.getDate() + i);
      return day;
    });
  }, [currentWeekStart]);

  // Format header title (e.g., "June 2026")
  const headerLabel = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    return currentWeekStart.toLocaleDateString(undefined, options);
  }, [currentWeekStart]);

  // Helper styles calculator for positioning items absolutely in the 6 AM - 11 PM timeframe
  const getTimelineItemStyle = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const duration = endHour - startHour;

    // Clamp values within our grid (6 to 24)
    const topOffset = Math.max(0, (startHour - 6) * HOUR_HEIGHT);
    const calculatedHeight = Math.max(25, duration * HOUR_HEIGHT);

    return {
      top: `${topOffset}px`,
      height: `${calculatedHeight}px`,
    };
  };

  // Helper to filter items for a specific day
  const getDayItems = (day: Date) => {
    const dayStr = day.toDateString();

    const dayEvents = events.filter((e) => new Date(e.start).toDateString() === dayStr);
    const daySessions = sessions.filter((s) => new Date(s.start).toDateString() === dayStr);

    return { dayEvents, daySessions };
  };

  // Generate empty slots dynamically
  const getDayFreeSlots = (day: Date, dayEvents: CalendarEvent[], daySessions: TaskSession[]) => {
    const busyPeriods: { start: number; end: number }[] = [];

    // Map events and sessions into fractional busy hours (e.g. 10.5 for 10:30)
    dayEvents.forEach((e) => {
      const s = new Date(e.start);
      const end = new Date(e.end);
      busyPeriods.push({
        start: s.getHours() + s.getMinutes() / 60,
        end: end.getHours() + end.getMinutes() / 60,
      });
    });

    daySessions.forEach((s) => {
      const start = new Date(s.start);
      const end = new Date(s.end);
      busyPeriods.push({
        start: start.getHours() + start.getMinutes() / 60,
        end: end.getHours() + end.getMinutes() / 60,
      });
    });

    // Potential slots in day: Morning (9–11), Midday (12–14), Afternoon (15–17)
    const potentialSlots = [
      { startHour: 9, endHour: 11, label: 'Morning Block (9–11)' },
      { startHour: 12, endHour: 13, label: 'Midday Block (12–13)' },
      { startHour: 15, endHour: 17, label: 'Afternoon Block (15–17)' },
    ];

    // Filter slots with no overlap
    return potentialSlots.filter((slot) => {
      const overlap = busyPeriods.some((busy) => {
        return slot.startHour < busy.end && slot.endHour > busy.start;
      });
      return !overlap;
    });
  };

  const handleOpenScheduleModal = (day: Date, startHour: number, endHour: number) => {
    const targetDate = new Date(day);
    targetDate.setHours(startHour, 0, 0, 0);
    const durationMinutes = (endHour - startHour) * 60;
    
    setSchedulingSlot({
      date: targetDate,
      startHour,
      durationMinutes,
    });
    
    // Select first active task if available
    const activeTasks = tasks.filter((t) => t.status !== 'completed');
    if (activeTasks.length > 0) {
      setSelectedTaskId(activeTasks[0].id);
    } else {
      setSelectedTaskId('');
    }
  };

  const handleBookSession = async () => {
    if (!selectedTaskId || !schedulingSlot) return;

    setBooking(true);
    try {
      const task = tasks.find((t) => t.id === selectedTaskId);
      if (task) {
        const result = await scheduleSession(
          task.id,
          task.title,
          schedulingSlot.durationMinutes,
          schedulingSlot.date.toISOString()
        );
        if (result.success) {
          // Log automated scheduling action
          await firestoreService.logAction('default_user', `Scheduled CLUTCH Block for "${task.title}"`);
          setSchedulingSlot(null);
        } else {
          alert('Could not schedule focus session. Please try a different slot.');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBooking(false);
    }
  };

  const handleItemClick = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setSelectedTaskForDetail(task);
    }
  };

  const activeTasksToSchedule = useMemo(() => {
    return tasks.filter((t) => t.status !== 'completed');
  }, [tasks]);

  return (
    <div className="p-4 md:p-8 space-y-6 bg-[#06060A] text-slate-100 min-h-screen">
      
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight uppercase font-mono">BATTLE PLAN TIMELINE</h1>
          <p className="text-xs text-slate-400 mt-1">Defend your focus blocks and resolve schedule friction points.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#0C0C14] border border-[#1E1E2E] p-1 rounded-xl">
            <button
              onClick={handlePrevWeek}
              className="p-2 hover:bg-white/5 text-slate-400 hover:text-white transition rounded-lg cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold font-mono text-slate-300 min-w-[120px] text-center">
              {headerLabel}
            </span>
            <button
              onClick={handleNextWeek}
              className="p-2 hover:bg-white/5 text-slate-400 hover:text-white transition rounded-lg cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleResetToToday}
            className="px-4 py-2.5 bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/20 transition text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase tracking-wider rounded-xl font-mono cursor-pointer"
          >
            Today
          </button>
        </div>
      </div>

      {/* Timeline Wrapper Grid */}
      <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-2xl overflow-x-auto shadow-2xl">
        <div className="min-w-[900px]">
          
          {/* Days Headers */}
          <div className="grid grid-cols-8 border-b border-slate-900">
            {/* Hour label placeholder */}
            <div className="p-4 flex items-center justify-center border-r border-slate-900 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
              Hour
            </div>

            {/* Weekday columns */}
            {weekDays.map((day) => {
              const isToday = day.toDateString() === new Date().toDateString();
              const dayName = day.toLocaleDateString(undefined, { weekday: 'short' });
              const dayNum = day.getDate();

              return (
                <div
                  key={day.toISOString()}
                  className="p-3.5 text-center flex flex-col items-center justify-center border-r border-slate-900/40 relative"
                >
                  <span className="text-xs font-bold text-slate-400 font-mono tracking-wider uppercase">{dayName}</span>
                  <span className="text-base font-black text-white mt-1">{dayNum}</span>
                  {isToday && (
                    <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-indigo-500 rounded-full" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Time axis & schedule blocks */}
          <div className="grid grid-cols-8 relative select-none">
            
            {/* Left Hour labels */}
            <div className="border-r border-slate-900 bg-[#08080C] flex flex-col relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
              {HOURS.map((hour, idx) => {
                const isAm = hour < 12;
                const displayHour = hour > 12 ? hour - 12 : hour;
                const suffix = isAm ? 'AM' : 'PM';

                return (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-b border-slate-900/30 flex items-start justify-end pr-3.5"
                    style={{
                      top: `${idx * HOUR_HEIGHT}px`,
                      height: `${HOUR_HEIGHT}px`,
                    }}
                  >
                    <span className="text-[10px] font-mono text-slate-550 pt-1">
                      {displayHour}:00 {suffix}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            {weekDays.map((day) => {
              const { dayEvents, daySessions } = getDayItems(day);
              const freeSlots = getDayFreeSlots(day, dayEvents, daySessions);

              return (
                <div
                  key={day.toISOString()}
                  className="border-r border-slate-900/40 relative bg-gradient-to-b from-[#0B0B10] to-[#08080C] overflow-hidden"
                  style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}
                >
                  
                  {/* Grid Lines Overlay */}
                  {HOURS.map((_, idx) => (
                    <div
                      key={idx}
                      className="absolute left-0 right-0 border-b border-slate-900/45 pointer-events-none"
                      style={{
                        top: `${idx * HOUR_HEIGHT}px`,
                        height: `${HOUR_HEIGHT}px`,
                      }}
                    />
                  ))}

                  {/* Calendar Events Positioning */}
                  {dayEvents.map((evt) => (
                    <div
                      key={evt.id}
                      style={getTimelineItemStyle(evt.start, evt.end)}
                      className="absolute left-1 right-1 bg-slate-800/60 border border-slate-700/60 rounded-xl p-2 shadow-sm flex flex-col justify-between overflow-hidden cursor-help group transition-all duration-200 hover:scale-[1.01] hover:bg-slate-800"
                    >
                      <span className="text-[10px] font-semibold text-slate-200 truncate leading-tight">
                        {evt.summary}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(evt.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}

                  {/* CLUTCH focus sessions */}
                  {daySessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleItemClick(session.taskId)}
                      style={getTimelineItemStyle(session.start, session.end)}
                      className="absolute left-1.5 right-1.5 bg-indigo-500/10 border border-indigo-500/35 rounded-xl p-2.5 shadow-md flex flex-col justify-between overflow-hidden cursor-pointer group transition-all duration-200 hover:scale-[1.01] hover:bg-indigo-500/20 hover:border-indigo-500/50"
                    >
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 font-mono tracking-wide uppercase">
                          <Zap className="w-2.5 h-2.5 fill-indigo-400" />
                          <span>🔒 CLUTCH BLOCK</span>
                        </div>
                        <span className="text-[10px] font-extrabold text-white truncate mt-1 leading-snug">
                          {session.taskTitle}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-indigo-400 mt-1">
                        {new Date(session.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} ({session.durationHours * 60}m)
                      </span>
                    </div>
                  ))}

                  {/* Free slots overlay with dashed border */}
                  {freeSlots.map((slot) => {
                    // Position calculations
                    const topOffset = (slot.startHour - 6) * HOUR_HEIGHT;
                    const duration = slot.endHour - slot.startHour;
                    const heightOffset = duration * HOUR_HEIGHT;

                    return (
                      <button
                        key={`${slot.startHour}-${slot.endHour}`}
                        onClick={() => handleOpenScheduleModal(day, slot.startHour, slot.endHour)}
                        style={{
                          top: `${topOffset + 3}px`,
                          height: `${heightOffset - 6}px`,
                        }}
                        className="absolute left-2 right-2 border border-dashed border-slate-700/60 bg-slate-900/15 hover:bg-indigo-500/5 hover:border-indigo-500/30 transition-all rounded-xl p-2 flex flex-col items-center justify-center text-center gap-1 cursor-pointer group"
                      >
                        <span className="text-[9px] font-mono font-bold text-slate-500 group-hover:text-indigo-400 uppercase tracking-widest">
                          + BOOK CLUTCH FOCUS
                        </span>
                        <span className="text-[8px] text-slate-600 group-hover:text-indigo-500 uppercase font-mono tracking-wider">
                          {slot.startHour}:00 - {slot.endHour}:00
                        </span>
                      </button>
                    );
                  })}

                </div>
              );
            })}

          </div>

        </div>
      </div>

      {/* Book schedule block overlay dialog */}
      {schedulingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSchedulingSlot(null)} />
          
          <div className="relative w-full max-w-sm bg-[#0C0C14] border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-900">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 rounded">
                  <Plus className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">
                  Schedule Clutch block
                </h3>
              </div>
              <button onClick={() => setSchedulingSlot(null)} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-[#13131F] border border-slate-850 rounded-xl space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Target Slot</p>
                <p className="text-xs font-bold text-white">
                  {schedulingSlot.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
                <p className="text-[11px] text-indigo-400 font-mono">
                  {schedulingSlot.startHour}:00 - {schedulingSlot.startHour + (schedulingSlot.durationMinutes / 60)}:00 ({schedulingSlot.durationMinutes} minutes)
                </p>
              </div>

              {activeTasksToSchedule.length === 0 ? (
                <div className="p-4 rounded-xl border border-yellow-500/15 bg-yellow-500/5 text-center space-y-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500 mx-auto" />
                  <p className="text-xs text-yellow-400 font-semibold">No Active Objectives Found</p>
                  <p className="text-[10px] text-slate-400">Please create a task first in the Command Center before scheduling focus blocks.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Select Objective</label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full bg-[#13131E] border border-slate-850 hover:border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-3 focus:outline-none focus:border-indigo-500 transition"
                  >
                    {activeTasksToSchedule.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.priority.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSchedulingSlot(null)}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-850 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBookSession}
                disabled={booking || activeTasksToSchedule.length === 0}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition text-white rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/10"
              >
                {booking ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Booking...</span>
                  </>
                ) : (
                  <span>Book Block</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Sheet overlay */}
      {selectedTaskForDetail && (
        <TaskDetailSheet
          open={!!selectedTaskForDetail}
          task={selectedTaskForDetail}
          onClose={() => setSelectedTaskForDetail(null)}
          onUpdate={async (updates) => {
            await updateTask(selectedTaskForDetail.id, updates);
            setSelectedTaskForDetail(null);
          }}
          onDelete={async () => {
            await deleteTask(selectedTaskForDetail.id);
            setSelectedTaskForDetail(null);
          }}
        />
      )}

    </div>
  );
}
