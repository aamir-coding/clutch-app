/**
 * Server-side Firestore operations backed by the Firebase Admin SDK.
 *
 * Use this service — NOT `firestoreService` from `lib/firebase/firestore.ts` —
 * in any file that executes inside a Next.js API route (Node.js server context).
 *
 * Reason: the client SDK (`firebase/firestore`) enforces Firestore security rules
 * against `request.auth`, which is always null on the server. Every read/write
 * would be rejected with `permission-denied`. The Admin SDK bypasses rules.
 */

import { adminDb } from './admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { Task, TaskFilter, User } from '../types';

// ─── Mappers ────────────────────────────────────────────────────────────────

function mapUser(uid: string, data: Record<string, any>): User {
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
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(data.createdAt || Date.now()),
    notificationPreferences: data.notificationPreferences,
    agentBehavior: data.agentBehavior,
  };
}

function mapTask(id: string, data: Record<string, any>): Task {
  return {
    id,
    userId: data.userId || '',
    title: data.title || '',
    description: data.description,
    deadline:
      data.deadline instanceof Timestamp
        ? data.deadline.toDate()
        : new Date(data.deadline || Date.now()),
    status: data.status || 'active',
    progressPercent: data.progressPercent ?? 0,
    riskScore: data.riskScore ?? 0,
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
    priority: data.priority,
    subtasks: data.subtasks,
    gmailThreadId: data.gmailThreadId,
    notes: data.notes,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

class AdminFirestoreService {
  private get db() {
    if (!adminDb) {
      throw new Error(
        'Firebase Admin SDK is not initialized. ' +
          'Ensure FIREBASE_SERVICE_ACCOUNT_KEY is set in your environment.'
      );
    }
    return adminDb;
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  async getUser(userId: string): Promise<User | null> {
    const snap = await this.db.collection('users').doc(userId).get();
    if (!snap.exists) return null;
    return mapUser(userId, snap.data() as Record<string, any>);
  }

  async getTokens(
    userId: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
    const snap = await this.db.collection('users').doc(userId).get();
    if (!snap.exists) return null;
    const data = snap.data() as Record<string, any>;
    return data.tokens || null;
  }

  async saveAccessToken(
    userId: string,
    accessToken: string,
    expiresAt: number
  ): Promise<void> {
    await this.db.collection('users').doc(userId).update({
      'tokens.accessToken': accessToken,
      'tokens.expiresAt': expiresAt,
    });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async getTasks(userId: string, filter?: TaskFilter): Promise<Task[]> {
    const col = this.db.collection('tasks');
    const base = col.where('userId', '==', userId);

    const runQuery = async (): Promise<Task[]> => {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
      const weekEnd    = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      let q: any = base;

      if (filter === 'completed') {
        q = q.where('status', '==', 'completed');
      } else if (filter === 'at_risk') {
        q = q.where('status', '==', 'active').where('riskScore', '>', 60);
      } else if (filter === 'today') {
        q = q
          .where('deadline', '>=', Timestamp.fromDate(todayStart))
          .where('deadline', '<=', Timestamp.fromDate(todayEnd));
      } else if (filter === 'this_week') {
        q = q
          .where('deadline', '>=', Timestamp.fromDate(now))
          .where('deadline', '<=', Timestamp.fromDate(weekEnd));
      } else if (filter === 'overdue') {
        q = q.where('status', '==', 'active').where('deadline', '<', Timestamp.fromDate(now));
      }

      q = q.orderBy('deadline', 'asc');
      const snap = await q.get();
      return snap.docs.map((d: any) => mapTask(d.id, d.data()));
    };

    try {
      return await runQuery();
    } catch (err: any) {
      // Compound query may need an index — fall back to in-memory filtering.
      const isIndexError =
        err?.code === 9 ||
        err?.message?.includes('index') ||
        err?.message?.includes('failed-precondition');

      if (!isIndexError) throw err;

      console.warn('adminFirestoreService.getTasks — index missing, using in-memory filter.');
      const snap = await base.get();
      let tasks = snap.docs.map((d: any) => mapTask(d.id, d.data()));

      const now = new Date();
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
  }

  async getAtRiskTasks(userId: string, withinHours: number): Promise<Task[]> {
    const limitDate = new Date(Date.now() + withinHours * 3600000);
    try {
      const snap = await this.db
        .collection('tasks')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .where('deadline', '<=', Timestamp.fromDate(limitDate))
        .orderBy('deadline', 'asc')
        .get();
      return snap.docs.map((d: any) => mapTask(d.id, d.data()));
    } catch (err: any) {
      const isIndexError =
        err?.code === 9 ||
        err?.message?.includes('index') ||
        err?.message?.includes('failed-precondition');
      if (!isIndexError) throw err;

      console.warn('adminFirestoreService.getAtRiskTasks — index missing, using in-memory filter.');
      const snap = await this.db
        .collection('tasks')
        .where('userId', '==', userId)
        .get();
      return snap.docs
        .map((d: any) => mapTask(d.id, d.data()))
        .filter(t => t.status === 'active' && t.deadline <= limitDate)
        .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
    }
  }

  async createTask(
    userId: string,
    taskData: Omit<Task, 'id' | 'createdAt' | 'riskScore'>
  ): Promise<Task> {
    const ref = await this.db.collection('tasks').add({
      ...taskData,
      userId,
      riskScore: 0,
      deadline: Timestamp.fromDate(taskData.deadline),
      createdAt: FieldValue.serverTimestamp(),
    });
    return {
      id: ref.id,
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
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const write: Record<string, any> = { ...updates };
    if (updates.deadline instanceof Date)
      write.deadline = Timestamp.fromDate(updates.deadline);
    if (updates.completedAt instanceof Date)
      write.completedAt = Timestamp.fromDate(updates.completedAt);
    if (updates.createdAt instanceof Date)
      write.createdAt = Timestamp.fromDate(updates.createdAt);
    await this.db.collection('tasks').doc(taskId).update(write);
  }

  async updateTaskProgress(taskId: string, percent: number): Promise<void> {
    const updates: Record<string, any> = { progressPercent: percent };
    if (percent >= 100) {
      updates.status = 'completed';
      updates.completedAt = FieldValue.serverTimestamp();
    }
    await this.db.collection('tasks').doc(taskId).update(updates);
  }

  async addScheduledSession(taskId: string, calendarEventId: string): Promise<void> {
    await this.db.collection('tasks').doc(taskId).update({
      scheduledSessions: FieldValue.arrayUnion(calendarEventId),
    });
  }

  // ── Impact ─────────────────────────────────────────────────────────────────

  async incrementTasksSaved(userId: string): Promise<void> {
    await this.db
      .collection('impact')
      .doc(userId)
      .set({ tasksSaved: FieldValue.increment(1) }, { merge: true });
  }

  // ── Monitoring ─────────────────────────────────────────────────────────────

  async logAlert(
    userId: string,
    taskId: string,
    alertType: 'crisis' | 'urgent' | 'planning'
  ): Promise<void> {
    await this.db
      .collection('monitoring')
      .doc(userId)
      .set(
        {
          alertLog: FieldValue.arrayUnion({
            taskId,
            alertType,
            sentAt: FieldValue.serverTimestamp(),
          }),
        },
        { merge: true }
      );
  }
}

export const adminFirestoreService = new AdminFirestoreService();