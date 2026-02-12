import { EventColor } from '../common';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  isAllDay: boolean;
  isRecurring: boolean;
  isPrivate: boolean;
  showAs: ShowAsStatus;
  reminder: ReminderOption;
  category: EventColor;
  attendees: Attendee[];
  recurrence?: RecurrencePattern;
  organizerEmail: string;
}

export type ShowAsStatus = 'free' | 'tentative' | 'busy' | 'outOfOffice' | 'workingElsewhere';

export type ReminderOption =
  | 'none'
  | 'atTime'
  | '5min'
  | '15min'
  | '30min'
  | '1hour'
  | '2hours'
  | '12hours'
  | '1day'
  | '1week';

export interface Attendee {
  email: string;
  name: string;
  status: 'accepted' | 'declined' | 'tentative' | 'none';
}

export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: string[];
  endDate?: string;
  occurrences?: number;
}

export type CalendarViewMode = 'day' | 'workWeek' | 'week' | 'month';

export interface CalendarDateRange {
  start: Date;
  end: Date;
}
