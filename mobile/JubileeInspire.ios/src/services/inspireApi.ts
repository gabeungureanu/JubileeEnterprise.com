/**
 * Jubilee Inspire - Inspire API Service
 *
 * Handles AI chat, Bible study, and content operations.
 * Inspire is the AI assistant service for Scripture-centered conversations.
 */

import HttpClient from './httpClient';
import { config } from '../config';
import { ApiResponse, ChatMessage, Conversation } from '../types';

// Initialize HTTP client with Inspire API URL
const client = new HttpClient(config.inspireApiUrl);

// Chat Request/Response Types
interface SendMessageRequest {
  conversationId?: string;
  message: string;
  context?: string;
}

interface SendMessageResponse {
  conversationId: string;
  message: ChatMessage;
}

interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Inspire API Service
 */
export const inspireApi = {
  /**
   * Send a message to the AI assistant
   */
  async sendMessage(
    message: string,
    conversationId?: string,
    context?: string
  ): Promise<ApiResponse<SendMessageResponse>> {
    return client.post<SendMessageResponse>('/chat/message', {
      message,
      conversationId,
      context,
    } as SendMessageRequest);
  },

  /**
   * Get conversation history
   */
  async getConversation(conversationId: string): Promise<ApiResponse<Conversation>> {
    return client.get<Conversation>(`/chat/conversations/${conversationId}`);
  },

  /**
   * List all conversations for the current user
   */
  async listConversations(page = 1, pageSize = 20): Promise<ApiResponse<ConversationListResponse>> {
    return client.get<ConversationListResponse>(
      `/chat/conversations?page=${page}&pageSize=${pageSize}`
    );
  },

  /**
   * Create a new conversation
   */
  async createConversation(title?: string): Promise<ApiResponse<Conversation>> {
    return client.post<Conversation>('/chat/conversations', { title });
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<ApiResponse<void>> {
    return client.delete<void>(`/chat/conversations/${conversationId}`);
  },

  /**
   * Search the Bible
   */
  async searchBible(query: string, translation = 'kjv'): Promise<ApiResponse<unknown>> {
    return client.get<unknown>(
      `/bible/search?q=${encodeURIComponent(query)}&translation=${translation}`
    );
  },

  /**
   * Get a Bible passage
   */
  async getBiblePassage(
    book: string,
    chapter: number,
    verses?: string,
    translation = 'kjv'
  ): Promise<ApiResponse<unknown>> {
    const versesParam = verses ? `&verses=${verses}` : '';
    return client.get<unknown>(
      `/bible/passage?book=${encodeURIComponent(book)}&chapter=${chapter}${versesParam}&translation=${translation}`
    );
  },

  /**
   * Set the auth token (forwarded from Codex)
   */
  setAuthToken(token: string | null): void {
    client.setAuthToken(token);
  },
};

export default inspireApi;
