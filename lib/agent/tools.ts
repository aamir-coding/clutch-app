import { Tool, SchemaType } from '@google/generative-ai';

export const CLUTCH_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'scan_calendar',
        description: 'Read Google Calendar events for a date range. Call this before scheduling anything to understand the user\'s existing commitments.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            start_date: { type: SchemaType.STRING, description: 'ISO 8601 date YYYY-MM-DD' },
            end_date: { type: SchemaType.STRING, description: 'ISO 8601 date YYYY-MM-DD' }
          },
          required: ['start_date', 'end_date']
        }
      },
      {
        name: 'find_free_slots',
        description: 'Find available time blocks within the user\'s work hours on a given day. Returns slots long enough for a work session.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            target_date: { type: SchemaType.STRING, description: 'ISO 8601 date YYYY-MM-DD' },
            duration_minutes: { type: SchemaType.NUMBER, description: 'Minimum slot length needed in minutes' },
            prefer_morning: { type: SchemaType.BOOLEAN, description: 'If true, return morning slots first' }
          },
          required: ['target_date', 'duration_minutes']
        }
      },
      {
        name: 'schedule_work_session',
        description: 'Create a Google Calendar event to block time for a specific task. This writes a real event to the user\'s calendar.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            task_name: { type: SchemaType.STRING },
            task_id: { type: SchemaType.STRING },
            start_datetime: { type: SchemaType.STRING, description: 'ISO 8601 datetime with timezone offset' },
            duration_minutes: { type: SchemaType.NUMBER },
            session_description: { type: SchemaType.STRING, description: 'What the user should focus on in this session' }
          },
          required: ['task_name', 'start_datetime', 'duration_minutes']
        }
      },
      {
        name: 'get_all_tasks',
        description: 'Retrieve all tasks from the user\'s CLUTCH task list with their deadlines, progress, and risk scores.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            filter: { type: SchemaType.STRING, description: 'all|at_risk|today|this_week|overdue' }
          }
        }
      },
      {
        name: 'add_task',
        description: 'Add a new task to track. After adding, the agent will automatically find and schedule work sessions.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING },
            deadline: { type: SchemaType.STRING, description: 'ISO 8601 datetime' },
            estimated_hours: { type: SchemaType.NUMBER },
            priority: { type: SchemaType.STRING, description: 'critical|high|medium|low' },
            subtasks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
          },
          required: ['title', 'deadline']
        }
      },
      {
        name: 'update_task_progress',
        description: 'Update a task\'s completion percentage or mark it as done when the user reports progress.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            task_id: { type: SchemaType.STRING },
            progress_percent: { type: SchemaType.NUMBER, description: '0 to 100' },
            completed: { type: SchemaType.BOOLEAN },
            completion_note: { type: SchemaType.STRING }
          },
          required: ['task_id']
        }
      },
      {
        name: 'analyze_deadline_risk',
        description: 'Compute whether a task can realistically be completed by its deadline given remaining work hours and calendar availability. Returns a risk level and reason.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            task_id: { type: SchemaType.STRING },
            deadline: { type: SchemaType.STRING },
            hours_remaining_estimate: { type: SchemaType.NUMBER }
          },
          required: ['task_id', 'deadline']
        }
      },
      {
        name: 'scan_gmail_for_deadlines',
        description: 'Search Gmail for emails that contain deadlines or time-sensitive commitments the user may have missed. Extracts them as tasks to add.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            look_back_days: { type: SchemaType.NUMBER, description: 'How many days back to scan. Defaults to 7.' }
          }
        }
      },
      {
        name: 'draft_email',
        description: 'Create a Gmail draft. Use this for deadline extension requests, status updates, or any commitment communication.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            to: { type: SchemaType.STRING },
            subject: { type: SchemaType.STRING },
            body: { type: SchemaType.STRING },
            save_as_draft: { type: SchemaType.BOOLEAN, description: 'If false, send immediately. Defaults to true.' }
          },
          required: ['to', 'subject', 'body']
        }
      },
      {
        name: 'activate_crisis_mode',
        description: 'Activate CLUTCH Crisis Mode for a task due in under 4 hours. This triggers the full-screen crisis UI and re-prioritizes the user\'s focus.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            task_id: { type: SchemaType.STRING },
            task_title: { type: SchemaType.STRING },
            hours_remaining: { type: SchemaType.NUMBER },
            can_complete: { type: SchemaType.BOOLEAN, description: 'Whether the task can realistically be finished in time' }
          },
          required: ['task_id', 'hours_remaining']
        }
      },
      {
        name: 'generate_battle_plan',
        description: 'Generate a complete scheduled work plan for the coming days, automatically creating calendar sessions for each task based on priority and available time.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            planning_horizon_days: { type: SchemaType.NUMBER, description: 'Days to plan ahead (1–7)' },
            auto_schedule: { type: SchemaType.BOOLEAN, description: 'If true, auto-create calendar events without additional confirmation' }
          }
        }
      }
    ]
  }
];
