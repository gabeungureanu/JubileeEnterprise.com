/**
 * Jubilee Inspire - Theme Context
 *
 * Global theme state management with AsyncStorage persistence
 * and automatic system theme detection.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, ColorScheme, getColorScheme, darkColors } from '../config/theme';

interface ThemeContextType {
  themeMode: ThemeMode;
  colors: ColorScheme;
  isLoading: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  getThemeDisplayName: () => string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = '@jubilee_inspire:theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme() || 'dark';
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedMode = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedMode && (savedMode === 'system' || savedMode === 'light' || savedMode === 'dark')) {
        setThemeModeState(savedMode as ThemeMode);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const getThemeDisplayName = (): string => {
    if (themeMode === 'system') {
      return `System (${systemColorScheme === 'dark' ? 'Dark' : 'Light'})`;
    }
    return themeMode === 'dark' ? 'Dark' : 'Light';
  };

  // Get the actual color scheme based on theme mode and system preference
  const colors = getColorScheme(themeMode, systemColorScheme);

  const value: ThemeContextType = {
    themeMode,
    colors,
    isLoading,
    setThemeMode,
    getThemeDisplayName,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
