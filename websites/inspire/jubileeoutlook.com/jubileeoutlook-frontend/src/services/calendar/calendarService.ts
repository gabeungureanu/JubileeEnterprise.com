import { continuumClient } from '../apiClient';
import { tokenStore } from '../apiClient';
import {
  ApiEventsListResponse, CalendarEventDto,
  CalendarEvent, mapEventDto,
} from '../../types/calendar';

export const calendarService = {
  async getEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const userId = tokenStore.getUserId();
    const response = await continuumClient.get<ApiEventsListResponse>('/outlook/events', {
      params: {
        userId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
    const data = response.data;
    const dtos = data.events || (data as any);
    return Array.isArray(dtos) ? dtos.map(mapEventDto) : [];
  },

  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    const response = await continuumClient.get<CalendarEventDto | { success: boolean; event: CalendarEventDto }>(
      `/outlook/events/${encodeURIComponent(eventId)}`
    );
    const data = response.data;
    const dto = (data as any).event || data;
    return dto?.id ? mapEventDto(dto as CalendarEventDto) : null;
  },

  async createEvent(event: Partial<CalendarEventDto>): Promise<CalendarEvent | null> {
    const userId = tokenStore.getUserId();
    const payload = { ...event, user_id: userId };
    const response = await continuumClient.post('/outlook/events', payload);
    const data = response.data;
    const dto = data?.event || data;
    return dto?.id ? mapEventDto(dto) : null;
  },

  async updateEvent(eventId: string, event: Partial<CalendarEventDto>): Promise<CalendarEvent | null> {
    const response = await continuumClient.put(`/outlook/events/${encodeURIComponent(eventId)}`, event);
    const data = response.data;
    const dto = data?.event || data;
    return dto?.id ? mapEventDto(dto) : null;
  },

  async deleteEvent(eventId: string, scope: 'series' | 'occurrence' = 'series', occurrenceDate?: string): Promise<boolean> {
    const params: Record<string, string> = { scope };
    if (scope === 'occurrence' && occurrenceDate) {
      params.date = occurrenceDate;
    }
    const response = await continuumClient.delete(`/outlook/events/${encodeURIComponent(eventId)}`, { params });
    return response.status === 200 || response.status === 204;
  },

  async getEventsForMonth(year: number, month: number): Promise<CalendarEvent[]> {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    return calendarService.getEvents(start, end);
  },

  async getEventsForDay(date: Date): Promise<CalendarEvent[]> {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    return calendarService.getEvents(start, end);
  },
};
