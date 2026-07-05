import { useState } from 'react';
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

  // Pull individual actions from the store so they are stable references and
  // do NOT cause the hook to re-render when unrelated store slices change.
  const setAgentThinking = useUiStore(state => state.setAgentThinking);
  const addToolCall      = useUiStore(state => state.addToolCall);
  const resolveToolCall  = useUiStore(state => state.resolveToolCall);
  const clearToolCalls   = useUiStore(state => state.clearToolCalls);

  const sendMessage = async (userMessage: string) => {
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

        // Accumulate chunks in a buffer and split on newlines so we never
        // try to parse a partial JSON object that was split across two reads.
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last (potentially incomplete) line in the buffer.
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

              /**
               * Crisis mode: the server-side agent emitted this event after
               * the activate_crisis_mode tool completed. We update the Zustand
               * UI store here, on the client, where it is actually subscribed to.
               *
               * We use getState() rather than a hook selector because this code
               * runs inside an async callback, outside the React render cycle.
               * Zustand's getState() is safe to call anywhere.
               */
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

      // Flush any remaining buffer content after the stream closes.
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
          // Incomplete trailing chunk — safe to ignore.
        }
      }

    } catch (e: any) {
      setError(e.message || 'Failed to send message');
    } finally {
      setLoading(false);
      setAgentThinking(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    setConversationId(null);
  };

  return { messages, loading, error, conversationId, sendMessage, clearHistory };
}