'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SendHorizonal, Zap } from 'lucide-react';
import { useAgent } from '@/lib/hooks/useAgent';
import { useUiStore } from '@/lib/stores/uiStore';
import AgentMessage from './AgentMessage';
import VoiceInput from './VoiceInput';

export default function AgentChat() {
  const { messages, loading, sendMessage } = useAgent();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Safe extraction of tool calls
  const activeToolCallsState = useUiStore((state: any) => state.activeToolCalls);
  const activeToolCalls = activeToolCallsState || [];

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeToolCalls]);

  const handleSubmit = () => {
    if (inputValue.trim().length === 0 || loading) return;
    const text = inputValue;
    setInputValue('');
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const suggestions = [
    "📅 Build my battle plan for this week",
    "📧 Scan my Gmail for missed deadlines",
    "⚡ What's most at risk right now?",
    "➕ Add a new task"
  ];

  const handleSuggestionClick = (text: string) => {
    setInputValue(text);
    setTimeout(() => {
      // Small delay to let the state update before sending
      if (!loading) {
        sendMessage(text);
        setInputValue('');
      }
    }, 50);
  };

  // Clone messages to inject active tool calls into the last assistant message if it's currently running
  const displayMessages = [...messages];
  if (loading && displayMessages.length > 0 && activeToolCalls.length > 0) {
    const lastMsg = displayMessages[displayMessages.length - 1];
    if (lastMsg.role === 'assistant') {
      lastMsg.toolCalls = [...activeToolCalls];
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#06060A]">
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-8 animate-fade-in">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(99,102,241,0.15)]">
                <Zap className="w-8 h-8 text-indigo-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white uppercase font-sans">
                CLUTCH
              </h1>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                How can I help you today? I can manage your tasks, schedule work sessions, and keep your deadlines on track.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  className="bg-[#12121A] border border-[#1E1E2E] hover:border-indigo-500/30 text-slate-300 hover:text-white transition-colors text-sm px-4 py-3 rounded-xl cursor-pointer text-left flex items-center justify-center text-center"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          displayMessages.map((msg, idx) => (
            <AgentMessage 
              key={msg.id} 
              message={msg} 
              isLast={idx === displayMessages.length - 1} 
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-[#1E1E2E] p-4 bg-[#12121A]/50 backdrop-blur-sm shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-row gap-3 items-end">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask CLUTCH anything..."
              className="flex-1 bg-[#0A0A0F] border border-[#1E1E2E] focus:border-indigo-500/50 outline-none text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm min-h-[48px] max-h-[140px] resize-none transition-colors"
              rows={1}
            />
            
            <VoiceInput 
              onTranscript={(text) => { 
                setInputValue(prev => prev ? prev + ' ' + text : text); 
              }} 
              disabled={loading}
            />
            
            <button
              onClick={handleSubmit}
              disabled={loading || inputValue.trim().length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl p-3 flex items-center justify-center transition-colors shrink-0"
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
