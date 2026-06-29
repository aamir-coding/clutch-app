import { NextResponse } from 'next/server';

export async function GET() {
  // Simulate fetching and analyzing emails for the last 7 days
  const mockDeadlines = [
    {
      id: 'gmail-1',
      title: 'Database Migration Plan',
      description: 'Scanned from thread: Please complete the migration checklist and share the timeline by Monday.',
      deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), // 48h from now
      estimatedHours: 3,
      priority: 'high',
      status: 'active',
      subtasks: [
        { id: 'gm-sub-1', title: 'Compile migrations list', done: false },
        { id: 'gm-sub-2', title: 'Schedule maintenance window', done: false }
      ]
    },
    {
      id: 'gmail-2',
      title: 'Quarterly Security Compliance Review',
      description: 'Scanned from thread: Deadline for SOC2 review and internal sign-off is Wednesday evening.',
      deadline: new Date(Date.now() + 96 * 3600 * 1000).toISOString(), // 96h from now
      estimatedHours: 5,
      priority: 'critical',
      status: 'active',
      subtasks: [
        { id: 'gm-sub-3', title: 'Collect SOC2 evidence', done: false },
        { id: 'gm-sub-4', title: 'Sign security affidavit', done: false }
      ]
    },
    {
      id: 'gmail-3',
      title: 'Marketing Campaign Asset Delivery',
      description: 'Scanned from thread: Send assets to design agency by Thursday noon.',
      deadline: new Date(Date.now() + 120 * 3600 * 1000).toISOString(), // 120h from now
      estimatedHours: 2,
      priority: 'medium',
      status: 'active',
      subtasks: []
    }
  ];

  return NextResponse.json(mockDeadlines);
}
