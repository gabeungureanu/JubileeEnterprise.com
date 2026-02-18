/**
 * Email Sync Service — mirrors web frontend src/services/mail/emailSyncService.ts exactly.
 */
import { continuumClient } from '../apiClient';

export interface ProviderInfo {
  type: string;
  displayName: string;
  isAppPassword: boolean;
  helpText: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

export interface ConnectResult {
  success: boolean;
  error?: string;
  account?: {
    id: string;
    email: string;
    provider: string;
    displayName: string;
  };
  folders?: Array<{
    id: string;
    name: string;
    type: string;
    path: string;
  }>;
  message?: string;
}

export interface SyncResult {
  success: boolean;
  error?: string;
  totalSynced?: number;
  folders?: Array<{ folder: string; synced: number }>;
  message?: string;
}

export const emailSyncService = {
  async detectProvider(email: string): Promise<ProviderInfo> {
    const response = await continuumClient.post<{ success: boolean; provider: ProviderInfo }>(
      '/outlook/accounts/detect',
      { email }
    );
    return response.data.provider;
  },

  async connectAccount(email: string, password: string, userId: string): Promise<ConnectResult> {
    try {
      const response = await continuumClient.post<ConnectResult>(
        '/outlook/accounts/connect',
        { email, password, userId },
        { timeout: 60000 }
      );
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Connection failed';
      return { success: false, error: errorMsg };
    }
  },

  async syncAccount(accountId: string): Promise<SyncResult> {
    try {
      const response = await continuumClient.post<SyncResult>(
        `/outlook/accounts/${encodeURIComponent(accountId)}/sync`,
        {},
        { timeout: 120000 }
      );
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Sync failed';
      return { success: false, error: errorMsg };
    }
  },

  async getAccounts(userId: string): Promise<Array<{ id: string; email_address: string; provider_type: string; connection_status: string }>> {
    const response = await continuumClient.get('/outlook/accounts', { params: { userId } });
    return response.data.accounts || [];
  },

  async disconnectAccount(accountId: string): Promise<boolean> {
    const response = await continuumClient.delete(`/outlook/accounts/${encodeURIComponent(accountId)}`);
    return response.data?.success === true;
  },
};
