import { useState, useCallback } from 'react';
import { useUiStore } from '@/lib/stores/uiStore';
import { useAuth }   from '@/components/layout/AuthProvider';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: Array<{ name: string; status: 'running' | 'done'; summary: string }>;
  timestamp: Date;
}

export function useAgent() {
  const { user } = useAuth();

  const [messages,       setMessages]       = useState<AgentMessage[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const setAgentThinking = useUiStore(state => state.setAgentThinking);
  const addToolCall      = useUiStore(state => state.addToolCall);
  const resolveToolCall  = useUiStore(state => state.resolveToolCall);
  const clearToolCalls   = useUiStore(state => state.clearToolCalls);

  /**
   * sendMessage is wrapped in useCallback so that AgentChat's own
   * useCallback(handleSubmit, [sendMessage]) chain stabilises correctly.
   * Without this, every render of useAgent produces a new sendMessage
   * reference, which cascades into handleSubmit → handleKeyDown being
   * recreated on every keystroke in the textarea.
   *
   * conversationId is included in the dependency array because the function
   * closes over it — omitting it would be a stale-closure bug where the
   * second message in a conversation would always send `conversationId: null`.
   */
  const sendMessage = useCallback(async (userMessage: string) => {
    const newUserMsg: AgentMessage = {
      id:        crypto.randomUUID(),
      role:      'user',
      content:   userMessage,
      toolCalls: [],
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);
    setAgentThinking(true);
    clearToolCalls();
    setError(null);

    try {
      const userId   = user?.uid ?? 'guest';
      const response = await fetch('/api/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: userMessage, userId, conversationId }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const newConversationId = response.headers.get('X-Conversation-Id');
      if (newConversationId) setConversationId(newConversationId);

      const assistantMessage: AgentMessage = {
        id:        crypto.randomUUID(),
        role:      'assistant',
        content:   '',
        toolCalls: [],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream');

      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed);

            switch (event.type as string) {
              case 'tool_call':
                addToolCall(event.name);
                break;

              case 'tool_result':
                resolveToolCall(event.name, event.summary);
                break;

              case 'text':
                assistantMessage.content += event.text as string;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessage.id ? { ...assistantMessage } : m
                  )
                );
                break;

              case 'crisis_activated':
                if (event.taskId) {
                  useUiStore.getState().activateCrisisMode(event.taskId as string);
                }
                break;

              case 'error':
                setError(event.message as string);
                break;
            }
          } catch {
            console.error('Failed to parse stream line:', trimmed);
          }
        }
      }

      // Flush any remaining buffer content after stream closes
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim());
          if (event.type === 'text') {
            assistantMessage.content += event.text as string;
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessage.id ? { ...assistantMessage } : m
              )
            );
          }
        } catch {
          // Incomplete trailing chunk — safe to ignore
        }
      }

    } catch (e: any) {
      setError(e.message || 'Failed to send message');
    } finally {
      setLoading(false);
      setAgentThinking(false);
    }
  }, [user?.uid, conversationId, setAgentThinking, addToolCall, resolveToolCall, clearToolCalls]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return { messages, loading, error, conversationId, sendMessage, clearHistory };
}