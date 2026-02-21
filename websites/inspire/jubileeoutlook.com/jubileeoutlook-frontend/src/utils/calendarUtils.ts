import { CalendarEvent } from '../types/calendar';

const MAX_OCCURRENCES = 365; // Safety limit matching WPF

/**
 * Expand recurring events into individual occurrences within a visible date range.
 * Ported from WPF CalendarViewModel.ExpandRecurringEvents logic.
 */
export function expandRecurringEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  const result: CalendarEvent[] = [];

  for (const event of events) {
    if (!event.isRecurring || !event.recurrenceType) {
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
  rangeEnd: Date
): CalendarEvent[] {
  const occurrences: CalendarEvent[] = [];
  const eventStart = new Date(event.startDateTime);
  const eventEnd = new Date(event.endDateTime);
  const durationMs = eventEnd.getTime() - eventStart.getTime();

  const recurrenceType = event.recurrenceType.toLowerCase();
  const interval = event.recurrenceInterval || 1;
  const maxOccurrences = event.recurrenceOccurrences || MAX_OCCURRENCES;
  const recurrenceEndDate = event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : null;
  const daysOfWeek = event.recurrenceDaysOfWeek || [];
  const exceptionDates = new Set(
    (event.recurrenceExceptionDates || []).map(d => new Date(d).toDateString())
  );

  let occurrenceCount = 0;
  let currentDate = new Date(eventStart);

  while (occurrenceCount < maxOccurrences && occurrenceCount < MAX_OCCURRENCES) {
    // Check end conditions
    if (recurrenceEndDate && currentDate > recurrenceEndDate) break;
    if (currentDate > rangeEnd) break;

    if (recurrenceType === 'weekly' && daysOfWeek.length > 0) {
      // Weekly with specific days: expand each week to the selected days
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

        if (dayDate >= rangeStart && dayDate <= rangeEnd && !exceptionDates.has(dayDate.toDateString())) {
          const occStart = new Date(dayDate);
          occStart.setHours(eventStart.getHours(), eventStart.getMinutes(), eventStart.getSeconds());
          const occEnd = new Date(occStart.getTime() + durationMs);

          occurrences.push(createOccurrence(event, occStart, occEnd, occurrenceCount));
        }
        occurrenceCount++;
      }

      // Advance by interval weeks
      currentDate.setDate(currentDate.getDate() + (7 * interval));
    } else {
      // Standard recurrence: Daily/Weekly/Monthly/Yearly
      if (currentDate >= rangeStart && currentDate <= rangeEnd && !exceptionDates.has(currentDate.toDateString())) {
        const occStart = new Date(currentDate);
        const occEnd = new Date(occStart.getTime() + durationMs);

        occurrences.push(createOccurrence(event, occStart, occEnd, occurrenceCount));
      }
      occurrenceCount++;

      // Advance based on type
      switch (recurrenceType) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + interval);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + (7 * interval));
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
  index: number
): CalendarEvent {
  return {
    ...source,
    id: `${source.id}_occ_${index}`,
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
  };
}
