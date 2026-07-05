export interface NotificationPreferences {
  crisisAlerts: boolean;
  morningBriefing: boolean;
  schedulingNudges: boolean;
}

export interface AgentBehaviorPreferences {
  autoSchedule: boolean;
  autoScanGmail: boolean;
  sessionLength: number;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  workHours: {
    start: string;
    end: string;
  };
  productiveHours: string[];
  avgTaskSpeed: number;
  fcmTokens: string[];
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  } | null;
  createdAt: Date;
  notificationPreferences?: NotificationPreferences;
  agentBehavior?: AgentBehaviorPreferences;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  deadline: Date;
  status: 'active' | 'completed' | 'cancelled';
  progressPercent: number;
  riskScore: number;
  scheduledSessions?: string[];
  completedAt?: Date;
  createdAt: Date;
  estimatedHours?: number;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  subtasks?: Array<{ id: string; title: string; done: boolean }>;
  gmailThreadId?: string | null;
  notes?: string;
}

export interface TaskSession {
  id: string;
  taskId: string;
  userId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualEnd?: Date;
  completed: boolean;
  skipped: boolean;
}

export interface AgentMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Every variant the Gemini agent stream can emit.
 *
 * `crisis_activated` is yielded by `clutchAgent.runStream` when the
 * `activate_crisis_mode` tool completes successfully. The API route forwards
 * it to the browser as a JSON-line event; `useAgent` receives it and calls
 * `useUiStore.getState().activateCrisisMode(taskId)` to trigger the overlay.
 *
 * This keeps the Zustand UI store entirely client-side: the server never
 * touches it, and the browser reacts to the stream event.
 */
export type AgentStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string }
  | { type: 'tool_result'; name: string; summary: string }
  | { type: 'crisis_activated'; taskId: string }
  | { type: 'error'; message: string };

export interface WorkPlan {
  battlePlan: Array<{
    taskId: string;
    taskTitle: string;
    riskScore: number;
    sessions: Array<{
      date: string;
      start: string;
      end: string;
      focus: string;
    }>;
  }>;
  impossibleTasks: Array<{
    taskId: string;
    reason: string;
  }>;
  summary: string;
  totalHoursScheduled: number;
}

export interface MonitoringState {
  userId: string;
  isMonitoring: boolean;
  lastCheck?: Date;
  alertLog?: Array<{
    taskId: string;
    alertType: 'crisis' | 'urgent' | 'planning';
    sentAt: Date;
  }>;
}

export interface ImpactStats {
  tasksSaved: number;
  hoursRecovered: number;
  onTimeRate: number;
  currentStreak: number;
}

export type TaskFilter = 'all' | 'at_risk' | 'today' | 'this_week' | 'overdue' | 'completed';

export interface CalendarEvent {
  id?: string;
  summary?: string;
  title?: string;
  start: Date | string;
  end: Date | string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export interface GmailDeadline {
  title: string;
  deadline: string | null;
  deadlineConfidence: 'high' | 'medium' | 'low';
  sender: string;
  context: string;
  threadId: string;
  emailSnippet: string;
}

export type RiskLevel    = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ToolResult {
  success: boolean;
  data: any;
  summary: string;
  error?: string;
}