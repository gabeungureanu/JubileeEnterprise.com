/**
 * Jubilee Inspire - Theme Configuration
 *
 * Defines light and dark color schemes for the application.
 */

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  // Chat specific
  userBubble: string;
  assistantBubble: string;
  inputBg: string;
  sidebar: string;
}

// Dark Theme (Default - ChatGPT-style)
export const darkColors: ColorScheme = {
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

// Light Theme
export const lightColors: ColorScheme = {
  primary: '#10a37f',      // ChatGPT green accent (kept consistent)
  secondary: '#19c37d',    // Lighter green
  accent: '#10a37f',       // Green accent
  background: '#ffffff',   // White background
  surface: '#f7f7f8',      // Light gray surface
  surfaceHover: '#ececf1', // Hover state
  text: '#0d0d0d',         // Dark text
  textSecondary: '#6e6e80', // Muted text
  border: '#d9d9e3',       // Light border
  error: '#ef4444',
  success: '#10a37f',
  warning: '#f59e0b',
  // Chat specific
  userBubble: '#10a37f',   // Green for user messages
  assistantBubble: '#f7f7f8', // Light gray for assistant
  inputBg: '#ffffff',      // White input background
  sidebar: '#f7f7f8',      // Light sidebar
};

/**
 * Get color scheme based on theme mode and system preference
 */
export const getColorScheme = (
  themeMode: ThemeMode,
  systemColorScheme: 'light' | 'dark'
): ColorScheme => {
  if (themeMode === 'system') {
    return systemColorScheme === 'dark' ? darkColors : lightColors;
  }
  return themeMode === 'dark' ? darkColors : lightColors;
};
