/**
 * API Client — mirrors web frontend src/services/apiClient.ts exactly.
 * Two Axios instances: continuumClient & codexClient.
 * Includes JWT token management with auto-refresh on 401.
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API, StorageKeys } from '../constants';
import { storage } from '../utils/storage';

// ---------- Token Store ----------

let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;
let cachedUserId: string | null = null;

export const tokenStore = {
  async init(): Promise<void> {
    cachedAccessToken = await storage.get(StorageKeys.ACCESS_TOKEN);
    cachedRefreshToken = await storage.get(StorageKeys.REFRESH_TOKEN);
    cachedUserId = await storage.get(StorageKeys.USER_ID);
  },

  getAccessToken: () => cachedAccessToken,
  getRefreshToken: () => cachedRefreshToken,
  getUserId: () => cachedUserId,

  /** Throws if user is not authenticated — use this instead of getUserId() in service calls. */
  requireUserId(): string {
    if (!cachedUserId) {
      throw new Error('User is not authenticated. Please sign in to continue.');
    }
    return cachedUserId;
  },

  async setTokens(access: string, refresh: string): Promise<void> {
    cachedAccessToken = access;
    cachedRefreshToken = refresh;
    await storage.set(StorageKeys.ACCESS_TOKEN, access);
    await storage.set(StorageKeys.REFRESH_TOKEN, refresh);
  },

  async setUserId(userId: string): Promise<void> {
    cachedUserId = userId;
    await storage.set(StorageKeys.USER_ID, userId);
  },

  async clear(): Promise<void> {
    cachedAccessToken = null;
    cachedRefreshToken = null;
    cachedUserId = null;
    await storage.multiRemove([
      StorageKeys.ACCESS_TOKEN,
      StorageKeys.REFRESH_TOKEN,
      StorageKeys.USER_ID,
    ]);
  },
};

// ---------- Request Interceptor ----------

function attachAuth(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = tokenStore.getAccessToken();
  const userId = tokenStore.getUserId();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (userId) {
    config.headers['X-User-Id'] = userId;
  }
  return config;
}

// ---------- Token Refresh Queue ----------

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else if (token) resolve(token);
  });
  refreshQueue = [];
}

let onAuthFailure: (() => void) | null = null;

export function setOnAuthFailure(callback: () => void) {
  onAuthFailure = callback;
}

function setupResponseInterceptor(client: AxiosInstance) {
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(client(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = tokenStore.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(
          `${API.CODEX_BASE_URL}/auth/refresh`,
          { refreshToken }
        );

        const newAccess = data.tokens?.accessToken || data.accessToken;
        const newRefresh = data.tokens?.refreshToken || data.refreshToken || refreshToken;

        await tokenStore.setTokens(newAccess, newRefresh);

        processQueue(null, newAccess);

        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await tokenStore.clear();
        onAuthFailure?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
  );
}

// ---------- Axios Instances ----------

export const continuumClient: AxiosInstance = axios.create({
  baseURL: `${API.CONTINUUM_BASE_URL}/v1`,
  timeout: API.REQUEST_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

export const codexClient: AxiosInstance = axios.create({
  baseURL: API.CODEX_BASE_URL,
  timeout: API.REQUEST_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth headers
continuumClient.interceptors.request.use(attachAuth);
codexClient.interceptors.request.use(attachAuth);

// Attach token refresh
setupResponseInterceptor(continuumClient);
setupResponseInterceptor(codexClient);
