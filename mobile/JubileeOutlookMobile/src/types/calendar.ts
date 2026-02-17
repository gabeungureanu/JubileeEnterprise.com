/**
 * Calendar types — mirrors web frontend src/types/calendar/index.ts
 */

export interface Calendar {
  id: string;
  userId: string;
  name: string;
  color: string;
  isDefault: boolean;
  timeZone: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  userId: string;
  subject: string;
  location?: string;
  description?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  status: 'free' | 'working_elsewhere' | 'tentative' | 'busy' | 'out_of_office';
  category?: string;
  eventColor: string;
  isPrivate: boolean;
  isRecurring: boolean;
  recurrenceRule?: string;
  reminderMinutes: number;
  isInPerson: boolean;
  attendees: EventAttendee[];
  attachments: EventAttachment[];
  images: EventImage[];
  createdAt: string;
  updatedAt: string;
}

export interface EventAttendee {
  id?: string;
  email: string;
  name?: string;
  responseStatus: 'pending' | 'accepted' | 'declined' | 'tentative';
  isRequired: boolean;
}

export interface EventAttachment {
  id?: string;
  fileName: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  url?: string;
}

export interface EventImage {
  id?: string;
  fileName: string;
  url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  displayOrder?: number;
}

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
  attendees?: Omit<EventAttendee, 'id' | 'responseStatus'>[];
  attachments?: Omit<EventAttachment, 'id'>[];
  images?: Omit<EventImage, 'id'>[];
}

export type CalendarViewMode = 'month' | 'week' | 'day';
