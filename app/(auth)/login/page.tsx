'use client';

import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { useAuth } from '@/components/layout/AuthProvider';
import { toast } from 'sonner';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [isBtnLoading, setIsBtnLoading] = useState<boolean>(false);

  const handleSignIn = async () => {
    setIsBtnLoading(true);
    try {
      await signIn();
      toast.success('Successfully logged in with Google!');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to authenticate with Google');
    } finally {
      setIsBtnLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0A0A0F] px-4 font-sans" id="login-page-main">
      <div className="max-w-sm w-full mx-auto flex flex-col items-center gap-6" id="login-card">
        {/* 1. Zap Icon */}
        <Zap size={48} className="text-indigo-500" id="login-zap-icon" />

        {/* 2. Clutch Heading */}
        <h1 className="text-5xl font-bold tracking-tight text-white" id="login-heading">
          CLUTCH
        </h1>

        {/* 3. Tagline */}
        <p className="text-slate-400 text-lg text-center" id="login-tagline">
          When everything&apos;s on the line.
        </p>

        {/* 4. Divider */}
        <div className="border-t border-slate-800 w-full" id="login-divider" />

        {/* 5. Description */}
        <p className="text-slate-500 text-sm text-center leading-relaxed" id="login-description">
          Connect your Google account. CLUTCH will monitor your calendar, scan Gmail for deadlines, and schedule work sessions automatically.
        </p>

        {/* 6. Sign in Button */}
        <button
          onClick={handleSignIn}
          disabled={isBtnLoading}
          className="w-full bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 rounded-lg py-3 px-4 flex items-center justify-center gap-3 transition-colors cursor-pointer"
          id="google-signin-btn"
        >
          {isBtnLoading ? (
            <svg
              className="animate-spin h-5 w-5 text-slate-900"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              id="google-signin-spinner"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              id="google-logo-svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          <span className="font-medium">Continue with Google</span>
        </button>

        {/* 7. Fine Print */}
        <p className="text-slate-600 text-xs text-center" id="login-fineprint">
          CLUTCH requests access to Calendar, Gmail, and Tasks
        </p>
      </div>
    </main>
  );
}
