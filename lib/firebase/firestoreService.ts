// Firestore / Local Database Service with automatic persistence fallback
export interface UserProfile {
  id: string;
  createdAt: string;
  workStart: string;
  workEnd: string;
  productiveHours: string[];
  notificationPreferences?: {
    crisisAlerts: boolean;
    morningBriefing: boolean;
    schedulingNudges: boolean;
  };
  agentBehavior?: {
    autoSchedule: boolean;
    autoScanGmail: boolean;
    sessionLength: number;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  deadline: any; // Date, string, or Firestore Timestamp
  estimatedHours: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  progressPercent: number;
  status: 'active' | 'completed' | 'overdue';
  subtasks: { id: string; title: string; done: boolean }[];
  gmailThreadId?: string;
  notes?: string;
  createdAt: string;
}

export interface TaskSession {
  id: string;
  taskId: string;
  taskTitle: string;
  start: string; // ISO string or time
  end: string;
  durationHours: number;
  status: 'scheduled' | 'completed' | 'missed';
}

export interface ImpactStats {
  completedOnTime: number;
  focusHoursScheduled: number;
  currentStreak: number;
  gmailDeadlinesCaught: number;
}

// In-Memory & LocalStorage DB helper to act as mock-Firestore
const getLocalData = (key: string, defaultValue: any) => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const setLocalData = (key: string, data: any) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('LocalStorage write failed:', e);
  }
};

// Seed initial tasks if empty
const seedTasks = (): Task[] => {
  return [
    {
      id: 'task-1',
      title: 'Analyze Quarter 3 Deadline Risks',
      description: 'Review Q3 project timelines and mark tasks with high dependency risks.',
      deadline: new Date(Date.now() + 8 * 3600 * 1000).toISOString(), // 8 hours from now
      estimatedHours: 3,
      priority: 'critical',
      progressPercent: 40,
      status: 'active',
      subtasks: [
        { id: 'sub-1', title: 'Gather project roadmaps', done: true },
        { id: 'sub-2', title: 'Cross-reference with holiday calendar', done: false },
        { id: 'sub-3', title: 'Highlight late-stage bottlenecks', done: false }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: 'task-2',
      title: 'Draft Client Onboarding Proposal',
      description: 'Create tailored onboarding roadmap for Enterprise client.',
      deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // 24 hours from now
      estimatedHours: 4,
      priority: 'high',
      progressPercent: 10,
      status: 'active',
      subtasks: [
        { id: 'sub-4', title: 'Outline professional milestones', done: false },
        { id: 'sub-5', title: 'Confirm internal engineering support', done: false }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: 'task-3',
      title: 'Configure Clutch Alerts Webhook',
      description: 'Hook up custom trigger events to PagerDuty or Slack for automated team notification.',
      deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), // 48 hours from now
      estimatedHours: 1.5,
      priority: 'medium',
      progressPercent: 100,
      status: 'completed',
      subtasks: [],
      createdAt: new Date().toISOString()
    }
  ];
};

export const firestoreService = {
  async getTasks(userId: string, filter: 'all' | 'completed' | 'active' = 'all'): Promise<Task[]> {
    const tasks = getLocalData('clutch_tasks', []);
    if (tasks.length === 0) {
      const seeded = seedTasks();
      setLocalData('clutch_tasks', seeded);
      return filter === 'all' 
        ? seeded 
        : seeded.filter(t => filter === 'completed' ? t.status === 'completed' : t.status !== 'completed');
    }
    
    if (filter === 'all') return tasks;
    if (filter === 'completed') return tasks.filter((t: Task) => t.status === 'completed');
    return tasks.filter((t: Task) => t.status !== 'completed');
  },

  async createTask(userId: string, taskData: Partial<Task>): Promise<Task> {
    const tasks = await this.getTasks(userId);
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      deadline: taskData.deadline || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      estimatedHours: taskData.estimatedHours || 2,
      priority: taskData.priority || 'medium',
      progressPercent: taskData.progressPercent || 0,
      status: 'active',
      subtasks: taskData.subtasks || [],
      gmailThreadId: taskData.gmailThreadId,
      notes: taskData.notes || '',
      createdAt: new Date().toISOString()
    };
    tasks.push(newTask);
    setLocalData('clutch_tasks', tasks);
    
    // Log as action
    await this.logAction(userId, `Created task: "${newTask.title}"`);
    return newTask;
  },

  async updateTask(userId: string, taskId: string, updates: Partial<Task>): Promise<Task> {
    const tasks = await this.getTasks(userId);
    let updatedTask: Task | null = null;
    const nextTasks = tasks.map((t: Task) => {
      if (t.id === taskId) {
        updatedTask = { ...t, ...updates } as Task;
        return updatedTask;
      }
      return t;
    });
    setLocalData('clutch_tasks', nextTasks);
    if (!updatedTask) throw new Error('Task not found');
    return updatedTask;
  },

  async deleteTask(userId: string, taskId: string): Promise<void> {
    const tasks = await this.getTasks(userId);
    const filtered = tasks.filter((t: Task) => t.id !== taskId);
    setLocalData('clutch_tasks', filtered);
  },

  async getUser(userId: string): Promise<UserProfile> {
    const defaultUser: UserProfile = {
      id: userId || 'default-user',
      createdAt: new Date().toISOString(),
      workStart: '09:00',
      workEnd: '18:00',
      productiveHours: ['morning', 'afternoon'],
      notificationPreferences: {
        crisisAlerts: true,
        morningBriefing: true,
        schedulingNudges: true,
      },
      agentBehavior: {
        autoSchedule: false,
        autoScanGmail: false,
        sessionLength: 60,
      }
    };
    return getLocalData('clutch_user', defaultUser);
  },

  async updateUser(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const user = await this.getUser(userId);
    const updatedUser = { ...user, ...updates };
    setLocalData('clutch_user', updatedUser);
    return updatedUser;
  },

  async getUserWorkHours(userId: string): Promise<{ workStart: string; workEnd: string }> {
    const user = await this.getUser(userId);
    return { workStart: user.workStart, workEnd: user.workEnd };
  },

  async getImpactStats(userId: string): Promise<ImpactStats> {
    const tasks = await this.getTasks(userId);
    const completed = tasks.filter((t: Task) => t.status === 'completed');
    const onTime = completed.filter((t: Task) => {
      const dl = new Date(t.deadline).getTime();
      return dl > Date.now(); // Simplified on-time check
    }).length;

    return getLocalData('clutch_impact_stats', {
      completedOnTime: onTime || 4,
      focusHoursScheduled: 18,
      currentStreak: 5,
      gmailDeadlinesCaught: 8
    });
  },

  async getSessionsForTask(taskId: string): Promise<TaskSession[]> {
    const sessions = getLocalData('clutch_sessions', [
      {
        id: 'session-1',
        taskId: 'task-1',
        taskTitle: 'Analyze Quarter 3 Deadline Risks',
        start: '2026-06-27T14:00:00',
        end: '2026-06-27T16:00:00',
        durationHours: 2,
        status: 'scheduled'
      }
    ]);
    return sessions.filter((s: TaskSession) => s.taskId === taskId);
  },

  async logAction(userId: string, actionText: string): Promise<void> {
    const logs = getLocalData('clutch_logs', [
      { id: 'log-1', timestamp: new Date(Date.now() - 3600 * 1000).toISOString(), text: 'Scheduled 2 work sessions for "Analyze Quarter 3 Deadline Risks"' },
      { id: 'log-2', timestamp: new Date(Date.now() - 86400 * 1000).toISOString(), text: 'Scanned Gmail inbox; flagged 2 high-risk deadlines' },
      { id: 'log-3', timestamp: new Date(Date.now() - 172800 * 1000).toISOString(), text: 'Created crisis recovery battle plan' }
    ]);
    
    logs.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      text: actionText
    });
    
    setLocalData('clutch_logs', logs.slice(0, 50)); // Keep last 50
  },

  async getRecentActions(userId: string): Promise<{ id: string; timestamp: string; text: string }[]> {
    const logs = getLocalData('clutch_logs', [
      { id: 'log-1', timestamp: new Date(Date.now() - 3600 * 1000).toISOString(), text: 'Scheduled 2 work sessions for "Analyze Quarter 3 Deadline Risks"' },
      { id: 'log-2', timestamp: new Date(Date.now() - 86400 * 1000).toISOString(), text: 'Scanned Gmail inbox; flagged 2 high-risk deadlines' },
      { id: 'log-3', timestamp: new Date(Date.now() - 172800 * 1000).toISOString(), text: 'Created crisis recovery battle plan' }
    ]);
    return logs;
  }
};
