export type AppModule = 'mail' | 'calendar' | 'people';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface LoginResponse {
  success: boolean;
  error?: string;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  user?: User;
}

export type EventColor = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow';

export type NetworkStatus = 'online' | 'offline' | 'checking';

export interface SyncStatus {
  lastSyncTime: Date | null;
  isSyncing: boolean;
  pendingOperations: number;
}
