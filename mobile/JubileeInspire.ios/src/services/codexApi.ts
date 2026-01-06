/**
 * Jubilee Inspire - Codex API Service
 *
 * Handles authentication, identity, and RBAC operations.
 * Codex is the identity and authentication service for Jubilee Solutions.
 */

import HttpClient from './httpClient';
import { config } from '../config';
import { ApiResponse, User, AuthTokens } from '../types';

// Initialize HTTP client with Codex API URL
const client = new HttpClient(config.codexApiUrl);

// Auth Request/Response Types
interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

/**
 * Codex API Service
 */
export const codexApi = {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const response = await client.post<LoginResponse>('/auth/login', {
      email,
      password,
    } as LoginRequest);

    if (response.success && response.data) {
      client.setAuthToken(response.data.tokens.accessToken);
    }

    return response;
  },

  /**
   * Register a new user
   */
  async register(email: string, password: string, displayName: string): Promise<ApiResponse<LoginResponse>> {
    const response = await client.post<LoginResponse>('/auth/register', {
      email,
      password,
      displayName,
    } as RegisterRequest);

    if (response.success && response.data) {
      client.setAuthToken(response.data.tokens.accessToken);
    }

    return response;
  },

  /**
   * Logout the current user
   */
  async logout(): Promise<ApiResponse<void>> {
    const response = await client.post<void>('/auth/logout');
    client.setAuthToken(null);
    return response;
  },

  /**
   * Refresh the authentication token
   */
  async refreshToken(refreshToken: string): Promise<ApiResponse<AuthTokens>> {
    const response = await client.post<AuthTokens>('/auth/refresh', {
      refreshToken,
    });

    if (response.success && response.data) {
      client.setAuthToken(response.data.accessToken);
    }

    return response;
  },

  /**
   * Get the current user's profile
   */
  async getProfile(): Promise<ApiResponse<User>> {
    return client.get<User>('/users/me');
  },

  /**
   * Update the current user's profile
   */
  async updateProfile(updates: Partial<User>): Promise<ApiResponse<User>> {
    return client.patch<User>('/users/me', updates);
  },

  /**
   * Set the auth token directly (for restoring sessions)
   */
  setAuthToken(token: string | null): void {
    client.setAuthToken(token);
  },
};

export default codexApi;
