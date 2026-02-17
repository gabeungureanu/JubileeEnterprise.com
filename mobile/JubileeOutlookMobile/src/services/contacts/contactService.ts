/**
 * Contact Service — mirrors web frontend src/services/contacts/contactService.ts
 */
import { codexClient, tokenStore } from '../apiClient';
import type { Contact, ContactGroup, CreateContactPayload, UpdateContactPayload } from '../../types';

export const contactService = {
  // ---------- Contacts ----------

  async getContacts(page: number = 1, pageSize: number = 50): Promise<{ contacts: Contact[]; pagination: any }> {
    const userId = tokenStore.getUserId();
    const { data } = await codexClient.get('/v1/contacts', {
      params: { userId, page, pageSize },
    });
    return {
      contacts: data.data || [],
      pagination: data.pagination || { page, pageSize, total: 0, totalPages: 0 },
    };
  },

  async getContact(contactId: string): Promise<Contact> {
    const { data } = await codexClient.get(`/v1/contacts/${contactId}`);
    return data.data || data;
  },

  async createContact(payload: CreateContactPayload): Promise<Contact> {
    const { data } = await codexClient.post('/v1/contacts', payload);
    return data.data || data;
  },

  async updateContact(contactId: string, payload: UpdateContactPayload): Promise<Contact> {
    const { data } = await codexClient.put(`/v1/contacts/${contactId}`, payload);
    return data.data || data;
  },

  async deleteContact(contactId: string): Promise<void> {
    await codexClient.delete(`/v1/contacts/${contactId}`);
  },

  async searchContacts(query: string, page: number = 1, pageSize: number = 50): Promise<{ contacts: Contact[]; pagination: any }> {
    const userId = tokenStore.getUserId();
    const { data } = await codexClient.get('/v1/contacts/search', {
      params: { userId, q: query, page, pageSize },
    });
    return {
      contacts: data.data || [],
      pagination: data.pagination || { page, pageSize, total: 0, totalPages: 0 },
    };
  },

  async toggleFavorite(contactId: string): Promise<void> {
    await codexClient.patch(`/v1/contacts/${contactId}/favorite`);
  },

  async softDelete(contactId: string): Promise<void> {
    await codexClient.patch(`/v1/contacts/${contactId}/soft-delete`);
  },

  async restore(contactId: string): Promise<void> {
    await codexClient.patch(`/v1/contacts/${contactId}/restore`);
  },

  // ---------- Groups ----------

  async getGroups(): Promise<ContactGroup[]> {
    const { data } = await codexClient.get('/v1/contact-groups');
    return data.data || data;
  },

  async getGroup(groupId: string): Promise<ContactGroup> {
    const { data } = await codexClient.get(`/v1/contact-groups/${groupId}`);
    return data.data || data;
  },

  async createGroup(name: string, description?: string): Promise<ContactGroup> {
    const userId = tokenStore.getUserId();
    const { data } = await codexClient.post('/v1/contact-groups', { userId, name, description });
    return data.data || data;
  },

  async updateGroup(groupId: string, name: string, description?: string): Promise<ContactGroup> {
    const { data } = await codexClient.put(`/v1/contact-groups/${groupId}`, { name, description });
    return data.data || data;
  },

  async deleteGroup(groupId: string): Promise<void> {
    await codexClient.delete(`/v1/contact-groups/${groupId}`);
  },

  async addMembersToGroup(groupId: string, contactIds: string[]): Promise<void> {
    await codexClient.post(`/v1/contact-groups/${groupId}/members`, { contactIds });
  },

  async removeMemberFromGroup(groupId: string, contactId: string): Promise<void> {
    await codexClient.delete(`/v1/contact-groups/${groupId}/members/${contactId}`);
  },
};
