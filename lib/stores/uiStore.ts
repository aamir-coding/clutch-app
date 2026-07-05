import { create } from 'zustand';

export interface ToolCall {
  name: string;
  status: 'running' | 'done';
  summary: string;
}

interface UiState {
  pageTitle: string;
  setPageTitle: (title: string) => void;

  agentThinking: boolean;
  setAgentThinking: (thinking: boolean) => void;

  activeToolCalls: ToolCall[];
  addToolCall: (name: string) => void;
  resolveToolCall: (name: string, summary: string) => void;
  clearToolCalls: () => void;

  notificationCount: number;
  setNotificationCount: (count: number) => void;
  clearNotifications: () => void;

  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;

  crisisTaskId: string | null;
  setCrisisTaskId: (taskId: string | null) => void;
  activateCrisisMode: (taskId: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  pageTitle: 'Command Center',
  setPageTitle: (title) => set({ pageTitle: title }),

  agentThinking: false,
  setAgentThinking: (thinking) => set({ agentThinking: thinking }),

  activeToolCalls: [],
  addToolCall: (name) =>
    set((state) => {
      const exists = state.activeToolCalls.some((c) => c.name === name);
      if (exists) {
        return {
          activeToolCalls: state.activeToolCalls.map((c) =>
            c.name === name ? { ...c, status: 'running' as const } : c
          ),
        };
      }
      return {
        activeToolCalls: [
          ...state.activeToolCalls,
          { name, status: 'running' as const, summary: '' },
        ],
      };
    }),
  resolveToolCall: (name, summary) =>
    set((state) => ({
      activeToolCalls: state.activeToolCalls.map((c) =>
        c.name === name ? { ...c, status: 'done' as const, summary } : c
      ),
    })),
  clearToolCalls: () => set({ activeToolCalls: [] }),

  notificationCount: 0,
  setNotificationCount: (count) => set({ notificationCount: Math.max(0, count) }),
  clearNotifications: () => set({ notificationCount: 0 }),

  sidebarExpanded: false,
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),

  crisisTaskId: null,
  setCrisisTaskId: (taskId) => set({ crisisTaskId: taskId }),
  activateCrisisMode: (taskId) => set({ crisisTaskId: taskId }),
}));