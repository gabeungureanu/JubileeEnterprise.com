// --- API DTO shapes (camelCase from InspireCodex) ---

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

// --- Frontend display types ---

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
  notes: string;
  photoUrl: string;
  birthday: string | null;
  anniversary: string | null;
  isFavorite: boolean;
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

// --- Mappers ---

export function mapContactDto(dto: ContactDto): Contact {
  return {
    id: dto.id,
    displayName: dto.display_name,
    firstName: dto.first_name,
    lastName: dto.last_name,
    title: dto.title,
    emailAddresses: dto.email_addresses || [],
    phoneNumbers: dto.phone_numbers || [],
    mobilePhone: dto.mobile_phone,
    company: dto.company,
    jobTitle: dto.job_title,
    department: dto.department,
    notes: dto.notes,
    photoUrl: dto.photo_url,
    birthday: dto.birthday,
    anniversary: dto.anniversary,
    isFavorite: dto.is_favorite,
    category: dto.category,
    website: dto.website,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function mapContactGroupDto(dto: ContactGroupDto): ContactGroup {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    memberCount: dto.member_count,
  };
}
