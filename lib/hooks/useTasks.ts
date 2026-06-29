import { useState, useEffect, useCallback } from 'react';
import { firestoreService, Task } from '../firebase/firestoreService';

export function useTasks(userId: string = 'default_user') {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await firestoreService.getTasks(userId);
      setTasks(data);
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

  const createTask = async (taskData: Partial<Task>) => {
    try {
      const created = await firestoreService.createTask(userId, taskData);
      setTasks((prev) => [...prev, created]);
      return created;
    } catch (e: any) {
      console.error('Failed to create task:', e);
      throw e;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const updated = await firestoreService.updateTask(userId, taskId, updates);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      return updated;
    } catch (e: any) {
      console.error('Failed to update task:', e);
      throw e;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await firestoreService.deleteTask(userId, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (e: any) {
      console.error('Failed to delete task:', e);
      throw e;
    }
  };

  const atRiskTasks = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    const dl = new Date(t.deadline).getTime();
    const hoursLeft = (dl - Date.now()) / (1000 * 3600);
    // Overdue or high danger (under 24 hours left with substantial work remaining)
    return hoursLeft < 24 || (hoursLeft < 48 && t.priority === 'critical');
  });

  return {
    tasks,
    loading,
    error,
    atRiskTasks,
    refetch: fetchTasks,
    createTask,
    updateTask,
    deleteTask,
  };
}
export type { Task };
