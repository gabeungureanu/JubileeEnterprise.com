import { codexClient, tokenStore } from '../apiClient';
import {
  ApiContactsListResponse, ApiContactGroupsListResponse,
  ContactDto, Contact, ContactGroup,
  mapContactDto, mapContactGroupDto,
} from '../../types/contacts';

/** Convert snake_case DTO keys to camelCase for the API */
function toCamelCaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

export const contactService = {
  async getContacts(page = 1, pageSize = 100): Promise<{ contacts: Contact[]; totalCount: number }> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.get<ApiContactsListResponse>('/contacts', {
      params: { userId, page, pageSize },
    });
    const data = response.data;
    const dtos = data.contacts || (data as any);
    return {
      contacts: Array.isArray(dtos) ? dtos.map(mapContactDto) : [],
      totalCount: (data as any).totalCount || data.total_count || 0,
    };
  },

  async getContact(contactId: string): Promise<Contact | null> {
    const response = await codexClient.get<ContactDto | { success: boolean; contact: ContactDto }>(
      `/contacts/${encodeURIComponent(contactId)}`
    );
    const data = response.data;
    const dto = (data as any).contact || data;
    return dto?.id ? mapContactDto(dto as ContactDto) : null;
  },

  async createContact(contact: Partial<ContactDto>): Promise<Contact | null> {
    const userId = tokenStore.getUserId();
    const payload = toCamelCaseKeys({ ...contact, user_id: userId } as Record<string, unknown>);
    const response = await codexClient.post('/contacts', payload);
    const data = response.data;
    const dto = data?.contact || data;
    return dto?.id ? mapContactDto(dto) : null;
  },

  async updateContact(contactId: string, contact: Partial<ContactDto>): Promise<Contact | null> {
    const payload = toCamelCaseKeys(contact as Record<string, unknown>);
    const response = await codexClient.put(`/contacts/${encodeURIComponent(contactId)}`, payload);
    const data = response.data;
    const dto = data?.contact || data;
    return dto?.id ? mapContactDto(dto) : null;
  },

  async deleteContact(contactId: string): Promise<boolean> {
    const response = await codexClient.delete(`/contacts/${encodeURIComponent(contactId)}`);
    return response.status === 200 || response.status === 204 || response.status === 404;
  },

  async searchContacts(query: string, page = 1, pageSize = 50): Promise<{ contacts: Contact[]; totalCount: number }> {
    const response = await codexClient.get<ApiContactsListResponse>('/contacts/search', {
      params: { q: query, page, pageSize },
    });
    const data = response.data;
    const dtos = data.contacts || (data as any);
    return {
      contacts: Array.isArray(dtos) ? dtos.map(mapContactDto) : [],
      totalCount: (data as any).totalCount || data.total_count || 0,
    };
  },

  // --- Contact Groups ---

  async getGroups(): Promise<ContactGroup[]> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.get<ApiContactGroupsListResponse>('/contact-groups', {
      params: { userId },
    });
    const dtos = response.data?.data || [];
    return dtos.map(mapContactGroupDto);
  },

  async createGroup(name: string, description = ''): Promise<ContactGroup | null> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.post('/contact-groups', { name, description }, {
      params: { userId },
    });
    const dto = response.data?.data;
    return dto ? mapContactGroupDto(dto) : null;
  },

  async updateGroup(groupId: string, name: string, description = ''): Promise<ContactGroup | null> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.put(`/contact-groups/${encodeURIComponent(groupId)}`, { name, description }, {
      params: { userId },
    });
    const dto = response.data?.data;
    return dto ? mapContactGroupDto(dto) : null;
  },

  async deleteGroup(groupId: string): Promise<boolean> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.delete(`/contact-groups/${encodeURIComponent(groupId)}`, {
      params: { userId },
    });
    return response.status === 200 || response.status === 204;
  },

  async addMembersToGroup(groupId: string, contactIds: string[]): Promise<number> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.post(`/contact-groups/${encodeURIComponent(groupId)}/members`, { contactIds }, {
      params: { userId },
    });
    return response.data?.added || 0;
  },

  async removeMemberFromGroup(groupId: string, contactId: string): Promise<boolean> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.delete(
      `/contact-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(contactId)}`,
      { params: { userId } }
    );
    return response.status === 200 || response.status === 204;
  },

  // --- Soft Delete / Restore / Favorites ---

  async softDeleteContact(contactId: string): Promise<boolean> {
    const response = await codexClient.patch(`/contacts/${encodeURIComponent(contactId)}/soft-delete`);
    return response.status === 200;
  },

  async restoreContact(contactId: string): Promise<boolean> {
    const response = await codexClient.patch(`/contacts/${encodeURIComponent(contactId)}/restore`);
    return response.status === 200;
  },

  async toggleFavorite(contactId: string, isFavorite: boolean): Promise<boolean> {
    const response = await codexClient.patch(`/contacts/${encodeURIComponent(contactId)}/favorite`, { isFavorite });
    return response.status === 200;
  },

  async getGroupMembers(groupId: string): Promise<Contact[]> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.get(`/contact-groups/${encodeURIComponent(groupId)}`, {
      params: { userId },
    });
    const members = response.data?.data?.members || [];
    return Array.isArray(members) ? members.map(mapContactDto) : [];
  },

  // --- Batch Operations ---

  async batchSoftDelete(contactIds: string[]): Promise<number> {
    const response = await codexClient.post('/contacts/batch/soft-delete', { contactIds });
    return response.data?.success_count || 0;
  },

  async batchRestore(contactIds: string[]): Promise<number> {
    const response = await codexClient.post('/contacts/batch/restore', { contactIds });
    return response.data?.success_count || 0;
  },

  async batchHardDelete(contactIds: string[]): Promise<number> {
    const response = await codexClient.post('/contacts/batch/delete', { contactIds });
    return response.data?.success_count || 0;
  },

  async batchUpdateCategory(contactIds: string[], category: string): Promise<number> {
    const response = await codexClient.post('/contacts/batch/category', { contactIds, category });
    return response.data?.success_count || 0;
  },

  // --- Duplicate Detection ---

  async checkDuplicates(displayName: string, emailAddresses: string[]): Promise<Contact[]> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.post('/contacts/check-duplicates', {
      userId, displayName, emailAddresses,
    });
    const matches = response.data?.matches || response.data?.contacts || [];
    return Array.isArray(matches) ? matches.map(mapContactDto) : [];
  },

  // --- Photo Upload ---

  async uploadPhoto(contactId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('photo', file);
    const response = await codexClient.post(
      `/contacts/${encodeURIComponent(contactId)}/photo`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data?.photo_url || response.data?.photoUrl || '';
  },

  // --- Import / Export ---

  async importVCard(file: File): Promise<{ imported: number; skipped: number }> {
    const userId = tokenStore.getUserId();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId || '');
    const response = await codexClient.post('/contacts/import/vcard', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return {
      imported: response.data?.imported || response.data?.success_count || 0,
      skipped: response.data?.skipped || 0,
    };
  },

  async importCsv(file: File): Promise<{ imported: number; skipped: number }> {
    const userId = tokenStore.getUserId();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId || '');
    const response = await codexClient.post('/contacts/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return {
      imported: response.data?.imported || response.data?.success_count || 0,
      skipped: response.data?.skipped || 0,
    };
  },

  async exportVCard(): Promise<Blob> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.get('/contacts/export/vcard', {
      params: { userId },
      responseType: 'blob',
    });
    return response.data;
  },

  async exportCsv(): Promise<Blob> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.get('/contacts/export/csv', {
      params: { userId },
      responseType: 'blob',
    });
    return response.data;
  },
};
