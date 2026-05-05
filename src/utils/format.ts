// Format health metrics for display
export function formatBP(systolic?: number, diastolic?: number): string {
  if (!systolic || !diastolic) return '--/--';
  return `${Math.round(systolic)}/${Math.round(diastolic)}`;
}

export function formatHeartRate(rate?: number): string {
  if (!rate) return '--';
  return `${Math.round(rate)} bpm`;
}

export function formatSpO2(spO2?: number): string {
  if (!spO2) return '--';
  return `${Math.round(spO2)}%`;
}

export function formatGlucose(glucose?: number): string {
  if (!glucose) return '--';
  return `${Math.round(glucose)} mg/dL`;
}

export function formatWeight(weight?: number): string {
  if (!weight) return '--';
  return `${weight.toFixed(1)} kg`;
}

export function formatBMI(bmi?: number): string {
  if (!bmi) return '--';
  return `${bmi.toFixed(1)}`;
}

export function formatSteps(steps?: number): string {
  if (!steps) return '--';
  if (steps >= 1000) {
    return `${(steps / 1000).toFixed(1)}k`;
  }
  return `${Math.round(steps)}`;
}

export function formatCalories(calories?: number): string {
  if (!calories) return '--';
  return `${Math.round(calories)} kcal`;
}

export function formatTime(date?: Date): string {
  if (!date) return '--';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date?: Date): string {
  if (!date) return '--';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateTime(date?: Date): string {
  if (!date) return '--';
  const d = new Date(date);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function formatProbability(prob?: number): string {
  if (prob === undefined || prob === null) return '--';
  return `${Math.round(prob * 100)}%`;
}

export function formatRelativeTime(date?: Date): string {
  if (!date) return '--';
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffMins < 1440) return `${Math.round(diffMins / 60)} hours ago`;
  return `${Math.round(diffMins / 1440)} days ago`;
}

export function formatTemperature(temp?: number): string {
  if (!temp) return '--';
  return `${temp.toFixed(1)}°C`;
}
