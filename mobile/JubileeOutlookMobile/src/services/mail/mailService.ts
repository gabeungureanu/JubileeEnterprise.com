/**
 * Mail Service — mirrors web frontend src/services/mail/mailService.ts exactly.
 */
import { continuumClient, tokenStore } from '../apiClient';
import {
  ApiFoldersResponse, ApiMessagesResponse,
  MailFolder, EmailMessage, EmailMessageDto,
  mapFolderDto, mapMessageDto,
} from '../../types/mail';

export const mailService = {
  // ---------- Folders ----------

  async getFolders(): Promise<MailFolder[]> {
    const userId = tokenStore.getUserId();
    if (!userId) return [];
    const response = await continuumClient.get<ApiFoldersResponse>('/outlook/folders', {
      params: { userId },
    });
    const data = response.data;
    const dtos = data.folders || (data as any);
    if (Array.isArray(dtos)) {
      return dtos.map(mapFolderDto);
    }
    return [];
  },

  async createFolder(name: string, parentFolderId?: string): Promise<{ success: boolean; folderId?: string }> {
    const userId = tokenStore.getUserId();
    const response = await continuumClient.post('/outlook/folders', { userId, name, parentFolderId });
    return response.data;
  },

  async renameFolder(folderId: string, name: string): Promise<boolean> {
    const response = await continuumClient.patch(`/outlook/folders/${encodeURIComponent(folderId)}`, { name });
    return response.data?.success !== false;
  },

  async deleteFolder(folderId: string): Promise<boolean> {
    const response = await continuumClient.delete(`/outlook/folders/${encodeURIComponent(folderId)}`);
    return response.data?.success !== false;
  },

  // ---------- Messages ----------

  async getMessages(folderId: string, page = 1, pageSize = 50): Promise<{ messages: EmailMessage[]; totalCount: number }> {
    const response = await continuumClient.get<ApiMessagesResponse>(
      `/outlook/folders/${encodeURIComponent(folderId)}/messages`,
      { params: { page, pageSize } }
    );
    const data = response.data;
    const dtos = data.messages || (data as any);
    return {
      messages: Array.isArray(dtos) ? dtos.map(mapMessageDto) : [],
      totalCount: data.total_count || 0,
    };
  },

  async getMessage(messageId: string): Promise<EmailMessage | null> {
    const response = await continuumClient.get<EmailMessageDto | { success: boolean; message: EmailMessageDto }>(
      `/outlook/messages/${encodeURIComponent(messageId)}`
    );
    const data = response.data;
    const dto = (data as any).message || data;
    return dto?.id ? mapMessageDto(dto as EmailMessageDto) : null;
  },

  async searchMessages(query: string, folderId?: string, page = 1, pageSize = 50): Promise<{ messages: EmailMessage[]; totalCount: number }> {
    const userId = tokenStore.getUserId();
    const response = await continuumClient.get<ApiMessagesResponse>('/outlook/messages/search', {
      params: { userId, q: query, folderId, page, pageSize },
    });
    const data = response.data;
    const dtos = data.messages || (data as any);
    return {
      messages: Array.isArray(dtos) ? dtos.map(mapMessageDto) : [],
      totalCount: data.total_count || 0,
    };
  },

  async markAsRead(messageId: string, isRead: boolean): Promise<boolean> {
    const response = await continuumClient.patch(`/outlook/messages/${encodeURIComponent(messageId)}`, {
      is_read: isRead,
    });
    return response.data?.success !== false;
  },

  async toggleFlag(messageId: string, isFlagged: boolean): Promise<boolean> {
    const response = await continuumClient.patch(`/outlook/messages/${encodeURIComponent(messageId)}`, {
      is_flagged: isFlagged,
    });
    return response.data?.success !== false;
  },

  async togglePin(messageId: string, isPinned: boolean): Promise<boolean> {
    const response = await continuumClient.patch(`/outlook/messages/${encodeURIComponent(messageId)}`, {
      is_pinned: isPinned,
    });
    return response.data?.success !== false;
  },

  async moveMessage(messageId: string, folderId: string): Promise<boolean> {
    const response = await continuumClient.patch(`/outlook/messages/${encodeURIComponent(messageId)}`, {
      folder_id: folderId,
    });
    return response.data?.success !== false;
  },

  async deleteMessage(messageId: string): Promise<boolean> {
    const response = await continuumClient.delete(`/outlook/messages/${encodeURIComponent(messageId)}`);
    return response.status === 200 || response.status === 204 || response.status === 404;
  },

  async sendMessage(data: {
    userId: string;
    sender_email: string;
    subject: string;
    body_html?: string;
    body_text?: string;
    recipients: { email: string; name: string; type: 'to' | 'cc' | 'bcc' }[];
    importance?: string;
    attachments?: { filename: string; content: string; contentType: string }[];
  }): Promise<{ success: boolean; messageId?: string }> {
    const response = await continuumClient.post('/outlook/messages/send', data);
    return response.data;
  },

  async saveDraft(data: {
    userId: string;
    id?: string;
    sender_email: string;
    subject: string;
    body_html?: string;
    body_text?: string;
    recipients?: { email: string; name: string; type: 'to' | 'cc' | 'bcc' }[];
  }): Promise<{ success: boolean; draftId?: string }> {
    const response = await continuumClient.post('/outlook/messages/draft', data);
    return response.data;
  },

  // ---------- Attachments ----------

  async downloadAttachment(messageId: string, attachmentId: string, fileName: string): Promise<void> {
    // On mobile, we fetch the blob and let the platform handle it
    await continuumClient.get(
      `/outlook/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/download`,
      { responseType: 'blob' }
    );
  },

  async fetchAttachmentBlob(messageId: string, attachmentId: string, mimeType?: string): Promise<Blob> {
    const response = await continuumClient.get(
      `/outlook/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/download`,
      { responseType: 'blob' }
    );
    return new Blob([response.data], mimeType ? { type: mimeType } : undefined);
  },

  // ---------- Accounts ----------

  async getAccounts(): Promise<{ id: string; email_address: string }[]> {
    const userId = tokenStore.getUserId();
    if (!userId) return [];
    const response = await continuumClient.get('/outlook/accounts', { params: { userId } });
    return response.data?.accounts || [];
  },

  async syncAccount(accountId: string): Promise<{ success: boolean; synced?: number }> {
    const response = await continuumClient.post(`/outlook/accounts/${encodeURIComponent(accountId)}/sync`, {}, {
      timeout: 120_000,
    });
    return response.data;
  },
};
