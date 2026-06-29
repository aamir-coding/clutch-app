import { create } from 'zustand';
import { isToday } from 'date-fns';
import { Task, TaskFilter } from '@/lib/types';

export interface TaskState {
  tasks: Task[];
  loading: boolean;
  filter: TaskFilter;
  sortBy: 'deadline' | 'risk' | 'priority' | 'progress';

  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
  setLoading: (val: boolean) => void;
  setFilter: (filter: TaskFilter) => void;
  setSortBy: (sortBy: TaskState['sortBy']) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  loading: false,
  filter: 'all',
  sortBy: 'deadline',

  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      ),
    })),
  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== taskId),
    })),
  setLoading: (val) => set({ loading: val }),
  setFilter: (filter) => set({ filter }),
  setSortBy: (sortBy) => set({ sortBy }),
}));

// Plain exported selector functions (NOT inside the store)

export function getAtRiskTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((task) => (task.riskScore ?? 0) > 60 && task.status === 'active')
    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
}

export function getTodaysTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => {
    try {
      const date = task.deadline instanceof Date ? task.deadline : new Date(task.deadline);
      return isToday(date);
    } catch {
      return false;
    }
  });
}

export function getOverdueTasks(tasks: Task[]): Task[] {
  const now = Date.now();
  return tasks.filter((task) => {
    try {
      const deadlineTime = task.deadline instanceof Date 
        ? task.deadline.getTime() 
        : new Date(task.deadline).getTime();
      return deadlineTime < now && task.status === 'active';
    } catch {
      return false;
    }
  });
}

export function sortTasksBy(tasks: Task[], sortBy: string): Task[] {
  const sorted = [...tasks];
  
  if (sortBy === 'deadline') {
    return sorted.sort((a, b) => {
      const aTime = a.deadline instanceof Date ? a.deadline.getTime() : new Date(a.deadline).getTime();
      const bTime = b.deadline instanceof Date ? b.deadline.getTime() : new Date(b.deadline).getTime();
      return aTime - bTime;
    });
  }
  
  if (sortBy === 'risk') {
    return sorted.sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
  }
  
  if (sortBy === 'priority') {
    const priorityMap: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return sorted.sort((a, b) => {
      const aPriority = (a as any).priority || 'low';
      const bPriority = (b as any).priority || 'low';
      const aVal = priorityMap[aPriority] !== undefined ? priorityMap[aPriority] : 99;
      const bVal = priorityMap[bPriority] !== undefined ? priorityMap[bPriority] : 99;
      return aVal - bVal;
    });
  }
  
  if (sortBy === 'progress') {
    return sorted.sort((a, b) => (a.progressPercent ?? 0) - (b.progressPercent ?? 0));
  }
  
  return sorted;
}
