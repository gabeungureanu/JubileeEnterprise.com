/**
 * Jubilee Inspire - Local Storage Service
 *
 * Handles persistent storage of conversations and settings.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Conversation, ChatMessage } from '../types';

const STORAGE_KEYS = {
  CONVERSATIONS: '@jubilee_inspire_conversations',
  CURRENT_CONVERSATION: '@jubilee_inspire_current',
  USER_SETTINGS: '@jubilee_inspire_settings',
};

/**
 * Storage Service for managing local data persistence
 */
export const storage = {
  /**
   * Save all conversations
   */
  async saveConversations(conversations: Conversation[]): Promise<void> {
    try {
      const data = JSON.stringify(conversations);
      await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, data);
    } catch (error) {
      console.error('Failed to save conversations:', error);
    }
  },

  /**
   * Load all conversations
   */
  async loadConversations(): Promise<Conversation[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      if (data) {
        const conversations = JSON.parse(data) as Conversation[];
        // Convert date strings back to Date objects
        return conversations.map(conv => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to load conversations:', error);
      return [];
    }
  },

  /**
   * Save a single conversation (updates or creates)
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    try {
      const conversations = await this.loadConversations();
      const index = conversations.findIndex(c => c.id === conversation.id);

      if (index >= 0) {
        conversations[index] = conversation;
      } else {
        conversations.unshift(conversation);
      }

      await this.saveConversations(conversations);
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const conversations = await this.loadConversations();
      const filtered = conversations.filter(c => c.id !== conversationId);
      await this.saveConversations(filtered);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  },

  /**
   * Get a single conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const conversations = await this.loadConversations();
      return conversations.find(c => c.id === conversationId) || null;
    } catch (error) {
      console.error('Failed to get conversation:', error);
      return null;
    }
  },

  /**
   * Add a message to a conversation
   */
  async addMessage(conversationId: string, message: ChatMessage): Promise<void> {
    try {
      const conversation = await this.getConversation(conversationId);
      if (conversation) {
        conversation.messages.push(message);
        conversation.updatedAt = new Date();
        // Update preview with first user message
        if (message.role === 'user' && !conversation.preview) {
          conversation.preview = message.content.substring(0, 50);
        }
        await this.saveConversation(conversation);
      }
    } catch (error) {
      console.error('Failed to add message:', error);
    }
  },

  /**
   * Update a message in a conversation
   */
  async updateMessage(
    conversationId: string,
    messageId: string,
    updates: Partial<ChatMessage>
  ): Promise<void> {
    try {
      const conversation = await this.getConversation(conversationId);
      if (conversation) {
        const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
        if (messageIndex >= 0) {
          conversation.messages[messageIndex] = {
            ...conversation.messages[messageIndex],
            ...updates,
          };
          await this.saveConversation(conversation);
        }
      }
    } catch (error) {
      console.error('Failed to update message:', error);
    }
  },

  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.CONVERSATIONS,
        STORAGE_KEYS.CURRENT_CONVERSATION,
        STORAGE_KEYS.USER_SETTINGS,
      ]);
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  },

  /**
   * Create a new conversation
   */
  createNewConversation(): Conversation {
    const now = new Date();
    return {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: 'New Conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Generate a title from the first message
   */
  generateTitle(firstMessage: string): string {
    const maxLength = 40;
    const cleaned = firstMessage.trim().replace(/\n/g, ' ');
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    return cleaned.substring(0, maxLength - 3) + '...';
  },
};

export default storage;
