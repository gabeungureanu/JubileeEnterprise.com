/**
 * Email Sync Service — mirrors web frontend src/services/mail/emailSyncService.ts
 */
import { continuumClient } from '../apiClient';
import type { ProviderDetection, EmailAccount } from '../../types';

export const emailSyncService = {
  async detectProvider(email: string): Promise<ProviderDetection> {
    const { data } = await continuumClient.post(
      '/outlook/accounts/detect',
      { email },
      { timeout: 30_000 }
    );
    return data.data || data;
  },

  async connectAccount(
    email: string,
    password: string,
    userId: string
  ): Promise<{ account: EmailAccount; folders: any[] }> {
    const { data } = await continuumClient.post(
      '/outlook/accounts/connect',
      { email, password, userId },
      { timeout: 60_000 }
    );
    return data.data || data;
  },

  async syncAccount(accountId: string): Promise<{ totalSynced: number; folders: any[] }> {
    const { data } = await continuumClient.post(
      `/outlook/accounts/${accountId}/sync`,
      {},
      { timeout: 120_000 }
    );
    return data.data || data;
  },

  async getAccounts(userId: string): Promise<EmailAccount[]> {
    const { data } = await continuumClient.get('/outlook/accounts', {
      params: { userId },
    });
    return data.data || data;
  },

  async disconnectAccount(accountId: string): Promise<void> {
    await continuumClient.delete(`/outlook/accounts/${accountId}`);
  },
};
