'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/components/layout/AuthProvider';
import { TaskSession } from '@/lib/firebase/firestoreService';

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
}

export function useCalendar() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [sessions, setSessions] = useState<TaskSession[]>([]);
  const [loading, setLoading] = useState(false);

  // Keep track of last fetched range to allow automatic re-fetching
  const lastRangeRef = useRef<{ start: Date; end: Date } | null>(null);

  const fetchForDateRange = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    lastRangeRef.current = { start, end };
    try {
      const userId = user?.uid;
      if (!userId) {
        setEvents([]);
        setSessions([]);
        return;
      }
      const startDateStr = start.toISOString();
      const endDateStr = end.toISOString();

      const url = `/api/calendar?userId=${userId}&startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}`;
      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        // Adapt response: if there's sessions, use it. Fallback to freeSlots.
        setSessions(data.sessions || data.freeSlots || []);
      } else {
        console.error('Failed to fetch calendar data');
      }
    } catch (e) {
      console.error('Error fetching calendar range:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const scheduleSession = useCallback(async (
    taskId: string,
    taskName: string,
    durationMinutes: number,
    startTime?: string
  ): Promise<{ success: boolean; sessionTime?: string }> => {
    try {
      const res = await fetch('/api/calendar/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          taskName,
          durationMinutes,
          startTime
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // On success: re-fetch events for current week range
        if (lastRangeRef.current) {
          await fetchForDateRange(lastRangeRef.current.start, lastRangeRef.current.end);
        }

        return {
          success: true,
          sessionTime: data.sessionTime
        };
      } else if (res.status === 422) {
        return { success: false };
      }

      return { success: false };
    } catch (e) {
      console.error('Error scheduling session:', e);
      return { success: false };
    }
  }, [fetchForDateRange]);

  return {
    events,
    sessions,
    loading,
    fetchForDateRange,
    scheduleSession
  };
}