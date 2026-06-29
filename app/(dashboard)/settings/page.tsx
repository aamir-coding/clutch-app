'use client';

import React, { useState, useEffect } from 'react';
import { useUiStore } from '@/lib/stores/uiStore';
import { firestoreService, UserProfile } from '@/lib/firebase/firestoreService';
import { AuthService, signInWithGoogle, signOut } from '@/lib/firebase/authService';
import { 
  Clock, Bell, Cpu, Link as LinkIcon, AlertTriangle, 
  CheckCircle2, RefreshCw, LogOut, Loader2, Sparkles, Check 
} from 'lucide-react';

export default function SettingsPage() {
  const setPageTitle = useUiStore((state: any) => state.setPageTitle);
  const userId = 'default_user';

  // Loading / saving states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Form State
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [productiveHours, setProductiveHours] = useState<string[]>([]);
  
  // Notification Toggles
  const [crisisAlerts, setCrisisAlerts] = useState(true);
  const [morningBriefing, setMorningBriefing] = useState(true);
  const [schedulingNudges, setSchedulingNudges] = useState(true);

  // Agent Behavior
  const [autoSchedule, setAutoSchedule] = useState(false);
  const [autoScanGmail, setAutoScanGmail] = useState(false);
  const [sessionLength, setSessionLength] = useState(60);

  // Load Settings on Mount
  useEffect(() => {
    if (setPageTitle) {
      setPageTitle('Settings');
    }

    const loadSettings = async () => {
      try {
        setLoading(true);
        const user = await firestoreService.getUser(userId);
        if (user) {
          setWorkStart(user.workStart || '09:00');
          setWorkEnd(user.workEnd || '18:00');
          setProductiveHours(user.productiveHours || ['morning', 'afternoon']);
          
          if (user.notificationPreferences) {
            setCrisisAlerts(user.notificationPreferences.crisisAlerts);
            setMorningBriefing(user.notificationPreferences.morningBriefing);
            setSchedulingNudges(user.notificationPreferences.schedulingNudges);
          }
          if (user.agentBehavior) {
            setAutoSchedule(user.agentBehavior.autoSchedule);
            setAutoScanGmail(user.agentBehavior.autoScanGmail);
            setSessionLength(user.agentBehavior.sessionLength || 60);
          }
        }
      } catch (e) {
        console.error('Failed to load user preferences:', e);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [setPageTitle]);

  // Handle Save (Work Hours & Productive Hours)
  const handleSaveWorkSchedule = async () => {
    try {
      setSaving(true);
      await firestoreService.updateUser(userId, {
        workStart,
        workEnd,
        productiveHours,
        workHours: { workStart, workEnd }
      } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save schedule settings:', e);
    } finally {
      setSaving(false);
    }
  };

  // Instant notification preference save
  const handleNotificationChange = async (prefKey: string, val: boolean) => {
    const nextPrefs = {
      crisisAlerts: prefKey === 'crisisAlerts' ? val : crisisAlerts,
      morningBriefing: prefKey === 'morningBriefing' ? val : morningBriefing,
      schedulingNudges: prefKey === 'schedulingNudges' ? val : schedulingNudges,
    };

    if (prefKey === 'crisisAlerts') setCrisisAlerts(val);
    if (prefKey === 'morningBriefing') setMorningBriefing(val);
    if (prefKey === 'schedulingNudges') setSchedulingNudges(val);

    try {
      await firestoreService.updateUser(userId, {
        notificationPreferences: nextPrefs
      });
    } catch (e) {
      console.error('Failed to update notification preferences:', e);
    }
  };

  // Instant agent behavior preference save
  const handleAgentBehaviorChange = async (prefKey: string, val: any) => {
    const nextBehavior = {
      autoSchedule: prefKey === 'autoSchedule' ? val : autoSchedule,
      autoScanGmail: prefKey === 'autoScanGmail' ? val : autoScanGmail,
      sessionLength: prefKey === 'sessionLength' ? val : sessionLength,
    };

    if (prefKey === 'autoSchedule') setAutoSchedule(val);
    if (prefKey === 'autoScanGmail') setAutoScanGmail(val);
    if (prefKey === 'sessionLength') setSessionLength(val);

    try {
      await firestoreService.updateUser(userId, {
        agentBehavior: nextBehavior
      });
    } catch (e) {
      console.error('Failed to update agent behavior preferences:', e);
    }
  };

  // Toggle productive hours selection
  const handleToggleProductive = (hour: string) => {
    setProductiveHours((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour]
    );
  };

  // Reconnect Google Accs
  const handleReconnect = async (service: string) => {
    try {
      console.log(`Reconnecting to ${service}...`);
      await signInWithGoogle();
      alert(`${service} reconnected successfully.`);
    } catch (e) {
      console.error(e);
    }
  };

  // Danger Zone Wipes
  const handleClearAllTasks = async () => {
    const confirmed = window.confirm(
      '⚠️ CRITICAL: Are you sure you want to delete all tasks? This action is permanent and cannot be undone.'
    );
    if (!confirmed) return;

    try {
      setClearing(true);
      const tasks = await firestoreService.getTasks(userId);
      for (const t of tasks) {
        await firestoreService.deleteTask(userId, t.id);
      }
      alert('All tasks have been successfully cleared.');
      window.location.reload();
    } catch (e) {
      console.error('Error clearing tasks:', e);
    } finally {
      setClearing(false);
    }
  };

  const handleSignOut = async () => {
    const confirmed = window.confirm('Are you sure you want to sign out?');
    if (confirmed) {
      await signOut();
    }
  };

  // Custom UI components
  const Switch = ({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-indigo-600' : 'bg-slate-800'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-4.5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <span className="text-xs uppercase font-mono tracking-widest">Loading Preferences...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8 bg-[#06060A] text-slate-100 min-h-screen">
      <div>
        <h1 className="text-xl font-extrabold text-white tracking-tight uppercase font-mono">Preferences</h1>
        <p className="text-xs text-slate-400 mt-1">Configure your workspace defaults, automated agents, and system connections.</p>
      </div>

      <div className="space-y-8 bg-[#0A0A0F] border border-[#1E1E2E] rounded-2xl p-6 md:p-8">
        
        {/* Section 1: Work Schedule */}
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">1. Work Schedule</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pl-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Work Start</label>
              <input
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="w-full bg-[#13131E] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Work End</label>
              <input
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="w-full bg-[#13131E] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div className="pl-6 space-y-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Productive Hours</label>
            <div className="flex flex-wrap gap-2.5">
              {[
                { key: 'morning', label: 'Morning 6–12' },
                { key: 'afternoon', label: 'Afternoon 12–17' },
                { key: 'evening', label: 'Evening 17–22' }
              ].map((chip) => {
                const isSelected = productiveHours.includes(chip.key);
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => handleToggleProductive(chip.key)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-white'
                        : 'bg-[#13131E] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 stroke-[3]" />}
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pl-6 flex items-center gap-3">
            <button
              onClick={handleSaveWorkSchedule}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 transition text-white px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
            {saved && (
              <span className="text-xs text-indigo-400 font-mono font-bold animate-pulse">Saved ✓</span>
            )}
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-slate-850/60 my-6" />

        {/* Section 2: Notifications */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">2. Notification Toggles</h2>
          </div>
          
          <div className="space-y-4 pl-6">
            <div className="flex items-center justify-between p-3.5 bg-[#12121A] border border-slate-900 rounded-xl">
              <div>
                <p className="text-xs font-bold text-slate-200">Crisis Mode Alerts</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Receive urgent push notifications when a deadline is less than 4 hours away.</p>
              </div>
              <Switch checked={crisisAlerts} onChange={(val) => handleNotificationChange('crisisAlerts', val)} />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-[#12121A] border border-slate-900 rounded-xl">
              <div>
                <p className="text-xs font-bold text-slate-200">Daily Morning Briefing</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Receive a compiled risk agenda summary at 8:00 AM every morning.</p>
              </div>
              <Switch checked={morningBriefing} onChange={(val) => handleNotificationChange('morningBriefing', val)} />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-[#12121A] border border-slate-900 rounded-xl">
              <div>
                <p className="text-xs font-bold text-slate-200">Proactive Scheduling Nudges</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Remind me to book work blocks when new tasks are identified without sessions.</p>
              </div>
              <Switch checked={schedulingNudges} onChange={(val) => handleNotificationChange('schedulingNudges', val)} />
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-slate-850/60 my-6" />

        {/* Section 3: Agent Behavior */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">3. Agent Behavior</h2>
          </div>
          
          <div className="space-y-4 pl-6">
            <div className="flex items-center justify-between p-3.5 bg-[#12121A] border border-slate-900 rounded-xl">
              <div>
                <p className="text-xs font-bold text-slate-200">Auto-Schedule Sessions</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Allow CLUTCH to directly schedule calendar sessions on your behalf without asking.</p>
              </div>
              <Switch checked={autoSchedule} onChange={(val) => handleAgentBehaviorChange('autoSchedule', val)} />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-[#12121A] border border-slate-900 rounded-xl">
              <div>
                <p className="text-xs font-bold text-slate-200">Auto-Scan Gmail Daily</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Enable regular automated background scans for deadline risks in your Gmail.</p>
              </div>
              <Switch checked={autoScanGmail} onChange={(val) => handleAgentBehaviorChange('autoScanGmail', val)} />
            </div>

            <div className="p-3.5 bg-[#12121A] border border-slate-900 rounded-xl space-y-3">
              <div>
                <p className="text-xs font-bold text-slate-200">Session Length Preference</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Configure your default duration for scheduled work sessions.</p>
              </div>
              
              <div className="flex bg-[#0A0A0F] border border-slate-800 p-1 rounded-xl w-fit">
                {[30, 60, 90, 120].map((len) => (
                  <button
                    key={len}
                    onClick={() => handleAgentBehaviorChange('sessionLength', len)}
                    className={`px-3.5 py-1.5 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                      sessionLength === len
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {len}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-slate-850/60 my-6" />

        {/* Section 4: Connected Accounts */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">4. Connected Accounts</h2>
          </div>
          
          <div className="space-y-3 pl-6">
            {[
              { name: 'Google Calendar', desc: 'Syncs focus sessions and handles conflict check.' },
              { name: 'Gmail Inbox', desc: 'Used for scanning deadlines and analyzing urgent mail.' },
              { name: 'Google Tasks', desc: 'Syncs priorities and items from external lists.' }
            ].map((acc) => (
              <div key={acc.name} className="flex items-center justify-between p-3.5 bg-[#12121A] border border-slate-900 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-green-500/10 rounded-lg text-green-400 border border-green-500/20 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{acc.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{acc.desc}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleReconnect(acc.name)}
                  className="bg-slate-800 hover:bg-slate-700 transition text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer font-mono"
                >
                  Reconnect
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-slate-850/60 my-6" />

        {/* Section 5: Danger Zone */}
        <section className="space-y-4 p-4.5 border border-red-500/10 bg-red-500/5 rounded-2xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
            <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider font-mono">5. Danger Zone</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 pl-6">
            <button
              onClick={handleClearAllTasks}
              disabled={clearing}
              className="bg-red-950/20 hover:bg-red-900/40 text-red-400 border border-red-900/40 hover:border-red-600 transition px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              {clearing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Clearing...</span>
                </>
              ) : (
                <span>Clear All Tasks</span>
              )}
            </button>

            <button
              onClick={handleSignOut}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
