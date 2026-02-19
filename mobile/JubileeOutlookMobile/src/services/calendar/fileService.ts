/**
 * File Service — Upload and delete event attachments via InspireContinuum API.
 *
 * Mirrors web frontend src/services/calendar/fileService.ts.
 * Uses FormData for upload and continuumClient for authenticated requests.
 */
import { continuumClient } from '../apiClient';
import type { EventAttachment } from '../../types/calendar';

export interface FileUploadInput {
  name: string;
  uri: string;
  type?: string;
}

export const fileService = {
  async uploadFile(file: FileUploadInput): Promise<EventAttachment> {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type || 'application/octet-stream',
    } as any);

    const response = await continuumClient.post('/outlook/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const data = response.data;
    return {
      id: data.id || `file_${Date.now()}`,
      fileName: data.fileName || file.name,
      fileSize: data.fileSize || 0,
      fileUrl: data.fileUrl || data.url || '',
      uploadedAt: data.uploadedAt || new Date().toISOString(),
    };
  },

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      const filename = fileUrl.split('/').pop() || '';
      await continuumClient.delete(`/outlook/files/${encodeURIComponent(filename)}`);
      return true;
    } catch {
      return false;
    }
  },
};
