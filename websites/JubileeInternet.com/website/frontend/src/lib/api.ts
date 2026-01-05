const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ApiError {
  error: string;
  error_description?: string;
  details?: unknown;
}

export interface TLD {
  id: string;
  tld: string;
  displayName: string;
  description: string;
  isRestricted: boolean;
  requiresVerification: boolean;
  pricePerYear: number;
  isActive: boolean;
}

export interface DomainSearchResult {
  name: string;
  tld: string;
  fullDomain: string;
  available: boolean;
  status: 'available' | 'registered' | 'reserved' | 'restricted';
  pricePerYear: number;
  requiresVerification: boolean;
}

export interface DomainSuggestion {
  fullDomain: string;
  name: string;
  tld: string;
  pricePerYear: number;
  reason: 'alternative_tld' | 'variation' | 'synonym';
}

export interface DomainAvailabilityResponse {
  query: string;
  results: DomainSearchResult[];
  suggestions: DomainSuggestion[];
}

export interface Domain {
  id: string;
  name: string;
  tldId: string;
  fullDomain: string;
  ownerId: string;
  status: string;
  registeredAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserDomainsResponse {
  totalDomains: number;
  activeDomains: number;
  expiringSoon: number;
  domains: Domain[];
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error((data as ApiError).error_description || (data as ApiError).error || 'Request failed');
    }

    return data as T;
  }

  // TLDs
  async getTLDs(includeRestricted = false): Promise<{ tlds: TLD[] }> {
    const params = includeRestricted ? '?includeRestricted=true' : '';
    return this.fetch(`/api/domains/tlds${params}`);
  }

  // Domain availability
  async checkAvailability(name: string, tlds?: string[]): Promise<DomainAvailabilityResponse> {
    return this.fetch('/api/domains/check', {
      method: 'POST',
      body: JSON.stringify({ name, tlds }),
    });
  }

  async quickCheck(name: string): Promise<DomainAvailabilityResponse> {
    return this.fetch(`/api/domains/check/${encodeURIComponent(name)}`);
  }

  // Domain registration
  async registerDomain(name: string, tld: string, years = 1, autoRenew = true) {
    return this.fetch('/api/domains/register', {
      method: 'POST',
      body: JSON.stringify({ name, tld, years, autoRenew }),
    });
  }

  // User domains
  async getMyDomains(): Promise<UserDomainsResponse> {
    return this.fetch('/api/domains/my');
  }

  async getDomain(id: string): Promise<{ domain: Domain; history: unknown[] }> {
    return this.fetch(`/api/domains/${id}`);
  }

  async updateDomain(id: string, updates: { autoRenew?: boolean; metadata?: Record<string, unknown> }) {
    return this.fetch(`/api/domains/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async renewDomain(id: string, years = 1) {
    return this.fetch(`/api/domains/${id}/renew`, {
      method: 'POST',
      body: JSON.stringify({ years }),
    });
  }

  // Resolve (for CelestialPaths Browser)
  async resolveDomain(fullDomain: string) {
    return this.fetch(`/api/domains/resolve/${encodeURIComponent(fullDomain)}`);
  }
}

export const api = new ApiClient();
