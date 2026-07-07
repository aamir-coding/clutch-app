import {
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  arrayUnion,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from './config';
import {
  User,
  Task,
  TaskSession,
  AgentMessage,
  MonitoringState,
  ImpactStats,
  TaskFilter,
} from '../types';

// ─── Error handling ───────────────────────────────────────────────────────────

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST   = 'list',
  GET    = 'get',
  WRITE  = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: { providerId?: string | null; email?: string | null }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId:        auth.currentUser?.uid || null,
      email:         auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous:   auth.currentUser?.isAnonymous || null,
      tenantId:      auth.currentUser?.tenantId || null,
      providerInfo:  auth.currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email:      p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapUser(uid: string, data: any): User {
  return {
    uid,
    email:          data.email || '',
    displayName:    data.displayName || '',
    photoURL:       data.photoURL || '',
    workHours:      data.workHours || { start: '09:00', end: '18:00' },
    productiveHours: data.productiveHours || [],
    avgTaskSpeed:   data.avgTaskSpeed ?? 1.0,
    fcmTokens:      data.fcmTokens || [],
    tokens:         data.tokens || null,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(data.createdAt || Date.now()),
    notificationPreferences: data.notificationPreferences,
    agentBehavior:           data.agentBehavior,
  };
}

function mapTask(id: string, data: any): Task {
  return {
    id,
    userId:      data.userId || '',
    title:       data.title || '',
    description: data.description,
    deadline:
      data.deadline instanceof Timestamp
        ? data.deadline.toDate()
        : new Date(data.deadline || Date.now()),
    status:           data.status || 'active',
    progressPercent:  data.progressPercent ?? 0,
    riskScore:        data.riskScore ?? 0,
    scheduledSessions: data.scheduledSessions || [],
    completedAt:
      data.completedAt instanceof Timestamp
        ? data.completedAt.toDate()
        : data.completedAt
        ? new Date(data.completedAt)
        : undefined,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(data.createdAt || Date.now()),
    estimatedHours: data.estimatedHours,
    priority:       data.priority,
    subtasks:       data.subtasks,
    gmailThreadId:  data.gmailThreadId,
    notes:          data.notes,
  };
}

function mapSession(id: string, data: any): TaskSession {
  return {
    id,
    taskId: data.taskId || '',
    userId: data.userId || '',
    scheduledStart:
      data.scheduledStart instanceof Timestamp
        ? data.scheduledStart.toDate()
        : new Date(data.scheduledStart || Date.now()),
    scheduledEnd:
      data.scheduledEnd instanceof Timestamp
        ? data.scheduledEnd.toDate()
        : new Date(data.scheduledEnd || Date.now()),
    actualEnd:
      data.actualEnd instanceof Timestamp
        ? data.actualEnd.toDate()
        : data.actualEnd
        ? new Date(data.actualEnd)
        : undefined,
    completed: data.completed ?? false,
    skipped:   data.skipped ?? false,
  };
}

function mapMonitoring(data: any): MonitoringState {
  return {
    userId:      data.userId || '',
    isMonitoring: data.isMonitoring ?? false,
    lastCheck:
      data.lastCheck instanceof Timestamp
        ? data.lastCheck.toDate()
        : data.lastCheck
        ? new Date(data.lastCheck)
        : undefined,
    alertLog: (data.alertLog || []).map((alert: any) => ({
      taskId:    alert.taskId || '',
      alertType: alert.alertType || 'planning',
      sentAt:
        alert.sentAt instanceof Timestamp
          ? alert.sentAt.toDate()
          : new Date(alert.sentAt || Date.now()),
    })),
  };
}

// ─── Service class ────────────────────────────────────────────────────────────

export class FirestoreService {

  // ── Users ───────────────────────────────────────────────────────────────────

  async createUser(
    uid: string,
    email: string,
    displayName: string,
    photoURL: string
  ): Promise<void> {
    const path = `users/${uid}`;
    try {
      await setDoc(
        doc(db, 'users', uid),
        {
          email,
          displayName,
          photoURL,
          workHours:       { start: '09:00', end: '18:00' },
          productiveHours: [],
          avgTaskSpeed:    1.0,
          fcmTokens:       [],
          tokens:          null,
          createdAt:       serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getUser(uid: string): Promise<User | null> {
    const path = `users/${uid}`;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) return null;
      return mapUser(uid, snap.data());
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async updateUser(uid: string, updates: Partial<User>): Promise<void> {
    const path = `users/${uid}`;
    try {
      const write: any = { ...updates };
      if (updates.createdAt instanceof Date) {
        write.createdAt = Timestamp.fromDate(updates.createdAt);
      }
      await updateDoc(doc(db, 'users', uid), write);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async saveTokens(
    uid: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: number
  ): Promise<void> {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), {
        tokens: { accessToken, refreshToken, expiresAt },
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async getTokens(
    uid: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
    const path = `users/${uid}`;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) return null;
      return snap.data().tokens || null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  // ── Tasks ───────────────────────────────────────────────────────────────────

  async createTask(
    userId: string,
    taskData: Omit<Task, 'id' | 'createdAt' | 'riskScore'>
  ): Promise<Task> {
    const path = 'tasks';
    try {
      const ref = await addDoc(collection(db, path), {
        ...taskData,
        userId,
        riskScore: 0,
        deadline:  Timestamp.fromDate(taskData.deadline),
        createdAt: serverTimestamp(),
      });
      return {
        id:                ref.id,
        userId,
        title:             taskData.title,
        description:       taskData.description,
        deadline:          taskData.deadline,
        status:            taskData.status || 'active',
        progressPercent:   taskData.progressPercent || 0,
        riskScore:         0,
        scheduledSessions: taskData.scheduledSessions || [],
        createdAt:         new Date(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async getTask(taskId: string): Promise<Task | null> {
    const path = `tasks/${taskId}`;
    try {
      const snap = await getDoc(doc(db, 'tasks', taskId));
      if (!snap.exists()) return null;
      return mapTask(snap.id, snap.data());
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async getTasks(userId: string, filter?: TaskFilter): Promise<Task[]> {
    const path = 'tasks';
    try {
      const runQuery = async (): Promise<Task[]> => {
        let q = query(collection(db, path), where('userId', '==', userId));

        const now        = new Date();
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
        const weekEnd    = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        if (filter === 'completed') {
          q = query(q, where('status', '==', 'completed'));
        } else if (filter === 'at_risk') {
          q = query(q, where('status', '==', 'active'), where('riskScore', '>', 60));
        } else if (filter === 'today') {
          q = query(
            q,
            where('deadline', '>=', Timestamp.fromDate(todayStart)),
            where('deadline', '<=', Timestamp.fromDate(todayEnd))
          );
        } else if (filter === 'this_week') {
          q = query(
            q,
            where('deadline', '>=', Timestamp.fromDate(now)),
            where('deadline', '<=', Timestamp.fromDate(weekEnd))
          );
        } else if (filter === 'overdue') {
          q = query(
            q,
            where('status', '==', 'active'),
            where('deadline', '<', Timestamp.fromDate(now))
          );
        }

        q = query(q, orderBy('deadline', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => mapTask(d.id, d.data()));
      };

      try {
        return await runQuery();
      } catch (err: any) {
        const isIndexError =
          err?.message?.includes('index') || err?.code === 'failed-precondition';
        if (!isIndexError) throw err;

        // Composite index not yet deployed — fall back to in-memory filtering
        console.warn('getTasks: index missing, using in-memory filter.');
        const snap = await getDocs(
          query(collection(db, path), where('userId', '==', userId))
        );
        let tasks = snap.docs.map(d => mapTask(d.id, d.data()));

        const now        = new Date();
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
        const weekEnd    = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        switch (filter) {
          case 'completed':  tasks = tasks.filter(t => t.status === 'completed'); break;
          case 'at_risk':    tasks = tasks.filter(t => t.status === 'active' && t.riskScore > 60); break;
          case 'today':      tasks = tasks.filter(t => t.deadline >= todayStart && t.deadline <= todayEnd); break;
          case 'this_week':  tasks = tasks.filter(t => t.deadline >= now && t.deadline <= weekEnd); break;
          case 'overdue':    tasks = tasks.filter(t => t.status === 'active' && t.deadline < now); break;
        }

        return tasks.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async getAtRiskTasks(userId: string, withinHours: number): Promise<Task[]> {
    const path      = 'tasks';
    const limitDate = new Date(Date.now() + withinHours * 3600000);
    try {
      const runQuery = async (): Promise<Task[]> => {
        const q = query(
          collection(db, path),
          where('userId',   '==', userId),
          where('status',   '==', 'active'),
          where('deadline', '<=', Timestamp.fromDate(limitDate)),
          orderBy('deadline', 'asc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => mapTask(d.id, d.data()));
      };

      try {
        return await runQuery();
      } catch (err: any) {
        const isIndexError =
          err?.message?.includes('index') || err?.code === 'failed-precondition';
        if (!isIndexError) throw err;

        console.warn('getAtRiskTasks: index missing, using in-memory filter.');
        const snap = await getDocs(
          query(collection(db, path), where('userId', '==', userId))
        );
        return snap.docs
          .map(d => mapTask(d.id, d.data()))
          .filter(t => t.status === 'active' && t.deadline <= limitDate)
          .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const path = `tasks/${taskId}`;
    try {
      const write: any = { ...updates };
      if (updates.deadline    instanceof Date) write.deadline    = Timestamp.fromDate(updates.deadline);
      if (updates.completedAt instanceof Date) write.completedAt = Timestamp.fromDate(updates.completedAt);
      if (updates.createdAt   instanceof Date) write.createdAt   = Timestamp.fromDate(updates.createdAt);
      await updateDoc(doc(db, 'tasks', taskId), write);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async updateTaskProgress(taskId: string, percent: number): Promise<void> {
    const path = `tasks/${taskId}`;
    try {
      const updates: any = { progressPercent: percent };
      if (percent >= 100) {
        updates.status      = 'completed';
        updates.completedAt = serverTimestamp();
      }
      await updateDoc(doc(db, 'tasks', taskId), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async addScheduledSession(taskId: string, calendarEventId: string): Promise<void> {
    const path = `tasks/${taskId}`;
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        scheduledSessions: arrayUnion(calendarEventId),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    const path = `tasks/${taskId}`;
    try {
      // Soft delete — preserves history and lets useTasks filter it out
      await updateDoc(doc(db, 'tasks', taskId), { status: 'cancelled' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async updateRiskScore(taskId: string, score: number): Promise<void> {
    const path = `tasks/${taskId}`;
    try {
      await updateDoc(doc(db, 'tasks', taskId), { riskScore: score });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  // ── Sessions ────────────────────────────────────────────────────────────────

  async createSession(session: Omit<TaskSession, 'id'>): Promise<TaskSession> {
    const path = 'sessions';
    try {
      const data: any = {
        ...session,
        scheduledStart: Timestamp.fromDate(session.scheduledStart),
        scheduledEnd:   Timestamp.fromDate(session.scheduledEnd),
      };
      if (session.actualEnd instanceof Date) {
        data.actualEnd = Timestamp.fromDate(session.actualEnd);
      }
      const ref = await addDoc(collection(db, path), data);
      return { ...session, id: ref.id };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async getSessionsForTask(taskId: string): Promise<TaskSession[]> {
    const path = 'sessions';
    try {
      const runQuery = async (): Promise<TaskSession[]> => {
        const q = query(
          collection(db, path),
          where('taskId', '==', taskId),
          orderBy('scheduledStart', 'asc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => mapSession(d.id, d.data()));
      };

      try {
        return await runQuery();
      } catch (err: any) {
        const isIndexError =
          err?.message?.includes('index') || err?.code === 'failed-precondition';
        if (!isIndexError) throw err;

        console.warn('getSessionsForTask: index missing, using in-memory sort.');
        const snap = await getDocs(
          query(collection(db, path), where('taskId', '==', taskId))
        );
        return snap.docs
          .map(d => mapSession(d.id, d.data()))
          .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async getSessionsForDate(userId: string, date: Date): Promise<TaskSession[]> {
    const path  = 'sessions';
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);
    try {
      const runQuery = async (): Promise<TaskSession[]> => {
        const q = query(
          collection(db, path),
          where('userId',         '==', userId),
          where('scheduledStart', '>=', Timestamp.fromDate(start)),
          where('scheduledStart', '<=', Timestamp.fromDate(end)),
          orderBy('scheduledStart', 'asc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => mapSession(d.id, d.data()));
      };

      try {
        return await runQuery();
      } catch (err: any) {
        const isIndexError =
          err?.message?.includes('index') || err?.code === 'failed-precondition';
        if (!isIndexError) throw err;

        console.warn('getSessionsForDate: index missing, using in-memory filter.');
        const snap = await getDocs(
          query(collection(db, path), where('userId', '==', userId))
        );
        return snap.docs
          .map(d => mapSession(d.id, d.data()))
          .filter(s => s.scheduledStart >= start && s.scheduledStart <= end)
          .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async markSessionCompleted(sessionId: string, actualEnd: Date): Promise<void> {
    const path = `sessions/${sessionId}`;
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        completed: true,
        actualEnd: Timestamp.fromDate(actualEnd),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async markSessionSkipped(sessionId: string): Promise<void> {
    const path = `sessions/${sessionId}`;
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { skipped: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  // ── Conversations ───────────────────────────────────────────────────────────

  async createConversation(userId: string): Promise<string> {
    const path = 'conversations';
    try {
      const ref = await addDoc(collection(db, path), {
        userId,
        messages:  [],
        createdAt: serverTimestamp(),
      });
      return ref.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async saveMessage(convId: string, message: AgentMessage): Promise<void> {
    const path = `conversations/${convId}`;
    try {
      await updateDoc(doc(db, 'conversations', convId), {
        messages: arrayUnion({
          ...message,
          timestamp: Timestamp.fromDate(message.timestamp),
        }),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async getHistory(convId: string, limitCount?: number): Promise<AgentMessage[]> {
    const path = `conversations/${convId}`;
    try {
      const snap = await getDoc(doc(db, 'conversations', convId));
      if (!snap.exists()) return [];
      const raw: any[] = snap.data().messages || [];
      const messages: AgentMessage[] = raw.map(m => ({
        ...m,
        timestamp:
          m.timestamp instanceof Timestamp
            ? m.timestamp.toDate()
            : new Date(m.timestamp || Date.now()),
      }));
      return limitCount && limitCount > 0 ? messages.slice(-limitCount) : messages;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  // ── Monitoring ──────────────────────────────────────────────────────────────

  async updateMonitoringState(userId: string, update: Partial<MonitoringState>): Promise<void> {
    const path = `monitoring/${userId}`;
    try {
      const write: any = { ...update };
      if (update.lastCheck instanceof Date) {
        write.lastCheck = Timestamp.fromDate(update.lastCheck);
      }
      if (update.alertLog) {
        write.alertLog = update.alertLog.map(a => ({
          ...a,
          sentAt: Timestamp.fromDate(a.sentAt),
        }));
      }
      await setDoc(doc(db, 'monitoring', userId), write, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getMonitoringState(userId: string): Promise<MonitoringState | null> {
    const path = `monitoring/${userId}`;
    try {
      const snap = await getDoc(doc(db, 'monitoring', userId));
      if (!snap.exists()) return null;
      return mapMonitoring(snap.data());
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async logAlert(
    userId: string,
    taskId: string,
    alertType: 'crisis' | 'urgent' | 'planning'
  ): Promise<void> {
    const path = `monitoring/${userId}`;
    try {
      await setDoc(
        doc(db, 'monitoring', userId),
        {
          alertLog: arrayUnion({
            taskId,
            alertType,
            sentAt: serverTimestamp(),
          }),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  // ── Impact ──────────────────────────────────────────────────────────────────

  async incrementTasksSaved(userId: string): Promise<void> {
    const path = `impact/${userId}`;
    try {
      await setDoc(
        doc(db, 'impact', userId),
        { tasksSaved: increment(1) },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async incrementHoursRecovered(userId: string, hours: number): Promise<void> {
    const path = `impact/${userId}`;
    try {
      await setDoc(
        doc(db, 'impact', userId),
        { hoursRecovered: increment(hours) },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getImpactStats(userId: string): Promise<ImpactStats> {
    const path = `impact/${userId}`;
    try {
      const snap = await getDoc(doc(db, 'impact', userId));
      if (!snap.exists()) {
        return { tasksSaved: 0, hoursRecovered: 0, onTimeRate: 0, currentStreak: 0 };
      }
      const d = snap.data();
      return {
        tasksSaved:     d.tasksSaved     || 0,
        hoursRecovered: d.hoursRecovered || 0,
        onTimeRate:     d.onTimeRate     || 0,
        currentStreak:  d.currentStreak  || 0,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async recordCompletedOnTime(userId: string, wasOnTime: boolean): Promise<void> {
    const path = `impact/${userId}`;
    try {
      const stats           = await this.getImpactStats(userId);
      const total           = stats.tasksSaved;
      const newTotal        = total + 1;
      const currentOnTime   = stats.onTimeRate * total;
      const newOnTimeRate   = newTotal > 0 ? (currentOnTime + (wasOnTime ? 1 : 0)) / newTotal : 0;
      const newStreak       = wasOnTime ? stats.currentStreak + 1 : 0;

      await setDoc(
        doc(db, 'impact', userId),
        {
          tasksSaved:    increment(1),
          onTimeRate:    newOnTimeRate,
          currentStreak: newStreak,
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export const firestoreService = new FirestoreService();