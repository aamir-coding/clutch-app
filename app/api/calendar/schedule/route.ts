import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, taskName, durationMinutes, startTime } = body;

    if (!taskId || !durationMinutes) {
      return NextResponse.json({ success: false, error: 'Missing taskId or durationMinutes' }, { status: 422 });
    }

    // Determine scheduled session time
    // If a start time is passed, use it, otherwise plan for a time tomorrow afternoon
    let scheduledTime: Date;
    if (startTime) {
      scheduledTime = new Date(startTime);
    } else {
      scheduledTime = new Date();
      scheduledTime.setDate(scheduledTime.getDate() + 1);
      scheduledTime.setHours(14, 0, 0, 0); // Default to 2 PM tomorrow
    }

    // Format time for response
    const formattedTime = scheduledTime.toLocaleDateString(undefined, {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

    return NextResponse.json({
      success: true,
      sessionTime: formattedTime,
      session: {
        id: `session-${crypto.randomUUID()}`,
        taskId,
        taskTitle: taskName || 'Scheduled Session',
        start: scheduledTime.toISOString(),
        end: new Date(scheduledTime.getTime() + durationMinutes * 60 * 1000).toISOString(),
        durationHours: durationMinutes / 60,
        status: 'scheduled',
      }
    });
  } catch (e: any) {
    console.error('Failed to schedule session:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
