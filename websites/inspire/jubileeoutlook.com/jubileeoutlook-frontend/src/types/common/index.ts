export type AppModule = 'mail' | 'calendar' | 'people';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  color: EventColor;
}

export type EventColor = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow';

export type NetworkStatus = 'online' | 'offline' | 'checking';

export interface SyncStatus {
  lastSyncTime: Date | null;
  isSyncing: boolean;
  pendingOperations: number;
}
