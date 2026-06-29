import { useState } from 'react';
import { useUiStore } from '@/lib/stores/uiStore';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: Array<{ name: string; status: 'running' | 'done'; summary: string }>;
  timestamp: Date;
}

export function useAgent() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const setAgentThinking = useUiStore((state: any) => state.setAgentThinking);
  const addToolCall = useUiStore((state: any) => state.addToolCall);
  const resolveToolCall = useUiStore((state: any) => state.resolveToolCall);
  const clearToolCalls = useUiStore((state: any) => state.clearToolCalls);

  const sendMessage = async (userMessage: string) => {
    const newUserMsg: AgentMessage = { 
      id: crypto.randomUUID(), 
      role: 'user', 
      content: userMessage, 
      toolCalls: [], 
      timestamp: new Date() 
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);
    if (setAgentThinking) setAgentThinking(true);
    if (clearToolCalls) clearToolCalls();
    setError(null);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, userId: 'default_user', conversationId })
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
      const newConversationId = response.headers.get('X-Conversation-Id');
      if (newConversationId) setConversationId(newConversationId);

      const assistantMessage: AgentMessage = { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        content: '', 
        toolCalls: [], 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, assistantMessage]);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream');
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim() !== '');

        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type === 'tool_call') {
              if (addToolCall) addToolCall(event.name);
            } else if (event.type === 'tool_result') {
              if (resolveToolCall) resolveToolCall(event.name, event.summary);
            } else if (event.type === 'text') {
              assistantMessage.content += event.text;
              setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { ...assistantMessage } : m));
            } else if (event.type === 'error') {
              setError(event.message);
            }
          } catch (e) {
            console.error('Failed to parse line:', line);
          }
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to send message');
      setLoading(false);
      if (setAgentThinking) setAgentThinking(false);
      if (clearToolCalls) clearToolCalls();
    } finally {
      setLoading(false);
      if (setAgentThinking) setAgentThinking(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    setConversationId(null);
  };

  return { messages, loading, error, conversationId, sendMessage, clearHistory };
}
