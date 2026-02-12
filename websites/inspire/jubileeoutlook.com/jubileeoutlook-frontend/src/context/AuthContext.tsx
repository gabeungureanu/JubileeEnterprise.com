import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '../types/common';
import { authService } from '../services/auth/authService';
import { tokenStore } from '../services/apiClient';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  register: (fullName: string, email: string, password: string, newsletter?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: authService.isAuthenticated(),
    isLoading: authService.isAuthenticated(),
  });

  useEffect(() => {
    if (state.isAuthenticated && !state.user) {
      authService.getCurrentUser().then((user) => {
        setState((prev) => ({
          ...prev,
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }));
      });
    }
  }, [state.isAuthenticated, state.user]);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean = true) => {
    try {
      const response = await authService.login(email, password);
      if (response.success && response.user) {
        // Store remember me preference
        if (rememberMe) {
          localStorage.setItem('jubilee_remember_email', email);
          localStorage.setItem('jubilee_remember_token', 'true');
        } else {
          localStorage.removeItem('jubilee_remember_email');
          localStorage.removeItem('jubilee_remember_token');
        }
        setState({ user: response.user, isAuthenticated: true, isLoading: false });
        return { success: true };
      }
      return { success: false, error: response.error || 'Login failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string, newsletter: boolean = false) => {
    try {
      const response = await authService.register(fullName, email, password, newsletter);
      if (response.success && response.user) {
        // Auto-save credentials after registration
        localStorage.setItem('jubilee_remember_email', email);
        localStorage.setItem('jubilee_remember_token', 'true');
        setState({ user: response.user, isAuthenticated: true, isLoading: false });
        return { success: true };
      }
      return { success: false, error: response.error || 'Registration failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    localStorage.removeItem('jubilee_remember_email');
    localStorage.removeItem('jubilee_remember_token');
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
