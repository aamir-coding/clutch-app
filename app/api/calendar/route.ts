import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const sessions = [
      {
        id: 'session-1',
        taskId: 'task-1',
        taskTitle: 'Analyze Quarter 3 Deadline Risks',
        start: `${todayStr}T13:00:00`,
        end: `${todayStr}T15:00:00`,
        durationHours: 2,
        status: 'scheduled'
      },
      {
        id: 'session-2',
        taskId: 'task-2',
        taskTitle: 'Draft Client Onboarding Proposal',
        start: `${todayStr}T15:30:00`,
        end: `${todayStr}T17:30:00`,
        durationHours: 2,
        status: 'scheduled'
      }
    ];

    const events = [
      {
        id: 'event-1',
        summary: '👥 Team Standup & Sync Meeting',
        start: `${todayStr}T10:00:00`,
        end: `${todayStr}T10:30:00`
      },
      {
        id: 'event-2',
        summary: '💼 Client Presentation Review',
        start: `${todayStr}T11:00:00`,
        end: `${todayStr}T12:00:00`
      }
    ];

    return NextResponse.json({ sessions, events });
  } catch (e: any) {
    console.error('Failed to get calendar data:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
