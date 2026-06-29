import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Create task
    const newTask = {
      id: crypto.randomUUID(),
      title: body.title || 'Untitled Objective',
      description: body.description || '',
      deadline: body.deadline || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      estimatedHours: body.estimatedHours || 2,
      priority: body.priority || 'medium',
      progressPercent: 0,
      status: 'active',
      subtasks: body.subtasks || [],
      gmailThreadId: body.gmailThreadId,
      createdAt: new Date().toISOString()
    };

    // Return the response
    return NextResponse.json(newTask, { status: 201 });
  } catch (e: any) {
    console.error('Failed to create task API:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
