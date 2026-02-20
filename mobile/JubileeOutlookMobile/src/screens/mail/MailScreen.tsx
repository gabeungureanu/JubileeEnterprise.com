/**
 * MailScreen — Main mail screen with two-column sidebar drawer.
 *
 * Manages local state for folders, messages, and selected folder.
 * Tapping the user avatar opens a sidebar with a left icon rail
 * and right folder list. Pull-to-refresh reloads messages.
 * A FAB opens the Compose screen.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  StatusBar,
  Modal,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { LoadingSpinner, EmptyState, FloatingActionButton } from '../../components/common';
import { useAlert } from '../../hooks';
import { SafeScreen } from '../../components/layout/SafeScreen';
import { MessageListItem } from '../../components/modules/mail/MessageListItem';
import { SidebarDrawer } from '../../components/modules/mail/SidebarDrawer';
import { useAuth } from '../../context/AuthContext';
import { mailService } from '../../services/mail/mailService';
import type { MailFolder, EmailMessage } from '../../types';
import type { MailStackParamList } from '../../types/navigation';

type MailNav = NativeStackNavigationProp<MailStackParamList, 'MailInbox'>;

/** Header avatar size. */
const HEADER_AVATAR_SIZE = 32;

const DRAWER_WIDTH = Dimensions.get('window').width * 0.80;

type FocusTab = 'focused' | 'other';
type FilterOption = 'all' | 'unread' | 'flagged' | 'pinned' | 'hasFiles' | 'mentionMe';

const FILTER_OPTIONS: { key: FilterOption; label: string }[] = [
  { key: 'all', label: 'All Messages' },
  { key: 'unread', label: 'Unread' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'pinned', label: 'Pinned' },
  { key: 'hasFiles', label: 'Has Files' },
  { key: 'mentionMe', label: 'Mention Me' },
];

// ---------- Date Grouping Helpers ----------

type DateSection = 'Pinned' | 'This Week' | 'Last Week' | 'This Month' | 'Last Month' | 'Older';

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // shift so Monday=0
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDateSection(receivedAt: string | undefined, now: Date): DateSection {
  if (!receivedAt) return 'Older';
  const msgDate = new Date(receivedAt);

  const thisWeekStart = getStartOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  if (msgDate >= thisWeekStart) return 'This Week';
  if (msgDate >= lastWeekStart) return 'Last Week';
  if (msgDate >= thisMonthStart) return 'This Month';
  if (msgDate >= lastMonthStart) return 'Last Month';
  return 'Older';
}

const SECTION_ORDER: DateSection[] = ['Pinned', 'This Week', 'Last Week', 'This Month', 'Last Month', 'Older'];

function buildSections(messages: EmailMessage[]): { title: string; data: EmailMessage[] }[] {
  // Sort all messages latest first
  const sorted = [...messages].sort((a, b) => {
    const da = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
    const db = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
    return db - da;
  });

  // Partition: pinned messages go to the Pinned section,
  // unpinned messages go into date-based sections (no duplicates)
  const pinned: EmailMessage[] = [];
  const unpinned: EmailMessage[] = [];
  for (const msg of sorted) {
    if (msg.isPinned) pinned.push(msg);
    else unpinned.push(msg);
  }

  const now = new Date();
  const groups = new Map<DateSection, EmailMessage[]>();

  if (pinned.length > 0) {
    groups.set('Pinned', pinned);
  }

  for (const msg of unpinned) {
    const section = getDateSection(msg.receivedAt, now);
    const list = groups.get(section);
    if (list) list.push(msg);
    else groups.set(section, [msg]);
  }

  // Build sections in order, skip empty
  return SECTION_ORDER
    .filter((key) => groups.has(key))
    .map((key) => ({ title: key, data: groups.get(key)! }));
}

export default function MailScreen() {
  const navigation = useNavigation<MailNav>();
  const { user } = useAuth();
  const { alert, toast, AlertComponent } = useAlert();

  // ---------- Local State ----------

  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  // Ref always mirrors latest messages — used by async merge helpers to avoid stale closures
  const messagesRef = useRef<EmailMessage[]>(messages);
  messagesRef.current = messages;
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; email: string }[]>([]);
  const [focusTab, setFocusTab] = useState<FocusTab>('focused');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Selection mode
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const isSelectionMode = selectedIds.size > 0;

  // Filter dropdown position — measured via onLayout
  const [filterDropdownTop, setFilterDropdownTop] = useState(0);

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

      // Load accounts and folders in parallel
      const [folderList, rawAccounts] = await Promise.all([
        loadFolders(),
        mailService.getAccounts().catch(() => []),
      ]);

      if (!cancelled) {
        setAccounts(
          (rawAccounts || []).map((a: { id: string; email_address: string }) => ({
            id: a.id,
            email: a.email_address,
          })),
        );
      }

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

  // Re-fetch messages + folders when screen regains focus (e.g. returning from MessageDetail/Compose)
  // Preserves local read/pin status so opened messages stay read.
  // Also refreshes folders so sidebar unread count stays accurate.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      if (!selectedFolderId) return;
      try {
        // Fetch messages and folders in parallel for speed
        const [{ messages: freshMsgs }] = await Promise.all([
          mailService.getMessages(selectedFolderId, 1, 50),
          loadFolders(),
        ]);
        // Use ref (not closure) so we always read the latest local state
        const prev = messagesRef.current;
        const readIds = new Set(prev.filter((m) => m.isRead).map((m) => m.id));
        const pinnedIds = new Set(prev.filter((m) => m.isPinned).map((m) => m.id));
        const merged = freshMsgs.map((m) => ({
          ...m,
          isRead: readIds.has(m.id) || m.isRead,
          isPinned: pinnedIds.has(m.id) || m.isPinned,
        }));
        setMessages(merged);
      } catch { /* silent */ }
    });
    return unsubscribe;
  }, [navigation, selectedFolderId, loadFolders]); // messagesRef used instead of messages

  // ---------- Refresh ----------

  const handleRefresh = useCallback(async () => {
    if (!selectedFolderId) return;
    setIsRefreshing(true);
    try {
      await loadFolders();
      const { messages: freshMsgs } = await mailService.getMessages(selectedFolderId, 1, 50);
      // Preserve local read/pin status — backend may lag behind optimistic updates
      const prev = messagesRef.current;
      const readIds = new Set(prev.filter((m) => m.isRead).map((m) => m.id));
      const pinnedIds = new Set(prev.filter((m) => m.isPinned).map((m) => m.id));
      const merged = freshMsgs.map((m) => ({
        ...m,
        isRead: readIds.has(m.id) || m.isRead,
        isPinned: pinnedIds.has(m.id) || m.isPinned,
      }));
      setMessages(merged);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedFolderId, loadFolders]);

  // ---------- Sync (fetch latest mail) ----------

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    if (!selectedFolderId || isSyncing) return;
    setIsSyncing(true);
    // Snapshot current state via ref (avoids stale closure)
    const prev = messagesRef.current;
    const prevIds = new Set(prev.map((m) => m.id));
    try {
      // 1. Trigger real IMAP sync for all accounts (mirrors web frontend syncAll)
      if (accounts.length > 0) {
        for (const account of accounts) {
          await mailService.syncAccount(account.id);
        }
      }
      // 2. Refresh folders and messages from database
      await loadFolders();
      const { messages: freshMsgs } = await mailService.getMessages(selectedFolderId, 1, 50);

      // 3. Preserve local read + pin status — IMAP sync may overwrite is_read flags
      //    Re-read ref for the freshest local state (may have changed during async sync)
      const latest = messagesRef.current;
      const readIds = new Set(latest.filter((m) => m.isRead).map((m) => m.id));
      const pinnedIds = new Set(latest.filter((m) => m.isPinned).map((m) => m.id));
      const merged = freshMsgs.map((m) => ({
        ...m,
        isRead: readIds.has(m.id) || m.isRead,
        isPinned: pinnedIds.has(m.id) || m.isPinned,
      }));
      setMessages(merged);

      // 4. Count truly new messages by comparing IDs (not array length, which is capped by pagination)
      const newCount = merged.filter((m) => !prevIds.has(m.id)).length;
      if (newCount > 0) {
        toast('Sync Completed', `${newCount} new email${newCount > 1 ? 's' : ''}`, 'success');
      } else {
        toast('Sync Completed', 'No new emails', 'success');
      }
    } catch (err) {
      alert('Sync Failed', 'Could not fetch latest mail. Please try again.', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [selectedFolderId, isSyncing, accounts, loadFolders, alert, toast]); // messagesRef used instead of messages

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

  // ---------- Selection Mode ----------

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setShowMoreMenu(false);
  }, []);

  // ---------- Folder Selection ----------

  const handleSelectFolder = useCallback(
    async (folder: MailFolder) => {
      setSelectedFolderId(folder.id);
      clearSelection();
      setMessages([]);
      closeDrawer();
      setIsLoading(true);
      await loadMessages(folder.id);
      setIsLoading(false);
    },
    [loadMessages, clearSelection, closeDrawer],
  );

  // ---------- Navigation ----------

  const handleMessagePress = useCallback(
    (message: EmailMessage) => {
      // In selection mode, tap toggles selection instead of navigating
      if (isSelectionMode) {
        toggleSelection(message.id);
        return;
      }
      // Mark as read locally so the blue unread dot disappears immediately
      if (!message.isRead) {
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? { ...m, isRead: true } : m)),
        );
        // Optimistically decrement sidebar unread count
        setFolders((prev) =>
          prev.map((f) =>
            f.id === message.folderId
              ? { ...f, unreadItemCount: Math.max(0, f.unreadItemCount - 1) }
              : f,
          ),
        );
        // Persist to backend — await ensures read state survives hard reload
        mailService.markAsRead(message.id, true)
          .then(() => loadFolders()) // reconcile with true server counts
          .catch((err) => console.warn('[MailScreen] markAsRead failed:', err));
      }
      navigation.navigate('MessageDetail', { messageId: message.id, message });
    },
    [navigation, isSelectionMode, toggleSelection, loadFolders],
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

  // ── Dynamic bulk action state (derived from selected items) ──
  const selectedMessages = useMemo(
    () => messages.filter((m) => selectedIds.has(m.id)),
    [messages, selectedIds],
  );
  const allFlagged = selectedMessages.length > 0 && selectedMessages.every((m) => m.isFlagged);
  const allPinned = selectedMessages.length > 0 && selectedMessages.every((m) => m.isPinned);
  const allRead = selectedMessages.length > 0 && selectedMessages.every((m) => m.isRead);

  // ---------- Bulk Actions ----------

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => mailService.deleteMessage(id)));
      setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
      toast('Deleted', `${ids.length} email${ids.length > 1 ? 's' : ''} deleted`, 'success');
    } catch {
      alert('Error', 'Could not delete some messages.', 'error');
    }
    clearSelection();
  }, [selectedIds, toast, alert, clearSelection]);

  const handleBulkArchive = useCallback(async () => {
    const archiveFolder = folders.find((f) => f.folderType === 'archive');
    if (!archiveFolder) {
      alert('No Archive', 'No archive folder found.', 'warning');
      return;
    }
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => mailService.moveMessage(id, archiveFolder.id)));
      setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
      toast('Archived', `${ids.length} email${ids.length > 1 ? 's' : ''} archived`, 'success');
    } catch {
      alert('Error', 'Could not archive some messages.', 'error');
    }
    clearSelection();
  }, [selectedIds, folders, toast, alert, clearSelection]);

  const handleBulkMarkRead = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const newRead = !allRead; // If all read → mark unread; otherwise → mark all read
    try {
      await Promise.all(ids.map((id) => mailService.markAsRead(id, newRead)));
      setMessages((prev) =>
        prev.map((m) => (selectedIds.has(m.id) ? { ...m, isRead: newRead } : m)),
      );
      // Refresh folders so sidebar unread count reflects the bulk change
      await loadFolders();
      toast(newRead ? 'Marked Read' : 'Marked Unread', `${ids.length} email${ids.length > 1 ? 's' : ''}`, 'success');
    } catch {
      alert('Error', `Could not mark some messages as ${newRead ? 'read' : 'unread'}.`, 'error');
    }
    clearSelection();
  }, [selectedIds, allRead, toast, alert, clearSelection, loadFolders]);

  const handleBulkFlag = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const newFlagged = !allFlagged; // If all flagged → unflag; otherwise → flag all
    try {
      await Promise.all(ids.map((id) => mailService.toggleFlag(id, newFlagged)));
      setMessages((prev) =>
        prev.map((m) => (selectedIds.has(m.id) ? { ...m, isFlagged: newFlagged } : m)),
      );
      toast(newFlagged ? 'Flagged' : 'Unflagged', `${ids.length} email${ids.length > 1 ? 's' : ''}`, 'success');
    } catch {
      alert('Error', `Could not ${newFlagged ? 'flag' : 'unflag'} some messages.`, 'error');
    }
    clearSelection();
  }, [selectedIds, allFlagged, toast, alert, clearSelection]);

  const handleBulkPin = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const newPinned = !allPinned; // If all pinned → unpin; otherwise → pin all
    try {
      await Promise.all(ids.map((id) => mailService.togglePin(id, newPinned)));
      setMessages((prev) =>
        prev.map((m) => (selectedIds.has(m.id) ? { ...m, isPinned: newPinned } : m)),
      );
      toast(newPinned ? 'Pinned' : 'Unpinned', `${ids.length} email${ids.length > 1 ? 's' : ''}`, 'success');
    } catch {
      alert('Error', `Could not ${newPinned ? 'pin' : 'unpin'} some messages.`, 'error');
    }
    clearSelection();
  }, [selectedIds, allPinned, toast, alert, clearSelection]);

  const handleBulkMoveToOther = useCallback(async () => {
    const junkFolder = folders.find((f) => f.folderType === 'spam');
    if (!junkFolder) {
      alert('No Folder', 'No junk folder found.', 'warning');
      return;
    }
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => mailService.moveMessage(id, junkFolder.id)));
      setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
      toast('Moved', `${ids.length} email${ids.length > 1 ? 's' : ''} moved to Other`, 'success');
    } catch {
      alert('Error', 'Could not move some messages.', 'error');
    }
    clearSelection();
  }, [selectedIds, folders, toast, alert, clearSelection]);

  const handleBulkMoveToFolder = useCallback(
    async (folderId: string) => {
      const ids = Array.from(selectedIds);
      try {
        await Promise.all(ids.map((id) => mailService.moveMessage(id, folderId)));
        setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
        toast('Moved', `${ids.length} email${ids.length > 1 ? 's' : ''} moved`, 'success');
      } catch {
        alert('Error', 'Could not move some messages.', 'error');
      }
      clearSelection();
      setShowFolderPicker(false);
    },
    [selectedIds, toast, alert, clearSelection],
  );

  // ---------- Focus Tab ----------

  const handleFocusTab = useCallback(
    async (tab: FocusTab) => {
      setFocusTab(tab);
      setActiveFilter('all');
      clearSelection();
      setMessages([]);
      setIsLoading(true);

      if (tab === 'other') {
        // Load junk/spam folder messages
        const junkFolder = folders.find((f) => f.folderType === 'spam');
        if (junkFolder) {
          setSelectedFolderId(junkFolder.id);
          await loadMessages(junkFolder.id);
        }
      } else {
        // Load inbox folder messages
        const inboxFolder = folders.find((f) => f.folderType === 'inbox') || folders[0];
        if (inboxFolder) {
          setSelectedFolderId(inboxFolder.id);
          await loadMessages(inboxFolder.id);
        }
      }
      setIsLoading(false);
    },
    [folders, loadMessages, clearSelection],
  );

  // ---------- Filtered Messages ----------

  const filteredMessages = useMemo(() => {
    if (activeFilter === 'all') return messages;
    switch (activeFilter) {
      case 'unread':
        return messages.filter((m) => !m.isRead);
      case 'flagged':
        return messages.filter((m) => m.isFlagged);
      case 'hasFiles':
        return messages.filter((m) => m.hasAttachments);
      case 'pinned':
        return messages.filter((m) => m.isPinned);
      case 'mentionMe':
        // Not supported by current API — return empty
        return [];
      default:
        return messages;
    }
  }, [messages, activeFilter]);

  const allSelected = filteredMessages.length > 0 && selectedIds.size === filteredMessages.length;

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMessages.map((m) => m.id)));
    }
    setShowMoreMenu(false);
  }, [allSelected, filteredMessages]);

  // ---------- Date-Grouped Sections ----------

  const sections = useMemo(() => buildSections(filteredMessages), [filteredMessages]);

  // ---------- Derived ----------

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const folderName = selectedFolder?.displayName || 'Inbox';

  // ---------- Render ----------

  const renderMessage = useCallback(
    ({ item }: { item: EmailMessage }) => (
      <MessageListItem
        message={item}
        isSelected={selectedIds.has(item.id)}
        isInSelectionMode={isSelectionMode}
        onPress={() => handleMessagePress(item)}
        onLongPress={() => toggleSelection(item.id)}
        onToggleFlag={() => handleToggleFlag(item)}
      />
    ),
    [selectedIds, isSelectionMode, handleMessagePress, toggleSelection, handleToggleFlag],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    ),
    [],
  );

  const SectionDivider = useCallback(
    () => <View style={styles.sectionDivider} />,
    [],
  );

  const keyExtractor = useCallback((item: EmailMessage) => item.id, []);

  if (isLoading && messages.length === 0) {
    return (
      <SafeScreen edges={['top']}>
        <LoadingSpinner fullScreen message="Loading mail..." />
      </SafeScreen>
    );
  }

  return (
    <SafeScreen edges={['top']} style={{ backgroundColor: Colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.surface} />

      {/* Row 1: Normal Header or Selection Header */}
      {isSelectionMode ? (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={clearSelection}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Icon name="check-circle" size={24} color={Colors.primary} />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {selectedIds.size} Selected
          </Text>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleBulkDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerButton}
            >
              <Icon name="delete-outline" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBulkArchive}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerButton}
            >
              <Icon name="archive" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowMoreMenu(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerButton}
            >
              <Icon name="more-vert" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={openDrawer}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            activeOpacity={0.7}
          >
            {user?.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Icon name="account-circle" size={HEADER_AVATAR_SIZE * 0.7} color={Colors.textSecondary} />
              </View>
            )}
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
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Icon name="sync" size={24} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Row 2: Focused/Other Toggle + Filter */}
      <View
        style={styles.subHeader}
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          setFilterDropdownTop(y + height);
        }}
      >
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, focusTab === 'focused' && styles.toggleButtonActive]}
            onPress={() => handleFocusTab('focused')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, focusTab === 'focused' && styles.toggleTextActive]}>
              Focused
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, focusTab === 'other' && styles.toggleButtonActive]}
            onPress={() => handleFocusTab('other')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, focusTab === 'other' && styles.toggleTextActive]}>
              Other
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterMenu(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterButtonText, activeFilter !== 'all' && styles.filterButtonTextActive]}>
            {activeFilter === 'all' ? 'Filter' : FILTER_OPTIONS.find((f) => f.key === activeFilter)?.label}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Message List */}
      {filteredMessages.length === 0 && !isLoading ? (
        <EmptyState
          icon="inbox"
          title="No Messages"
          subtitle="This folder is empty"
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          renderSectionHeader={renderSectionHeader}
          SectionSeparatorComponent={SectionDivider}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
              progressBackgroundColor={Colors.surface}
            />
          }
          contentContainerStyle={filteredMessages.length === 0 ? styles.emptyList : undefined}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB — Compose */}
      <FloatingActionButton icon="edit" onPress={handleCompose} />

      {/* Filter Menu — inline absolute, not Modal (consistent across web + mobile) */}
      {showFilterMenu && (
        <>
          <Pressable
            style={styles.filterOverlay}
            onPress={() => setShowFilterMenu(false)}
          />
          <View
            style={[
              styles.filterMenu,
              { top: filterDropdownTop, right: Spacing.md },
            ]}
          >
            {FILTER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[styles.filterMenuItem, activeFilter === option.key && styles.filterMenuItemActive]}
                onPress={() => {
                  setActiveFilter(option.key);
                  setShowFilterMenu(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterMenuItemText,
                    activeFilter === option.key && styles.filterMenuItemTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {activeFilter === option.key && (
                  <Icon name="check" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* More Options Menu (Selection Mode) */}
      {showMoreMenu && (
        <>
          <Pressable
            style={styles.filterOverlay}
            onPress={() => setShowMoreMenu(false)}
          />
          <View style={[styles.filterMenu, { top: 48, right: Spacing.md }]}>
            {[
              { key: 'moveFolder', label: 'Move to Folder', icon: 'drive-file-move-outline' },
              { key: 'moveOther', label: 'Move to Other', icon: 'move-to-inbox' },
              { key: 'markRead', label: allRead ? 'Mark as Unread' : 'Mark as Read', icon: allRead ? 'mark-email-unread' : 'mark-email-read' },
              { key: 'flag', label: allFlagged ? 'Unflag' : 'Flag', icon: allFlagged ? 'outlined-flag' : 'flag' },
              { key: 'pin', label: allPinned ? 'Unpin' : 'Pin', icon: 'push-pin' },
              { key: 'selectAll', label: allSelected ? 'Unselect All' : 'Select All', icon: allSelected ? 'deselect' : 'select-all' },
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.moreMenuItem}
                onPress={() => {
                  setShowMoreMenu(false);
                  switch (item.key) {
                    case 'moveFolder': setShowFolderPicker(true); break;
                    case 'moveOther': handleBulkMoveToOther(); break;
                    case 'markRead': handleBulkMarkRead(); break;
                    case 'flag': handleBulkFlag(); break;
                    case 'pin': handleBulkPin(); break;
                    case 'selectAll': toggleSelectAll(); break;
                  }
                }}
                activeOpacity={0.7}
              >
                <Icon
                  name={item.icon as any}
                  size={20}
                  color={Colors.textSecondary}
                />
                <Text style={styles.moreMenuItemText}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Folder Picker Modal */}
      <Modal
        visible={showFolderPicker}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { setShowFolderPicker(false); }}
      >
        <Pressable
          style={styles.folderPickerOverlay}
          onPress={() => setShowFolderPicker(false)}
        >
          <View style={styles.folderPickerCard}>
            <Text style={styles.folderPickerTitle}>Move to Folder</Text>
            {folders
              .filter((f) => f.id !== selectedFolderId)
              .map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  style={styles.folderPickerItem}
                  onPress={() => handleBulkMoveToFolder(folder.id)}
                  activeOpacity={0.7}
                >
                  <Icon name="folder" size={20} color={Colors.textSecondary} />
                  <Text style={styles.folderPickerItemText}>{folder.displayName}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </Pressable>
      </Modal>

      {/* Drawer Overlay — Modal renders above header + tab bar */}
      <Modal
        visible={showFolders}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeDrawer}
      >
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
            <SidebarDrawer
              userEmail={user?.email || ''}
              userAvatarUrl={user?.avatarUrl}
              userDisplayName={user?.displayName}
              accounts={accounts}
              allFolders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={handleSelectFolder}
              onClose={closeDrawer}
            />
          </Animated.View>
        </View>
      </Modal>

      {AlertComponent}
    </SafeScreen>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  headerAvatar: {
    width: HEADER_AVATAR_SIZE,
    height: HEADER_AVATAR_SIZE,
    borderRadius: HEADER_AVATAR_SIZE / 2,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  headerAvatarFallback: {
    width: HEADER_AVATAR_SIZE,
    height: HEADER_AVATAR_SIZE,
    borderRadius: HEADER_AVATAR_SIZE / 2,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Sub-header: toggle + filter
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 20,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 2,
    borderRadius: 18,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.textInverse,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: Colors.primary,
  },
  // Filter menu (inline absolute — not Modal)
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.scrim,
    zIndex: 10,
  },
  filterMenu: {
    position: 'absolute',
    zIndex: 11,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    width: 200,
    paddingVertical: Spacing.xs,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  filterMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  filterMenuItemActive: {
    backgroundColor: Colors.surfaceHover,
  },
  filterMenuItemText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  filterMenuItemTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyList: {
    flexGrow: 1,
  },
  // Section headers & dividers
  sectionHeader: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sectionHeaderText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
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
  // More Menu (selection mode)
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  moreMenuItemText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  // Folder Picker Modal
  folderPickerOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  folderPickerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    width: '100%',
    maxHeight: 400,
    paddingVertical: Spacing.lg,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  folderPickerTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  folderPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  folderPickerItemText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
});
