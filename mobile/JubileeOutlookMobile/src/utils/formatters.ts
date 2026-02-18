const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format a date as 'Jan 15, 2026'.
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Format a date's time portion as '3:30 PM'.
 */
export function formatTime(date: string | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const mins = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${mins} ${ampm}`;
}

/**
 * Format a date as 'Jan 15, 2026 3:30 PM'.
 */
export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${formatDate(d)} ${formatTime(d)}`;
}

/**
 * Format a date relative to today.
 * Returns 'Today', 'Yesterday', a short day name (e.g. 'Mon') for dates
 * within the current week, or the formatted date for anything older.
 */
export function formatRelativeDate(date: string | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return DAYS_SHORT[d.getDay()];
  return formatDate(d);
}

/**
 * Truncate text to a maximum length, appending an ellipsis if truncated.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

/**
 * Format a byte count into a human-readable file size string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Extract initials from a full name. Returns up to two characters.
 * e.g. 'John Doe' => 'JD', 'Alice' => 'A'
 */
export function getInitials(name: string): string {
  if (!name || !name.trim()) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Format an email address with an optional display name.
 * e.g. formatEmailAddress('john@example.com', 'John Doe') => 'John Doe <john@example.com>'
 */
export function formatEmailAddress(email: string, name?: string): string {
  if (!email) return '';
  if (name && name.trim()) return `${name.trim()} <${email}>`;
  return email;
}
