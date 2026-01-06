/**
 * Jubilee Inspire - Continuum API Service
 *
 * Handles user data, settings, and preferences synchronization.
 * Continuum provides persistent user state across devices and sessions.
 */

import HttpClient from './httpClient';
import { config } from '../config';
import { ApiResponse } from '../types';

// Initialize HTTP client with Continuum API URL
const client = new HttpClient(config.continuumApiUrl);

// User Settings Types
interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  bibleTranslation: string;
  notificationsEnabled: boolean;
  dailyVerseEnabled: boolean;
  dailyVerseTime?: string;
}

interface UserPreferences {
  favoriteBooks: string[];
  recentSearches: string[];
  bookmarks: Bookmark[];
}

interface Bookmark {
  id: string;
  passage: string;
  note?: string;
  createdAt: Date;
}

interface SyncStatus {
  lastSynced: Date;
  pendingChanges: number;
  status: 'synced' | 'syncing' | 'offline' | 'error';
}

/**
 * Continuum API Service
 */
export const continuumApi = {
  /**
   * Get user settings
   */
  async getSettings(): Promise<ApiResponse<UserSettings>> {
    return client.get<UserSettings>('/settings');
  },

  /**
   * Update user settings
   */
  async updateSettings(settings: Partial<UserSettings>): Promise<ApiResponse<UserSettings>> {
    return client.patch<UserSettings>('/settings', settings);
  },

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<ApiResponse<UserPreferences>> {
    return client.get<UserPreferences>('/preferences');
  },

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: Partial<UserPreferences>): Promise<ApiResponse<UserPreferences>> {
    return client.patch<UserPreferences>('/preferences', preferences);
  },

  /**
   * Add a bookmark
   */
  async addBookmark(passage: string, note?: string): Promise<ApiResponse<Bookmark>> {
    return client.post<Bookmark>('/bookmarks', { passage, note });
  },

  /**
   * Remove a bookmark
   */
  async removeBookmark(bookmarkId: string): Promise<ApiResponse<void>> {
    return client.delete<void>(`/bookmarks/${bookmarkId}`);
  },

  /**
   * Get all bookmarks
   */
  async getBookmarks(): Promise<ApiResponse<Bookmark[]>> {
    return client.get<Bookmark[]>('/bookmarks');
  },

  /**
   * Sync local changes to the server
   */
  async sync(): Promise<ApiResponse<SyncStatus>> {
    return client.post<SyncStatus>('/sync');
  },

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<ApiResponse<SyncStatus>> {
    return client.get<SyncStatus>('/sync/status');
  },

  /**
   * Set the auth token (forwarded from Codex)
   */
  setAuthToken(token: string | null): void {
    client.setAuthToken(token);
  },
};

export default continuumApi;
