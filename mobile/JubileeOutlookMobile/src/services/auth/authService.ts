/**
 * Auth Service — mirrors web frontend src/services/auth/authService.ts exactly.
 */
import { Platform } from 'react-native';
import { codexClient, tokenStore } from '../apiClient';
import type { User, LoginResponse } from '../../types';

function buildDeviceInfo() {
  return {
    deviceId: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    deviceName: `${Platform.OS} ${Platform.Version}`,
    deviceType: 'mobile',
    platform: Platform.OS,
    platformVersion: String(Platform.Version),
    appName: 'JubileeOutlookMobile',
    appVersion: '1.0.0',
  };
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await codexClient.post<LoginResponse>('/auth/login', {
      email,
      password,
      rememberMe: true,
      deviceInfo: buildDeviceInfo(),
    });

    const data = response.data;
    if (data.success && data.tokens && data.user) {
      await tokenStore.setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      await tokenStore.setUserId(data.user.id);
    }
    return data;
  },

  async register(
    fullName: string,
    email: string,
    password: string,
    newsletter: boolean = false
  ): Promise<LoginResponse> {
    const response = await codexClient.post<LoginResponse>('/auth/register', {
      fullName,
      email,
      password,
      newsletter,
      deviceInfo: buildDeviceInfo(),
    });

    const data = response.data;
    if (data.success && data.tokens && data.user) {
      await tokenStore.setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      await tokenStore.setUserId(data.user.id);
    }
    return data;
  },

  async logout(): Promise<void> {
    try {
      await codexClient.post('/auth/logout');
    } catch {
      // Logout regardless of API response
    }
    await tokenStore.clear();
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await codexClient.get<{ success: boolean; user: User }>('/auth/me');
      return response.data?.user || null;
    } catch {
      return null;
    }
  },

  async forgotPassword(email: string): Promise<boolean> {
    await codexClient.post('/auth/forgot-password', { email });
    return true; // Always returns true for security
  },

  async verifyResetCode(email: string, code: string): Promise<boolean> {
    const response = await codexClient.post('/auth/verify-reset-code', { email, code });
    return response.data?.success === true;
  },

  async resetPassword(email: string, code: string, newPassword: string): Promise<boolean> {
    const response = await codexClient.post('/auth/reset-password', { email, code, newPassword });
    return response.data?.success === true;
  },

  isAuthenticated(): boolean {
    return !!tokenStore.getAccessToken();
  },
};
