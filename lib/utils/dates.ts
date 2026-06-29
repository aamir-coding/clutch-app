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
