import { continuumClient, tokenStore } from '../apiClient';
import {
  ApiFoldersResponse, ApiMessagesResponse,
  MailFolder, EmailMessage, CreateMessageRequest,
  mapFolderDto, mapMessageDto, EmailMessageDto,
} from '../../types/mail';

export const mailService = {
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

  async sendMessage(data: CreateMessageRequest): Promise<boolean> {
    const payload = { ...data, is_draft: false };
    const response = await continuumClient.post('/outlook/messages', payload);
    return response.data?.success !== false;
  },

  async saveDraft(data: CreateMessageRequest): Promise<boolean> {
    const payload = { ...data, is_draft: true };
    const response = await continuumClient.post('/outlook/messages', payload);
    return response.data?.success !== false;
  },

  async deleteMessage(messageId: string): Promise<boolean> {
    const response = await continuumClient.delete(`/outlook/messages/${encodeURIComponent(messageId)}`);
    return response.status === 200 || response.status === 204 || response.status === 404;
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

  async moveMessage(messageId: string, folderId: string): Promise<boolean> {
    const response = await continuumClient.patch(`/outlook/messages/${encodeURIComponent(messageId)}`, {
      folder_id: folderId,
    });
    return response.data?.success !== false;
  },

  async searchMessages(query: string, folderId?: string, page = 1, pageSize = 50): Promise<{ messages: EmailMessage[]; totalCount: number }> {
    const response = await continuumClient.get<ApiMessagesResponse>('/outlook/messages/search', {
      params: { q: query, folderId, page, pageSize },
    });
    const data = response.data;
    const dtos = data.messages || (data as any);
    return {
      messages: Array.isArray(dtos) ? dtos.map(mapMessageDto) : [],
      totalCount: data.total_count || 0,
    };
  },
};
