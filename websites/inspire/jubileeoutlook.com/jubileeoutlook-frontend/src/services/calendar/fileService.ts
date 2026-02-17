import { continuumClient } from '../apiClient';

export interface EventAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: string;
}

export const fileService = {
  async uploadFile(file: File): Promise<EventAttachment> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await continuumClient.post('/outlook/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const data = response.data;
    return {
      id: data.id || crypto.randomUUID(),
      fileName: data.fileName || file.name,
      fileSize: data.fileSize || file.size,
      fileUrl: data.fileUrl || data.url || '',
      uploadedAt: data.uploadedAt || new Date().toISOString(),
    };
  },

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      // Extract filename from URL for the delete endpoint
      const filename = fileUrl.split('/').pop() || '';
      await continuumClient.delete(`/outlook/files/${encodeURIComponent(filename)}`);
      return true;
    } catch {
      return false;
    }
  },

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },

  getFileIcon(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const icons: Record<string, string> = {
      pdf: 'picture_as_pdf',
      doc: 'description', docx: 'description',
      xls: 'table_chart', xlsx: 'table_chart',
      ppt: 'slideshow', pptx: 'slideshow',
      jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image',
      zip: 'folder_zip', rar: 'folder_zip', '7z': 'folder_zip',
      txt: 'article', csv: 'article',
    };
    return icons[ext] || 'attach_file';
  },
};
