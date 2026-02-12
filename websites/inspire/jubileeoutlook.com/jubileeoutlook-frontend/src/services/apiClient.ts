import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'jubilee_access_token';
const REFRESH_TOKEN_KEY = 'jubilee_refresh_token';
const USER_ID_KEY = 'jubilee_user_id';

// --- Token helpers ---
export const tokenStore = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getUserId: () => localStorage.getItem(USER_ID_KEY),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  setUserId: (userId: string) => localStorage.setItem(USER_ID_KEY, userId),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
  },
};

// --- Auth interceptor (shared) ---
const attachAuth = (config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccessToken();
  const userId = tokenStore.getUserId();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (userId) {
    config.headers['X-User-Id'] = userId;
  }
  return config;
};

// --- Token refresh logic ---
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const handleTokenRefresh = async (client: AxiosInstance, error: any) => {
  const originalRequest = error.config;
  if (error.response?.status === 401 && !originalRequest._retry) {
    if (isRefreshing) {
      return new Promise((resolve) => {
        addRefreshSubscriber((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(client(originalRequest));
        });
      });
    }
    originalRequest._retry = true;
    isRefreshing = true;
    try {
      const refreshToken = tokenStore.getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');
      const res = await codexClient.post('/auth/refresh', { refreshToken });
      if (res.data?.success && res.data?.tokens) {
        const { accessToken, refreshToken: newRefresh } = res.data.tokens;
        tokenStore.setTokens(accessToken, newRefresh);
        onRefreshed(accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return client(originalRequest);
      }
      throw new Error('Refresh failed');
    } catch {
      tokenStore.clear();
      window.location.href = '/login';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
  return Promise.reject(error);
};

// --- InspireContinuum Client (Mail & Calendar) ---
export const continuumClient: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_CONTINUUM_API_URL || 'https://inspirecontinuum.com/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

continuumClient.interceptors.request.use(attachAuth, (err) => Promise.reject(err));
continuumClient.interceptors.response.use(
  (res) => res,
  (err) => handleTokenRefresh(continuumClient, err)
);

// --- InspireCodex Client (Contacts & Auth) ---
export const codexClient: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_CODEX_API_URL || 'https://inspirecodex.com/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

codexClient.interceptors.request.use(attachAuth, (err) => Promise.reject(err));
codexClient.interceptors.response.use(
  (res) => res,
  (err) => handleTokenRefresh(codexClient, err)
);

// Default export for backward compat
export default codexClient;
