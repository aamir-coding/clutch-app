'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Calendar, Mail, CheckSquare, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/layout/AuthProvider';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, signIn } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  // Redirect already-authenticated users immediately
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleGoogleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      await signIn();
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Sign-in error:', error);

      let message = 'Sign-in failed. Please try again.';

      if (error?.code === 'auth/popup-closed-by-user') {
        message = 'Sign-in cancelled.';
      } else if (error?.code === 'auth/popup-blocked') {
        message = 'Pop-up blocked — please allow pop-ups for this site and try again.';
      } else if (
        error?.code === 'auth/invalid-credential' ||
        error?.message?.includes('invalid_client')
      ) {
        message =
          'OAuth configuration error. Check that your Google Cloud OAuth client secret matches Firebase Authentication. See console for details.';
      } else if (error?.code === 'auth/cancelled-popup-request') {
        // Another popup was opened — silently ignore
        message = '';
      } else if (error?.message) {
        message = error.message;
      }

      if (message) toast.error(message, { duration: 7000 });
    } finally {
      setSigningIn(false);
    }
  };

  // Blank screen while checking auth state — prevents layout flash
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#06060A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  const features = [
    {
      icon:  Calendar,
      label: 'Google Calendar',
      desc:  'Auto-schedule focus sessions around your meetings',
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    {
      icon:  Mail,
      label: 'Gmail Inbox',
      desc:  'Detect deadline threats hidden in your email',
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    },
    {
      icon:  CheckSquare,
      label: 'Google Tasks',
      desc:  'Sync priorities across all your Google tools',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <div className="min-h-screen bg-[#06060A] flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 space-y-5">

        {/* Branding */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
              <div className="relative p-4 bg-[#0D0D15] border border-indigo-500/30 rounded-2xl shadow-2xl">
                <Zap className="w-10 h-10 text-indigo-400" fill="currentColor" />
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-[0.2em] text-white uppercase">
              CLUTCH
            </h1>
            <p className="text-slate-500 text-sm mt-1.5 font-medium tracking-wide">
              When everything&apos;s on the line.
            </p>
          </div>
        </div>

        {/* Sign-in card */}
        <div className="bg-[#0D0D15] border border-[#1E1E2E] rounded-2xl shadow-2xl overflow-hidden">

          <div className="bg-indigo-600/5 border-b border-[#1E1E2E] px-6 py-4 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0" />
            <p className="text-xs text-slate-300 font-medium">
              Connect your Google account to activate CLUTCH
            </p>
          </div>

          <div className="p-6 space-y-5">

            <p className="text-xs text-slate-400 leading-relaxed text-center">
              CLUTCH monitors your calendar, scans Gmail for deadlines, and
              schedules work sessions automatically — so you never miss a
              commitment again.
            </p>

            {/* Feature tiles */}
            <div className="space-y-2">
              {features.map(({ icon: Icon, label, desc, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 p-3 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl"
                >
                  <div className={`p-1.5 border rounded-lg shrink-0 ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">{label}</p>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Google Sign-in Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold text-sm py-3 px-5 rounded-xl transition-all duration-150 flex items-center justify-center gap-3 shadow-lg shadow-black/20 cursor-pointer"
            >
              {signingIn ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500 shrink-0" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 shrink-0"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            <p className="text-center text-[10px] text-slate-600 font-mono leading-relaxed">
              CLUTCH requests read access to Calendar, Gmail, and Tasks.
              <br />
              No data is stored without your action.
            </p>

          </div>
        </div>

        <p className="text-center text-[10px] text-slate-700 font-mono uppercase tracking-widest">
          Powered by Google Workspace + Gemini AI
        </p>

      </div>
    </div>
  );
}