/**
 * Mail Service — mirrors web frontend src/services/mail/mailService.ts
 */
import { continuumClient } from '../apiClient';
import type {
  MailFolder,
  EmailMessage,
  SendMessagePayload,
  DraftPayload,
  EmailAccount,
} from '../../types';

export const mailService = {
  // ---------- Folders ----------

  async getFolders(userId: string): Promise<MailFolder[]> {
    const { data } = await continuumClient.get('/outlook/folders', {
      params: { userId },
    });
    return data.data || data;
  },

  async createFolder(userId: string, name: string, parentFolderId?: string): Promise<MailFolder> {
    const { data } = await continuumClient.post('/outlook/folders', {
      userId,
      name,
      parentFolderId,
    });
    return data.data || data;
  },

  async renameFolder(folderId: string, name: string): Promise<void> {
    await continuumClient.patch(`/outlook/folders/${folderId}`, { name });
  },

  async deleteFolder(folderId: string): Promise<void> {
    await continuumClient.delete(`/outlook/folders/${folderId}`);
  },

  // ---------- Messages ----------

  async getMessages(
    folderId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ messages: EmailMessage[]; pagination: any }> {
    const { data } = await continuumClient.get(
      `/outlook/folders/${folderId}/messages`,
      { params: { page, pageSize } }
    );
    return {
      messages: data.data || data.messages || [],
      pagination: data.pagination || { page, pageSize, total: 0, totalPages: 0 },
    };
  },

  async getMessage(messageId: string): Promise<EmailMessage> {
    const { data } = await continuumClient.get(`/outlook/messages/${messageId}`);
    return data.data || data;
  },

  async searchMessages(
    userId: string,
    query: string,
    folderId?: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ messages: EmailMessage[]; pagination: any }> {
    const { data } = await continuumClient.get('/outlook/messages/search', {
      params: { userId, q: query, folderId, page, pageSize },
    });
    return {
      messages: data.data || data.messages || [],
      pagination: data.pagination || { page, pageSize, total: 0, totalPages: 0 },
    };
  },

  async markAsRead(messageId: string, isRead: boolean): Promise<void> {
    await continuumClient.patch(`/outlook/messages/${messageId}`, { is_read: isRead });
  },

  async toggleFlag(messageId: string, isFlagged: boolean): Promise<void> {
    await continuumClient.patch(`/outlook/messages/${messageId}`, { is_flagged: isFlagged });
  },

  async moveMessage(messageId: string, folderId: string): Promise<void> {
    await continuumClient.patch(`/outlook/messages/${messageId}`, { folder_id: folderId });
  },

  async deleteMessage(messageId: string): Promise<void> {
    await continuumClient.delete(`/outlook/messages/${messageId}`);
  },

  async sendMessage(payload: SendMessagePayload): Promise<{ messageId: string }> {
    const { data } = await continuumClient.post('/outlook/messages/send', payload);
    return data.data || data;
  },

  async saveDraft(payload: DraftPayload): Promise<{ draftId: string }> {
    const { data } = await continuumClient.post('/outlook/messages/draft', payload);
    return data.data || data;
  },

  // ---------- Attachments ----------

  async downloadAttachment(
    messageId: string,
    attachmentId: string
  ): Promise<{ url: string; blob: Blob }> {
    const response = await continuumClient.get(
      `/outlook/messages/${messageId}/attachments/${attachmentId}/download`,
      { responseType: 'blob' }
    );
    return { url: '', blob: response.data };
  },

  // ---------- Accounts ----------

  async getAccounts(userId: string): Promise<EmailAccount[]> {
    const { data } = await continuumClient.get('/outlook/accounts', {
      params: { userId },
    });
    return data.data || data;
  },

  async syncAccount(accountId: string): Promise<{ totalSynced: number }> {
    const { data } = await continuumClient.post(
      `/outlook/accounts/${accountId}/sync`,
      {},
      { timeout: 120_000 }
    );
    return data.data || data;
  },
};
