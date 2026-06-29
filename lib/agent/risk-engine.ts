export function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 85) return 'high';
  return 'critical';
}

export function getRiskColor(level: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (level) {
    case 'low': return '#10B981'; // emerald
    case 'medium': return '#3B82F6'; // blue
    case 'high': return '#F59E0B'; // amber
    case 'critical': return '#EF4444'; // red
  }
}
