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
  placeholder: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  // Chat specific
  userBubble: string;
  assistantBubble: string;
  inputBg: string;
  sidebar: string;
  // Chat input box
  chatInputBg: string;
  chatInputBorder: string;
  chatInputButtonBg: string;
  chatInputButtonBorder: string;
  chatInputButtonIcon: string;
  // Logo text
  logoText: string;
  // Menu hover
  menuItemHover: string;
}

// Dark Theme (Default - ChatGPT-style)
export const darkColors: ColorScheme = {
  primary: '#ffbd59',      // ChatGPT green accent
  secondary: '#19c37d',    // Lighter green
  accent: '#ffbd59',       // Green accent
  background: '#000000',   // Black background
  surface: '#2f2f2f',      // Slightly lighter surface
  surfaceHover: '#3f3f3f', // Hover state
  text: '#ececec',         // Light text
  textSecondary: '#8e8e8e', // Muted text
  placeholder: '#8e8e8e',  // Placeholder text (same as textSecondary for dark)
  border: '#3f3f3f',       // Dark border
  error: '#ef4444',
  success: '#ffbd59',
  warning: '#f59e0b',
  // Chat specific
  userBubble: '#ffbd59',   // Green for user messages
  assistantBubble: '#2f2f2f', // Dark for assistant
  inputBg: '#3f3f3f',      // Input background
  sidebar: '#171717',      // Darker sidebar
  // Chat input box
  chatInputBg: '#5a5a5a',      // Dark input background
  chatInputBorder: '#5a5a5a',  // Dark input border
  chatInputButtonBg: '#6b6b6b',    // Button background
  chatInputButtonBorder: '#7b7b7b', // Button border
  chatInputButtonIcon: '#ffffff',  // Button icon color (white)
  // Logo text
  logoText: '#ffffff',         // White for dark theme
  // Menu hover
  menuItemHover: '#3f3f3f',    // Dark hover background
};

// Light Theme
export const lightColors: ColorScheme = {
  primary: '#ffbd59',      // ChatGPT green accent (kept consistent)
  secondary: '#19c37d',    // Lighter green
  accent: '#ffbd59',       // Green accent
  background: '#ffffff',   // White background
  surface: '#f7f7f8',      // Light gray surface
  surfaceHover: '#ececf1', // Hover state
  text: '#0d0d0d',         // Dark text
  textSecondary: '#6e6e80', // Muted text
  placeholder: '#777777',  // Placeholder text (visible on light backgrounds)
  border: '#d9d9e3',       // Light border
  error: '#ef4444',
  success: '#ffbd59',
  warning: '#f59e0b',
  // Chat specific
  userBubble: '#ffbd59',   // Green for user messages
  assistantBubble: '#f7f7f8', // Light gray for assistant
  inputBg: '#ffffff',      // White input background
  sidebar: '#f9f9f9',      // Light sidebar
  // Chat input box
  chatInputBg: '#f9f9f9',      // Light input background
  chatInputBorder: '#d9d9e3',  // Light input border
  chatInputButtonBg: '#d9d9e3',    // Button background
  chatInputButtonBorder: '#b9b9b9', // Button border
  chatInputButtonIcon: '#6e6e80',  // Button icon color (gray)
  // Logo text
  logoText: '#cccccc',         // Gray for light theme
  // Menu hover
  menuItemHover: '#eeeeee',    // Light hover background
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
