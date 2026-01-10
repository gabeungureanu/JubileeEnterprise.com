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
} from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { colors, spacing, typography } from '../config';
import { Conversation } from '../types';
import ConversationItem from './ConversationItem';
import { storage } from '../services/storage';

const DrawerContent: React.FC<DrawerContentComponentProps> = ({ navigation: drawerNavigation }) => {
  const navigation = useNavigation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    if (isLoading) return; // Prevent multiple simultaneous loads

    setIsLoading(true);
    console.log('[DrawerContent] Loading conversations...');
    try {
      const loaded = await storage.loadConversations();
      console.log('[DrawerContent] Loaded conversations:', loaded.length);
      setConversations(loaded);
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
            if (convId && convId !== currentConversationId) {
              console.log('[DrawerContent] Active conversation changed to:', convId);
              setCurrentConversationId(convId);
              // Only reload conversations when conversation actually changes
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
    await storage.deleteConversation(conversationId);
    await loadConversations();
    if (currentConversationId === conversationId) {
      setCurrentConversationId(null);
    }
  };

  const handleSettings = () => {
    drawerNavigation.navigate('HomeStack', {
      screen: 'Settings'
    } as any);
    drawerNavigation.closeDrawer();
  };

  // Group conversations by date
  const groupConversationsByDate = (convs: Conversation[]) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const groups: { title: string; conversations: Conversation[] }[] = [];

    const todayConvs = convs.filter(
      c => new Date(c.updatedAt).toDateString() === today.toDateString()
    );
    const yesterdayConvs = convs.filter(
      c => new Date(c.updatedAt).toDateString() === yesterday.toDateString()
    );
    const weekConvs = convs.filter(c => {
      const date = new Date(c.updatedAt);
      return (
        date > weekAgo &&
        date.toDateString() !== today.toDateString() &&
        date.toDateString() !== yesterday.toDateString()
      );
    });
    const monthConvs = convs.filter(c => {
      const date = new Date(c.updatedAt);
      return date <= weekAgo && date > monthAgo;
    });
    const olderConvs = convs.filter(c => new Date(c.updatedAt) <= monthAgo);

    if (todayConvs.length > 0) groups.push({ title: 'Today', conversations: todayConvs });
    if (yesterdayConvs.length > 0) groups.push({ title: 'Yesterday', conversations: yesterdayConvs });
    if (weekConvs.length > 0) groups.push({ title: 'Previous 7 Days', conversations: weekConvs });
    if (monthConvs.length > 0) groups.push({ title: 'Previous 30 Days', conversations: monthConvs });
    if (olderConvs.length > 0) groups.push({ title: 'Older', conversations: olderConvs });

    return groups;
  };

  const groupedConversations = groupConversationsByDate(conversations);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
          <Ionicons name="add" size={22} color={colors.text} />
          <Text style={styles.newChatText}>New chat</Text>
        </TouchableOpacity>
      </View>

      {/* Conversation List */}
      <ScrollView style={styles.conversationList} showsVerticalScrollIndicator={false}>
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
                  onPress={() => handleConversationPress(conversation)}
                  onDelete={() => handleDeleteConversation(conversation.id)}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171717',  // Dark sidebar
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#2f2f2f',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3f3f3f',
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
    borderTopColor: '#2f2f2f',
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
    fontSize: typography.fontSize.base,
    color: colors.text,
  },
});

export default DrawerContent;
