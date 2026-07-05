import { calendarService }        from '../google/calendar';
import { gmailService }           from '../google/gmail';
import { googleTasksService }     from '../google/tasks';
import { adminFirestoreService }  from '../firebase/adminFirestore';
import { ToolResult }             from '../types';
import { hoursUntil }             from '../utils/dates';

export async function executeAgentTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  try {
    switch (toolName) {

      // ── Calendar ────────────────────────────────────────────────────────────

      case 'scan_calendar': {
        const events = await calendarService.getEvents(
          userId,
          new Date(args.start_date as string),
          new Date(args.end_date as string)
        );
        return {
          success: true,
          data:    events,
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
          data:    slots,
          summary:
            slots.length === 0
              ? `No free slots found on ${args.target_date}`
              : `Found ${slots.length} free slots on ${args.target_date}. ` +
                `Earliest at ${slots[0].start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        };
      }

      case 'schedule_work_session': {
        const start    = new Date(args.start_datetime as string);
        const duration = args.duration_minutes as number;
        const end      = new Date(start.getTime() + duration * 60000);
        const title    = `🔒 CLUTCH: ${args.task_name}`;

        const eventResult = await calendarService.createEvent(userId, {
          title,
          start,
          end,
          description: (args.session_description as string) || '',
          colorId:     '1',
        });

        if (args.task_id) {
          await adminFirestoreService.addScheduledSession(
            args.task_id as string,
            eventResult.eventId
          );
        }

        const dateStr = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return {
          success: true,
          data:    eventResult,
          summary: `Scheduled "${args.task_name}" on ${dateStr} at ${timeStr} for ${duration} min`,
        };
      }

      // ── Tasks ───────────────────────────────────────────────────────────────

      case 'get_all_tasks': {
        const filter = (args.filter as any) || 'all';
        const tasks  = await adminFirestoreService.getTasks(userId, filter);
        const atRiskCount = tasks.filter(t => (t.riskScore || 0) > 60).length;
        return {
          success: true,
          data:    tasks,
          summary: `Retrieved ${tasks.length} tasks. ${atRiskCount} at risk.`,
        };
      }

      case 'add_task': {
        const title          = args.title as string;
        const deadline       = new Date(args.deadline as string);
        const estimatedHours = (args.estimated_hours as number) || 2;
        const priority       = (args.priority as any) || 'medium';
        const subtasksRaw    = (args.subtasks as string[]) || [];
        const subtasks       = subtasksRaw.map((t, i) => ({ id: String(i), title: t, done: false }));

        const taskObj = {
          userId,
          title,
          deadline,
          estimatedHours,
          priority,
          progressPercent:   0,
          status:            'active' as const,
          subtasks,
          scheduledSessions: [] as string[],
          gmailThreadId:     null,
          notes:             '',
        };

        const newTask = await adminFirestoreService.createTask(userId, taskObj);

        // Auto-schedule: find next free 2-hour slot tomorrow.
        let autoScheduleSummary = '';
        try {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);

          const slots = await calendarService.findFreeSlots(userId, tomorrow, 120);
          if (slots && slots.length > 0) {
            const slotStart = slots[0].start;
            const slotEnd   = new Date(slotStart.getTime() + 120 * 60000);

            const eventResult = await calendarService.createEvent(userId, {
              title:       `🔒 CLUTCH: ${title}`,
              start:       slotStart,
              end:         slotEnd,
              description: `Deep work session scheduled automatically by CLUTCH for: ${title}`,
              colorId:     '1',
            });

            await adminFirestoreService.addScheduledSession(newTask.id, eventResult.eventId);

            const dateStr = slotStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            autoScheduleSummary = `. First session scheduled ${dateStr} at ${timeStr}.`;
          } else {
            autoScheduleSummary = `. No available slot found for auto-scheduling.`;
          }
        } catch (scheduleErr) {
          console.warn('Auto-scheduling failed:', scheduleErr);
          autoScheduleSummary = `. Auto-scheduling failed.`;
        }

        return {
          success: true,
          data:    newTask,
          summary: `Added task "${title}" due ${deadline.toLocaleDateString()}${autoScheduleSummary}`,
        };
      }

      case 'update_task_progress': {
        const taskId          = args.task_id as string;
        const progressPercent = (args.progress_percent as number) ?? 0;
        const completed       = !!args.completed;

        await adminFirestoreService.updateTaskProgress(taskId, progressPercent);

        if (completed) {
          await adminFirestoreService.updateTask(taskId, {
            status:      'completed',
            completedAt: new Date(),
          });
          await adminFirestoreService.incrementTasksSaved(userId);
        }

        return {
          success: true,
          data:    {},
          summary: `Updated "${taskId}" to ${completed ? 'completed' : progressPercent + '%'}`,
        };
      }

      case 'analyze_deadline_risk': {
        const taskId = args.task_id as string;
        const tasks  = await adminFirestoreService.getTasks(userId, 'all');
        const task   = tasks.find(t => t.id === taskId);
        if (!task) throw new Error(`Task with id ${taskId} not found`);

        const hoursLeft       = hoursUntil(task.deadline);
        const estimated       = task.estimatedHours || 2;
        const hoursOfWorkLeft = estimated * (1 - (task.progressPercent || 0) / 100);
        const ratio           = hoursOfWorkLeft > 0 ? hoursLeft / hoursOfWorkLeft : 999;

        let riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
        let riskScore: number;

        if (ratio < 1)        { riskLevel = 'CRITICAL'; riskScore = 95; }
        else if (ratio < 1.5) { riskLevel = 'HIGH';     riskScore = 75; }
        else if (ratio < 2)   { riskLevel = 'MEDIUM';   riskScore = 45; }
        else                  { riskLevel = 'LOW';       riskScore = 15; }

        await adminFirestoreService.updateTask(taskId, { riskScore });

        return {
          success: true,
          data:    { riskLevel, hoursLeft, hoursOfWorkLeft, ratio },
          summary: `Risk: ${riskLevel}. ${hoursLeft.toFixed(1)}h until deadline, ` +
                   `~${hoursOfWorkLeft.toFixed(1)}h of work remaining.`,
        };
      }

      // ── Gmail ───────────────────────────────────────────────────────────────

      case 'scan_gmail_for_deadlines': {
        const lookBackDays = (args.look_back_days as number) || 7;
        const deadlines    = await gmailService.scanForDeadlines(userId, lookBackDays);
        return {
          success: true,
          data:    deadlines,
          summary: `Found ${deadlines.length} potential deadlines in Gmail.`,
        };
      }

      case 'draft_email': {
        const to          = args.to as string;
        const subject     = args.subject as string;
        const body        = args.body as string;
        const saveAsDraft = args.save_as_draft !== false;

        if (!saveAsDraft) {
          await gmailService.sendEmail(userId, to, subject, body);
          return { success: true, data: {}, summary: `Email sent to ${to}: "${subject}"` };
        } else {
          const result = await gmailService.createDraft(userId, to, subject, body);
          return { success: true, data: result, summary: `Gmail draft created to ${to}: "${subject}"` };
        }
      }

      // ── Crisis ──────────────────────────────────────────────────────────────

      case 'activate_crisis_mode': {
        const taskId         = args.task_id as string;
        const taskTitle      = args.task_title as string;
        const hoursRemaining = (args.hours_remaining as number) || 0;
        const canComplete    = args.can_complete !== false;

        // Update Firestore via Admin SDK — no client-side store manipulation here.
        // The stream consumer (useAgent) receives a 'crisis_activated' event and
        // triggers the UI-store update on the browser side.
        await adminFirestoreService.updateTask(taskId, { priority: 'critical' });
        await adminFirestoreService.logAlert(userId, taskId, 'crisis');

        return {
          success: true,
          // taskId is included in data so the agent can emit a crisis_activated stream event.
          data:    { taskId, canComplete },
          summary: `Crisis Mode activated for "${taskTitle}". ${hoursRemaining.toFixed(1)}h remaining.`,
        };
      }

      // ── Battle Plan ─────────────────────────────────────────────────────────

      case 'generate_battle_plan': {
        const horizonDays = (args.planning_horizon_days as number) || 3;
        const { clutchAgent } = await import('./agent');
        const plan            = await clutchAgent.generateBattlePlan(userId, horizonDays);
        const sessionCount    = plan.battlePlan?.reduce(
          (acc, t) => acc + (t.sessions?.length || 0),
          0
        ) || 0;

        return {
          success: true,
          data:    plan,
          summary: `Battle plan generated: ${sessionCount} sessions across ${horizonDays} days. ` +
                   `${plan.impossibleTasks?.length || 0} impossible tasks flagged.`,
        };
      }

      default:
        return {
          success: false,
          data:    null,
          summary: `Unknown tool: ${toolName}`,
          error:   'UNKNOWN_TOOL',
        };
    }
  } catch (err) {
    return {
      success: false,
      data:    null,
      summary: `Tool ${toolName} failed: ${(err as Error).message}`,
      error:   (err as Error).message,
    };
  }
}