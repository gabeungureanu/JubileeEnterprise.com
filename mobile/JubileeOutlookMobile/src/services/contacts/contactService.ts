/**
 * Contact Service — mirrors web frontend src/services/contacts/contactService.ts exactly.
 */
import { codexClient, tokenStore } from '../apiClient';
import {
  ApiContactsListResponse, ApiContactGroupsListResponse,
  ContactDto, Contact, ContactGroup,
  mapContactDto, mapContactGroupDto,
} from '../../types/contacts';

export const contactService = {
  // ---------- Contacts ----------

  async getContacts(page = 1, pageSize = 100): Promise<{ contacts: Contact[]; totalCount: number }> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.get<ApiContactsListResponse>('/contacts', {
      params: { userId, page, pageSize },
    });
    const data = response.data;
    const dtos = data.contacts || (data as any);
    return {
      contacts: Array.isArray(dtos) ? dtos.map(mapContactDto) : [],
      totalCount: data.total_count || 0,
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
    const payload = { ...contact, user_id: userId };
    const response = await codexClient.post('/contacts', payload);
    const data = response.data;
    const dto = data?.contact || data;
    return dto?.id ? mapContactDto(dto) : null;
  },

  async updateContact(contactId: string, contact: Partial<ContactDto>): Promise<Contact | null> {
    const response = await codexClient.put(`/contacts/${encodeURIComponent(contactId)}`, contact);
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
      totalCount: data.total_count || 0,
    };
  },

  // ---------- Contact Groups ----------

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

  // ---------- Mobile-specific convenience methods ----------

  async toggleFavorite(contactId: string): Promise<Contact | null> {
    const response = await codexClient.patch(`/contacts/${encodeURIComponent(contactId)}/favorite`);
    const data = response.data;
    const dto = data?.contact || data;
    return dto?.id ? mapContactDto(dto) : null;
  },

  async softDelete(contactId: string): Promise<boolean> {
    const response = await codexClient.patch(`/contacts/${encodeURIComponent(contactId)}/soft-delete`);
    return response.status === 200 || response.status === 204;
  },

  async restore(contactId: string): Promise<Contact | null> {
    const response = await codexClient.patch(`/contacts/${encodeURIComponent(contactId)}/restore`);
    const data = response.data;
    const dto = data?.contact || data;
    return dto?.id ? mapContactDto(dto) : null;
  },
};
