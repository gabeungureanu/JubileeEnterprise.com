import apiClient from '../apiClient';
import { Contact, ContactFormData, ContactGroup } from '../../types/contacts';
import { ApiResponse } from '../../types/common';

const CODEX_BASE = process.env.REACT_APP_CODEX_API_URL || '';

export const contactService = {
  async getContacts(): Promise<ApiResponse<Contact[]>> {
    const response = await apiClient.get(`${CODEX_BASE}/api/v1/contacts`);
    return response.data;
  },

  async getContact(contactId: string): Promise<ApiResponse<Contact>> {
    const response = await apiClient.get(`${CODEX_BASE}/api/v1/contacts/${contactId}`);
    return response.data;
  },

  async createContact(data: ContactFormData): Promise<ApiResponse<Contact>> {
    const response = await apiClient.post(`${CODEX_BASE}/api/v1/contacts`, data);
    return response.data;
  },

  async updateContact(contactId: string, data: ContactFormData): Promise<ApiResponse<Contact>> {
    const response = await apiClient.put(`${CODEX_BASE}/api/v1/contacts/${contactId}`, data);
    return response.data;
  },

  async deleteContact(contactId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete(`${CODEX_BASE}/api/v1/contacts/${contactId}`);
    return response.data;
  },

  async getGroups(): Promise<ApiResponse<ContactGroup[]>> {
    const response = await apiClient.get(`${CODEX_BASE}/api/v1/contacts/groups`);
    return response.data;
  },

  async createGroup(name: string): Promise<ApiResponse<ContactGroup>> {
    const response = await apiClient.post(`${CODEX_BASE}/api/v1/contacts/groups`, { name });
    return response.data;
  },

  async findDuplicates(): Promise<ApiResponse<Contact[][]>> {
    const response = await apiClient.get(`${CODEX_BASE}/api/v1/contacts/duplicates`);
    return response.data;
  },
};
