'use client';

import React, { useEffect } from 'react';
import { useUiStore } from '@/lib/stores/uiStore';
import AgentChat from '@/components/agent/AgentChat';

export default function ChatPage() {
  const setPageTitle = useUiStore((state: any) => state.setPageTitle);

  useEffect(() => {
    if (setPageTitle) {
      setPageTitle('CLUTCH Agent');
    }
  }, [setPageTitle]);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full">
      <AgentChat />
    </div>
  );
}
