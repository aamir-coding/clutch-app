'use client';

import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  deadline: Date;
  onExpired: () => void;
}

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
}

export default function CountdownTimer({ deadline, onExpired }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = new Date(deadline).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        onExpired();
        return false;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
      return true;
    };

    // Run once immediately
    const active = updateTimer();
    if (!active) return;

    const interval = setInterval(() => {
      const active = updateTimer();
      if (!active) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, onExpired]);

  const isWarning = timeLeft.hours === 0 && timeLeft.minutes < 30;
  const isUrgent = timeLeft.hours === 0 && timeLeft.minutes < 10;

  const pad = (num: number) => String(num).padStart(2, '0');

  return (
    <div
      id="countdown-timer-wrapper"
      className={`flex items-center justify-center gap-2 transition-all ${
        isWarning ? 'animate-[pulse_2s_infinite]' : ''
      }`}
    >
      {/* Hours */}
      <div id="countdown-hours-box" className="bg-[#12121A] border border-red-500/30 rounded-lg px-4 py-3 flex flex-col items-center min-w-[70px]">
        <span className={`text-4xl font-bold font-mono tracking-tight ${isUrgent ? 'text-red-500' : 'text-red-400'}`}>
          {pad(timeLeft.hours)}
        </span>
        <span className="text-xs text-slate-500 uppercase tracking-wider mt-1">Hours</span>
      </div>

      <span className="text-2xl text-red-500/50 font-bold self-center mb-5">:</span>

      {/* Minutes */}
      <div id="countdown-minutes-box" className="bg-[#12121A] border border-red-500/30 rounded-lg px-4 py-3 flex flex-col items-center min-w-[70px]">
        <span className={`text-4xl font-bold font-mono tracking-tight ${isUrgent ? 'text-red-500' : 'text-red-400'}`}>
          {pad(timeLeft.minutes)}
        </span>
        <span className="text-xs text-slate-500 uppercase tracking-wider mt-1">Mins</span>
      </div>

      <span className="text-2xl text-red-500/50 font-bold self-center mb-5">:</span>

      {/* Seconds */}
      <div id="countdown-seconds-box" className="bg-[#12121A] border border-red-500/30 rounded-lg px-4 py-3 flex flex-col items-center min-w-[70px]">
        <span className={`text-4xl font-bold font-mono tracking-tight ${isUrgent ? 'text-red-500' : 'text-red-400'}`}>
          {pad(timeLeft.seconds)}
        </span>
        <span className="text-xs text-slate-500 uppercase tracking-wider mt-1">Secs</span>
      </div>
    </div>
  );
}
