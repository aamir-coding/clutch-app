import { calendarService } from '../google/calendar';
import { gmailService } from '../google/gmail';
import { googleTasksService } from '../google/tasks';
import { firestoreService } from '../firebase/firestore';
import { useUiStore } from '../stores/uiStore';
import { ToolResult } from '../types';
import { hoursUntil } from '../utils/dates';

export async function executeAgentTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'scan_calendar': {
        const events = await calendarService.getEvents(
          userId,
          new Date(args.start_date as string),
          new Date(args.end_date as string)
        );
        return {
          success: true,
          data: events,
          summary: `Found ${events.length} events between ${args.start_date} and ${args.end_date}`,
        };
      }

      case 'find_free_slots': {
        const slots = await calendarService.findFreeSlots(
          userId,
          new Date(args.target_date as string),
          args.duration_minutes as number,
          args.prefer_morning as boolean
        );
        return {
          success: true,
          data: slots,
          summary: slots.length === 0
            ? `No free slots found on ${args.target_date}`
            : `Found ${slots.length} free slots on ${args.target_date}. Earliest at ${slots[0].start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        };
      }

      case 'schedule_work_session': {
        const start = new Date(args.start_datetime as string);
        const duration = args.duration_minutes as number;
        const end = new Date(start.getTime() + duration * 60000);
        const title = `🔒 CLUTCH: ${args.task_name}`;
        const description = (args.session_description as string) || '';

        const eventResult = await calendarService.createEvent(userId, {
          title,
          start,
          end,
          description,
          colorId: '1',
        });

        if (args.task_id) {
          await firestoreService.addScheduledSession(args.task_id as string, eventResult.eventId);
        }

        const dateStr = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return {
          success: true,
          data: eventResult,
          summary: `Scheduled "${args.task_name}" on ${dateStr} at ${timeStr} for ${duration} min`,
        };
      }

      case 'get_all_tasks': {
        const filter = (args.filter as any) || 'all';
        const tasks = await firestoreService.getTasks(userId, filter);
        const atRiskCount = tasks.filter((t) => (t.riskScore || 0) > 60).length;
        return {
          success: true,
          data: tasks,
          summary: `Retrieved ${tasks.length} tasks. ${atRiskCount} at risk.`,
        };
      }

      case 'add_task': {
        const title = args.title as string;
        const deadline = new Date(args.deadline as string);
        const estimatedHours = (args.estimated_hours as number) || 2;
        const priority = (args.priority as any) || 'medium';
        const subtasksArgs = (args.subtasks as string[]) || [];
        const subtasks = subtasksArgs.map((t, i) => ({ id: String(i), title: t, done: false }));

        const taskObj = {
          userId,
          title,
          deadline,
          estimatedHours,
          priority,
          progressPercent: 0,
          status: 'active' as const,
          subtasks,
          scheduledSessions: [],
          gmailThreadId: null,
          notes: '',
        };

        const newTask = await firestoreService.createTask(userId, taskObj);

        // Auto-schedule: find next free 2-hour slot tomorrow and create calendar event
        let autoScheduleSummary = '';
        try {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);

          const slots = await calendarService.findFreeSlots(userId, tomorrow, 120);
          if (slots && slots.length > 0) {
            const start = slots[0].start;
            const end = new Date(start.getTime() + 120 * 60000);
            const eventTitle = `🔒 CLUTCH: ${title}`;

            const eventResult = await calendarService.createEvent(userId, {
              title: eventTitle,
              start,
              end,
              description: `Deep work session scheduled automatically by CLUTCH for task: ${title}`,
              colorId: '1',
            });

            await firestoreService.addScheduledSession(newTask.id, eventResult.eventId);

            const dateStr = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            autoScheduleSummary = `. First work session scheduled on ${dateStr} at ${timeStr}.`;
          } else {
            autoScheduleSummary = `. No tomorrow slot found for auto-scheduling.`;
          }
        } catch (scheduleErr) {
          console.warn('Auto-scheduling failed:', scheduleErr);
          autoScheduleSummary = `. Auto-scheduling failed.`;
        }

        return {
          success: true,
          data: newTask,
          summary: `Added task "${title}" due ${deadline.toLocaleDateString()}${autoScheduleSummary}`,
        };
      }

      case 'update_task_progress': {
        const taskId = args.task_id as string;
        const progressPercent = (args.progress_percent as number) ?? 0;
        const completed = !!args.completed;

        await firestoreService.updateTaskProgress(taskId, progressPercent);

        if (completed) {
          await firestoreService.updateTask(taskId, { status: 'completed', completedAt: new Date() });
          await firestoreService.incrementTasksSaved(userId);
        }

        return {
          success: true,
          data: {},
          summary: `Updated "${taskId}" to ${completed ? 'completed' : progressPercent + '%'}`,
        };
      }

      case 'analyze_deadline_risk': {
        const taskId = args.task_id as string;
        const tasks = await firestoreService.getTasks(userId, 'all');
        const task = tasks.find((t) => t.id === taskId);
        if (!task) {
          throw new Error(`Task with id ${taskId} not found`);
        }

        const hoursLeft = hoursUntil(task.deadline);
        const estimated = task.estimatedHours || 2;
        const hoursOfWorkLeft = estimated * (1 - (task.progressPercent || 0) / 100);

        const ratio = hoursOfWorkLeft > 0 ? hoursLeft / hoursOfWorkLeft : 999;

        let riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
        let riskScore = 0;
        if (ratio < 1) {
          riskLevel = 'CRITICAL';
          riskScore = 95;
        } else if (ratio < 1.5) {
          riskLevel = 'HIGH';
          riskScore = 75;
        } else if (ratio < 2) {
          riskLevel = 'MEDIUM';
          riskScore = 45;
        } else {
          riskLevel = 'LOW';
          riskScore = 15;
        }

        await firestoreService.updateTask(taskId, { riskScore });

        return {
          success: true,
          data: { riskLevel, hoursLeft, hoursOfWorkLeft, ratio },
          summary: `Risk: ${riskLevel}. ${hoursLeft.toFixed(1)}h until deadline, ~${hoursOfWorkLeft.toFixed(1)}h of work remaining.`,
        };
      }

      case 'scan_gmail_for_deadlines': {
        const lookBackDays = (args.look_back_days as number) || 7;
        const deadlines = await gmailService.scanForDeadlines(userId, lookBackDays);
        return {
          success: true,
          data: deadlines,
          summary: `Found ${deadlines.length} potential deadlines in Gmail.`,
        };
      }

      case 'draft_email': {
        const to = args.to as string;
        const subject = args.subject as string;
        const body = args.body as string;
        const saveAsDraft = args.save_as_draft !== false;

        if (!saveAsDraft) {
          await gmailService.sendEmail(userId, to, subject, body);
          return {
            success: true,
            data: {},
            summary: `Email sent to ${to}: "${subject}"`,
          };
        } else {
          const result = await gmailService.createDraft(userId, to, subject, body);
          return {
            success: true,
            data: result,
            summary: `Gmail draft created to ${to}: "${subject}"`,
          };
        }
      }

      case 'activate_crisis_mode': {
        const taskId = args.task_id as string;
        const taskTitle = args.task_title as string;
        const hoursRemaining = (args.hours_remaining as number) || 0;
        const canComplete = args.can_complete !== false;

        useUiStore.getState().activateCrisisMode(taskId);
        await firestoreService.updateTask(taskId, { priority: 'critical' });
        await firestoreService.logAlert(userId, taskId, 'crisis');

        return {
          success: true,
          data: { canComplete },
          summary: `Crisis Mode activated for "${taskTitle}". ${hoursRemaining.toFixed(1)}h remaining.`,
        };
      }

      case 'generate_battle_plan': {
        const horizonDays = (args.planning_horizon_days as number) || 3;
        const { clutchAgent } = await import('./agent');
        const plan = await clutchAgent.generateBattlePlan(userId, horizonDays);

        const planSessionsLength = plan.battlePlan?.reduce((acc, task) => acc + (task.sessions?.length || 0), 0) || 0;

        return {
          success: true,
          data: plan,
          summary: `Battle plan generated: ${planSessionsLength} sessions across ${horizonDays} days. ${plan.impossibleTasks?.length || 0} impossible tasks flagged.`,
        };
      }

      default:
        return {
          success: false,
          data: null,
          summary: `Unknown tool: ${toolName}`,
          error: 'UNKNOWN_TOOL',
        };
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      summary: `Tool ${toolName} failed: ${(err as Error).message}`,
      error: (err as Error).message,
    };
  }
}
