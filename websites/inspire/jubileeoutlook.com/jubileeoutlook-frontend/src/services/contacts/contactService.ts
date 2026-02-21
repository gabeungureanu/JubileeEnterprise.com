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

/** Parse vCard file content into contact objects (mirrors API parseVCard) */
function parseVCardContacts(vcardContent: string): Record<string, any>[] {
  const contacts: Record<string, any>[] = [];
  const vcards = vcardContent.split('END:VCARD').map(v => v.trim()).filter(v => v.includes('BEGIN:VCARD'));

  for (const vcard of vcards) {
    const lines = vcard.split(/\r?\n/);
    const contact: Record<string, any> = { emailAddresses: [], phoneNumbers: [] };

    for (const line of lines) {
      if (line.startsWith('FN:') || line.startsWith('FN;')) {
        contact.displayName = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('N:') || line.startsWith('N;')) {
        const parts = line.split(':').slice(1).join(':').split(';');
        contact.lastName = parts[0]?.trim() || '';
        contact.firstName = parts[1]?.trim() || '';
        contact.middleName = parts[2]?.trim() || '';
        contact.title = parts[3]?.trim() || '';
        contact.suffix = parts[4]?.trim() || '';
      } else if (line.startsWith('EMAIL')) {
        const email = line.split(':').slice(1).join(':').trim();
        if (email) contact.emailAddresses.push(email);
      } else if (line.startsWith('TEL')) {
        const phone = line.split(':').slice(1).join(':').trim();
        if (phone) contact.phoneNumbers.push(phone);
      } else if (line.startsWith('ORG:') || line.startsWith('ORG;')) {
        contact.company = line.split(':').slice(1).join(':').split(';')[0]?.trim();
        contact.department = line.split(':').slice(1).join(':').split(';')[1]?.trim();
      } else if (line.startsWith('TITLE:') || line.startsWith('TITLE;')) {
        contact.jobTitle = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('NOTE:') || line.startsWith('NOTE;')) {
        contact.notes = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('URL:') || line.startsWith('URL;')) {
        contact.website = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('BDAY:')) {
        contact.birthday = line.split(':')[1]?.trim();
      } else if (line.startsWith('ANNIVERSARY:') || line.startsWith('X-ANNIVERSARY:')) {
        contact.anniversary = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('X-SPOUSE:') || line.startsWith('X-MS-SPOUSE:')) {
        contact.spouse = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('NICKNAME:')) {
        contact.nickname = line.split(':')[1]?.trim();
      } else if (line.startsWith('ADR')) {
        const parts = line.split(':').slice(1).join(':').split(';');
        contact.address = parts[2]?.trim() || '';
        contact.city = parts[3]?.trim() || '';
        contact.state = parts[4]?.trim() || '';
        contact.postalCode = parts[5]?.trim() || '';
        contact.country = parts[6]?.trim() || '';
      } else if (line.startsWith('CATEGORIES:')) {
        contact.category = line.split(':')[1]?.trim();
      }
    }

    if (!contact.displayName) {
      contact.displayName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed Contact';
    }
    contacts.push(contact);
  }
  return contacts;
}

/** Parse CSV file content into contact objects (mirrors API parseCsvContacts) */
function parseCsvFileContacts(csvContent: string): Record<string, any>[] {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const contacts: Record<string, any>[] = [];

  const headerMap: Record<string, string> = {
    'first name': 'firstName', 'firstname': 'firstName',
    'last name': 'lastName', 'lastname': 'lastName',
    'display name': 'displayName', 'displayname': 'displayName', 'name': 'displayName',
    'email': 'email', 'e-mail': 'email', 'email address': 'email',
    'phone': 'phone', 'telephone': 'phone', 'phone number': 'phone',
    'mobile': 'mobilePhone', 'mobile phone': 'mobilePhone', 'cell': 'mobilePhone',
    'company': 'company', 'organization': 'company', 'org': 'company',
    'job title': 'jobTitle', 'jobtitle': 'jobTitle', 'title': 'jobTitle',
    'department': 'department',
    'address': 'address', 'street': 'address',
    'city': 'city',
    'state': 'state', 'province': 'state',
    'zip': 'postalCode', 'postal code': 'postalCode', 'zipcode': 'postalCode',
    'country': 'country',
    'notes': 'notes',
    'website': 'website', 'url': 'website',
    'nickname': 'nickname',
    'category': 'category',
  };

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const contact: Record<string, any> = { emailAddresses: [], phoneNumbers: [] };

    for (let j = 0; j < headers.length && j < values.length; j++) {
      const mapped = headerMap[headers[j]];
      if (!mapped || !values[j]) continue;
      if (mapped === 'email') {
        contact.emailAddresses.push(values[j]);
      } else if (mapped === 'phone') {
        contact.phoneNumbers.push(values[j]);
      } else {
        contact[mapped] = values[j];
      }
    }

    if (!contact.displayName) {
      contact.displayName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed Contact';
    }
    contacts.push(contact);
  }
  return contacts;
}

/** Check if a parsed contact matches an existing contact by name or email */
function isContactMatch(
  parsed: Record<string, any>,
  existing: { displayName: string; emailAddresses: string[] }
): boolean {
  // Match by display name (case-insensitive)
  if (parsed.displayName && existing.displayName &&
      parsed.displayName.toLowerCase().trim() === existing.displayName.toLowerCase().trim()) {
    return true;
  }
  // Match by any shared email
  const parsedEmails = (parsed.emailAddresses || []).map((e: string) => e.toLowerCase().trim());
  const existingEmails = (existing.emailAddresses || []).map((e: string) => e.toLowerCase().trim());
  return parsedEmails.some((e: string) => existingEmails.includes(e));
}

/** Import parsed contacts with full duplicate detection (including soft-deleted contacts) */
async function importContactsWithDuplicateCheck(
  parsedContacts: Record<string, any>[]
): Promise<{ imported: number; skipped: number }> {
  const userId = tokenStore.getUserId();
  let imported = 0;
  let skipped = 0;

  // Fetch ALL existing contacts (including soft-deleted) to check for duplicates
  let existingContacts: { id: string; displayName: string; emailAddresses: string[]; isDeleted: boolean }[] = [];
  try {
    const response = await codexClient.get('/contacts', { params: { userId, page: 1, pageSize: 10000 } });
    const data = response.data;
    const dtos = data.contacts || data;
    if (Array.isArray(dtos)) {
      existingContacts = dtos.map((d: any) => ({
        id: d.id,
        displayName: d.displayName || d.display_name || '',
        emailAddresses: d.emailAddresses || d.email_addresses || [],
        isDeleted: d.isDeleted ?? d.is_deleted ?? false,
      }));
    }
  } catch {
    // If we can't fetch existing contacts, fall through to API-level duplicate check
  }

  for (const contact of parsedContacts) {
    // Check against ALL existing contacts (active + soft-deleted)
    const activeMatch = existingContacts.find(e => !e.isDeleted && isContactMatch(contact, e));
    const deletedMatch = existingContacts.find(e => e.isDeleted && isContactMatch(contact, e));

    if (activeMatch) {
      // Active duplicate exists — skip entirely
      skipped++;
      continue;
    }

    if (deletedMatch) {
      // Soft-deleted duplicate exists — restore it instead of creating new
      try {
        await codexClient.patch(`/contacts/${encodeURIComponent(deletedMatch.id)}/restore`);
        deletedMatch.isDeleted = false; // Update local state so next iterations see it as active
        imported++;
      } catch {
        skipped++;
      }
      continue;
    }

    // No match — create new contact
    try {
      const payload: Record<string, unknown> = {
        userId,
        displayName: contact.displayName,
        firstName: contact.firstName,
        lastName: contact.lastName,
        title: contact.title,
        middleName: contact.middleName,
        suffix: contact.suffix,
        nickname: contact.nickname,
        emailAddresses: contact.emailAddresses || [],
        phoneNumbers: contact.phoneNumbers || [],
        mobilePhone: contact.mobilePhone,
        company: contact.company,
        jobTitle: contact.jobTitle,
        department: contact.department,
        office: contact.office,
        address: contact.address,
        city: contact.city,
        state: contact.state,
        postalCode: contact.postalCode,
        country: contact.country,
        notes: contact.notes,
        birthday: contact.birthday || null,
        anniversary: contact.anniversary || null,
        spouse: contact.spouse,
        website: contact.website,
        category: contact.category,
      };
      const res = await codexClient.post('/contacts', payload);
      const created = res.data?.contact || res.data;
      // Add to local list so subsequent imports see it
      if (created?.id) {
        existingContacts.push({
          id: created.id,
          displayName: contact.displayName || '',
          emailAddresses: contact.emailAddresses || [],
          isDeleted: false,
        });
      }
      imported++;
    } catch (err: any) {
      skipped++;
    }
  }
  return { imported, skipped };
}

export const contactService = {
  async getContacts(page = 1, pageSize = 100): Promise<{ contacts: Contact[]; totalCount: number }> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.get<ApiContactsListResponse>('/contacts', {
      params: { userId, page, pageSize, _t: Date.now() },
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
    const response = await codexClient.post('/contacts/batch/soft-delete', { ids: contactIds });
    return response.data?.deleted || response.data?.success_count || 0;
  },

  async batchRestore(contactIds: string[]): Promise<number> {
    const response = await codexClient.post('/contacts/batch/restore', { ids: contactIds });
    return response.data?.restored || response.data?.success_count || 0;
  },

  async batchHardDelete(contactIds: string[]): Promise<number> {
    const response = await codexClient.post('/contacts/batch/delete', { ids: contactIds });
    return response.data?.deleted || response.data?.success_count || 0;
  },

  async batchUpdateCategory(contactIds: string[], category: string): Promise<number> {
    const response = await codexClient.post('/contacts/batch/category', { ids: contactIds, category });
    return response.data?.updated || response.data?.success_count || 0;
  },

  // --- Duplicate Detection ---

  async checkDuplicates(displayName: string, phoneNumbers: string[], mobilePhone?: string): Promise<Contact[]> {
    const userId = tokenStore.getUserId();
    const response = await codexClient.post('/contacts/check-duplicates', {
      userId, displayName, phoneNumbers, mobilePhone,
    });
    const matches = response.data?.duplicates || response.data?.matches || response.data?.contacts || [];
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
    const vcardContent = await file.text();
    const parsed = parseVCardContacts(vcardContent);
    if (parsed.length === 0) throw new Error('No valid contacts found in vCard file.');
    if (parsed.length > 500) throw new Error('Maximum 500 contacts per import.');
    return importContactsWithDuplicateCheck(parsed);
  },

  async importCsv(file: File): Promise<{ imported: number; skipped: number }> {
    const csvContent = await file.text();
    const parsed = parseCsvFileContacts(csvContent);
    if (parsed.length === 0) throw new Error('No valid contacts found in CSV file.');
    if (parsed.length > 500) throw new Error('Maximum 500 contacts per import.');
    return importContactsWithDuplicateCheck(parsed);
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
