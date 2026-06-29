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
}

export const useUiStore = create<UiState>((set) => ({
  pageTitle: 'Command Center',
  setPageTitle: (title) => set({ pageTitle: title }),
  agentThinking: false,
  setAgentThinking: (thinking) => set({ agentThinking: thinking }),
  activeToolCalls: [],
  addToolCall: (name) => set((state) => {
    // Check if it already exists, if so keep it. Otherwise add new one with 'running'
    const exists = state.activeToolCalls.some((c) => c.name === name);
    if (exists) {
      return {
        activeToolCalls: state.activeToolCalls.map((c) =>
          c.name === name ? { ...c, status: 'running' } : c
        ),
      };
    }
    return {
      activeToolCalls: [
        ...state.activeToolCalls,
        { name, status: 'running', summary: '' },
      ],
    };
  }),
  resolveToolCall: (name, summary) => set((state) => ({
    activeToolCalls: state.activeToolCalls.map((c) =>
      c.name === name ? { ...c, status: 'done', summary } : c
    ),
  })),
  clearToolCalls: () => set({ activeToolCalls: [] }),
}));
