/**
 * Jubilee Inspire - Drawer Content Component
 *
 * Sidebar with conversation history, like ChatGPT.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { spacing, typography } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { Conversation } from '../types';
import ConversationItem from './ConversationItem';
import { storage } from '../services/storage';

const DrawerContent: React.FC<DrawerContentComponentProps> = ({ navigation: drawerNavigation }) => {
  const { colors } = useTheme();

  const navigation = useNavigation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pendingConversation, setPendingConversation] = useState<Conversation | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);

  const styles = createStyles(colors, isCollapsed);

  const loadConversations = useCallback(async () => {
    if (isLoading) return; // Prevent multiple simultaneous loads

    setIsLoading(true);
    console.log('[DrawerContent] Loading conversations...');
    try {
      const loaded = await storage.loadConversations();
      console.log('[DrawerContent] Loaded conversations:', loaded.length);
      setConversations(loaded);

      // Also load pending conversation if it exists
      const pending = await storage.loadPendingConversation();
      if (pending) {
        console.log('[DrawerContent] Found pending conversation:', pending.id);
        setPendingConversation(pending);
      } else {
        setPendingConversation(null);
      }
    } catch (error) {
      console.error('[DrawerContent] Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Load conversations when drawer opens (with debounce)
  useFocusEffect(
    useCallback(() => {
      // Small delay to let drawer animation complete
      const timeoutId = setTimeout(() => {
        loadConversations();
      }, 100);

      return () => clearTimeout(timeoutId);
    }, [loadConversations])
  );

  // Track current conversation from navigation state
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', () => {
      // Get the current route params from navigation state
      const state = navigation.getState();
      const routes = state?.routes;
      if (routes && routes.length > 0) {
        const homeStackRoute = routes.find((r: any) => r.name === 'HomeStack');
        if (homeStackRoute && homeStackRoute.state) {
          const chatRoute = homeStackRoute.state.routes?.find((r: any) => r.name === 'Chat');
          if (chatRoute && chatRoute.params) {
            const convId = (chatRoute.params as any).conversationId;
            const timestamp = (chatRoute.params as any).timestamp;

            // Reload conversations if:
            // 1. Conversation ID changed
            // 2. We have a new timestamp (indicates a forced reload/new conversation)
            // 3. conversationId became undefined (user navigated to new chat)
            if (convId !== currentConversationId || timestamp) {
              console.log('[DrawerContent] Navigation state changed, reloading conversations');
              setCurrentConversationId(convId || null);
              loadConversations();
            }
          }
        }
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId]);

  const handleNewChat = () => {
    // Force navigation by using a unique key for new conversations
    const timestamp = Date.now();
    console.log('[DrawerContent] New Chat clicked, timestamp:', timestamp);
    setCurrentConversationId(null);
    drawerNavigation.navigate('HomeStack', {
      screen: 'Chat',
      params: {
        conversationId: undefined,
        // Add timestamp to force re-render - each click gets unique timestamp
        timestamp
      }
    } as any);
    drawerNavigation.closeDrawer();

    // Reload conversations after a short delay to pick up the new one
    setTimeout(() => {
      loadConversations();
    }, 500);
  };

  const handleConversationPress = (conversation: Conversation) => {
    console.log('[DrawerContent] Conversation clicked:', conversation.id);
    setCurrentConversationId(conversation.id);
    drawerNavigation.navigate('HomeStack', {
      screen: 'Chat',
      params: { conversationId: conversation.id }
    } as any);
    drawerNavigation.closeDrawer();
  };

  const handleDeleteConversation = async (conversationId: string) => {
    // Check if this is the pending conversation
    if (pendingConversation && pendingConversation.id === conversationId) {
      await storage.clearPendingConversation();
      setPendingConversation(null);
    } else {
      await storage.deleteConversation(conversationId);
    }

    await loadConversations();
    if (currentConversationId === conversationId) {
      setCurrentConversationId(null);
      // Navigate to a new conversation after deleting
      handleNewChat();
    }
  };

  const handleSettings = () => {
    drawerNavigation.navigate('HomeStack', {
      screen: 'Settings'
    } as any);
    drawerNavigation.closeDrawer();
  };

  const handlePinToggle = async (conversationId: string) => {
    console.log('[DrawerContent] Toggle pin for conversation:', conversationId);
    try {
      await storage.togglePinConversation(conversationId);
      await loadConversations();
    } catch (error) {
      console.error('[DrawerContent] Error toggling pin:', error);
    }
  };

  const handleRename = async (conversationId: string, newTitle: string) => {
    console.log('[DrawerContent] Rename conversation:', conversationId, 'to:', newTitle);
    try {
      await storage.renameConversation(conversationId, newTitle);
      setEditingConversationId(null);
      await loadConversations();
    } catch (error) {
      console.error('[DrawerContent] Error renaming conversation:', error);
    }
  };

  const handleStartEditing = (conversationId: string) => {
    console.log('[DrawerContent] Start editing conversation:', conversationId);
    setEditingConversationId(conversationId);
  };

  const handleCancelEditing = () => {
    console.log('[DrawerContent] Cancel editing');
    setEditingConversationId(null);
  };

  // Group conversations by date with pinned section first
  const groupConversationsByDate = (convs: Conversation[]) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const groups: { title: string; conversations: Conversation[] }[] = [];

    // Separate pinned and unpinned conversations
    const pinnedConvs = convs
      .filter(c => c.isPinned)
      .sort((a, b) => {
        // Sort pinned by pinnedAt (most recently pinned first)
        const pinnedAtA = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
        const pinnedAtB = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
        return pinnedAtB - pinnedAtA;
      });
    const unpinnedConvs = convs.filter(c => !c.isPinned);

    // Add pinned section first if there are pinned conversations
    if (pinnedConvs.length > 0) {
      groups.push({ title: 'Pinned', conversations: pinnedConvs });
    }

    // Group unpinned conversations by date
    const todayConvs = unpinnedConvs.filter(
      c => new Date(c.updatedAt).toDateString() === today.toDateString()
    );
    const yesterdayConvs = unpinnedConvs.filter(
      c => new Date(c.updatedAt).toDateString() === yesterday.toDateString()
    );
    const weekConvs = unpinnedConvs.filter(c => {
      const date = new Date(c.updatedAt);
      return (
        date > weekAgo &&
        date.toDateString() !== today.toDateString() &&
        date.toDateString() !== yesterday.toDateString()
      );
    });
    const monthConvs = unpinnedConvs.filter(c => {
      const date = new Date(c.updatedAt);
      return date <= weekAgo && date > monthAgo;
    });
    const olderConvs = unpinnedConvs.filter(c => new Date(c.updatedAt) <= monthAgo);

    if (todayConvs.length > 0) groups.push({ title: 'Today', conversations: todayConvs });
    if (yesterdayConvs.length > 0) groups.push({ title: 'Yesterday', conversations: yesterdayConvs });
    if (weekConvs.length > 0) groups.push({ title: 'Previous 7 Days', conversations: weekConvs });
    if (monthConvs.length > 0) groups.push({ title: 'Previous 30 Days', conversations: monthConvs });
    if (olderConvs.length > 0) groups.push({ title: 'Older', conversations: olderConvs });

    return groups;
  };

  const groupedConversations = groupConversationsByDate(conversations);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleSearchChats = () => {
    console.log('[DrawerContent] Search chats');
    // TODO: Implement search functionality
  };

  const handleImages = () => {
    console.log('[DrawerContent] Images');
    // TODO: Implement images functionality
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with collapse toggle */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.collapseButton}
          onPress={toggleCollapse}
        >
          <Ionicons
            name={isCollapsed ? "chevron-forward" : "chevron-back"}
            size={20}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Menu Options */}
      {isCollapsed ? (
        <View style={styles.collapsedMenu}>
          <TouchableOpacity
            style={styles.collapsedMenuItem}
            onPress={handleNewChat}
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setHoveredItem('new-chat'),
              onMouseLeave: () => setHoveredItem(null)
            } as any : {})}
          >
            <Ionicons name="create-outline" size={20} color={colors.text} />
            {hoveredItem === 'new-chat' && Platform.OS === 'web' && (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>New chat</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.collapsedMenuItem}
            onPress={handleSearchChats}
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setHoveredItem('search'),
              onMouseLeave: () => setHoveredItem(null)
            } as any : {})}
          >
            <Ionicons name="search-outline" size={20} color={colors.text} />
            {hoveredItem === 'search' && Platform.OS === 'web' && (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>Search chats</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.collapsedMenuItem}
            onPress={handleImages}
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setHoveredItem('images'),
              onMouseLeave: () => setHoveredItem(null)
            } as any : {})}
          >
            <Ionicons name="image-outline" size={20} color={colors.text} />
            {hoveredItem === 'images' && Platform.OS === 'web' && (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>Images</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.expandedMenu}>
          <TouchableOpacity style={styles.menuItem} onPress={handleNewChat}>
            <Ionicons name="create-outline" size={20} color={colors.text} />
            <Text style={styles.menuText}>New chat</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleSearchChats}>
            <Ionicons name="search-outline" size={20} color={colors.text} />
            <Text style={styles.menuText}>Search chats</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleImages}>
            <Ionicons name="image-outline" size={20} color={colors.text} />
            <Text style={styles.menuText}>Images</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Conversation List - Only show in expanded state */}
      {!isCollapsed ? (
        <>
          <ScrollView style={styles.conversationList} showsVerticalScrollIndicator={false}>
            {/* Show existing conversations or empty state */}
            {groupedConversations.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
                <Text style={styles.emptyText}>No conversations yet</Text>
                <Text style={styles.emptySubtext}>Start a new chat to begin</Text>
              </View>
            ) : (
              groupedConversations.map((group, groupIndex) => (
                <View key={groupIndex} style={styles.group}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.conversations.map(conversation => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isActive={currentConversationId === conversation.id}
                      isEditing={editingConversationId === conversation.id}
                      onPress={() => handleConversationPress(conversation)}
                      onDelete={() => handleDeleteConversation(conversation.id)}
                      onPinToggle={() => handlePinToggle(conversation.id)}
                      onRename={(newTitle) => handleRename(conversation.id, newTitle)}
                      onStartEditing={() => handleStartEditing(conversation.id)}
                      onCancelEditing={handleCancelEditing}
                    />
                  ))}
                </View>
              ))
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerItem} onPress={handleSettings}>
              <Ionicons name="settings-outline" size={22} color={colors.text} />
              <Text style={styles.footerText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        /* Collapsed state - Show settings icon only at bottom */
        <View style={styles.collapsedFooter}>
          <TouchableOpacity
            style={styles.collapsedMenuItem}
            onPress={handleSettings}
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setHoveredItem('settings'),
              onMouseLeave: () => setHoveredItem(null)
            } as any : {})}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text} />
            {hoveredItem === 'settings' && Platform.OS === 'web' && (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>Settings</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const createStyles = (colors: any, isCollapsed: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    width: isCollapsed ? 56 : undefined,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: isCollapsed ? 'center' : 'flex-end',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  newChatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  collapseButton: {
    padding: spacing.xs,
  },
  expandedMenu: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  collapsedMenu: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginVertical: 2,
    gap: spacing.sm,
  },
  collapsedMenuItem: {
    padding: spacing.sm,
    borderRadius: 8,
    marginVertical: 2,
    position: 'relative',
  },
  menuText: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: '400',
  },
  tooltip: {
    position: 'absolute',
    left: '120%',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        whiteSpace: 'nowrap',
      },
    }),
  },
  tooltipText: {
    color: colors.text,
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  newChatText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text,
    fontWeight: '500',
  },
  conversationList: {
    flex: 1,
  },
  group: {
    paddingTop: spacing.md,
  },
  groupTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.sm,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  footerText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text,
  },
  collapsedFooter: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.md,
    alignItems: 'center',
    fontSize: typography.fontSize.base,
    color: colors.text,
  },
});

export default DrawerContent;
