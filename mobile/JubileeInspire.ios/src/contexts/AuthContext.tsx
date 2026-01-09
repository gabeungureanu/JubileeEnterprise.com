/**
 * Jubilee Inspire - Authentication Context
 *
 * Global authentication state management with AsyncStorage persistence.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthTokens } from '../types';

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (user: User, tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: '@jubilee_inspire:user',
  TOKENS: '@jubilee_inspire:tokens',
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored authentication on mount
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedUser, storedTokens] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.TOKENS),
      ]);

      if (storedUser && storedTokens) {
        const parsedUser: User = JSON.parse(storedUser);
        const parsedTokens: AuthTokens = JSON.parse(storedTokens);

        // Check if token is expired
        if (parsedTokens.expiresAt > Date.now()) {
          setUser(parsedUser);
          setTokens(parsedTokens);
        } else {
          // Token expired, clear storage
          await clearStorage();
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      await clearStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (newUser: User, newTokens: AuthTokens) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      await AsyncStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(newTokens));

      setUser(newUser);
      setTokens(newTokens);
    } catch (error) {
      console.error('Error storing auth:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await clearStorage();
      setUser(null);
      setTokens(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const updateUser = async (updatedUser: User) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  const clearStorage = async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.TOKENS]);
  };

  const value: AuthContextType = {
    user,
    tokens,
    isLoading,
    isAuthenticated: !!user && !!tokens,
    signIn,
    signOut,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
