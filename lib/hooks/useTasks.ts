'use client';

import { useState, useEffect, useCallback } from 'react';
import { firestoreService } from '../firebase/firestore';
import { Task } from '../types';
import { useAuth } from '@/components/layout/AuthProvider';

export function useTasks(explicitUserId?: string) {
  const { user } = useAuth();
  const userId = explicitUserId ?? user?.uid ?? null;

  const [tasks,   setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await firestoreService.getTasks(userId);
      setTasks(data.filter((t) => t.status !== 'cancelled'));
    } catch (e: any) {
      console.error('Error in useTasks:', e);
      setError(e.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  /**
   * All three mutation helpers are wrapped in useCallback so that parent
   * components that receive them as props (TaskCard, TaskDetailSheet,
   * AtRiskPanel) don't re-render unnecessarily — previously these were
   * recreated on every useTasks render, cascading renders to all consumers.
   */

  const createTask = useCallback(async (taskData: Partial<Task>): Promise<Task> => {
    if (!userId) throw new Error('Cannot create task: no authenticated user');

    const deadline =
      taskData.deadline instanceof Date
        ? taskData.deadline
        : new Date(taskData.deadline ?? Date.now() + 24 * 3600 * 1000);

    const draft: Omit<Task, 'id' | 'createdAt' | 'riskScore'> = {
      userId,
      title:             taskData.title || 'Untitled Task',
      description:       taskData.description,
      deadline,
      status:            taskData.status || 'active',
      progressPercent:   taskData.progressPercent ?? 0,
      scheduledSessions: taskData.scheduledSessions || [],
      completedAt:       taskData.completedAt,
      estimatedHours:    taskData.estimatedHours,
      priority:          taskData.priority || 'medium',
      subtasks:          taskData.subtasks || [],
      gmailThreadId:     taskData.gmailThreadId,
      notes:             taskData.notes,
    };

    // Firestore rejects keys explicitly set to `undefined`
    const fullTaskData = Object.fromEntries(
      Object.entries(draft).filter(([, v]) => v !== undefined)
    ) as Omit<Task, 'id' | 'createdAt' | 'riskScore'>;

    const created = await firestoreService.createTask(userId, fullTaskData);
    setTasks((prev) => [...prev, created]);
    return created;
  }, [userId]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>): Promise<void> => {
    await firestoreService.updateTask(taskId, updates);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
  }, []);

  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    await firestoreService.deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const atRiskTasks = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    const hoursLeft = (t.deadline.getTime() - Date.now()) / (1000 * 3600);
    return hoursLeft < 24 || (hoursLeft < 48 && t.priority === 'critical');
  });

  return {
    tasks,
    loading,
    error,
    atRiskTasks,
    refetch:    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
  };
}
export type { Task };