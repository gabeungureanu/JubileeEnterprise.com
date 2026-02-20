/**
 * Contact types — mirrors web frontend src/types/contacts/index.ts
 */

// --- API DTO shapes (snake_case from InspireCodex) ---

export interface ContactDto {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  title: string;
  middle_name: string;
  suffix: string;
  nickname: string;
  email_addresses: string[];
  phone_numbers: string[];
  mobile_phone: string;
  company: string;
  job_title: string;
  department: string;
  office: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  notes: string;
  photo_url: string;
  birthday: string | null;
  anniversary: string | null;
  spouse: string;
  website: string;
  is_favorite: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  category: string;
  skip_duplicate_check: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiContactsListResponse {
  success: boolean;
  error?: string;
  contacts: ContactDto[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface ContactGroupDto {
  id: string;
  user_id: string;
  name: string;
  description: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface ApiContactGroupsListResponse {
  success: boolean;
  data: ContactGroupDto[];
}

// --- DTO Mappers ---

export function mapContactDto(dto: ContactDto): Contact {
  // API may return camelCase or snake_case — handle both
  const d = dto as any;
  return {
    id: dto.id,
    displayName: d.displayName || dto.display_name || '',
    firstName: d.firstName || dto.first_name || '',
    lastName: d.lastName || dto.last_name || '',
    title: d.title || dto.title || '',
    emailAddresses: d.emailAddresses || dto.email_addresses || [],
    phoneNumbers: d.phoneNumbers || dto.phone_numbers || [],
    mobilePhone: d.mobilePhone || dto.mobile_phone || '',
    company: d.company || dto.company || '',
    jobTitle: d.jobTitle || dto.job_title || '',
    department: d.department || dto.department || '',
    office: d.office || dto.office || '',
    address: d.address || dto.address || '',
    city: d.city || dto.city || '',
    state: d.state || dto.state || '',
    postalCode: d.postalCode || dto.postal_code || '',
    country: d.country || dto.country || '',
    notes: d.notes || dto.notes || '',
    photoUrl: d.photoUrl || dto.photo_url || '',
    birthday: d.birthday ?? dto.birthday,
    anniversary: d.anniversary ?? dto.anniversary,
    spouse: d.spouse || dto.spouse || '',
    isFavorite: d.isFavorite ?? dto.is_favorite ?? false,
    isDeleted: d.isDeleted ?? dto.is_deleted ?? false,
    category: d.category || dto.category || '',
    website: d.website || dto.website || '',
    createdAt: d.createdAt || dto.created_at || '',
    updatedAt: d.updatedAt || dto.updated_at || '',
  };
}

export function mapContactGroupDto(dto: ContactGroupDto): ContactGroup {
  const d = dto as any;
  return {
    id: dto.id,
    name: d.name || dto.name || '',
    description: d.description || dto.description || '',
    memberCount: d.memberCount ?? dto.member_count ?? 0,
  };
}

// --- Frontend display types (mapped from DTOs) ---

export interface Contact {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  title: string;
  emailAddresses: string[];
  phoneNumbers: string[];
  mobilePhone: string;
  company: string;
  jobTitle: string;
  department: string;
  office?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes: string;
  photoUrl: string;
  birthday: string | null;
  anniversary: string | null;
  spouse?: string;
  isFavorite: boolean;
  isDeleted: boolean;
  category: string;
  website: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
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
