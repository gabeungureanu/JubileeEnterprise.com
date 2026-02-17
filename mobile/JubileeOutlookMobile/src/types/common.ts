/**
 * Common types — mirrors web frontend src/types/common/index.ts
 */

export type AppModule = 'mail' | 'calendar' | 'people' | 'settings';

export type NetworkStatus = 'online' | 'offline' | 'checking';

export interface SyncStatus {
  lastSyncTime: string | null;
  isSyncing: boolean;
  pendingOperations: number;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface LoginResponse {
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  user: User;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
