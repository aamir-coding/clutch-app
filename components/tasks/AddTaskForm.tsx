'use client';

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Minus, X, Loader2, Calendar, ClipboardList } from 'lucide-react';
import { Task } from '@/lib/types';

// Form validation schema with Zod
const addTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().optional(),
  dateStr: z.string().min(1, 'Date is required'),
  timeStr: z.string().min(1, 'Time is required'),
  estimatedHours: z.number().min(0.5, 'Minimum 0.5 hours').max(100, 'Maximum 100 hours'),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  subtasks: z.array(z.object({ value: z.string() })).optional(),
});

type AddTaskFormData = z.infer<typeof addTaskSchema>;

interface AddTaskFormProps {
  onTaskAdded: (task: Partial<Task>) => void | Promise<void>;
  onClose: () => void;
}

export default function AddTaskForm({ onTaskAdded, onClose }: AddTaskFormProps) {
  const [loading, setLoading] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);

  // Set default deadline tomorrow at 5:00 PM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];
  const defaultTime = '17:00';

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddTaskFormData>({
    resolver: zodResolver(addTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      dateStr: defaultDate,
      timeStr: defaultTime,
      estimatedHours: 2,
      priority: 'medium',
      subtasks: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'subtasks',
  });

  const estimatedHours = watch('estimatedHours');
  const selectedPriority = watch('priority');

  const adjustHours = (amount: number) => {
    const newVal = Math.max(0.5, Math.min(100, estimatedHours + amount));
    setValue('estimatedHours', newVal);
  };

  const onSubmit = async (data: AddTaskFormData) => {
    // Combine date string and time string to single Date object
    const deadlineDate = new Date(`${data.dateStr}T${data.timeStr}`);

    if (deadlineDate <= new Date()) {
      alert('Deadline must be in the future.');
      return;
    }

    setLoading(true);
    try {
      const formattedSubtasks = (data.subtasks || [])
        .filter((sub) => sub.value.trim() !== '')
        .map((sub) => ({
          id: crypto.randomUUID(),
          title: sub.value.trim(),
          done: false,
        }));

      const newTask: Partial<Task> = {
        title: data.title,
        description: data.description || '',
        deadline: deadlineDate,
        estimatedHours: data.estimatedHours,
        priority: data.priority,
        status: 'active',
        progressPercent: 0,
        subtasks: formattedSubtasks,
      };

      await onTaskAdded(newTask);
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to add task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 animate-fade-in text-slate-100">
      {/* 1. Title Input */}
      <div className="space-y-1">
        <input
          type="text"
          autoFocus
          placeholder="What needs to be done?"
          {...register('title')}
          className="w-full bg-[#0A0A0F] border border-[#1E1E2E] focus:border-indigo-500/50 outline-none text-white placeholder-slate-600 rounded-xl px-4 py-3 text-base font-medium transition-colors"
        />
        {errors.title && (
          <p className="text-xs text-rose-500 pl-1 font-mono">{errors.title.message}</p>
        )}
      </div>

      {/* 2. Description Input */}
      <div className="space-y-1">
        <textarea
          placeholder="Add context or notes (optional)"
          rows={2}
          {...register('description')}
          className="w-full bg-[#0A0A0F] border border-[#1E1E2E] focus:border-indigo-500/50 outline-none text-white placeholder-slate-600 rounded-xl px-4 py-2.5 text-xs resize-none transition-colors"
        />
        {errors.description && (
          <p className="text-xs text-rose-500 pl-1 font-mono">{errors.description.message}</p>
        )}
      </div>

      {/* 3. Deadline Picker Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Date Due</label>
          <div className="relative">
            <input
              type="date"
              {...register('dateStr')}
              className="w-full bg-[#0A0A0F] border border-[#1E1E2E] focus:border-indigo-500/50 text-white text-xs rounded-xl px-3 py-2.5 outline-none font-mono"
            />
          </div>
          {errors.dateStr && (
            <p className="text-xs text-rose-500 pl-1 font-mono">{errors.dateStr.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Time Due</label>
          <input
            type="time"
            {...register('timeStr')}
            className="w-full bg-[#0A0A0F] border border-[#1E1E2E] focus:border-indigo-500/50 text-white text-xs rounded-xl px-3 py-2.5 outline-none font-mono"
          />
          {errors.timeStr && (
            <p className="text-xs text-rose-500 pl-1 font-mono">{errors.timeStr.message}</p>
          )}
        </div>
      </div>

      {/* 4. Segmented Priority Selector */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Priority</label>
        <div className="grid grid-cols-4 gap-1.5 bg-[#0A0A0F] p-1 border border-[#1E1E2E] rounded-xl">
          {(['critical', 'high', 'medium', 'low'] as const).map((p) => {
            const isSelected = selectedPriority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setValue('priority', p)}
                className={`text-[10px] py-1.5 rounded-lg font-bold uppercase transition-all tracking-wider cursor-pointer
                  ${isSelected 
                    ? p === 'critical' ? 'bg-rose-500 text-white shadow-sm' 
                      : p === 'high' ? 'bg-amber-500 text-black shadow-sm'
                      : p === 'medium' ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Stepper Estimated Hours Row */}
      <div className="flex items-center justify-between bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-3.5">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-slate-300">Estimated Effort</span>
          <p className="text-[10px] text-slate-500 font-mono">Total focused hours needed</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => adjustHours(-0.5)}
            className="w-8 h-8 bg-[#12121A] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-850 rounded-lg flex items-center justify-center transition cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>

          <span className="text-sm font-extrabold text-white w-10 text-center font-mono">
            {estimatedHours}h
          </span>

          <button
            type="button"
            onClick={() => adjustHours(0.5)}
            className="w-8 h-8 bg-[#12121A] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-850 rounded-lg flex items-center justify-center transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 6. Subtasks Checklist List */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowSubtasks(!showSubtasks)}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1 cursor-pointer font-bold uppercase tracking-wider text-[10px]"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>{showSubtasks ? 'Hide Subtasks' : 'Add Subtasks (Optional)'}</span>
        </button>

        {showSubtasks && (
          <div className="space-y-2 bg-[#0A0A0F] border border-[#1E1E2E] p-3 rounded-xl animate-fade-in">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-center">
                <input
                  {...register(`subtasks.${index}.value` as const)}
                  placeholder="Subtask checklist item..."
                  className="flex-1 bg-[#12121A] border border-slate-800 rounded-lg text-xs text-white px-3 py-1.5 outline-none focus:border-indigo-500/50 font-sans"
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-slate-500 hover:text-rose-400 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({ value: '' })}
              className="text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5 px-1 py-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Add Checklist Step</span>
            </button>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/10"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>Adding Objective...</span>
          </>
        ) : (
          <span>Add Task — CLUTCH will schedule it</span>
        )}
      </button>

    </form>
  );
}
export type { AddTaskFormProps };