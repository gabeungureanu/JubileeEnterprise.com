/**
 * Jubilee Inspire - HTTP Client
 *
 * A centralized HTTP client for making API requests.
 * All API services should use this client for consistency.
 */

import { ApiResponse } from '../types';

interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Set the authentication token for subsequent requests
   */
  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  /**
   * Get the current auth token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Build the full URL for a request
   */
  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${cleanEndpoint}`;
  }

  /**
   * Build headers for a request
   */
  private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers = { ...this.defaultHeaders, ...customHeaders };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Make an HTTP request
   */
  async request<T>(endpoint: string, config: RequestConfig): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const headers = this.buildHeaders(config.headers);

    const fetchConfig: RequestInit = {
      method: config.method,
      headers,
    };

    if (config.body && config.method !== 'GET') {
      fetchConfig.body = JSON.stringify(config.body);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);

      const response = await fetch(url, {
        ...fetchConfig,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || data.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, headers });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body, headers });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body, headers });
  }
}

export default HttpClient;
