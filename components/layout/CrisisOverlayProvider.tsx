'use client';

import React from 'react';
import { useUiStore } from '@/lib/stores/uiStore';
import CrisisMode from '@/components/crisis/CrisisMode';

export default function CrisisOverlayProvider({ children }: { children: React.ReactNode }) {
  const crisisTaskId = useUiStore((state) => state.crisisTaskId);
  const setCrisisTaskId = useUiStore((state) => state.setCrisisTaskId);

  return (
    <>
      {children}
      {crisisTaskId && (
        <div id="crisis-overlay-container" className="fixed inset-0 z-50">
          <CrisisMode
            taskId={crisisTaskId}
            onComplete={() => setCrisisTaskId(null)}
            onDismiss={() => setCrisisTaskId(null)}
          />
        </div>
      )}
    </>
  );
}
