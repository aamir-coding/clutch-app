import {
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  addDoc,
  arrayUnion,
  serverTimestamp,
  increment,
  Timestamp,
  writeBatch,
  documentId
} from 'firebase/firestore';
import { db, auth } from './config';
import {
  User,
  Task,
  TaskSession,
  AgentMessage,
  MonitoringState,
  ImpactStats,
  TaskFilter
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
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
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function mapUser(uid: string, data: any): User {
  return {
    uid,
    email: data.email || '',
    displayName: data.displayName || '',
    photoURL: data.photoURL || '',
    workHours: data.workHours || { start: '09:00', end: '18:00' },
    productiveHours: data.productiveHours || [],
    avgTaskSpeed: data.avgTaskSpeed ?? 1.0,
    fcmTokens: data.fcmTokens || [],
    tokens: data.tokens || null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt || Date.now())
  };
}

function mapTask(id: string, data: any): Task {
  return {
    id,
    userId: data.userId || '',
    title: data.title || '',
    description: data.description,
    deadline: data.deadline instanceof Timestamp ? data.deadline.toDate() : new Date(data.deadline || Date.now()),
    status: data.status || 'active',
    progressPercent: data.progressPercent ?? 0,
    riskScore: data.riskScore ?? 0,
    scheduledSessions: data.scheduledSessions || [],
    completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate() : data.completedAt ? new Date(data.completedAt) : undefined,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
    estimatedHours: data.estimatedHours,
    priority: data.priority,
    subtasks: data.subtasks,
    gmailThreadId: data.gmailThreadId,
    notes: data.notes
  };
}

function mapSession(id: string, data: any): TaskSession {
  return {
    id,
    taskId: data.taskId || '',
    userId: data.userId || '',
    scheduledStart: data.scheduledStart instanceof Timestamp ? data.scheduledStart.toDate() : new Date(data.scheduledStart || Date.now()),
    scheduledEnd: data.scheduledEnd instanceof Timestamp ? data.scheduledEnd.toDate() : new Date(data.scheduledEnd || Date.now()),
    actualEnd: data.actualEnd instanceof Timestamp ? data.actualEnd.toDate() : data.actualEnd ? new Date(data.actualEnd) : undefined,
    completed: data.completed ?? false,
    skipped: data.skipped ?? false
  };
}

function mapMonitoring(data: any): MonitoringState {
  return {
    userId: data.userId || '',
    isMonitoring: data.isMonitoring ?? false,
    lastCheck: data.lastCheck instanceof Timestamp ? data.lastCheck.toDate() : data.lastCheck ? new Date(data.lastCheck) : undefined,
    alertLog: (data.alertLog || []).map((alert: any) => ({
      taskId: alert.taskId || '',
      alertType: alert.alertType || 'planning',
      sentAt: alert.sentAt instanceof Timestamp ? alert.sentAt.toDate() : new Date(alert.sentAt || Date.now())
    }))
  };
}

export class FirestoreService {
  // ==========================================
  // USER METHODS
  // ==========================================

  async createUser(uid: string, email: string, displayName: string, photoURL: string): Promise<void> {
    const path = `users/${uid}`;
    try {
      await setDoc(doc(db, 'users', uid), {
        email,
        displayName,
        photoURL,
        workHours: { start: '09:00', end: '18:00' },
        productiveHours: [],
        avgTaskSpeed: 1.0,
        fcmTokens: [],
        tokens: null,
        createdAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getUser(uid: string): Promise<User | null> {
    const path = `users/${uid}`;
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (!docSnap.exists()) return null;
      return mapUser(uid, docSnap.data());
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async updateUser(uid: string, updates: Partial<User>): Promise<void> {
    const path = `users/${uid}`;
    try {
      const writeUpdates: any = { ...updates };
      if (updates.createdAt instanceof Date) {
        writeUpdates.createdAt = Timestamp.fromDate(updates.createdAt);
      }
      await updateDoc(doc(db, 'users', uid), writeUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async saveTokens(uid: string, accessToken: string, refreshToken: string, expiresAt: number): Promise<void> {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), {
        tokens: { accessToken, refreshToken, expiresAt }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async getTokens(uid: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
    const path = `users/${uid}`;
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (!docSnap.exists()) return null;
      const data = docSnap.data();
      return data.tokens || null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  // ==========================================
  // TASK METHODS
  // ==========================================

  async createTask(userId: string, taskData: Omit<Task, 'id' | 'createdAt' | 'riskScore'>): Promise<Task> {
    const path = 'tasks';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...taskData,
        userId,
        riskScore: 0,
        deadline: Timestamp.fromDate(taskData.deadline),
        createdAt: serverTimestamp(),
      });
      return {
        id: docRef.id,
        userId,
        title: taskData.title,
        description: taskData.description,
        deadline: taskData.deadline,
        status: taskData.status || 'active',
        progressPercent: taskData.progressPercent || 0,
        riskScore: 0,
        scheduledSessions: taskData.scheduledSessions || [],
        createdAt: new Date(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async getTask(taskId: string): Promise<Task | null> {
    const path = `tasks/${taskId}`;
    try {
      const docSnap = await getDoc(doc(db, 'tasks', taskId));
      if (!docSnap.exists()) return null;
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: data.userId,
        title: data.title,
        description: data.description,
        deadline: data.deadline instanceof Timestamp ? data.deadline.toDate() : new Date(data.deadline),
        status: data.status,
        progressPercent: data.progressPercent,
        riskScore: data.riskScore,
        scheduledSessions: data.scheduledSessions || [],
        completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate() : data.completedAt ? new Date(data.completedAt) : undefined,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        estimatedHours: data.estimatedHours,
        priority: data.priority,
        subtasks: data.subtasks,
        gmailThreadId: data.gmailThreadId,
        notes: data.notes,
      } as Task;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async getTasks(userId: string, filter?: TaskFilter): Promise<Task[]> {
    const path = 'tasks';
    try {
      const runQuery = async () => {
        let q = query(collection(db, path), where('userId', '==', userId));

        if (filter === 'completed') {
          q = query(q, where('status', '==', 'completed'));
        } else if (filter === 'at_risk') {
          q = query(q, where('status', '==', 'active'), where('riskScore', '>', 60));
        } else if (filter === 'today') {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);
          q = query(
            q,
            where('deadline', '>=', Timestamp.fromDate(todayStart)),
            where('deadline', '<=', Timestamp.fromDate(todayEnd))
          );
        } else if (filter === 'this_week') {
          const now = new Date();
          const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          q = query(
            q,
            where('deadline', '>=', Timestamp.fromDate(now)),
            where('deadline', '<=', Timestamp.fromDate(oneWeekLater))
          );
        } else if (filter === 'overdue') {
          const now = new Date();
          q = query(
            q,
            where('status', '==', 'active'),
            where('deadline', '<', Timestamp.fromDate(now))
          );
        }

        q = query(q, orderBy('deadline', 'asc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => mapTask(doc.id, doc.data()));
      };

      try {
        return await runQuery();
      } catch (err: any) {
        if (err && (err.message?.includes('index') || err.code === 'failed-precondition')) {
          console.warn('Firestore query failed (likely missing index). Falling back to in-memory filtering.', err.message);
          const qBase = query(collection(db, path), where('userId', '==', userId));
          const querySnapshot = await getDocs(qBase);
          let tasks = querySnapshot.docs.map(doc => mapTask(doc.id, doc.data()));

          const now = new Date();
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);
          const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

          if (filter === 'completed') {
            tasks = tasks.filter(t => t.status === 'completed');
          } else if (filter === 'at_risk') {
            tasks = tasks.filter(t => t.status === 'active' && t.riskScore > 60);
          } else if (filter === 'today') {
            tasks = tasks.filter(t => t.deadline >= todayStart && t.deadline <= todayEnd);
          } else if (filter === 'this_week') {
            tasks = tasks.filter(t => t.deadline >= now && t.deadline <= oneWeekLater);
          } else if (filter === 'overdue') {
            tasks = tasks.filter(t => t.status === 'active' && t.deadline < now);
          }

          tasks.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
          return tasks;
        }
        throw err;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async getAtRiskTasks(userId: string, withinHours: number): Promise<Task[]> {
    const path = 'tasks';
    const limitDate = new Date(Date.now() + withinHours * 3600000);
    try {
      const runQuery = async () => {
        const q = query(
          collection(db, path),
          where('userId', '==', userId),
          where('status', '==', 'active'),
          where('deadline', '<=', Timestamp.fromDate(limitDate)),
          orderBy('deadline', 'asc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => mapTask(doc.id, doc.data()));
      };

      try {
        return await runQuery();
      } catch (err: any) {
        if (err && (err.message?.includes('index') || err.code === 'failed-precondition')) {
          console.warn('getAtRiskTasks failed (likely missing index). Falling back to in-memory filtering.');
          const qBase = query(collection(db, path), where('userId', '==', userId));
          const querySnapshot = await getDocs(qBase);
          let tasks = querySnapshot.docs.map(doc => mapTask(doc.id, doc.data()));
          tasks = tasks.filter(t => t.status === 'active' && t.deadline <= limitDate);
          tasks.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
          return tasks;
        }
        throw err;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const path = `tasks/${taskId}`;
    try {
      const writeUpdates: any = { ...updates };
      if (updates.deadline instanceof Date) {
        writeUpdates.deadline = Timestamp.fromDate(updates.deadline);
      }
      if (updates.completedAt instanceof Date) {
        writeUpdates.completedAt = Timestamp.fromDate(updates.completedAt);
      }
      if (updates.createdAt instanceof Date) {
        writeUpdates.createdAt = Timestamp.fromDate(updates.createdAt);
      }
      await updateDoc(doc(db, 'tasks', taskId), writeUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async updateTaskProgress(taskId: string, percent: number): Promise<void> {
    const path = `tasks/${taskId}`;
    try {
      const updates: any = { progressPercent: percent };
      if (percent >= 100) {
        updates.status = 'completed';
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
        scheduledSessions: arrayUnion(calendarEventId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    const path = `tasks/${taskId}`;
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'cancelled'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async updateRiskScore(taskId: string, score: number): Promise<void> {
    const path = `tasks/${taskId}`;
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        riskScore: score
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  // ==========================================
  // SESSION METHODS
  // ==========================================

  async createSession(session: Omit<TaskSession, 'id'>): Promise<TaskSession> {
    const path = 'sessions';
    try {
      const firestoreData: any = {
        ...session,
        scheduledStart: Timestamp.fromDate(session.scheduledStart),
        scheduledEnd: Timestamp.fromDate(session.scheduledEnd),
      };
      if (session.actualEnd instanceof Date) {
        firestoreData.actualEnd = Timestamp.fromDate(session.actualEnd);
      }
      const docRef = await addDoc(collection(db, path), firestoreData);
      return {
        ...session,
        id: docRef.id
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async getSessionsForTask(taskId: string): Promise<TaskSession[]> {
    const path = 'sessions';
    try {
      const runQuery = async () => {
        const q = query(
          collection(db, path),
          where('taskId', '==', taskId),
          orderBy('scheduledStart', 'asc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => mapSession(doc.id, doc.data()));
      };

      try {
        return await runQuery();
      } catch (err: any) {
        if (err && (err.message?.includes('index') || err.code === 'failed-precondition')) {
          console.warn('getSessionsForTask failed (likely missing index). Falling back to in-memory filtering.');
          const qBase = query(collection(db, path), where('taskId', '==', taskId));
          const querySnapshot = await getDocs(qBase);
          let sessions = querySnapshot.docs.map(doc => mapSession(doc.id, doc.data()));
          sessions.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
          return sessions;
        }
        throw err;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async getSessionsForDate(userId: string, date: Date): Promise<TaskSession[]> {
    const path = 'sessions';
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    try {
      const runQuery = async () => {
        const q = query(
          collection(db, path),
          where('userId', '==', userId),
          where('scheduledStart', '>=', Timestamp.fromDate(start)),
          where('scheduledStart', '<=', Timestamp.fromDate(end)),
          orderBy('scheduledStart', 'asc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => mapSession(doc.id, doc.data()));
      };

      try {
        return await runQuery();
      } catch (err: any) {
        if (err && (err.message?.includes('index') || err.code === 'failed-precondition')) {
          console.warn('getSessionsForDate failed (likely missing index). Falling back to in-memory filtering.');
          const qBase = query(collection(db, path), where('userId', '==', userId));
          const querySnapshot = await getDocs(qBase);
          let sessions = querySnapshot.docs.map(doc => mapSession(doc.id, doc.data()));
          sessions = sessions.filter(s => s.scheduledStart >= start && s.scheduledStart <= end);
          sessions.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
          return sessions;
        }
        throw err;
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
        actualEnd: Timestamp.fromDate(actualEnd)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async markSessionSkipped(sessionId: string): Promise<void> {
    const path = `sessions/${sessionId}`;
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        skipped: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  // ==========================================
  // CONVERSATION METHODS
  // ==========================================

  async createConversation(userId: string): Promise<string> {
    const path = 'conversations';
    try {
      const docRef = await addDoc(collection(db, path), {
        userId,
        messages: [],
        createdAt: serverTimestamp()
      });
      return docRef.id;
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
          timestamp: Timestamp.fromDate(message.timestamp)
        })
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async getHistory(convId: string, limitCount?: number): Promise<AgentMessage[]> {
    const path = `conversations/${convId}`;
    try {
      const docSnap = await getDoc(doc(db, 'conversations', convId));
      if (!docSnap.exists()) return [];
      const data = docSnap.data();
      const messagesRaw = data.messages || [];
      const messages: AgentMessage[] = messagesRaw.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp instanceof Timestamp ? msg.timestamp.toDate() : new Date(msg.timestamp || Date.now())
      }));
      if (limitCount && limitCount > 0) {
        return messages.slice(-limitCount);
      }
      return messages;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  // ==========================================
  // MONITORING METHODS
  // ==========================================

  async updateMonitoringState(userId: string, update: Partial<MonitoringState>): Promise<void> {
    const path = `monitoring/${userId}`;
    try {
      const firestoreUpdate: any = { ...update };
      if (update.lastCheck instanceof Date) {
        firestoreUpdate.lastCheck = Timestamp.fromDate(update.lastCheck);
      }
      if (update.alertLog) {
        firestoreUpdate.alertLog = update.alertLog.map(alert => ({
          ...alert,
          sentAt: Timestamp.fromDate(alert.sentAt)
        }));
      }
      await setDoc(doc(db, 'monitoring', userId), firestoreUpdate, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getMonitoringState(userId: string): Promise<MonitoringState | null> {
    const path = `monitoring/${userId}`;
    try {
      const docSnap = await getDoc(doc(db, 'monitoring', userId));
      if (!docSnap.exists()) return null;
      return mapMonitoring(docSnap.data());
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async logAlert(userId: string, taskId: string, alertType: 'crisis' | 'urgent' | 'planning'): Promise<void> {
    const path = `monitoring/${userId}`;
    try {
      await setDoc(doc(db, 'monitoring', userId), {
        alertLog: arrayUnion({
          taskId,
          alertType,
          sentAt: serverTimestamp()
        })
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  // ==========================================
  // IMPACT METHODS
  // ==========================================

  async incrementTasksSaved(userId: string): Promise<void> {
    const path = `impact/${userId}`;
    try {
      await setDoc(doc(db, 'impact', userId), {
        tasksSaved: increment(1)
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async incrementHoursRecovered(userId: string, hours: number): Promise<void> {
    const path = `impact/${userId}`;
    try {
      await setDoc(doc(db, 'impact', userId), {
        hoursRecovered: increment(hours)
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getImpactStats(userId: string): Promise<ImpactStats> {
    const path = `impact/${userId}`;
    try {
      const docSnap = await getDoc(doc(db, 'impact', userId));
      if (!docSnap.exists()) {
        return {
          tasksSaved: 0,
          hoursRecovered: 0,
          onTimeRate: 0,
          currentStreak: 0
        };
      }
      const data = docSnap.data();
      return {
        tasksSaved: data.tasksSaved || 0,
        hoursRecovered: data.hoursRecovered || 0,
        onTimeRate: data.onTimeRate || 0,
        currentStreak: data.currentStreak || 0
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async recordCompletedOnTime(userId: string, wasOnTime: boolean): Promise<void> {
    const path = `impact/${userId}`;
    try {
      const stats = await this.getImpactStats(userId);
      const totalCompletions = stats.tasksSaved;
      
      const newTotal = totalCompletions + 1;
      const currentOnTimeCount = stats.onTimeRate * totalCompletions;
      const newOnTimeCount = currentOnTimeCount + (wasOnTime ? 1 : 0);
      const newOnTimeRate = newTotal > 0 ? newOnTimeCount / newTotal : 0;
      
      const newStreak = wasOnTime ? stats.currentStreak + 1 : 0;
      
      await setDoc(doc(db, 'impact', userId), {
        tasksSaved: increment(1),
        onTimeRate: newOnTimeRate,
        currentStreak: newStreak
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export const firestoreService = new FirestoreService();