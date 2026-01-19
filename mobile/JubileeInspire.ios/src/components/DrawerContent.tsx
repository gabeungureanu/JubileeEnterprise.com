/**
 * Jubilee Inspire - Drawer Content Component
 *
 * Sidebar with conversation history, like ChatGPT.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { spacing, typography } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { useDrawer } from '../contexts/DrawerContext';
import { Conversation } from '../types';
import ConversationItem from './ConversationItem';
import SettingsModal from './SettingsModal';
import { storage } from '../services/storage';

const DrawerContent: React.FC<DrawerContentComponentProps> = ({ navigation: drawerNavigation }) => {
  const { colors } = useTheme();
  const { isCollapsed, setIsCollapsed, toggleCollapse, isMobileView } = useDrawer();

  const navigation = useNavigation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pendingConversation, setPendingConversation] = useState<Conversation | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Menu state - controlled centrally to allow switching between menus with single click
  const [openMenuConversationId, setOpenMenuConversationId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const styles = createStyles(colors, isCollapsed, isMobileView);

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
    // Only close drawer automatically on non-mobile views
    if (!isMobileView) {
      drawerNavigation.closeDrawer();
    }

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
    // Only close drawer automatically on non-mobile views
    if (!isMobileView) {
      drawerNavigation.closeDrawer();
    }
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
    // Show the settings modal instead of navigating to a separate screen
    setShowSettingsModal(true);
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

  // Menu handlers for centralized control
  const handleMenuOpen = (conversationId: string, position: { top: number; left: number }) => {
    setOpenMenuConversationId(conversationId);
    setHoveredMenuItem(null); // Reset hover state when opening new menu

    // Get window dimensions for smart positioning
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const menuHeight = 280; // Approximate menu height
    const padding = 10; // Minimum padding from edges

    // Adjust position: 25px lower than original
    let adjustedTop = position.top + 25;

    // Check if menu would overflow at the bottom
    if (adjustedTop + menuHeight > windowHeight - padding) {
      // Open upward instead: position above the trigger point
      adjustedTop = position.top - menuHeight - 25;
    }

    // Ensure menu doesn't go above the top edge
    if (adjustedTop < padding) {
      adjustedTop = padding;
    }

    setMenuPosition({ top: adjustedTop, left: position.left });
  };

  const handleMenuClose = () => {
    setOpenMenuConversationId(null);
    setHoveredMenuItem(null);
  };

  // Get the conversation for the open menu
  const openMenuConversation = useMemo(() => {
    if (!openMenuConversationId) return null;
    return [...conversations, pendingConversation].find(c => c?.id === openMenuConversationId) || null;
  }, [openMenuConversationId, conversations, pendingConversation]);

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversations;
    }

    const query = searchQuery.toLowerCase().trim();
    return conversations.filter(conv => {
      // Search in title
      if (conv.title.toLowerCase().includes(query)) {
        return true;
      }
      // Search in preview (last message)
      if (conv.preview && conv.preview.toLowerCase().includes(query)) {
        return true;
      }
      return false;
    });
  }, [conversations, searchQuery]);

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

  const groupedConversations = groupConversationsByDate(filteredConversations);

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    // Only unfocus if search is empty
    if (!searchQuery) {
      setIsSearchFocused(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearchFocused(false);
    searchInputRef.current?.blur();
  };

  const handleImages = () => {
    console.log('[DrawerContent] Images');
    // TODO: Implement images functionality
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with collapse toggle (desktop) or close button (mobile) */}
      <View style={styles.header}>
        {isMobileView ? (
          // Mobile: show close button to dismiss drawer
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={() => drawerNavigation.closeDrawer()}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          // Desktop: show collapse/expand toggle
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
        )}
      </View>

      {/* Menu Options - always show expanded menu on mobile */}
      {!isMobileView && isCollapsed ? (
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
            onPress={() => {
              setIsCollapsed(false);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
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

          {/* Search Input */}
          <View style={[
            styles.searchContainer,
            isSearchFocused && styles.searchContainerFocused,
            { borderColor: isSearchFocused ? colors.primary : colors.border }
          ]}>
            <Ionicons
              name="search-outline"
              size={18}
              color={isSearchFocused ? colors.primary : colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search chats"
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={handleImages}>
            <Ionicons name="image-outline" size={20} color={colors.text} />
            <Text style={styles.menuText}>Images</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Conversation List - Only show in expanded state */}
      {!isCollapsed ? (
        <>
          {/* Search Results Header */}
          {searchQuery.trim() && (
            <View style={styles.searchResultsHeader}>
              <Text style={[styles.searchResultsText, { color: colors.textSecondary }]}>
                {filteredConversations.length === 0
                  ? 'No results found'
                  : `${filteredConversations.length} result${filteredConversations.length !== 1 ? 's' : ''} for "${searchQuery}"`
                }
              </Text>
              <TouchableOpacity onPress={handleClearSearch}>
                <Text style={[styles.clearSearchText, { color: colors.primary }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.conversationList} showsVerticalScrollIndicator={false}>
            {/* Show existing conversations or empty state */}
            {groupedConversations.length === 0 ? (
              searchQuery.trim() ? (
                // Empty search results
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color={colors.border} />
                  <Text style={styles.emptyText}>No matching chats</Text>
                  <Text style={styles.emptySubtext}>Try a different search term</Text>
                </View>
              ) : (
                // No conversations at all
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
                  <Text style={styles.emptyText}>No conversations yet</Text>
                  <Text style={styles.emptySubtext}>Start a new chat to begin</Text>
                </View>
              )
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
                      searchQuery={searchQuery}
                      isMenuOpen={openMenuConversationId === conversation.id}
                      onMenuOpen={(position) => handleMenuOpen(conversation.id, position)}
                      onMenuClose={handleMenuClose}
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

      {/* Centralized Options Menu Modal */}
      <Modal
        visible={!!openMenuConversationId}
        transparent={true}
        animationType="fade"
        onRequestClose={handleMenuClose}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={handleMenuClose}
        >
          <View style={[
            styles.menuContent,
            { position: 'absolute', top: menuPosition.top, left: menuPosition.left }
          ]}>
            <TouchableOpacity
              style={[styles.optionsMenuItem, hoveredMenuItem === 'share' && styles.menuItemHovered]}
              onPress={() => {
                handleMenuClose();
                // Share functionality would go here
              }}
              {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setHoveredMenuItem('share'),
                onMouseLeave: () => setHoveredMenuItem(null),
              } as any : {})}
            >
              <Ionicons name="share-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionsMenuItem, hoveredMenuItem === 'group' && styles.menuItemHovered]}
              onPress={() => {
                handleMenuClose();
                // Group chat functionality
              }}
              {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setHoveredMenuItem('group'),
                onMouseLeave: () => setHoveredMenuItem(null),
              } as any : {})}
            >
              <Ionicons name="people-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Start a group chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionsMenuItem, hoveredMenuItem === 'rename' && styles.menuItemHovered]}
              onPress={() => {
                if (openMenuConversationId) {
                  handleMenuClose();
                  handleStartEditing(openMenuConversationId);
                }
              }}
              {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setHoveredMenuItem('rename'),
                onMouseLeave: () => setHoveredMenuItem(null),
              } as any : {})}
            >
              <Ionicons name="create-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Rename</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionsMenuItem, hoveredMenuItem === 'pin' && styles.menuItemHovered]}
              onPress={() => {
                if (openMenuConversationId) {
                  handleMenuClose();
                  handlePinToggle(openMenuConversationId);
                }
              }}
              {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setHoveredMenuItem('pin'),
                onMouseLeave: () => setHoveredMenuItem(null),
              } as any : {})}
            >
              <Ionicons
                name={openMenuConversation?.isPinned ? "pin" : "pin-outline"}
                size={20}
                color={colors.text}
              />
              <Text style={styles.menuItemText}>
                {openMenuConversation?.isPinned ? 'Unpin chat' : 'Pin chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionsMenuItem, hoveredMenuItem === 'archive' && styles.menuItemHovered]}
              onPress={() => {
                handleMenuClose();
                // Archive functionality
              }}
              {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setHoveredMenuItem('archive'),
                onMouseLeave: () => setHoveredMenuItem(null),
              } as any : {})}
            >
              <Ionicons name="archive-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Archive</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={[styles.optionsMenuItem, hoveredMenuItem === 'delete' && styles.menuItemHovered]}
              onPress={() => {
                if (openMenuConversationId) {
                  handleMenuClose();
                  handleDeleteConversation(openMenuConversationId);
                }
              }}
              {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setHoveredMenuItem('delete'),
                onMouseLeave: () => setHoveredMenuItem(null),
              } as any : {})}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={[styles.menuItemText, styles.deleteText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onNavigateToAuth={() => {
          setShowSettingsModal(false);
          drawerNavigation.navigate('HomeStack', {
            screen: 'Auth'
          } as any);
        }}
        onClearHistory={() => {
          setShowSettingsModal(false);
          // Navigate to new chat after clearing history
          drawerNavigation.navigate('HomeStack', {
            screen: 'Chat',
            params: {
              conversationId: undefined,
              timestamp: Date.now()
            }
          } as any);
          // Reload conversations
          setTimeout(() => {
            loadConversations();
          }, 500);
        }}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: any, isCollapsed: boolean, isMobileView: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.sidebar,
    // On mobile view, always use full width; on desktop, use collapsed or full width
    width: isMobileView ? '100%' : (isCollapsed ? 56 : '100%'),
    // Right border visible in both collapsed and expanded modes
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    // On mobile: left-align close button; on desktop: center when collapsed, right when expanded
    justifyContent: isMobileView ? 'flex-start' : (isCollapsed ? 'center' : 'flex-end'),
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
  // Search styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginVertical: spacing.xs,
  },
  searchContainerFocused: {
    borderWidth: 1.5,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    paddingVertical: spacing.xs,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
      default: {},
    }),
  },
  clearButton: {
    padding: spacing.xs,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchResultsText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
  },
  clearSearchText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
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
    ...Platform.select({
      web: {
        whiteSpace: 'nowrap',
      },
    }),
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
  // Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContent: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: spacing.xs,
    minWidth: 200,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  optionsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  menuItemHovered: {
    backgroundColor: colors.menuItemHover,
  },
  menuItemText: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: '400',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  deleteText: {
    color: '#ef4444',
  },
});

export default DrawerContent;
