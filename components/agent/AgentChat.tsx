'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SendHorizonal, Zap, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAgent } from '@/lib/hooks/useAgent';
import { useUiStore } from '@/lib/stores/uiStore';
import AgentMessage from './AgentMessage';
import VoiceInput from './VoiceInput';

export default function AgentChat() {
  const { messages, loading, error, sendMessage, clearHistory } = useAgent();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeToolCalls = useUiStore(state => state.activeToolCalls) ?? [];

  // Auto-scroll to the latest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeToolCalls]);

  // Surface persistent errors as toasts so they are visible even when the
  // chat thread is scrolled up.
  useEffect(() => {
    if (error) {
      toast.error(`Agent error: ${error}`, { duration: 6000 });
    }
  }, [error]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim() || loading) return;
    const text = inputValue.trim();
    setInputValue('');
    sendMessage(text);
  }, [inputValue, loading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  /**
   * Memoized so VoiceInput's internal useEffect — which lists onTranscript in
   * its dependency array — does not restart SpeechRecognition on every render.
   */
  const handleTranscript = useCallback((text: string) => {
    setInputValue(prev => (prev ? `${prev} ${text}` : text));
  }, []);

  const handleSuggestionClick = useCallback(
    (text: string) => { if (!loading) sendMessage(text); },
    [loading, sendMessage]
  );

  const handleClear = useCallback(() => {
    clearHistory();
    toast.success('Conversation cleared');
  }, [clearHistory]);

  // ── Display messages ───────────────────────────────────────────────────────
  //
  // Inject live tool calls into the last assistant message without mutating
  // the state object (shallow-copy only touches that one message).
  const displayMessages = messages.map((msg, idx) => {
    if (
      loading &&
      idx === messages.length - 1 &&
      msg.role === 'assistant' &&
      activeToolCalls.length > 0
    ) {
      return { ...msg, toolCalls: [...activeToolCalls] };
    }
    return msg;
  });

  // ── Suggestions ────────────────────────────────────────────────────────────

  const suggestions = [
    '📅 Build my battle plan for this week',
    '📧 Scan my Gmail for missed deadlines',
    '⚡ What tasks are most at risk right now?',
    '➕ Add a new task for me',
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#06060A]">

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">

        {displayMessages.length === 0 ? (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-8 animate-fade-in">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(99,102,241,0.15)]">
                <Zap className="w-8 h-8 text-indigo-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white uppercase font-sans">
                CLUTCH
              </h1>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                Your AI productivity agent. Ask me to manage tasks, schedule focus
                sessions, or scan Gmail for incoming deadlines.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  disabled={loading}
                  className="bg-[#12121A] border border-[#1E1E2E] hover:border-indigo-500/30 text-slate-300 hover:text-white transition-colors text-sm px-4 py-3 rounded-xl cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message thread */
          <>
            {/* Clear conversation button */}
            {displayMessages.length > 0 && !loading && (
              <div className="flex justify-center">
                <button
                  onClick={handleClear}
                  className="flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-400 transition font-mono uppercase tracking-wider cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear conversation
                </button>
              </div>
            )}

            {displayMessages.map((msg, idx) => (
              <AgentMessage
                key={msg.id}
                message={msg}
                isLast={idx === displayMessages.length - 1}
              />
            ))}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[#1E1E2E] p-4 bg-[#12121A]/50 backdrop-blur-sm shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-row gap-3 items-end">
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={loading ? 'CLUTCH is thinking...' : 'Ask CLUTCH anything...'}
              disabled={loading}
              className="flex-1 bg-[#0A0A0F] border border-[#1E1E2E] focus:border-indigo-500/50 outline-none text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm min-h-[48px] max-h-[140px] resize-none transition-colors disabled:opacity-60"
              rows={1}
            />

            <VoiceInput
              onTranscript={handleTranscript}
              disabled={loading}
            />

            <button
              onClick={handleSubmit}
              disabled={loading || !inputValue.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl p-3 flex items-center justify-center transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <SendHorizonal className="w-5 h-5" />
            </button>
          </div>

          <p className="text-[10px] text-slate-700 text-center mt-2 font-mono">
            CLUTCH can read and write to your Google Calendar and Gmail
          </p>
        </div>
      </div>

    </div>
  );
}