'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import CrisisMode from '@/components/crisis/CrisisMode';

export default function CrisisTaskPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.taskId as string;

  if (!taskId) {
    return (
      <div id="crisis-invalid-route" className="min-h-screen bg-[#0A0A0F] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-xl font-bold text-red-500 mb-2">INVALID RESOURCE ROUTE</h1>
        <button
          onClick={() => router.push('/tasks')}
          className="mt-4 px-6 py-2 bg-[#12121A] border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition text-sm"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const handleComplete = () => {
    // Navigate back to the main tasks dashboard on successful resolution
    router.push('/tasks');
  };

  const handleDismiss = () => {
    // Navigate back to tasks dashboard
    router.push('/tasks');
  };

  return (
    <div id="crisis-task-page-root" className="min-h-screen bg-[#0A0A0F] relative">
      <CrisisMode taskId={taskId} onComplete={handleComplete} onDismiss={handleDismiss} />
    </div>
  );
}
