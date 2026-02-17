/**
 * Calendar Service — mirrors web frontend src/services/calendar/calendarService.ts
 */
import { continuumClient } from '../apiClient';
import { tokenStore } from '../apiClient';
import type { CalendarEvent, CreateEventPayload } from '../../types';

export const calendarService = {
  async getEvents(
    startDate: string,
    endDate: string,
    calendarId?: string
  ): Promise<CalendarEvent[]> {
    const userId = tokenStore.getUserId();
    const { data } = await continuumClient.get('/outlook/events', {
      params: { userId, startDate, endDate, calendarId },
    });
    return data.data || data;
  },

  async getEvent(eventId: string): Promise<CalendarEvent> {
    const { data } = await continuumClient.get(`/outlook/events/${eventId}`);
    return data.data || data;
  },

  async createEvent(payload: CreateEventPayload): Promise<CalendarEvent> {
    const { data } = await continuumClient.post('/outlook/events', payload);
    return data.data || data;
  },

  async updateEvent(eventId: string, payload: Partial<CreateEventPayload>): Promise<CalendarEvent> {
    const { data } = await continuumClient.put(`/outlook/events/${eventId}`, payload);
    return data.data || data;
  },

  async deleteEvent(eventId: string): Promise<void> {
    await continuumClient.delete(`/outlook/events/${eventId}`);
  },

  async getEventsForMonth(year: number, month: number): Promise<CalendarEvent[]> {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
    return this.getEvents(startDate, endDate);
  },

  async getEventsForDay(date: string): Promise<CalendarEvent[]> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    return this.getEvents(dayStart.toISOString(), dayEnd.toISOString());
  },
};
