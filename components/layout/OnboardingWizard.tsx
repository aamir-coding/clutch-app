'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Clock, Mail, CheckCircle2, ChevronRight, Loader2, X, Check } from 'lucide-react';
import { firestoreService, Task } from '@/lib/firebase/firestoreService';

interface OnboardingWizardProps {
  showOnboarding: boolean;
  onClose: () => void;
  onRefreshTasks?: () => void;
}

export default function OnboardingWizard({ showOnboarding, onClose, onRefreshTasks }: OnboardingWizardProps) {
  const [isOpen, setIsOpen] = useState(showOnboarding);
  const [currentStep, setCurrentStep] = useState(1);
  const [userId] = useState('default_user');

  // Step 1 states
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [productiveHours, setProductiveHours] = useState<string[]>(['morning', 'afternoon']);

  // Step 2 states
  const [scanning, setScanning] = useState(false);
  const [scannedTasks, setScannedTasks] = useState<any[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [addingTasks, setAddingTasks] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    setIsOpen(showOnboarding);
  }, [showOnboarding]);

  if (!isOpen) return null;

  const handleToggleProductive = (hour: string) => {
    setProductiveHours((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour]
    );
  };

  const saveStep1 = async () => {
    try {
      await firestoreService.updateUser(userId, {
        workStart,
        workEnd,
        productiveHours,
        // Also save as workHours nested structure just in case
        workHours: { workStart, workEnd }
      } as any);
      setCurrentStep(2);
    } catch (e) {
      console.error('Failed to save step 1 preferences:', e);
      setCurrentStep(2); // Progress anyway to avoid blocking
    }
  };

  const handleScanGmail = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/gmail/scan');
      if (res.ok) {
        const data = await res.json();
        setScannedTasks(data);
        // Default select all scanned tasks
        setSelectedTaskIds(data.map((t: any) => t.id));
        setHasScanned(true);
      } else {
        console.error('Failed to scan Gmail');
      }
    } catch (e) {
      console.error('Error during scan fetch:', e);
    } finally {
      setScanning(false);
    }
  };

  const handleToggleTaskSelection = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((tId) => tId !== id) : [...prev, id]
    );
  };

  const handleAddTasks = async () => {
    setAddingTasks(true);
    try {
      const tasksToCreate = scannedTasks.filter((t) => selectedTaskIds.includes(t.id));
      for (const t of tasksToCreate) {
        await firestoreService.createTask(userId, {
          title: t.title,
          description: t.description,
          deadline: t.deadline,
          estimatedHours: t.estimatedHours,
          priority: t.priority,
          status: 'active',
          subtasks: t.subtasks || [],
          gmailThreadId: t.id
        });
      }
      setAddedCount(tasksToCreate.length);
      if (onRefreshTasks) {
        onRefreshTasks();
      }
      setCurrentStep(3);
    } catch (e) {
      console.error('Failed to import tasks:', e);
      setCurrentStep(3);
    } finally {
      setAddingTasks(false);
    }
  };

  const handleComplete = () => {
    setIsOpen(false);
    onClose();
  };

  return (
    <div id="onboarding-dialog-container" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
      />

      {/* Main Dialog Box */}
      <div 
        id="onboarding-dialog-body" 
        className="relative w-full max-w-md bg-[#0D0D15] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Header Section */}
        <div className="p-6 pb-0 flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((step) => (
              <span
                key={step}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  currentStep === step 
                    ? 'bg-indigo-500 scale-110 shadow-sm shadow-indigo-500/50' 
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>

          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-white transition p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <div className="p-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">When do you work best?</h2>
                  <p className="text-xs text-slate-400 mt-1">Configure your preferred hours to help CLUTCH optimize your schedule.</p>
                </div>

                {/* Work Start / End Inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">Work Start</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="time"
                        value={workStart}
                        onChange={(e) => setWorkStart(e.target.value)}
                        className="w-full bg-[#13131E] border border-slate-800 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">Work End</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="time"
                        value={workEnd}
                        onChange={(e) => setWorkEnd(e.target.value)}
                        className="w-full bg-[#13131E] border border-slate-800 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Productive hours multi-select */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">Most productive hours</label>
                  <div className="grid grid-cols-1 gap-2.5">
                    {[
                      { key: 'morning', label: 'Morning (6–12)', desc: 'Sharp focus & planning' },
                      { key: 'afternoon', label: 'Afternoon (12–17)', desc: 'Execution & collaboration' },
                      { key: 'evening', label: 'Evening (17–22)', desc: 'Late momentum & review' },
                    ].map((slot) => {
                      const selected = productiveHours.includes(slot.key);
                      return (
                        <button
                          key={slot.key}
                          type="button"
                          onClick={() => handleToggleProductive(slot.key)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-left cursor-pointer ${
                            selected
                              ? 'bg-indigo-500/10 border-indigo-500/40 text-white'
                              : 'bg-[#13131E] border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold font-mono tracking-wide uppercase">{slot.label}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{slot.desc}</p>
                          </div>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
                            selected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-700'
                          }`}>
                            {selected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Continue Button */}
                <button
                  onClick={saveStep1}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 transition-colors text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Find deadlines in your Gmail</h2>
                  <p className="text-xs text-slate-400 mt-1">CLUTCH will scan the last 7 days of Gmail for any deadlines or commitments.</p>
                </div>

                {!hasScanned ? (
                  <div className="py-8 text-center bg-[#13131E] border border-slate-800 rounded-2xl flex flex-col items-center justify-center p-6 space-y-4">
                    <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
                      <Mail className="w-8 h-8" />
                    </div>
                    <p className="text-xs text-slate-400 max-w-[280px]">Scan securely to pull in critical tasks without manual input.</p>
                    <button
                      onClick={handleScanGmail}
                      disabled={scanning}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                    >
                      {scanning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Scanning Inbox...</span>
                        </>
                      ) : (
                        <span>Scan Now</span>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="max-h-[220px] overflow-y-auto space-y-2.5 pr-1">
                      {scannedTasks.map((t) => {
                        const isSelected = selectedTaskIds.includes(t.id);
                        return (
                          <div
                            key={t.id}
                            onClick={() => handleToggleTaskSelection(t.id)}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition text-left cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-500/10 border-indigo-500/30'
                                : 'bg-[#13131E] border-slate-850 hover:border-slate-800'
                            }`}
                          >
                            <div className={`mt-0.5 w-4.5 h-4.5 rounded border flex items-center justify-center transition shrink-0 ${
                              isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-750 bg-slate-900'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white truncate">{t.title}</p>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">{t.description}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase font-semibold">
                                  {t.priority}
                                </span>
                                <span className="text-[9px] font-mono text-slate-500">
                                  Due: {new Date(t.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Action button */}
                    <button
                      onClick={handleAddTasks}
                      disabled={addingTasks}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {addingTasks ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creating tasks...</span>
                        </>
                      ) : (
                        <span>Add {selectedTaskIds.length} Selected Tasks</span>
                      )}
                    </button>
                  </div>
                )}

                {/* Footer link to skip */}
                <div className="text-center pt-2">
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="text-xs text-slate-500 hover:text-indigo-400 transition font-mono uppercase tracking-wider underline underline-offset-4 cursor-pointer"
                  >
                    Skip &amp; set up manually
                  </button>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 text-center py-4"
              >
                {/* Large, animated Zap icon */}
                <div className="flex justify-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
                    className="p-5 bg-indigo-500/10 border border-indigo-500/30 rounded-3xl text-indigo-400 shadow-lg shadow-indigo-500/10"
                  >
                    <Zap className="w-12 h-12 fill-indigo-400" />
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">You&apos;re all set!</h2>
                  <p className="text-xs text-slate-400 max-w-[300px] mx-auto leading-relaxed">
                    {addedCount > 0 
                      ? `CLUTCH found ${addedCount} tasks and scheduled your first work sessions.`
                      : "CLUTCH has configured your profile. Let's start tracking and defending your deadlines."}
                  </p>
                </div>

                {/* Tip box */}
                <div className="bg-[#13131E] border border-indigo-950/40 p-3.5 rounded-xl text-left max-w-[340px] mx-auto">
                  <p className="text-[11px] text-indigo-300 font-sans leading-relaxed">
                    💡 <strong>Pro tip:</strong> Say &quot;Build my battle plan for this week&quot; to CLUTCH to get started.
                  </p>
                </div>

                {/* Open Command Center Button */}
                <button
                  onClick={handleComplete}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 transition text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <span>Open Command Center</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
