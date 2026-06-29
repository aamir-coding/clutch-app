import React from 'react';
import { getRiskLevel, getRiskColor } from '@/lib/agent/risk-engine';

interface RiskBarProps {
  score: number;
  showLabel?: boolean;
  showLevel?: boolean;
  className?: string;
}

export default function RiskBar({ score, showLabel = true, showLevel = true, className = '' }: RiskBarProps) {
  const level = getRiskLevel(score);
  const color = getRiskColor(level);

  return (
    <div id={`risk-bar-${score}`} className={`${className} space-y-1`}>
      {(showLevel || showLabel) && (
        <div className="flex items-center justify-between text-xs">
          {showLabel && <span className="text-slate-400 font-medium">Risk Score</span>}
          {showLevel && (
            <span 
              className="font-mono font-bold uppercase tracking-wider" 
              style={{ color }}
            >
              {level} ({score}%)
            </span>
          )}
        </div>
      )}
      <div className="w-full h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${score > 85 ? 'animate-pulse' : ''}`}
          style={{ 
            width: `${Math.min(100, Math.max(0, score))}%`,
            backgroundColor: color 
          }}
        />
      </div>
    </div>
  );
}
