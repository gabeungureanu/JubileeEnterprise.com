/**
 * Auth Service — mirrors web frontend src/services/auth/authService.ts
 */
import { codexClient, tokenStore } from '../apiClient';
import type { User, LoginResponse } from '../../types';

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await codexClient.post('/auth/login', { email, password });
    const response = data.data || data;

    await tokenStore.setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    await tokenStore.setUserId(response.user.id);

    return response;
  },

  async register(
    fullName: string,
    email: string,
    password: string,
    newsletter: boolean = false
  ): Promise<LoginResponse> {
    const { data } = await codexClient.post('/auth/register', {
      fullName,
      email,
      password,
      newsletter,
    });
    const response = data.data || data;

    await tokenStore.setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    await tokenStore.setUserId(response.user.id);

    return response;
  },

  async oauthRegister(provider: string, token: string): Promise<LoginResponse> {
    const { data } = await codexClient.post('/auth/oauth-register', { provider, token });
    const response = data.data || data;

    await tokenStore.setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    await tokenStore.setUserId(response.user.id);

    return response;
  },

  async getCurrentUser(): Promise<User> {
    const { data } = await codexClient.get('/auth/me');
    return data.data || data;
  },

  async logout(): Promise<void> {
    try {
      await codexClient.post('/auth/logout');
    } catch {
      // Fire-and-forget — clear tokens regardless
    }
    await tokenStore.clear();
  },

  async forgotPassword(email: string): Promise<void> {
    await codexClient.post('/auth/forgot-password', { email });
  },

  async verifyResetCode(email: string, code: string): Promise<void> {
    await codexClient.post('/auth/verify-reset-code', { email, code });
  },

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    await codexClient.post('/auth/reset-password', { email, code, newPassword });
  },

  isAuthenticated(): boolean {
    return !!tokenStore.getAccessToken() && !!tokenStore.getUserId();
  },
};
