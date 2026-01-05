import { formatDistanceToNow, format } from 'date-fns';

export function formatRelativeTime(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDateTime(date: string): string {
  return format(new Date(date), 'MMM d, yyyy h:mm a');
}

export function formatVersion(major: number, minor: number): string {
  return `v${major}.${minor}`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    review: 'bg-amber-100 text-amber-700',
    approved: 'bg-blue-100 text-blue-700',
    active: 'bg-emerald-100 text-emerald-700',
    deprecated: 'bg-red-100 text-red-700'
  };
  return colors[status] || 'bg-slate-100 text-slate-700';
}

export function getGuardrailColor(level: string): string {
  const colors: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700'
  };
  return colors[level] || 'bg-slate-100 text-slate-700';
}
