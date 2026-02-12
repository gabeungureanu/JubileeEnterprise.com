// --- API DTO shapes (camelCase from InspireContinuum) ---

export interface CalendarEventDto {
  id: string;
  user_id: string;
  calendar_id: string;
  subject: string;
  location: string;
  start_time: string;
  end_time: string;
  description: string;
  is_all_day: boolean;
  status: string;
  category: string;
  calendar_name: string;
  event_color: string;
  attendees: string[];
  organizer: string;
  is_private: boolean;
  is_in_person: boolean;
  is_recurring: boolean;
  recurrence_type: string;
  recurrence_interval: number;
  recurrence_end_date: string | null;
  recurrence_occurrences: number | null;
  recurrence_days_of_week: string[];
  reminder_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface ApiEventsListResponse {
  success: boolean;
  error?: string;
  events: CalendarEventDto[];
  total_count: number;
}

// --- Frontend display types ---

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

// --- Mapper ---

export function mapEventDto(dto: CalendarEventDto): CalendarEvent {
  return {
    id: dto.id,
    title: dto.subject,
    description: dto.description,
    location: dto.location,
    startDateTime: dto.start_time,
    endDateTime: dto.end_time,
    isAllDay: dto.is_all_day,
    isRecurring: dto.is_recurring,
    isPrivate: dto.is_private,
    isInPerson: dto.is_in_person,
    showAs: dto.status,
    category: dto.category,
    eventColor: dto.event_color,
    attendees: dto.attendees || [],
    organizer: dto.organizer,
    reminderMinutes: dto.reminder_minutes,
    recurrenceType: dto.recurrence_type,
    recurrenceInterval: dto.recurrence_interval,
    recurrenceEndDate: dto.recurrence_end_date,
    recurrenceOccurrences: dto.recurrence_occurrences,
    recurrenceDaysOfWeek: dto.recurrence_days_of_week || [],
  };
}
