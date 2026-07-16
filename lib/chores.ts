import type { ChoreFrequencyUnit, ChoreTemplate } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function addChoreDuration(from: Date, amount: number, unit: ChoreFrequencyUnit): Date {
  const result = new Date(from);
  if (unit === 'day') result.setDate(result.getDate() + amount);
  if (unit === 'week') result.setDate(result.getDate() + amount * 7);
  if (unit === 'month') result.setMonth(result.getMonth() + amount);
  return result;
}

export function formatFrequency(template?: Pick<ChoreTemplate, 'frequencyInterval' | 'frequencyUnit'>): string {
  if (!template?.frequencyInterval || !template.frequencyUnit) return 'One-off';
  const unit = `${template.frequencyUnit}${template.frequencyInterval === 1 ? '' : 's'}`;
  return `Every ${template.frequencyInterval} ${unit}`;
}

export function isPastDue(dueDate?: string, now = new Date()): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < startOfDay(now).getTime();
}

export function isToday(dateValue?: string, now = new Date()): boolean {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

export function isWithinCompletedWindow(completedAt?: string, now = Date.now()): boolean {
  if (!completedAt) return false;
  const age = now - new Date(completedAt).getTime();
  return age >= 0 && age < DAY_MS;
}

export function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatRelativeAvailability(availableAt?: string): string {
  if (!availableAt) return 'Waiting to return';
  const target = new Date(availableAt);
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return 'Ready now';
  const days = Math.ceil(diff / DAY_MS);
  if (days === 1) return 'Returns tomorrow';
  if (days < 14) return `Returns in ${days} days`;
  return `Returns ${target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
