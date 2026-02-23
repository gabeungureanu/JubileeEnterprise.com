/**
 * Contact Service — mirrors web frontend src/services/contacts/contactService.ts exactly.
 */
import { codexClient, tokenStore } from '../apiClient';
import {
  ApiContactsListResponse, ApiContactGroupsListResponse,
  ContactDto, Contact, ContactGroup,
  mapContactDto, mapContactGroupDto,
} from '../../types/contacts';

/** Convert snake_case DTO keys to camelCase for the API (matches web frontend) */
function toCamelCaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

/** Extract human-readable error message from Axios error responses */
function extractApiError(err: any): string {
  const data = err?.response?.data;
  return data?.error || data?.message || err?.message || 'An unexpected error occurred.';
}

// ---------- vCard Parsing (matches web frontend exactly) ----------

function parseVCardContacts(vcardContent: string): Record<string, any>[] {
  const contacts: Record<string, any>[] = [];
  const cards = vcardContent.split(/END:VCARD/i).filter((c) => c.trim());

  for (const card of cards) {
    const contact: Record<string, any> = {
      emailAddresses: [] as string[],
      phoneNumbers: [] as string[],
    };

    const lines = card.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('BEGIN:VCARD') || line.startsWith('VERSION:')) continue;

      if (line.match(/^FN[;:]/i)) {
        contact.displayName = line.replace(/^FN[;:][^:]*:/i, '').replace(/^FN:/i, '').trim();
      } else if (line.match(/^N[;:]/i)) {
        const parts = line.replace(/^N[;:][^:]*:/i, '').replace(/^N:/i, '').split(';');
        contact.lastName = parts[0]?.trim() || '';
        contact.firstName = parts[1]?.trim() || '';
        contact.middleName = parts[2]?.trim() || '';
        contact.title = parts[3]?.trim() || '';
        contact.suffix = parts[4]?.trim() || '';
      } else if (line.match(/^EMAIL/i)) {
        const email = line.replace(/^EMAIL[^:]*:/i, '').trim();
        if (email) contact.emailAddresses.push(email);
      } else if (line.match(/^TEL/i)) {
        const phone = line.replace(/^TEL[^:]*:/i, '').trim();
        if (phone) contact.phoneNumbers.push(phone);
      } else if (line.match(/^ORG[;:]/i)) {
        const orgParts = line.replace(/^ORG[;:][^:]*:/i, '').replace(/^ORG:/i, '').split(';');
        contact.company = orgParts[0]?.trim() || '';
        if (orgParts[1]) contact.department = orgParts[1].trim();
      } else if (line.match(/^TITLE[;:]/i)) {
        contact.jobTitle = line.replace(/^TITLE[;:][^:]*:/i, '').replace(/^TITLE:/i, '').trim();
      } else if (line.match(/^NOTE[;:]/i)) {
        contact.notes = line.replace(/^NOTE[;:][^:]*:/i, '').replace(/^NOTE:/i, '').trim().replace(/\\n/g, '\n');
      } else if (line.match(/^URL[;:]/i)) {
        contact.website = line.replace(/^URL[;:][^:]*:/i, '').replace(/^URL:/i, '').trim();
      } else if (line.match(/^BDAY[;:]/i)) {
        contact.birthday = line.replace(/^BDAY[;:][^:]*:/i, '').replace(/^BDAY:/i, '').trim();
      } else if (line.match(/^(ANNIVERSARY|X-ANNIVERSARY)[;:]/i)) {
        contact.anniversary = line.replace(/^(ANNIVERSARY|X-ANNIVERSARY)[;:][^:]*:/i, '').trim();
      } else if (line.match(/^(X-SPOUSE|X-MS-SPOUSE)[;:]/i)) {
        contact.spouse = line.replace(/^(X-SPOUSE|X-MS-SPOUSE)[;:][^:]*:/i, '').trim();
      } else if (line.match(/^NICKNAME[;:]/i)) {
        contact.nickname = line.replace(/^NICKNAME[;:][^:]*:/i, '').replace(/^NICKNAME:/i, '').trim();
      } else if (line.match(/^ADR[;:]/i)) {
        const parts = line.replace(/^ADR[^:]*:/i, '').split(';');
        contact.address = parts[2]?.trim() || '';
        contact.city = parts[3]?.trim() || '';
        contact.state = parts[4]?.trim() || '';
        contact.postalCode = parts[5]?.trim() || '';
        contact.country = parts[6]?.trim() || '';
      } else if (line.match(/^CATEGORIES[;:]/i)) {
        contact.category = line.replace(/^CATEGORIES[;:][^:]*:/i, '').replace(/^CATEGORIES:/i, '').trim();
      }
    }

    // Fallback displayName
    if (!contact.displayName) {
      contact.displayName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed Contact';
    }

    contacts.push(contact);
  }

  return contacts;
}

// ---------- CSV Parsing (matches web frontend exactly) ----------

const CSV_HEADER_MAP: Record<string, string> = {
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

function parseCsvFileContacts(csvContent: string): Record<string, any>[] {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows.');

  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^"(.*)"$/, '$1').toLowerCase());

  const contacts: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"(.*)"$/, '$1'));
    const contact: Record<string, any> = {
      emailAddresses: [] as string[],
      phoneNumbers: [] as string[],
    };

    for (let j = 0; j < headers.length; j++) {
      const val = values[j]?.trim();
      if (!val) continue;

      const mapped = CSV_HEADER_MAP[headers[j]];
      if (!mapped) continue;

      if (mapped === 'email') {
        contact.emailAddresses.push(val);
      } else if (mapped === 'phone') {
        contact.phoneNumbers.push(val);
      } else {
        contact[mapped] = val;
      }
    }

    // Build displayName if not explicitly set
    if (!contact.displayName) {
      contact.displayName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed Contact';
    }

    contacts.push(contact);
  }

  return contacts;
}

// ---------- Duplicate Matching (matches web frontend exactly) ----------

/**
 * Check if a parsed contact matches an existing contact.
 * Criteria (same as web): displayName match OR shared email address.
 */
function isContactMatch(parsed: Record<string, any>, existing: Contact): boolean {
  // Match by displayName (case-insensitive, trimmed)
  const parsedName = (parsed.displayName || '').toLowerCase().trim();
  const existingName = (existing.displayName || '').toLowerCase().trim();
  if (parsedName && existingName && parsedName === existingName) return true;

  // Match by shared email address
  const parsedEmails = (parsed.emailAddresses || []).map((e: string) => e.toLowerCase().trim());
  const existingEmails = (existing.emailAddresses || []).map((e) => e.toLowerCase().trim());
  for (const pe of parsedEmails) {
    if (pe && existingEmails.includes(pe)) return true;
  }

  return false;
}

/**
 * Normalise phone number by removing all non-digit characters.
 * Used for duplicate detection during contact creation (matches web).
 */
function normalizePhone(phone: string | undefined | null): string {
  return (phone || '').replace(/\D/g, '');
}

export const contactService = {
  // ---------- Contacts ----------

  async getContacts(page = 1, pageSize = 100): Promise<{ contacts: Contact[]; totalCount: number }> {
    const userId = tokenStore.requireUserId();
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
    const userId = tokenStore.requireUserId();
    const payload = toCamelCaseKeys({ ...contact, user_id: userId } as Record<string, unknown>);
    try {
      const response = await codexClient.post('/contacts', payload);
      const data = response.data;
      const dto = data?.contact || data;
      return dto?.id ? mapContactDto(dto) : null;
    } catch (err: any) {
      // Extract meaningful error from 409 duplicate responses
      if (err?.response?.status === 409) {
        const code = err.response.data?.code;
        const deletedId = err.response.data?.duplicates?.[0]?.id;
        const error = new Error(extractApiError(err));
        (error as any).code = code;
        (error as any).deletedContactId = deletedId;
        throw error;
      }
      throw new Error(extractApiError(err));
    }
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
      totalCount: data.total_count || 0,
    };
  },

  // ---------- Contact Groups ----------

  async getGroups(): Promise<ContactGroup[]> {
    const userId = tokenStore.requireUserId();
    const response = await codexClient.get<ApiContactGroupsListResponse>('/contact-groups', {
      params: { userId },
    });
    const dtos = response.data?.data || [];
    return dtos.map(mapContactGroupDto);
  },

  async createGroup(name: string, description = ''): Promise<ContactGroup | null> {
    const userId = tokenStore.requireUserId();
    const response = await codexClient.post('/contact-groups', { name, description }, {
      params: { userId },
    });
    const dto = response.data?.data;
    return dto ? mapContactGroupDto(dto) : null;
  },

  async updateGroup(groupId: string, name: string, description = ''): Promise<ContactGroup | null> {
    const userId = tokenStore.requireUserId();
    const response = await codexClient.put(`/contact-groups/${encodeURIComponent(groupId)}`, { name, description }, {
      params: { userId },
    });
    const dto = response.data?.data;
    return dto ? mapContactGroupDto(dto) : null;
  },

  async deleteGroup(groupId: string): Promise<boolean> {
    const userId = tokenStore.requireUserId();
    const response = await codexClient.delete(`/contact-groups/${encodeURIComponent(groupId)}`, {
      params: { userId },
    });
    return response.status === 200 || response.status === 204;
  },

  async addMembersToGroup(groupId: string, contactIds: string[]): Promise<number> {
    const userId = tokenStore.requireUserId();
    const response = await codexClient.post(`/contact-groups/${encodeURIComponent(groupId)}/members`, { contactIds }, {
      params: { userId },
    });
    return response.data?.added || 0;
  },

  async removeMemberFromGroup(groupId: string, contactId: string): Promise<boolean> {
    const userId = tokenStore.requireUserId();
    const response = await codexClient.delete(
      `/contact-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(contactId)}`,
      { params: { userId } }
    );
    return response.status === 200 || response.status === 204;
  },

  // ---------- Favorite / Soft-delete / Restore ----------

  async toggleFavorite(contactId: string, isFavorite?: boolean): Promise<Contact | null> {
    const body = isFavorite !== undefined ? { isFavorite } : undefined;
    const response = await codexClient.patch(
      `/contacts/${encodeURIComponent(contactId)}/favorite`,
      body,
    );
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

  // ---------- Batch operations ----------

  async batchSoftDelete(ids: string[]): Promise<number> {
    const response = await codexClient.post('/contacts/batch/soft-delete', { ids });
    return response.data?.deleted || 0;
  },

  async batchRestore(ids: string[]): Promise<number> {
    const response = await codexClient.post('/contacts/batch/restore', { ids });
    return response.data?.restored || 0;
  },

  async batchHardDelete(ids: string[]): Promise<number> {
    const response = await codexClient.post('/contacts/batch/delete', { ids });
    return response.data?.deleted || 0;
  },

  async batchUpdateCategory(ids: string[], category: string | null): Promise<number> {
    const response = await codexClient.post('/contacts/batch/category', { ids, category });
    return response.data?.updated || 0;
  },

  // ---------- Group member fetching ----------

  async getGroupMembers(groupId: string): Promise<Contact[]> {
    const userId = tokenStore.requireUserId();
    const response = await codexClient.get(`/contact-groups/${encodeURIComponent(groupId)}`, {
      params: { userId },
    });
    const members = response.data?.data?.members || [];
    return members.map((m: any) => mapContactDto(m));
  },

  // ---------- Import (matches web frontend exactly) ----------

  /**
   * Import vCard file content with duplicate detection.
   * Returns { imported, skipped } counts.
   */
  async importVCard(vcardContent: string): Promise<{ imported: number; skipped: number }> {
    const parsed = parseVCardContacts(vcardContent);
    if (parsed.length === 0) throw new Error('No contacts found in the vCard file.');
    if (parsed.length > 500) throw new Error('Maximum 500 contacts per import. Please split the file.');
    return this.importContactsWithDuplicateCheck(parsed);
  },

  /**
   * Import CSV file content with duplicate detection.
   * Returns { imported, skipped } counts.
   */
  async importCsv(csvContent: string): Promise<{ imported: number; skipped: number }> {
    const parsed = parseCsvFileContacts(csvContent);
    if (parsed.length === 0) throw new Error('No contacts found in the CSV file.');
    if (parsed.length > 500) throw new Error('Maximum 500 contacts per import. Please split the file.');
    return this.importContactsWithDuplicateCheck(parsed);
  },

  /**
   * Core import logic with duplicate check — matches web frontend importContactsWithDuplicateCheck.
   * 1. Fetch all existing contacts (including soft-deleted)
   * 2. For each parsed contact:
   *    - Active duplicate → SKIP
   *    - Soft-deleted duplicate → RESTORE
   *    - No match → CREATE
   */
  async importContactsWithDuplicateCheck(
    parsedContacts: Record<string, any>[],
  ): Promise<{ imported: number; skipped: number }> {
    const userId = tokenStore.requireUserId();

    // Fetch all existing contacts including soft-deleted
    const response = await codexClient.get<ApiContactsListResponse>('/contacts', {
      params: { userId, page: 1, pageSize: 10000, includeDeleted: true },
    });
    const allExisting = (response.data.contacts || []).map(mapContactDto);

    const activeContacts = allExisting.filter((c) => !c.isDeleted);
    const deletedContacts = allExisting.filter((c) => c.isDeleted);

    // Track restored IDs so we move them into the "active" bucket for later iterations
    const restoredIds = new Set<string>();

    let imported = 0;
    let skipped = 0;

    for (const parsed of parsedContacts) {
      // Check against active contacts (including previously restored in this batch)
      const activeMatch = activeContacts.find((c) => isContactMatch(parsed, c));
      if (activeMatch) {
        skipped++;
        continue;
      }

      // Check already-restored contacts in this import run
      const alreadyRestored = deletedContacts.find(
        (c) => restoredIds.has(c.id) && isContactMatch(parsed, c),
      );
      if (alreadyRestored) {
        skipped++;
        continue;
      }

      // Check against soft-deleted contacts → restore instead of creating
      const deletedMatch = deletedContacts.find(
        (c) => !restoredIds.has(c.id) && isContactMatch(parsed, c),
      );
      if (deletedMatch) {
        await codexClient.patch(`/contacts/${encodeURIComponent(deletedMatch.id)}/restore`);
        restoredIds.add(deletedMatch.id);
        // Move to active bucket for subsequent iterations
        activeContacts.push({ ...deletedMatch, isDeleted: false });
        imported++;
        continue;
      }

      // No match — create new contact
      const payload: Record<string, unknown> = {
        userId,
        displayName: parsed.displayName || 'Unnamed Contact',
        firstName: parsed.firstName || '',
        lastName: parsed.lastName || '',
        emailAddresses: parsed.emailAddresses || [],
        phoneNumbers: parsed.phoneNumbers || [],
        mobilePhone: parsed.mobilePhone || '',
        company: parsed.company || '',
        jobTitle: parsed.jobTitle || '',
        department: parsed.department || '',
        notes: parsed.notes || '',
        website: parsed.website || '',
        nickname: parsed.nickname || '',
        category: parsed.category || '',
        address: parsed.address || '',
        city: parsed.city || '',
        state: parsed.state || '',
        postalCode: parsed.postalCode || '',
        country: parsed.country || '',
        birthday: parsed.birthday || null,
        anniversary: parsed.anniversary || null,
        spouse: parsed.spouse || '',
        skipDuplicateCheck: true,
      };

      try {
        const createRes = await codexClient.post('/contacts', payload);
        const newContact = createRes.data?.contact || createRes.data;
        if (newContact?.id) {
          activeContacts.push(mapContactDto(newContact));
        }
        imported++;
      } catch {
        // Skip contacts that fail to create (e.g., unexpected server-side validation)
        skipped++;
      }
    }

    return { imported, skipped };
  },

  // ---------- Export (matches web frontend exactly) ----------

  /**
   * Export all contacts as vCard 3.0 format string.
   * Calls the API export endpoint (same as web).
   */
  async exportAllVCard(): Promise<string> {
    const userId = tokenStore.requireUserId();
    const response = await codexClient.get('/contacts/export/vcard', {
      params: { userId },
      responseType: 'text',
    });
    return response.data;
  },

  /**
   * Export all contacts as CSV format string.
   * Calls the API export endpoint (same as web).
   */
  async exportAllCsv(): Promise<string> {
    const userId = tokenStore.requireUserId();
    const response = await codexClient.get('/contacts/export/csv', {
      params: { userId },
      responseType: 'text',
    });
    return response.data;
  },

  // ---------- Duplicate Check API (matches web frontend exactly) ----------

  /**
   * Check for duplicate contacts by display name + phone numbers.
   * Used for the two-pass duplicate check during contact creation.
   */
  async checkDuplicates(
    displayName: string,
    phoneNumbers: string[],
    mobilePhone?: string,
  ): Promise<Contact[]> {
    const userId = tokenStore.requireUserId();
    const response = await codexClient.post('/contacts/check-duplicates', {
      userId,
      displayName,
      phoneNumbers,
      mobilePhone: mobilePhone || '',
    });
    const dtos = response.data?.duplicates || response.data || [];
    return Array.isArray(dtos) ? dtos.map(mapContactDto) : [];
  },

  /**
   * Find an active (non-deleted) duplicate for a given contact.
   * Used before restoring to warn the user (matches web frontend findActiveDuplicate).
   * Matches by: displayName (case-insensitive) OR shared email.
   */
  findActiveDuplicate(
    contact: Contact,
    allContacts: Contact[],
  ): Contact | undefined {
    const name = (contact.displayName || '').toLowerCase().trim();
    const emails = (contact.emailAddresses || [])
      .map((e) => e.toLowerCase().trim())
      .filter(Boolean);

    return allContacts.find((c) => {
      if (c.isDeleted || c.id === contact.id) return false;
      // Match by name
      const cName = (c.displayName || '').toLowerCase().trim();
      if (name && cName && name === cName) return true;
      // Match by shared email
      const cEmails = (c.emailAddresses || [])
        .map((e) => e.toLowerCase().trim())
        .filter(Boolean);
      return emails.some((e) => cEmails.includes(e));
    });
  },

  /**
   * Client-side duplicate check for contact creation (matches web PeoplePage logic).
   * Checks displayName + phone number match against active contacts.
   * Returns the matching contact or undefined.
   */
  findLocalDuplicate(
    displayName: string,
    phoneNumbers: string[],
    mobilePhone: string,
    allContacts: Contact[],
  ): Contact | undefined {
    const newName = (displayName || '').toLowerCase().trim();
    const newPhones = [...phoneNumbers, mobilePhone]
      .map(normalizePhone)
      .filter((p) => p.length > 0);

    return allContacts.find((c) => {
      if (c.isDeleted) return false;
      const cName = (c.displayName || '').toLowerCase().trim();
      if (cName !== newName) return false;
      const existingPhones = [...(c.phoneNumbers || []), c.mobilePhone || '']
        .map(normalizePhone)
        .filter((p) => p.length > 0);
      return newPhones.some((np) => existingPhones.includes(np));
    });
  },
};
