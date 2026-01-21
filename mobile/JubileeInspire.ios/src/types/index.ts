/**
 * Jubilee Inspire - Type Definitions
 */

// Navigation Types
export type RootStackParamList = {
  Main: undefined;
  Chat: { conversationId?: string; timestamp?: number };
  Images: { sessionId?: string; timestamp?: number };
  Settings: undefined;
  Appearance: undefined;
  NewChat: undefined;
  Auth: undefined;
};

export type DrawerParamList = {
  HomeStack: {
    screen: 'Chat' | 'Images' | 'Settings' | 'Appearance' | 'Auth';
    params?: { conversationId?: string; sessionId?: string; timestamp?: number };
  } | undefined;
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
  isPinned?: boolean;
  pinnedAt?: Date;
  isArchived?: boolean;
  archivedAt?: Date;
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

// ============================================================================
// IMAGE TYPES - For Images Tab functionality (similar to ChatGPT Images)
// ============================================================================

// Image generation modes
export type ImageMode = 'generate' | 'analyze' | 'edit';

// Generated/uploaded image item
export interface ImageItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  prompt?: string;
  mode: ImageMode;
  width?: number;
  height?: number;
  createdAt: Date;
  isLocal?: boolean;
  localUri?: string;
}

// Image session (like a conversation but for images)
export interface ImageSession {
  id: string;
  title: string;
  images: ImageItem[];
  messages: ImageMessage[];
  mode: ImageMode;
  createdAt: Date;
  updatedAt: Date;
}

// Message in image session
export interface ImageMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageId?: string;
  timestamp: Date;
}

// Image generation request
export interface ImageGenerateRequest {
  prompt: string;
  style?: 'natural' | 'vivid' | 'artistic';
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

// Image analysis request
export interface ImageAnalyzeRequest {
  imageUrl?: string;
  imageBase64?: string;
  question: string;
}

// Image edit request
export interface ImageEditRequest {
  imageUrl?: string;
  imageBase64?: string;
  instruction: string;
  mask?: string;
}
