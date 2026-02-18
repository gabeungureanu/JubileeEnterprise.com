/**
 * MailScreen — Main mail screen with drawer-style folder sidebar.
 *
 * Manages local state for folders, messages, and selected folder.
 * Tapping the hamburger icon toggles a FolderList overlay on the left.
 * Pull-to-refresh reloads messages. A FAB opens the Compose screen.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Animated,
  Dimensions,
  Pressable,
  StatusBar,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner, EmptyState, FloatingActionButton } from '../../components/common';
import { MessageListItem } from '../../components/modules/mail/MessageListItem';
import { FolderList } from '../../components/modules/mail/FolderList';
import { useAuth } from '../../context/AuthContext';
import { mailService } from '../../services/mail/mailService';
import type { MailFolder, EmailMessage } from '../../types';
import type { MailStackParamList } from '../../types/navigation';

type MailNav = NativeStackNavigationProp<MailStackParamList, 'MailInbox'>;

const DRAWER_WIDTH = Dimensions.get('window').width * 0.78;

export default function MailScreen() {
  const navigation = useNavigation<MailNav>();
  const { user } = useAuth();

  // ---------- Local State ----------

  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Drawer animation
  const [drawerAnim] = useState(() => new Animated.Value(-DRAWER_WIDTH));

  // ---------- Data Fetching ----------

  const loadFolders = useCallback(async () => {
    try {
      const result = await mailService.getFolders();
      setFolders(result);
      return result;
    } catch (err) {
      console.warn('[MailScreen] loadFolders failed:', err);
      return [];
    }
  }, []);

  const loadMessages = useCallback(
    async (folderId: string) => {
      try {
        const { messages: msgs } = await mailService.getMessages(folderId, 1, 50);
        setMessages(msgs);
      } catch (err) {
        console.warn('[MailScreen] loadMessages failed:', err);
        setMessages([]);
      }
    },
    [],
  );

  // Initial mount: load folders, select inbox, load messages
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      const folderList = await loadFolders();
      if (cancelled || !folderList || folderList.length === 0) {
        setIsLoading(false);
        return;
      }

      // Select the inbox folder by default
      const inbox = folderList.find((f) => f.folderType === 'inbox') || folderList[0];
      setSelectedFolderId(inbox.id);
      await loadMessages(inbox.id);
      setIsLoading(false);
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [loadFolders, loadMessages]);

  // ---------- Refresh ----------

  const handleRefresh = useCallback(async () => {
    if (!selectedFolderId) return;
    setIsRefreshing(true);
    try {
      await loadFolders();
      await loadMessages(selectedFolderId);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedFolderId, loadFolders, loadMessages]);

  // ---------- Sync ----------

  const handleSync = useCallback(async () => {
    try {
      const accounts = await mailService.getAccounts();
      for (const account of accounts) {
        await mailService.syncAccount(account.id);
      }
      Alert.alert('Sync Complete', 'Your mailbox has been synced.');
      await handleRefresh();
    } catch (err) {
      Alert.alert('Sync Failed', 'Could not sync your mailbox. Please try again.');
    }
  }, [handleRefresh]);

  // ---------- Folder Selection ----------

  const handleSelectFolder = useCallback(
    async (folder: MailFolder) => {
      setSelectedFolderId(folder.id);
      setSelectedMessage(null);
      setMessages([]);
      setSearchQuery('');
      closeDrawer();
      setIsLoading(true);
      await loadMessages(folder.id);
      setIsLoading(false);
    },
    [loadMessages],
  );

  // ---------- Drawer ----------

  const openDrawer = useCallback(() => {
    setShowFolders(true);
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [drawerAnim]);

  const closeDrawer = useCallback(() => {
    Animated.timing(drawerAnim, {
      toValue: -DRAWER_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowFolders(false);
    });
  }, [drawerAnim]);

  // ---------- Navigation ----------

  const handleMessagePress = useCallback(
    (message: EmailMessage) => {
      setSelectedMessage(message);
      navigation.navigate('MessageDetail', { messageId: message.id, message });
    },
    [navigation],
  );

  const handleCompose = useCallback(() => {
    navigation.navigate('Compose', { mode: 'new' });
  }, [navigation]);

  const handleSearch = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  // ---------- Flag Toggle ----------

  const handleToggleFlag = useCallback(
    async (message: EmailMessage) => {
      try {
        const newFlagged = !message.isFlagged;
        await mailService.toggleFlag(message.id, newFlagged);
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? { ...m, isFlagged: newFlagged } : m)),
        );
      } catch (err) {
        console.warn('[MailScreen] toggleFlag failed:', err);
      }
    },
    [],
  );

  // ---------- Derived ----------

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const folderName = selectedFolder?.displayName || 'Inbox';

  // ---------- Render ----------

  const renderMessage = useCallback(
    ({ item }: { item: EmailMessage }) => (
      <MessageListItem
        message={item}
        isSelected={selectedMessage?.id === item.id}
        onPress={() => handleMessagePress(item)}
        onToggleFlag={() => handleToggleFlag(item)}
      />
    ),
    [selectedMessage?.id, handleMessagePress, handleToggleFlag],
  );

  const keyExtractor = useCallback((item: EmailMessage) => item.id, []);

  if (isLoading && messages.length === 0) {
    return (
      <View style={styles.screen}>
        <LoadingSpinner fullScreen message="Loading mail..." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.surface} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={openDrawer}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerButton}
        >
          <Icon name="menu" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {folderName}
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleSearch}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerButton}
          >
            <Icon name="search" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSync}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerButton}
          >
            <Icon name="sync" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Message List */}
      {messages.length === 0 && !isLoading ? (
        <EmptyState
          icon="inbox"
          title="No Messages"
          subtitle="This folder is empty"
        />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
              progressBackgroundColor={Colors.surface}
            />
          }
          contentContainerStyle={messages.length === 0 ? styles.emptyList : undefined}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB — Compose */}
      <FloatingActionButton icon="edit" onPress={handleCompose} />

      {/* Drawer Overlay */}
      {showFolders && (
        <View style={StyleSheet.absoluteFill}>
          {/* Scrim */}
          <Pressable style={styles.drawerScrim} onPress={closeDrawer} />

          {/* Drawer panel */}
          <Animated.View
            style={[
              styles.drawerPanel,
              { transform: [{ translateX: drawerAnim }] },
            ]}
          >
            <View style={styles.drawerHeader}>
              <Icon name="mail" size={28} color={Colors.primary} />
              <Text style={styles.drawerHeaderTitle}>Folders</Text>
            </View>
            <FolderList
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={handleSelectFolder}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  headerButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    flex: 1,
    marginHorizontal: Spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  emptyList: {
    flexGrow: 1,
  },
  // Drawer
  drawerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.scrim,
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.surface,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
    gap: Spacing.md,
  },
  drawerHeaderTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
});
