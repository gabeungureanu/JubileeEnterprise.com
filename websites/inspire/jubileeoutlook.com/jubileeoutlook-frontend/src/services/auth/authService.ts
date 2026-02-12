import apiClient from '../apiClient';
import { ApiResponse, User } from '../../types/common';

export const authService = {
  async login(email: string, password: string): Promise<ApiResponse<{ token: string; user: User }>> {
    const response = await apiClient.post('/api/auth/login', { email, password });
    if (response.data.success && response.data.data.token) {
      localStorage.setItem('authToken', response.data.data.token);
    }
    return response.data;
  },

  async logout(): Promise<void> {
    localStorage.removeItem('authToken');
  },

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  },
};
