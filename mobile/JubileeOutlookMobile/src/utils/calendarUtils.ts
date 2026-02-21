/**
 * Calendar utilities — ported from web frontend src/utils/calendarUtils.ts
 * and src/components/calendar/CalendarGrid/CalendarGrid.tsx.
 *
 * Contains: overlap detection, recurrence expansion, date range helpers,
 * formatting utilities, and shared constants.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CalendarEvent, CalendarViewMode, ShowAsStatus } from '../types/calendar';

// ────────────────────────────────────────────────────────────
// Constants (matching web frontend EventDialog.tsx)
// ────────────────────────────────────────────────────────────

export const HOUR_HEIGHT_DAY = 60;
export const HOUR_HEIGHT_WEEK = 48;

export const HOURS = Array.from({ length: 24 }, (_, i) => {
  const suffix = i >= 12 ? 'PM' : 'AM';
  const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return { hour24: i, label: `${h12} ${suffix}` };
});

export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return {
    label: `${h12}:${minute} ${suffix}`,
    hour24: hour,
    minute: i % 2 === 0 ? 0 : 30,
    value: `${String(hour).padStart(2, '0')}:${minute}`,
  };
});

export const EVENT_COLORS: Record<string, string> = {
  blue: '#5B9BD5',
  green: '#70AD47',
  orange: '#ED7D31',
  purple: '#9966CC',
  red: '#E74856',
  yellow: '#FFC000',
};

export const CATEGORY_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'blue', label: 'Blue category', color: '#5B9BD5' },
  { value: 'green', label: 'Green category', color: '#70AD47' },
  { value: 'orange', label: 'Orange category', color: '#ED7D31' },
  { value: 'purple', label: 'Purple category', color: '#9966CC' },
  { value: 'red', label: 'Red category', color: '#E74856' },
  { value: 'yellow', label: 'Yellow category', color: '#FFC000' },
];

export const SHOW_AS_OPTIONS: { value: ShowAsStatus; label: string; color: string }[] = [
  { value: 'free', label: 'Free', color: '#FFFFFF' },
  { value: 'workingelsewhere', label: 'Working elsewhere', color: '#9370DB' },
  { value: 'tentative', label: 'Tentative', color: '#6495ED' },
  { value: 'busy', label: 'Busy', color: '#DC143C' },
  { value: 'outofoffice', label: 'Out of office', color: '#9B30FF' },
];

export const REMINDER_OPTIONS: { label: string; minutes: number }[] = [
  { label: "Don't remind me", minutes: -1 },
  { label: 'At time of event', minutes: 0 },
  { label: '5 minutes before', minutes: 5 },
  { label: '15 minutes before', minutes: 15 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '2 hours before', minutes: 120 },
  { label: '12 hours before', minutes: 720 },
  { label: '1 day before', minutes: 1440 },
  { label: '1 week before', minutes: 10080 },
];

export const RECURRENCE_TYPES = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
export const RECURRENCE_END_OPTIONS = ['Never', 'On date', 'After occurrences'];

export const DAYS_OF_WEEK = [
  { key: 'Sun', label: 'S' },
  { key: 'Mon', label: 'M' },
  { key: 'Tue', label: 'T' },
  { key: 'Wed', label: 'W' },
  { key: 'Thu', label: 'T' },
  { key: 'Fri', label: 'F' },
  { key: 'Sat', label: 'S' },
];

export const TIMEZONE_OPTIONS = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

// ────────────────────────────────────────────────────────────
// Date helpers
// ────────────────────────────────────────────────────────────

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(date: Date): Date {
  const d = getWeekStart(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function formatTime12h(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function getEventColor(category: string): string {
  return EVENT_COLORS[category] || EVENT_COLORS.blue;
}

// ────────────────────────────────────────────────────────────
// Date range calculation (matching web CalendarPage.tsx)
// ────────────────────────────────────────────────────────────

export function getDateRange(
  selectedDate: Date,
  viewMode: CalendarViewMode,
): { start: Date; end: Date } {
  const d = new Date(selectedDate);

  switch (viewMode) {
    case 'day': {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      return { start, end };
    }
    case 'week': {
      const start = getWeekStart(d);
      const end = getWeekEnd(d);
      return { start, end };
    }
    case 'month':
    default: {
      const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    }
  }
}

// ────────────────────────────────────────────────────────────
// Overlap detection (ported from web CalendarGrid.tsx:73-150)
// ────────────────────────────────────────────────────────────

export interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
}

export function detectOverlaps(
  events: CalendarEvent[],
  hourHeight: number,
): PositionedEvent[] {
  if (events.length === 0) return [];

  const items = events
    .map((evt) => {
      const start = new Date(evt.startDateTime);
      const end = new Date(evt.endDateTime);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();
      const duration = Math.max(endMin - startMin, 15);
      return {
        event: evt,
        startMin,
        endMin: startMin + duration,
        top: (startMin / 60) * hourHeight,
        height: (duration / 60) * hourHeight,
      };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const clusters: (typeof items)[] = [];
  let currentCluster = [items[0]];

  for (let i = 1; i < items.length; i++) {
    const clusterEnd = Math.max(...currentCluster.map((c) => c.endMin));
    if (items[i].startMin < clusterEnd) {
      currentCluster.push(items[i]);
    } else {
      clusters.push(currentCluster);
      currentCluster = [items[i]];
    }
  }
  clusters.push(currentCluster);

  const result: PositionedEvent[] = [];
  for (const cluster of clusters) {
    const columns: (typeof items)[] = [];

    for (const item of cluster) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1];
        if (item.startMin >= lastInCol.endMin) {
          columns[col].push(item);
          result.push({
            event: item.event,
            top: item.top,
            height: item.height,
            column: col,
            totalColumns: 0,
          });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([item]);
        result.push({
          event: item.event,
          top: item.top,
          height: item.height,
          column: columns.length - 1,
          totalColumns: 0,
        });
      }
    }

    const totalCols = columns.length;
    for (let i = result.length - cluster.length; i < result.length; i++) {
      result[i].totalColumns = totalCols;
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────────
// Recurrence expansion (ported from web calendarUtils.ts)
// ────────────────────────────────────────────────────────────

const MAX_OCCURRENCES = 365;

export function expandRecurringEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  const result: CalendarEvent[] = [];

  for (const event of events) {
    if (!event.isRecurring || !event.recurrenceType || event.recurrenceType === 'none') {
      result.push(event);
      continue;
    }

    const occurrences = generateOccurrences(event, rangeStart, rangeEnd);
    result.push(...occurrences);
  }

  return result;
}

function generateOccurrences(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  const occurrences: CalendarEvent[] = [];
  const eventStart = new Date(event.startDateTime);
  const eventEnd = new Date(event.endDateTime);
  const durationMs = eventEnd.getTime() - eventStart.getTime();

  const recurrenceType = event.recurrenceType.toLowerCase();
  const interval = event.recurrenceInterval || 1;
  const maxOccurrences = event.recurrenceOccurrences || MAX_OCCURRENCES;
  const recurrenceEndDate = event.recurrenceEndDate
    ? new Date(event.recurrenceEndDate)
    : null;
  const daysOfWeek = event.recurrenceDaysOfWeek || [];

  // Exception dates: occurrences that have been individually deleted or modified.
  // These should be excluded from expansion (matching web frontend exactly).
  const exceptionDates = new Set(
    (event.recurrenceExceptionDates || []).map((d) => new Date(d).toDateString()),
  );

  let occurrenceCount = 0;
  const currentDate = new Date(eventStart);

  while (occurrenceCount < maxOccurrences && occurrenceCount < MAX_OCCURRENCES) {
    if (recurrenceEndDate && currentDate > recurrenceEndDate) break;
    if (currentDate > rangeEnd) break;

    if (recurrenceType === 'weekly' && daysOfWeek.length > 0) {
      const weekStart = new Date(currentDate);
      const dayMap: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
      };

      for (const dayKey of daysOfWeek) {
        const targetDayNum = dayMap[dayKey];
        if (targetDayNum === undefined) continue;

        const dayDate = new Date(weekStart);
        const currentDayNum = weekStart.getDay();
        const diff = targetDayNum - currentDayNum;
        dayDate.setDate(weekStart.getDate() + diff);

        if (dayDate < eventStart) continue;
        if (recurrenceEndDate && dayDate > recurrenceEndDate) continue;
        if (occurrenceCount >= maxOccurrences) break;

        if (
          dayDate >= rangeStart &&
          dayDate <= rangeEnd &&
          !exceptionDates.has(dayDate.toDateString())
        ) {
          const occStart = new Date(dayDate);
          occStart.setHours(
            eventStart.getHours(),
            eventStart.getMinutes(),
            eventStart.getSeconds(),
          );
          const occEnd = new Date(occStart.getTime() + durationMs);

          occurrences.push(createOccurrence(event, occStart, occEnd, occurrenceCount));
        }
        occurrenceCount++;
      }

      currentDate.setDate(currentDate.getDate() + 7 * interval);
    } else {
      if (
        currentDate >= rangeStart &&
        currentDate <= rangeEnd &&
        !exceptionDates.has(currentDate.toDateString())
      ) {
        const occStart = new Date(currentDate);
        const occEnd = new Date(occStart.getTime() + durationMs);

        occurrences.push(createOccurrence(event, occStart, occEnd, occurrenceCount));
      }
      occurrenceCount++;

      switch (recurrenceType) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + interval);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7 * interval);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + interval);
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + interval);
          break;
        default:
          currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  }

  return occurrences;
}

function createOccurrence(
  source: CalendarEvent,
  start: Date,
  end: Date,
  index: number,
): CalendarEvent {
  return {
    ...source,
    id: `${source.id}_occ_${index}`,
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
  };
}

// ────────────────────────────────────────────────────────────
// Formatting utilities
// ────────────────────────────────────────────────────────────

export function formatRecurrenceDescription(event: CalendarEvent): string {
  if (!event.isRecurring || !event.recurrenceType || event.recurrenceType === 'none') {
    return '';
  }

  const type = event.recurrenceType.toLowerCase();
  const interval = event.recurrenceInterval || 1;
  const daysOfWeek = event.recurrenceDaysOfWeek || [];

  let desc = 'Every ';

  if (interval === 1) {
    switch (type) {
      case 'daily': desc += 'day'; break;
      case 'weekly': desc += 'week'; break;
      case 'monthly': desc += 'month'; break;
      case 'yearly': desc += 'year'; break;
    }
  } else {
    switch (type) {
      case 'daily': desc += `${interval} days`; break;
      case 'weekly': desc += `${interval} weeks`; break;
      case 'monthly': desc += `${interval} months`; break;
      case 'yearly': desc += `${interval} years`; break;
    }
  }

  if (type === 'weekly' && daysOfWeek.length > 0) {
    desc += ` on ${daysOfWeek.join(', ')}`;
  }

  if (event.recurrenceEndDate) {
    const endDate = new Date(event.recurrenceEndDate);
    desc += ` until ${endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  } else if (event.recurrenceOccurrences) {
    desc += `, ${event.recurrenceOccurrences} times`;
  }

  return desc;
}

export function formatReminderLabel(minutes: number): string {
  const option = REMINDER_OPTIONS.find((o) => o.minutes === minutes);
  return option ? option.label : `${minutes} minutes before`;
}

// ────────────────────────────────────────────────────────────
// 24-hour time input parsing + formatting
// ────────────────────────────────────────────────────────────

/**
 * Parse a freeform 24-hour time string into hour + minute.
 *
 * Accepted formats:
 *   "8"     → 08:00    "08"    → 08:00
 *   "830"   → 08:30    "0830"  → 08:30
 *   "14:30" → 14:30    "8:30"  → 08:30
 *   "2030"  → 20:30    "0"     → 00:00
 *
 * Returns null if the input is invalid.
 */
export function parseTimeInput24h(
  input: string,
): { hour: number; minute: number } | null {
  const trimmed = input.replace(/\s/g, '');
  if (!trimmed) return null;

  // Pattern: "HH:MM" or "H:MM"
  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return { hour: h, minute: m };
    return null;
  }

  // Pattern: 1-2 digits only → treat as hour (e.g., "8" → 08:00, "14" → 14:00)
  const hourOnly = trimmed.match(/^(\d{1,2})$/);
  if (hourOnly) {
    const h = parseInt(hourOnly[1], 10);
    if (h >= 0 && h < 24) return { hour: h, minute: 0 };
    return null;
  }

  // Pattern: 3 digits → "HMM" (e.g., "830" → 08:30)
  const threeDigit = trimmed.match(/^(\d)(\d{2})$/);
  if (threeDigit) {
    const h = parseInt(threeDigit[1], 10);
    const m = parseInt(threeDigit[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return { hour: h, minute: m };
    return null;
  }

  // Pattern: 4 digits → "HHMM" (e.g., "1430" → 14:30, "0830" → 08:30)
  const fourDigit = trimmed.match(/^(\d{2})(\d{2})$/);
  if (fourDigit) {
    const h = parseInt(fourDigit[1], 10);
    const m = parseInt(fourDigit[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return { hour: h, minute: m };
    return null;
  }

  return null;
}

/**
 * Format a Date to 24-hour time string "HH:MM".
 */
export function formatTime24h(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Auto-format a raw numeric string into "HH:MM" as the user types.
 * Inserts colon after 2 digits: "14" → "14:", "1430" → "14:30".
 */
export function autoFormatTimeInput(raw: string): string {
  // Strip non-digit characters except colon
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

// ────────────────────────────────────────────────────────────
// Last-used time persistence (AsyncStorage)
// ────────────────────────────────────────────────────────────

const LAST_TIMES_KEY = '@jubilee_event_last_times';

interface LastUsedTimes {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

const DEFAULT_TIMES: LastUsedTimes = {
  startHour: 8,
  startMin: 0,
  endHour: 9,
  endMin: 0,
};

export async function getLastUsedTimes(): Promise<LastUsedTimes> {
  try {
    const raw = await AsyncStorage.getItem(LAST_TIMES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed.startHour === 'number' &&
        typeof parsed.startMin === 'number' &&
        typeof parsed.endHour === 'number' &&
        typeof parsed.endMin === 'number'
      ) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_TIMES;
}

export async function saveLastUsedTimes(
  startHour: number,
  startMin: number,
  endHour: number,
  endMin: number,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      LAST_TIMES_KEY,
      JSON.stringify({ startHour, startMin, endHour, endMin }),
    );
  } catch { /* ignore */ }
}
