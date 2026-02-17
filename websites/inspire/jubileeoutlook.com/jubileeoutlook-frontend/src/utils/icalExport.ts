import { CalendarEvent } from '../types/calendar';

function formatICalDate(date: Date, isAllDay: boolean): string {
  if (isAllDay) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  // RFC 5545: lines must be folded at 75 octets
  const maxLen = 75;
  if (line.length <= maxLen) return line;

  const parts: string[] = [line.substring(0, maxLen)];
  for (let i = maxLen; i < line.length; i += maxLen - 1) {
    parts.push(' ' + line.substring(i, i + maxLen - 1));
  }
  return parts.join('\r\n');
}

export function exportEventsToICal(events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jubilee Outlook//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const evt of events) {
    // Skip expanded recurring event occurrences (only export originals)
    if (evt.id.includes('_occ_')) continue;

    const start = new Date(evt.startDateTime);
    const end = new Date(evt.endDateTime);

    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:${evt.id}@jubileeoutlook.com`));
    lines.push(`DTSTAMP:${formatICalDate(new Date(), false)}`);
    lines.push(`DTSTART${evt.isAllDay ? ';VALUE=DATE' : ''}:${formatICalDate(start, evt.isAllDay)}`);
    lines.push(`DTEND${evt.isAllDay ? ';VALUE=DATE' : ''}:${formatICalDate(end, evt.isAllDay)}`);
    lines.push(foldLine(`SUMMARY:${escapeICalText(evt.title)}`));

    if (evt.description) {
      lines.push(foldLine(`DESCRIPTION:${escapeICalText(evt.description)}`));
    }
    if (evt.location) {
      lines.push(foldLine(`LOCATION:${escapeICalText(evt.location)}`));
    }

    // Attendees
    for (const attendee of evt.attendees) {
      lines.push(foldLine(`ATTENDEE:mailto:${attendee}`));
    }

    // Categories
    if (evt.category) {
      lines.push(`CATEGORIES:${evt.category.toUpperCase()}`);
    }

    // Status mapping
    const statusMap: Record<string, string> = {
      busy: 'CONFIRMED',
      tentative: 'TENTATIVE',
      free: 'CONFIRMED',
      outofoffice: 'CONFIRMED',
      workingelsewhere: 'CONFIRMED',
    };
    lines.push(`STATUS:${statusMap[evt.showAs] || 'CONFIRMED'}`);

    // Transparency (free/busy)
    lines.push(`TRANSP:${evt.showAs === 'free' ? 'TRANSPARENT' : 'OPAQUE'}`);

    // Privacy
    if (evt.isPrivate) {
      lines.push('CLASS:PRIVATE');
    }

    // Reminder (VALARM)
    if (evt.reminderMinutes >= 0) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:Reminder');
      const triggerMins = evt.reminderMinutes || 0;
      lines.push(`TRIGGER:-PT${triggerMins}M`);
      lines.push('END:VALARM');
    }

    // Recurrence rule
    if (evt.isRecurring && evt.recurrenceType && evt.recurrenceType !== 'none') {
      const freq = evt.recurrenceType.toUpperCase();
      const parts = [`FREQ=${freq}`, `INTERVAL=${evt.recurrenceInterval || 1}`];

      if (evt.recurrenceDaysOfWeek && evt.recurrenceDaysOfWeek.length > 0) {
        const dayMap: Record<string, string> = {
          Sun: 'SU', Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA',
        };
        const days = evt.recurrenceDaysOfWeek.map((d) => dayMap[d] || d.substring(0, 2).toUpperCase());
        parts.push(`BYDAY=${days.join(',')}`);
      }

      if (evt.recurrenceEndDate) {
        parts.push(`UNTIL=${formatICalDate(new Date(evt.recurrenceEndDate), false)}`);
      } else if (evt.recurrenceOccurrences) {
        parts.push(`COUNT=${evt.recurrenceOccurrences}`);
      }

      lines.push(`RRULE:${parts.join(';')}`);
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICalFile(events: CalendarEvent[], filename?: string): void {
  const ical = exportEventsToICal(events);
  const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `jubilee-calendar-${new Date().toISOString().split('T')[0]}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
