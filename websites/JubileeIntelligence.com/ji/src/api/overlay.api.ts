import { apiClient } from './client';
import { ContentEntry, EntryFormData, EntryStatus } from '../types/entry.types';

export const overlayApi = {
  // Get entries by scope
  getEntries: async (domain: string, domainKey: string, subKey?: string): Promise<ContentEntry[]> => {
    const params = new URLSearchParams({ domain, domainKey });
    if (subKey) params.append('subKey', subKey);
    const response = await apiClient.get(`/overlay/entries?${params}`);
    return response.data;
  },

  // Get all entries
  getAllEntries: async (filters?: { status?: EntryStatus; domain?: string }): Promise<ContentEntry[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.domain) params.append('domain', filters.domain);
    const endpoint = params.toString() ? `/overlay/entries/all?${params}` : '/overlay/entries/all';
    const response = await apiClient.get(endpoint);
    return response.data;
  },

  // Get single entry
  getEntry: async (id: string): Promise<ContentEntry> => {
    const response = await apiClient.get(`/overlay/entries/${id}`);
    return response.data;
  },

  // Create entry
  createEntry: async (data: EntryFormData): Promise<ContentEntry> => {
    const response = await apiClient.post('/overlay/entries', {
      ...data,
      status: 'draft',
      version: { major: 1, minor: 0 }
    });
    return response.data;
  },

  // Update metadata only
  updateMetadata: async (id: string, data: Partial<EntryFormData>): Promise<ContentEntry> => {
    const response = await apiClient.patch(`/overlay/entries/${id}/metadata`, data);
    return response.data;
  },

  // Update content
  updateContent: async (id: string, content: string): Promise<ContentEntry> => {
    const response = await apiClient.patch(`/overlay/entries/${id}/content`, { content });
    return response.data;
  },

  // Update status
  updateStatus: async (id: string, status: EntryStatus): Promise<ContentEntry> => {
    const response = await apiClient.patch(`/overlay/entries/${id}/status`, { status });
    return response.data;
  },

  // Soft delete
  deleteEntry: async (id: string): Promise<void> => {
    await apiClient.delete(`/overlay/entries/${id}`);
  },

  // Supersede entry
  supersedeEntry: async (oldId: string, newData: EntryFormData): Promise<ContentEntry> => {
    const response = await apiClient.post(`/overlay/entries/${oldId}/supersede`, newData);
    return response.data;
  },

  // Get resolved entries for individual (with inheritance)
  getResolvedEntries: async (domain: string, domainKey: string, individual: string): Promise<ContentEntry[]> => {
    const response = await apiClient.get(`/overlay/resolved/${domain}/${domainKey}/${individual}`);
    return response.data;
  },

  // Get audit log
  getAuditLog: async (id: string): Promise<Array<{
    id: number;
    action: string;
    old_value: string | null;
    new_value: string | null;
    changed_at: string;
    changed_by: string;
  }>> => {
    const response = await apiClient.get(`/overlay/entries/${id}/audit`);
    return response.data;
  }
};
