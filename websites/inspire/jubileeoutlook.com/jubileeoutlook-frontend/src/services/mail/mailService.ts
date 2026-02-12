import apiClient from '../apiClient';
import { MailFolder, EmailMessage, ComposeMailData } from '../../types/mail';
import { ApiResponse } from '../../types/common';

const CONTINUUM_BASE = process.env.REACT_APP_CONTINUUM_API_URL || '';

export const mailService = {
  async getFolders(): Promise<ApiResponse<MailFolder[]>> {
    const response = await apiClient.get(`${CONTINUUM_BASE}/api/outlook/folders`);
    return response.data;
  },

  async getMessages(folderId: string, page = 1, pageSize = 50): Promise<ApiResponse<EmailMessage[]>> {
    const response = await apiClient.get(`${CONTINUUM_BASE}/api/outlook/messages`, {
      params: { folderId, page, pageSize },
    });
    return response.data;
  },

  async getMessage(messageId: string): Promise<ApiResponse<EmailMessage>> {
    const response = await apiClient.get(`${CONTINUUM_BASE}/api/outlook/message/${messageId}`);
    return response.data;
  },

  async sendMessage(data: ComposeMailData): Promise<ApiResponse<void>> {
    const response = await apiClient.post(`${CONTINUUM_BASE}/api/outlook/send`, data);
    return response.data;
  },

  async saveDraft(data: ComposeMailData): Promise<ApiResponse<EmailMessage>> {
    const response = await apiClient.post(`${CONTINUUM_BASE}/api/outlook/draft`, data);
    return response.data;
  },

  async deleteMessage(messageId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete(`${CONTINUUM_BASE}/api/outlook/message/${messageId}`);
    return response.data;
  },

  async moveMessage(messageId: string, destinationFolderId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post(`${CONTINUUM_BASE}/api/outlook/message/${messageId}/move`, {
      destinationFolderId,
    });
    return response.data;
  },

  async markAsRead(messageId: string, isRead: boolean): Promise<ApiResponse<void>> {
    const response = await apiClient.patch(`${CONTINUUM_BASE}/api/outlook/message/${messageId}`, { isRead });
    return response.data;
  },

  async toggleFlag(messageId: string, isFlagged: boolean): Promise<ApiResponse<void>> {
    const response = await apiClient.patch(`${CONTINUUM_BASE}/api/outlook/message/${messageId}`, { isFlagged });
    return response.data;
  },
};
