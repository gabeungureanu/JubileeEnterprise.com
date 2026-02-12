export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  emailAddresses: ContactEmail[];
  phoneNumbers: ContactPhone[];
  organization: string;
  jobTitle: string;
  birthday: string | null;
  anniversary: string | null;
  avatarUrl: string | null;
  notes: string;
  isFavorite: boolean;
  groups: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactEmail {
  type: 'personal' | 'work' | 'other';
  address: string;
  isPrimary: boolean;
}

export interface ContactPhone {
  type: 'mobile' | 'home' | 'work' | 'other';
  number: string;
  isPrimary: boolean;
}

export interface ContactGroup {
  id: string;
  name: string;
  memberCount: number;
}

export interface ContactFormData {
  firstName: string;
  lastName: string;
  displayName: string;
  emailAddresses: ContactEmail[];
  phoneNumbers: ContactPhone[];
  organization: string;
  jobTitle: string;
  birthday: string | null;
  anniversary: string | null;
  notes: string;
  groups: string[];
}
