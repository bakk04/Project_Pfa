// Risk level colors and visual indicators - Unified Lime Green Theme
export const riskColors = {
  low: {
    bg: 'bg-emerald-50/50',
    border: 'border-emerald-100',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800',
    indicator: '#34C759',
  },
  moderate: {
    bg: 'bg-green-50/50',
    border: 'border-green-100',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-800',
    indicator: '#28a745',
  },
  high: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-900',
    badge: 'bg-slate-200 text-slate-800',
    indicator: '#1e7e34',
  },
};

export function getRiskColor(level: 'low' | 'moderate' | 'high') {
  return riskColors[level] || riskColors.low;
}

export function getRiskLevelFromProbability(probability: number): 'low' | 'moderate' | 'high' {
  if (probability < 0.3) return 'low';
  if (probability < 0.7) return 'moderate';
  return 'high';
}

// Visual indicators
export const vitalsIndicators = {
  heartRate: {
    normal: { min: 60, max: 100 },
    elevated: { min: 100, max: 120 },
    high: { min: 120, max: Infinity },
  },
  spO2: {
    normal: { min: 95, max: 100 },
    low: { min: 90, max: 95 },
    critical: { min: 0, max: 90 },
  },
  systolicBP: {
    normal: { min: 0, max: 120 },
    elevated: { min: 120, max: 140 },
    high: { min: 140, max: Infinity },
  },
  glucose: {
    normal: { min: 70, max: 100 },
    prediabetic: { min: 100, max: 126 },
    diabetic: { min: 126, max: Infinity },
  },
};

export function getVitalStatus(
  vital: string,
  value: number
): 'normal' | 'elevated' | 'high' | 'critical' | 'low' | 'prediabetic' | 'diabetic' {
  const indicator = vitalsIndicators[vital as keyof typeof vitalsIndicators];
  if (!indicator) return 'normal';

  const ranges = indicator as Record<string, { min: number; max: number }>;
  for (const [status, range] of Object.entries(ranges)) {
    if (value >= range.min && value <= range.max) {
      return status as any;
    }
  }
  return 'normal';
}
