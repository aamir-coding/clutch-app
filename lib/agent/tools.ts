import { Tool } from '@google/generative-ai';

/**
 * Tool definitions for the Gemini function-calling API.
 *
 * Schema types must be plain string literals ('object', 'string', etc.)
 * rather than the SchemaType enum — using the enum causes a runtime
 * serialisation mismatch that makes Gemini ignore the tool definitions
 * silently, producing a plain-text response instead of tool calls.
 */
export const CLUTCH_TOOLS: Tool[] = [
  {
    functionDeclarations: [

      // ── Calendar ────────────────────────────────────────────────────────

      {
        name:        'scan_calendar',
        description: 'Retrieve Google Calendar events for a date range. Use this to understand the user\'s existing schedule before suggesting new sessions.',
        parameters: {
          type: 'object' as any,
          properties: {
            start_date: {
              type:        'string' as any,
              description: 'ISO 8601 start datetime, e.g. 2025-01-20T00:00:00Z',
            },
            end_date: {
              type:        'string' as any,
              description: 'ISO 8601 end datetime, e.g. 2025-01-27T23:59:59Z',
            },
          },
          required: ['start_date', 'end_date'],
        },
      },

      {
        name:        'find_free_slots',
        description: 'Find available free time slots in the user\'s calendar on a specific day that are long enough for a focus session.',
        parameters: {
          type: 'object' as any,
          properties: {
            target_date: {
              type:        'string' as any,
              description: 'ISO 8601 date to find slots on, e.g. 2025-01-21T00:00:00Z',
            },
            duration_minutes: {
              type:        'number' as any,
              description: 'Minimum slot length in minutes, e.g. 60, 90, 120',
            },
            prefer_morning: {
              type:        'boolean' as any,
              description: 'If true, surface morning slots first',
            },
          },
          required: ['target_date', 'duration_minutes'],
        },
      },

      {
        name:        'schedule_work_session',
        description: 'Create a Google Calendar event to block focus time for a specific task. Always call find_free_slots first to confirm the slot is available.',
        parameters: {
          type: 'object' as any,
          properties: {
            task_id: {
              type:        'string' as any,
              description: 'Firestore ID of the task this session is for',
            },
            task_name: {
              type:        'string' as any,
              description: 'Human-readable task name (used as calendar event title)',
            },
            start_datetime: {
              type:        'string' as any,
              description: 'ISO 8601 start datetime for the session',
            },
            duration_minutes: {
              type:        'number' as any,
              description: 'Session length in minutes',
            },
            session_description: {
              type:        'string' as any,
              description: 'Optional notes or sub-goals for the session',
            },
          },
          required: ['task_name', 'start_datetime', 'duration_minutes'],
        },
      },

      // ── Tasks ────────────────────────────────────────────────────────────

      {
        name:        'get_all_tasks',
        description: 'Retrieve the user\'s tasks from Firestore. Always call this before giving advice about scheduling or deadlines.',
        parameters: {
          type: 'object' as any,
          properties: {
            filter: {
              type: 'string' as any,
              description: 'Narrow the result set. One of: all, at_risk, today, this_week, overdue, completed. Defaults to all.',
              enum: ['all', 'at_risk', 'today', 'this_week', 'overdue', 'completed'],
            },
          },
        },
      },

      {
        name:        'add_task',
        description: 'Add a new task to Firestore and auto-schedule a first focus session in Google Calendar.',
        parameters: {
          type: 'object' as any,
          properties: {
            title: {
              type:        'string' as any,
              description: 'Clear, concise task title',
            },
            deadline: {
              type:        'string' as any,
              description: 'ISO 8601 deadline datetime',
            },
            estimated_hours: {
              type:        'number' as any,
              description: 'Estimated total hours of focused work needed',
            },
            priority: {
              type:        'string' as any,
              description: 'Task priority level',
              enum: ['critical', 'high', 'medium', 'low'],
            },
            subtasks: {
              type: 'array' as any,
              description: 'Optional list of subtask titles',
              items: { type: 'string' as any },
            },
          },
          required: ['title', 'deadline'],
        },
      },

      {
        name:        'update_task_progress',
        description: 'Update the completion percentage of a task, or mark it as fully complete.',
        parameters: {
          type: 'object' as any,
          properties: {
            task_id: {
              type:        'string' as any,
              description: 'Firestore document ID of the task',
            },
            progress_percent: {
              type:        'number' as any,
              description: 'New completion percentage, 0–100',
            },
            completed: {
              type:        'boolean' as any,
              description: 'Set to true to mark the task as fully complete',
            },
          },
          required: ['task_id', 'progress_percent'],
        },
      },

      {
        name:        'analyze_deadline_risk',
        description: 'Calculate the deadline risk score for a specific task based on time remaining and estimated work hours. Updates riskScore in Firestore.',
        parameters: {
          type: 'object' as any,
          properties: {
            task_id: {
              type:        'string' as any,
              description: 'Firestore document ID of the task to analyse',
            },
          },
          required: ['task_id'],
        },
      },

      // ── Gmail ────────────────────────────────────────────────────────────

      {
        name:        'scan_gmail_for_deadlines',
        description: 'Scan the user\'s Gmail inbox for emails that contain deadlines, commitments, or time-sensitive requests.',
        parameters: {
          type: 'object' as any,
          properties: {
            look_back_days: {
              type:        'number' as any,
              description: 'How many days back to scan. Defaults to 7.',
            },
          },
        },
      },

      {
        name:        'draft_email',
        description: 'Compose and optionally send an email on behalf of the user via Gmail.',
        parameters: {
          type: 'object' as any,
          properties: {
            to: {
              type:        'string' as any,
              description: 'Recipient email address',
            },
            subject: {
              type:        'string' as any,
              description: 'Email subject line',
            },
            body: {
              type:        'string' as any,
              description: 'Plain text email body',
            },
            save_as_draft: {
              type:        'boolean' as any,
              description: 'If true, save as draft instead of sending. Defaults to true.',
            },
          },
          required: ['to', 'subject', 'body'],
        },
      },

      // ── Crisis ───────────────────────────────────────────────────────────

      {
        name:        'activate_crisis_mode',
        description: 'Activate Crisis Mode for a task with a deadline under 4 hours. This flags the task as critical, sends a push notification, and opens the crisis UI overlay.',
        parameters: {
          type: 'object' as any,
          properties: {
            task_id: {
              type:        'string' as any,
              description: 'Firestore document ID of the task in crisis',
            },
            task_title: {
              type:        'string' as any,
              description: 'Human-readable task name',
            },
            hours_remaining: {
              type:        'number' as any,
              description: 'Hours until the deadline',
            },
            can_complete: {
              type:        'boolean' as any,
              description: 'Whether completion is still achievable given current progress',
            },
          },
          required: ['task_id', 'task_title', 'hours_remaining'],
        },
      },

      // ── Battle Plan ──────────────────────────────────────────────────────

      {
        name:        'generate_battle_plan',
        description: 'Generate a full multi-day work plan that schedules all active tasks into Google Calendar focus blocks. Use this when the user asks for a schedule, plan, or battle plan.',
        parameters: {
          type: 'object' as any,
          properties: {
            planning_horizon_days: {
              type:        'number' as any,
              description: 'Number of days to plan ahead. Defaults to 3.',
            },
          },
        },
      },

    ],
  },
];