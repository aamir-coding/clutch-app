import { googleFetch, buildGoogleUrl } from './auth-client';
import { firestoreService } from '../firebase/firestore';
import { getWorkBoundaries } from '../utils/dates';
import { CalendarEvent, TimeSlot } from '../types';

export class CalendarService {
  async getEvents(userId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const url = buildGoogleUrl('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    });

    const response = await googleFetch(userId, url);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Calendar getEvents failed: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const items = data.items || [];

    return items.map((item: any) => {
      const startStr = item.start?.dateTime || item.start?.date;
      const endStr = item.end?.dateTime || item.end?.date;
      return {
        id: item.id,
        title: item.summary || 'Untitled',
        start: new Date(startStr),
        end: new Date(endStr),
        isAllDay: !!item.start?.date,
        colorId: item.colorId || '1',
      };
    });
  }

  async findFreeSlots(
    userId: string,
    targetDate: Date,
    durationMinutes: number,
    preferMorning?: boolean
  ): Promise<TimeSlot[]> {
    const user = await firestoreService.getUser(userId);
    const workHours = user?.workHours || { start: '09:00', end: '18:00' };

    const { workStart, workEnd } = getWorkBoundaries(targetDate, workHours);

    // Fetch calendar events for the whole day (midnight to midnight)
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const events = await this.getEvents(userId, dayStart, dayEnd);

    const busyIntervals: Array<{ start: number; end: number }> = [];
    for (const event of events) {
      const estart = event.start instanceof Date ? event.start.getTime() : new Date(event.start).getTime();
      const eend = event.end instanceof Date ? event.end.getTime() : new Date(event.end).getTime();

      const clampedStart = Math.max(estart, workStart.getTime());
      const clampedEnd = Math.min(eend, workEnd.getTime());

      if (clampedStart < clampedEnd) {
        busyIntervals.push({ start: clampedStart, end: clampedEnd });
      }
    }

    // Sort and merge overlapping busy intervals
    busyIntervals.sort((a, b) => a.start - b.start);
    const mergedBusy: Array<{ start: number; end: number }> = [];
    for (const interval of busyIntervals) {
      if (mergedBusy.length === 0) {
        mergedBusy.push(interval);
      } else {
        const last = mergedBusy[mergedBusy.length - 1];
        if (interval.start <= last.end) {
          last.end = Math.max(last.end, interval.end);
        } else {
          mergedBusy.push(interval);
        }
      }
    }

    // Calculate free gaps
    const freeSlots: TimeSlot[] = [];
    let currentStart = workStart.getTime();

    for (const busy of mergedBusy) {
      if (busy.start > currentStart) {
        freeSlots.push({
          start: new Date(currentStart),
          end: new Date(busy.start),
          durationMinutes: Math.floor((busy.start - currentStart) / 60000),
        });
      }
      currentStart = Math.max(currentStart, busy.end);
    }

    if (workEnd.getTime() > currentStart) {
      freeSlots.push({
        start: new Date(currentStart),
        end: new Date(workEnd.getTime()),
        durationMinutes: Math.floor((workEnd.getTime() - currentStart) / 60000),
      });
    }

    // Filter by durationMinutes
    let filteredSlots = freeSlots.filter((slot) => slot.durationMinutes >= durationMinutes);

    // If preferMorning, sort so morning slots (start hour < 12) come first
    if (preferMorning) {
      filteredSlots.sort((a, b) => {
        const aIsMorning = a.start.getHours() < 12 ? 0 : 1;
        const bIsMorning = b.start.getHours() < 12 ? 0 : 1;
        if (aIsMorning !== bIsMorning) {
          return aIsMorning - bIsMorning;
        }
        return a.start.getTime() - b.start.getTime();
      });
    }

    return filteredSlots;
  }

  async createEvent(
    userId: string,
    event: { title: string; start: Date; end: Date; description?: string; colorId?: string }
  ): Promise<{ eventId: string; htmlLink: string }> {
    const response = await googleFetch(userId, 'https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      body: JSON.stringify({
        summary: event.title,
        start: { dateTime: event.start.toISOString(), timeZone: 'UTC' },
        end: { dateTime: event.end.toISOString(), timeZone: 'UTC' },
        description: event.description || '',
        colorId: event.colorId || '1',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Calendar createEvent failed: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return {
      eventId: data.id,
      htmlLink: data.htmlLink,
    };
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    const response = await googleFetch(userId, `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Calendar deleteEvent failed: ${response.status} ${errText}`);
    }
  }

  async getWeekSummary(
    userId: string
  ): Promise<{ totalMeetingHours: number; freeHours: number; events: CalendarEvent[] }> {
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const events = await this.getEvents(userId, monday, sunday);

    // Compute total event duration in hours
    let totalMeetingDurationMs = 0;
    for (const event of events) {
      const start = event.start instanceof Date ? event.start.getTime() : new Date(event.start).getTime();
      const end = event.end instanceof Date ? event.end.getTime() : new Date(event.end).getTime();
      if (start < end) {
        totalMeetingDurationMs += end - start;
      }
    }
    const totalMeetingHours = totalMeetingDurationMs / 3600000;

    const user = await firestoreService.getUser(userId);
    const workHours = user?.workHours || { start: '09:00', end: '18:00' };
    const [startHour, startMin] = workHours.start.split(':').map(Number);
    const [endHour, endMin] = workHours.end.split(':').map(Number);
    const dailyWorkHours = (endHour + endMin / 60) - (startHour + startMin / 60);
    const totalWorkHoursInWeek = dailyWorkHours * 5;

    const freeHours = Math.max(0, totalWorkHoursInWeek - totalMeetingHours);

    return {
      totalMeetingHours,
      freeHours,
      events,
    };
  }
}

export const calendarService = new CalendarService();
