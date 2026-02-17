import { continuumClient } from '../apiClient';

export interface CalendarShare {
  id: string;
  calendarId: string;
  sharedWithEmail: string;
  permission: 'view' | 'edit';
  createdAt: string;
}

export const sharingService = {
  async getShares(calendarId: string): Promise<CalendarShare[]> {
    try {
      const response = await continuumClient.get(
        `/outlook/calendars/${encodeURIComponent(calendarId)}/shares`
      );
      return response.data.shares || response.data || [];
    } catch {
      // API endpoint may not exist yet - return empty
      return [];
    }
  },

  async createShare(
    calendarId: string,
    email: string,
    permission: 'view' | 'edit'
  ): Promise<CalendarShare | null> {
    try {
      const response = await continuumClient.post(
        `/outlook/calendars/${encodeURIComponent(calendarId)}/shares`,
        { email, permission }
      );
      return response.data.share || response.data;
    } catch {
      return null;
    }
  },

  async deleteShare(shareId: string): Promise<boolean> {
    try {
      await continuumClient.delete(`/outlook/calendars/shares/${encodeURIComponent(shareId)}`);
      return true;
    } catch {
      return false;
    }
  },
};
