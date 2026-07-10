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

    // Create the assistant placeholder immediately so the UI shows activity.
    const assistantMsgId = crypto.randomUUID();
    const assistantMessage: AgentMessage = {
      id:        assistantMsgId,
      role:      'assistant',
      content:   '',
      toolCalls: [],
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    /**
     * Helper: update the assistant message in state without mutating the
     * original object reference.
     */
    const updateAssistant = (patch: Partial<AgentMessage>) => {
      Object.assign(assistantMessage, patch);
      setMessages(prev =>
        prev.map(m => m.id === assistantMsgId ? { ...assistantMessage } : m)
      );
    };

    try {
      const userId   = user?.uid ?? 'guest';
      const response = await fetch('/api/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: userMessage, userId, conversationId }),
      });

      if (!response.ok) {
        throw new Error(`Server error ${response.status}: ${await response.text()}`);
      }

      const newConversationId = response.headers.get('X-Conversation-Id');
      if (newConversationId) setConversationId(newConversationId);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is not readable.');

      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Buffer incomplete lines across read() calls so we never try to
        // JSON.parse a partial object.
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed);

            switch (event.type as string) {

              case 'text':
                // Append streamed text to the assistant message content.
                updateAssistant({ content: assistantMessage.content + (event.text as string) });
                break;

              case 'tool_call':
                addToolCall(event.name);
                break;

              case 'tool_result':
                resolveToolCall(event.name, event.summary);
                break;

              case 'crisis_activated':
                if (event.taskId) {
                  useUiStore.getState().activateCrisisMode(event.taskId as string);
                }
                break;

              case 'error': {
                /**
                 * KEY FIX: populate the assistant message with the error text
                 * so it doesn't stay empty (which renders loading dots forever).
                 * The message box will show the error inline in the chat thread.
                 */
                const errMsg = event.message as string;
                setError(errMsg);
                updateAssistant({
                  content: `⚠️ **Something went wrong.** ${errMsg}\n\nPlease check your configuration and try again.`,
                });
                break;
              }
            }
          } catch {
            // Malformed line — skip it without crashing the stream consumer.
            console.warn('[useAgent] Could not parse stream line:', trimmed);
          }
        }
      }

      // Flush any trailing buffer content after the stream closes.
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim());
          if (event.type === 'text') {
            updateAssistant({ content: assistantMessage.content + (event.text as string) });
          }
        } catch {
          // Incomplete trailing chunk — safe to discard.
        }
      }

      /**
       * Final safety net: if we got here without any content (e.g. the stream
       * closed before producing any text or error events), show a fallback
       * message so the loading dots don't persist indefinitely.
       */
      if (!assistantMessage.content.trim()) {
        updateAssistant({
          content: "I didn't receive a response. This usually means the Gemini API key isn't set or the model returned an empty reply. Check your `.env.local` file and server logs.",
        });
      }

    } catch (e: any) {
      const errMsg = e.message || 'Failed to contact the agent. Check your network and server logs.';
      setError(errMsg);
      updateAssistant({
        content: `⚠️ **Connection error.** ${errMsg}`,
      });
    } finally {
      setLoading(false);
      setAgentThinking(false);
    }
  }, [user?.uid, conversationId, setAgentThinking, addToolCall, resolveToolCall, clearToolCalls]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  return { messages, loading, error, conversationId, sendMessage, clearHistory };
}