export function hoursUntil(deadline: Date | string | any): number {
  if (!deadline) return 0;
  let d: Date;
  if (typeof deadline.toDate === 'function') {
    d = deadline.toDate();
  } else {
    d = new Date(deadline);
  }
  return (d.getTime() - Date.now()) / (1000 * 60 * 60);
}

export function formatRelativeDeadline(deadline: Date | string | any): { label: string; level: 'low' | 'medium' | 'high' | 'critical' } {
  if (!deadline) return { label: 'No deadline', level: 'low' };
  const hours = hoursUntil(deadline);
  if (hours < 0) {
    return { label: 'Overdue', level: 'critical' };
  }
  if (hours < 4) {
    return { label: `Crisis: ${hours.toFixed(1)}h left`, level: 'critical' };
  }
  if (hours < 24) {
    return { label: `Due soon: ${hours.toFixed(1)}h left`, level: 'high' };
  }
  const days = Math.ceil(hours / 24);
  if (days === 1) {
    return { label: 'Due tomorrow', level: 'medium' };
  }
  return { label: `Due in ${days} days`, level: 'low' };
}

/**
 * Resolves a user's work-hour window ("09:00" - "18:00") into concrete
 * Date boundaries anchored to the given target date.
 */
export function getWorkBoundaries(
  targetDate: Date,
  workHours: { start: string; end: string }
): { workStart: Date; workEnd: Date } {
  const [startHour, startMinute] = workHours.start.split(':').map((v) => parseInt(v, 10));
  const [endHour, endMinute] = workHours.end.split(':').map((v) => parseInt(v, 10));

  const workStart = new Date(targetDate);
  workStart.setHours(Number.isFinite(startHour) ? startHour : 9, Number.isFinite(startMinute) ? startMinute : 0, 0, 0);

  const workEnd = new Date(targetDate);
  workEnd.setHours(Number.isFinite(endHour) ? endHour : 18, Number.isFinite(endMinute) ? endMinute : 0, 0, 0);

  return { workStart, workEnd };
}