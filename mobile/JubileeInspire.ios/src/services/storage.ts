/**
 * Jubilee Inspire - Local Storage Service
 *
 * Handles persistent storage of conversations and settings.
 * Supports user-specific storage when logged in.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Conversation, ChatMessage } from '../types';

// Base storage keys prefix
const STORAGE_PREFIX = '@jubilee_inspire';

// Current user ID for user-specific storage
let currentUserId: string | null = null;

/**
 * Get storage keys based on current user
 * Returns user-specific keys if logged in, base keys otherwise
 */
const getStorageKeys = () => {
  const suffix = currentUserId ? `_${currentUserId}` : '';
  return {
    CONVERSATIONS: `${STORAGE_PREFIX}_conversations${suffix}`,
    CURRENT_CONVERSATION: `${STORAGE_PREFIX}_current${suffix}`,
    USER_SETTINGS: `${STORAGE_PREFIX}_settings${suffix}`,
    PENDING_CONVERSATION: `${STORAGE_PREFIX}_pending_conversation${suffix}`,
  };
};

// Legacy keys for backward compatibility (anonymous user data)
const STORAGE_KEYS = {
  CONVERSATIONS: '@jubilee_inspire_conversations',
  CURRENT_CONVERSATION: '@jubilee_inspire_current',
  USER_SETTINGS: '@jubilee_inspire_settings',
  PENDING_CONVERSATION: '@jubilee_inspire_pending_conversation',
};

/**
 * Storage Service for managing local data persistence
 */
export const storage = {
  /**
   * Set the current user ID for user-specific storage
   * Call this when user logs in/out
   */
  setCurrentUser(userId: string | null): void {
    console.log('[Storage] Setting current user:', userId || 'anonymous');
    currentUserId = userId;
  },

  /**
   * Get the current user ID
   */
  getCurrentUser(): string | null {
    return currentUserId;
  },

  /**
   * Check if a user is currently set
   */
  hasCurrentUser(): boolean {
    return currentUserId !== null;
  },

  /**
   * Save all conversations
   */
  async saveConversations(conversations: Conversation[]): Promise<void> {
    try {
      const keys = getStorageKeys();
      const data = JSON.stringify(conversations);
      await AsyncStorage.setItem(keys.CONVERSATIONS, data);
    } catch (error) {
      console.error('Failed to save conversations:', error);
    }
  },

  /**
   * Load all conversations
   */
  async loadConversations(): Promise<Conversation[]> {
    try {
      const keys = getStorageKeys();
      const data = await AsyncStorage.getItem(keys.CONVERSATIONS);
      if (data) {
        const conversations = JSON.parse(data) as Conversation[];
        // Convert date strings back to Date objects
        return conversations.map(conv => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          pinnedAt: conv.pinnedAt ? new Date(conv.pinnedAt) : undefined,
          archivedAt: conv.archivedAt ? new Date(conv.archivedAt) : undefined,
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
   * Clear all data for current user
   */
  async clearAll(): Promise<void> {
    try {
      const keys = getStorageKeys();
      await AsyncStorage.multiRemove([
        keys.CONVERSATIONS,
        keys.CURRENT_CONVERSATION,
        keys.USER_SETTINGS,
        keys.PENDING_CONVERSATION,
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

  /**
   * Save pending conversation (temporary placeholder, not in main list)
   */
  async savePendingConversation(conversation: Conversation): Promise<void> {
    try {
      const keys = getStorageKeys();
      const data = JSON.stringify(conversation);
      await AsyncStorage.setItem(keys.PENDING_CONVERSATION, data);
    } catch (error) {
      console.error('Failed to save pending conversation:', error);
    }
  },

  /**
   * Load pending conversation
   */
  async loadPendingConversation(): Promise<Conversation | null> {
    try {
      const keys = getStorageKeys();
      const data = await AsyncStorage.getItem(keys.PENDING_CONVERSATION);
      if (data) {
        const conversation = JSON.parse(data) as Conversation;
        return {
          ...conversation,
          createdAt: new Date(conversation.createdAt),
          updatedAt: new Date(conversation.updatedAt),
          messages: conversation.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to load pending conversation:', error);
      return null;
    }
  },

  /**
   * Clear pending conversation
   */
  async clearPendingConversation(): Promise<void> {
    try {
      const keys = getStorageKeys();
      await AsyncStorage.removeItem(keys.PENDING_CONVERSATION);
    } catch (error) {
      console.error('Failed to clear pending conversation:', error);
    }
  },

  /**
   * Promote pending conversation to saved conversation
   * This happens when the user sends their first message
   */
  async promotePendingConversation(conversation: Conversation): Promise<void> {
    try {
      // Save to main conversations list
      await this.saveConversation(conversation);
      // Clear the pending conversation
      await this.clearPendingConversation();
    } catch (error) {
      console.error('Failed to promote pending conversation:', error);
    }
  },

  /**
   * Pin a conversation
   * Pinned conversations appear at the top of the chat list
   */
  async pinConversation(conversationId: string): Promise<void> {
    try {
      const conversations = await this.loadConversations();
      const index = conversations.findIndex(c => c.id === conversationId);

      if (index >= 0 && !conversations[index].isPinned) {
        conversations[index] = {
          ...conversations[index],
          isPinned: true,
          pinnedAt: new Date(),
        };
        await this.saveConversations(conversations);
      }
    } catch (error) {
      console.error('Failed to pin conversation:', error);
      throw error;
    }
  },

  /**
   * Unpin a conversation
   */
  async unpinConversation(conversationId: string): Promise<void> {
    try {
      const conversations = await this.loadConversations();
      const index = conversations.findIndex(c => c.id === conversationId);

      if (index >= 0 && conversations[index].isPinned) {
        conversations[index] = {
          ...conversations[index],
          isPinned: false,
          pinnedAt: undefined,
        };
        await this.saveConversations(conversations);
      }
    } catch (error) {
      console.error('Failed to unpin conversation:', error);
      throw error;
    }
  },

  /**
   * Toggle pin state for a conversation
   * Returns the new pinned state
   */
  async togglePinConversation(conversationId: string): Promise<boolean> {
    try {
      const conversation = await this.getConversation(conversationId);
      if (!conversation) return false;

      if (conversation.isPinned) {
        await this.unpinConversation(conversationId);
        return false;
      } else {
        await this.pinConversation(conversationId);
        return true;
      }
    } catch (error) {
      console.error('Failed to toggle pin conversation:', error);
      throw error;
    }
  },

  /**
   * Rename a conversation
   * Updates the title and persists to storage
   */
  async renameConversation(conversationId: string, newTitle: string): Promise<void> {
    try {
      const conversations = await this.loadConversations();
      const index = conversations.findIndex(c => c.id === conversationId);

      if (index >= 0) {
        const trimmedTitle = newTitle.trim();
        if (trimmedTitle.length > 0) {
          conversations[index] = {
            ...conversations[index],
            title: trimmedTitle,
          };
          await this.saveConversations(conversations);
        }
      }
    } catch (error) {
      console.error('Failed to rename conversation:', error);
      throw error;
    }
  },

  /**
   * Archive a conversation
   * Archived conversations are hidden from the main list but not deleted
   */
  async archiveConversation(conversationId: string): Promise<void> {
    try {
      const conversations = await this.loadConversations();
      const index = conversations.findIndex(c => c.id === conversationId);

      if (index >= 0 && !conversations[index].isArchived) {
        conversations[index] = {
          ...conversations[index],
          isArchived: true,
          archivedAt: new Date(),
          // Unpin when archiving
          isPinned: false,
          pinnedAt: undefined,
        };
        await this.saveConversations(conversations);
      }
    } catch (error) {
      console.error('Failed to archive conversation:', error);
      throw error;
    }
  },

  /**
   * Unarchive a conversation
   * Restores the conversation to the main list
   */
  async unarchiveConversation(conversationId: string): Promise<void> {
    try {
      const conversations = await this.loadConversations();
      const index = conversations.findIndex(c => c.id === conversationId);

      if (index >= 0 && conversations[index].isArchived) {
        conversations[index] = {
          ...conversations[index],
          isArchived: false,
          archivedAt: undefined,
        };
        await this.saveConversations(conversations);
      }
    } catch (error) {
      console.error('Failed to unarchive conversation:', error);
      throw error;
    }
  },

  /**
   * Load only active (non-archived) conversations
   */
  async loadActiveConversations(): Promise<Conversation[]> {
    const conversations = await this.loadConversations();
    return conversations.filter(c => !c.isArchived);
  },

  /**
   * Load only archived conversations
   */
  async loadArchivedConversations(): Promise<Conversation[]> {
    const conversations = await this.loadConversations();
    return conversations.filter(c => c.isArchived);
  },
};

export default storage;
