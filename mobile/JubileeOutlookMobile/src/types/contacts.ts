/**
 * Contact types — mirrors web frontend src/types/contacts/index.ts
 */

export interface Contact {
  id: string;
  userId: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  emailAddresses: string[];
  phoneNumbers: string[];
  mobilePhone?: string;
  company?: string;
  jobTitle?: string;
  department?: string;
  office?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  photoUrl?: string;
  website?: string;
  birthday?: string;
  anniversary?: string;
  spouse?: string;
  isFavorite: boolean;
  isDeleted: boolean;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactGroup {
  id: string;
  userId: string;
  name: string;
  description?: string;
  memberCount?: number;
  members?: Contact[];
  createdAt: string;
}

export interface CreateContactPayload {
  userId: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  emailAddresses?: string[];
  phoneNumbers?: string[];
  mobilePhone?: string;
  company?: string;
  jobTitle?: string;
  department?: string;
  office?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  website?: string;
  birthday?: string;
  anniversary?: string;
  spouse?: string;
  category?: string;
}

export interface UpdateContactPayload extends Partial<CreateContactPayload> {
  isFavorite?: boolean;
}
