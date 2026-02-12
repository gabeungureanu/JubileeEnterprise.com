import apiClient from '../apiClient';
import { CalendarEvent } from '../../types/calendar';
import { ApiResponse } from '../../types/common';

const CONTINUUM_BASE = process.env.REACT_APP_CONTINUUM_API_URL || '';

export const calendarService = {
  async getEvents(startDate: string, endDate: string): Promise<ApiResponse<CalendarEvent[]>> {
    const response = await apiClient.get(`${CONTINUUM_BASE}/api/outlook/events`, {
      params: { startDate, endDate },
    });
    return response.data;
  },

  async getEvent(eventId: string): Promise<ApiResponse<CalendarEvent>> {
    const response = await apiClient.get(`${CONTINUUM_BASE}/api/outlook/events/${eventId}`);
    return response.data;
  },

  async createEvent(event: Partial<CalendarEvent>): Promise<ApiResponse<CalendarEvent>> {
    const response = await apiClient.post(`${CONTINUUM_BASE}/api/outlook/events`, event);
    return response.data;
  },

  async updateEvent(eventId: string, event: Partial<CalendarEvent>): Promise<ApiResponse<CalendarEvent>> {
    const response = await apiClient.put(`${CONTINUUM_BASE}/api/outlook/events/${eventId}`, event);
    return response.data;
  },

  async deleteEvent(eventId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete(`${CONTINUUM_BASE}/api/outlook/events/${eventId}`);
    return response.data;
  },
};
