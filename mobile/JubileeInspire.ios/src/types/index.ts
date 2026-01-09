/**
 * Jubilee Inspire - Type Definitions
 */

// Navigation Types
export type RootStackParamList = {
  Main: undefined;
  Chat: { conversationId?: string };
  Settings: undefined;
  NewChat: undefined;
  Auth: undefined;
};

export type DrawerParamList = {
  HomeStack: undefined;
};

// Chat Message Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

// User Types
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Conversation Types
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  preview?: string;
}

// Environment Configuration
export interface EnvironmentConfig {
  apiBaseUrl: string;
  codexApiUrl: string;
  inspireApiUrl: string;
  continuumApiUrl: string;
  environment: 'development' | 'staging' | 'production';
}

// App State
export interface AppState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  user: User | null;
}
