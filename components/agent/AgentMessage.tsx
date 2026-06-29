'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ToolCallIndicator from './ToolCallIndicator';
import { AgentMessage as AgentMessageType } from '@/lib/hooks/useAgent';

interface AgentMessageProps {
  message: AgentMessageType;
  isLast: boolean;
}

export default function AgentMessage({ message, isLast }: AgentMessageProps) {
  const isUser = message.role === 'user';
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  if (isUser) {
    return (
      <div className="flex flex-row-reverse items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
          U
        </div>
        <div className="flex flex-col items-end">
          <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm shadow-sm">
            {message.content}
          </div>
          <span className="text-[10px] text-slate-600 mt-1">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex flex-row items-start gap-3 w-full">
      <div className="w-8 h-8 rounded-full bg-[#12121A] border border-indigo-500/30 flex items-center justify-center shrink-0">
        <Zap className="w-4 h-4 text-indigo-400" />
      </div>
      
      <div className="flex flex-col gap-1.5 max-w-[85%]">
        {/* Tool calls above the bubble if they exist and this is the last message */}
        {isLast && message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallIndicator toolCalls={message.toolCalls} />
        )}
        
        <div className="bg-[#12121A] border border-[#1E1E2E] text-[#F8FAFC] rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm">
          {message.content.trim() === '' ? (
            <div className="flex space-x-1 items-center h-5">
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          ) : (
            <ReactMarkdown
              className="markdown-body text-sm leading-relaxed"
              components={{
                code(props: any) {
                  const { children, className, node, ...rest } = props;
                  return (
                    <code {...rest} className={`${className} bg-[#0A0A0F] px-1 py-0.5 rounded text-indigo-300 font-mono text-xs`}>
                      {children}
                    </code>
                  );
                },
                strong(props: any) {
                  return <strong className="text-white font-bold">{props.children}</strong>;
                },
                ul(props: any) {
                  return <ul className="ml-4 space-y-1 list-disc my-2">{props.children}</ul>;
                },
                ol(props: any) {
                  return <ol className="ml-4 space-y-1 list-decimal my-2">{props.children}</ol>;
                },
                p(props: any) {
                  return <p className="mb-2 last:mb-0">{props.children}</p>;
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        
        <span className="text-[10px] text-slate-600 mt-0.5">{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}
