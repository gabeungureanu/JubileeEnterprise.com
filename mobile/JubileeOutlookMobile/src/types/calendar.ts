/**
 * Calendar types — mirrors web frontend src/types/calendar/index.ts
 */

// --- API DTO shape (matches actual InspireContinuum API response) ---

export interface CalendarEventDto {
  id: string;
  userId?: string;
  calendarId?: string;
  subject: string;
  location: string;
  startTime?: string;
  endTime?: string;
  description: string;
  isAllDay?: boolean;
  status: string;
  category: string;
  calendarName?: string;
  eventColor?: string;
  attendees?: string[];
  organizer?: string;
  isPrivate?: boolean;
  isInPerson?: boolean;
  isRecurring?: boolean;
  recurrenceType?: string;
  recurrenceInterval?: number;
  recurrenceEndDate?: string | null;
  recurrenceOccurrences?: number | null;
  recurrenceDaysOfWeek?: string[];
  reminderMinutes?: number;
  createdAt?: string;
  updatedAt?: string;
  // snake_case aliases (for write payloads)
  user_id?: string;
  calendar_id?: string;
  start_time?: string;
  end_time?: string;
  is_all_day?: boolean;
  calendar_name?: string;
  event_color?: string;
  is_private?: boolean;
  is_in_person?: boolean;
  is_recurring?: boolean;
  recurrence_type?: string;
  recurrence_interval?: number;
  recurrence_end_date?: string | null;
  recurrence_occurrences?: number | null;
  recurrence_days_of_week?: string[];
  reminder_minutes?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ApiEventsListResponse {
  success?: boolean;
  error?: string;
  events?: CalendarEventDto[];
  total_count?: number;
}

// --- DTO Mapper (handles both camelCase and snake_case API responses) ---

export function mapEventDto(dto: CalendarEventDto): CalendarEvent {
  const d = dto as any;
  return {
    id: d.id,
    title: d.subject || '',
    description: d.description || '',
    location: d.location || '',
    startDateTime: d.startTime || d.start_time || '',
    endDateTime: d.endTime || d.end_time || '',
    isAllDay: d.isAllDay ?? d.is_all_day ?? false,
    isRecurring: d.isRecurring ?? d.is_recurring ?? false,
    isPrivate: d.isPrivate ?? d.is_private ?? false,
    isInPerson: d.isInPerson ?? d.is_in_person ?? false,
    showAs: d.status || 'busy',
    category: d.category || 'blue',
    eventColor: d.eventColor || d.event_color || 'blue',
    attendees: d.attendees || [],
    organizer: d.organizer || '',
    reminderMinutes: d.reminderMinutes ?? d.reminder_minutes ?? 15,
    recurrenceType: d.recurrenceType || d.recurrence_type || 'none',
    recurrenceInterval: d.recurrenceInterval ?? d.recurrence_interval ?? 1,
    recurrenceEndDate: d.recurrenceEndDate ?? d.recurrence_end_date ?? null,
    recurrenceOccurrences: d.recurrenceOccurrences ?? d.recurrence_occurrences ?? null,
    recurrenceDaysOfWeek: d.recurrenceDaysOfWeek || d.recurrence_days_of_week || [],
  };
}

// --- Frontend display types (mapped from DTOs) ---

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
  isInPerson: boolean;
  showAs: string;
  category: string;
  eventColor: string;
  attendees: string[];
  organizer: string;
  reminderMinutes: number;
  recurrenceType: string;
  recurrenceInterval: number;
  recurrenceEndDate: string | null;
  recurrenceOccurrences: number | null;
  recurrenceDaysOfWeek: string[];
}

export type CalendarViewMode = 'day' | 'workWeek' | 'week' | 'month';

export interface CalendarDateRange {
  start: Date;
  end: Date;
}

export type ShowAsStatus = 'free' | 'tentative' | 'busy' | 'outofoffice' | 'workingelsewhere';

export type ReminderOption =
  | 'none' | 'atTime' | '5min' | '15min' | '30min'
  | '1hour' | '2hours' | '12hours' | '1day' | '1week';

export interface CreateEventPayload {
  userId: string;
  calendarId?: string;
  subject: string;
  location?: string;
  description?: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  eventColor?: string;
  isRecurring?: boolean;
  reminderMinutes?: number;
  isPrivate?: boolean;
  isInPerson?: boolean;
  attendees?: { email: string; name?: string; isRequired: boolean }[];
  attachments?: { fileName: string; filePath?: string; fileSize?: number; mimeType?: string }[];
}
