/**
 * Jubilee Inspire - Configuration Exports
 */

export { config, isDevelopment, isProduction } from './environment';
export type { EnvironmentConfig } from '../types';

// App Constants
export const APP_NAME = 'Jubilee Inspire';
export const APP_VERSION = '1.0.0';

// Theme Colors - Dark Theme (ChatGPT-style)
export const colors = {
  primary: '#10a37f',      // ChatGPT green accent
  secondary: '#19c37d',    // Lighter green
  accent: '#10a37f',       // Green accent
  background: '#212121',   // Dark background
  surface: '#2f2f2f',      // Slightly lighter surface
  surfaceHover: '#3f3f3f', // Hover state
  text: '#ececec',         // Light text
  textSecondary: '#8e8e8e', // Muted text
  border: '#3f3f3f',       // Dark border
  error: '#ef4444',
  success: '#10a37f',
  warning: '#f59e0b',
  // Chat specific
  userBubble: '#10a37f',   // Green for user messages
  assistantBubble: '#2f2f2f', // Dark for assistant
  inputBg: '#3f3f3f',      // Input background
  sidebar: '#171717',      // Darker sidebar
};

// Typography
export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
};

// Spacing
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
};
