import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { MailProvider, MailContextValue } from '../../context/MailContext';
import { useToast } from '../../components/common/Toast';
import MailRibbon from '../../components/layout/Ribbon/MailRibbon';
import FolderPane from '../../components/mail/FolderPane';
import MessageList from '../../components/mail/MessageList';
import ReadingPane from '../../components/mail/ReadingPane';
import ComposeMail from '../../components/mail/ComposeMail';
import MoveToFolderDialog from '../../components/mail/MoveToFolderDialog';
import { ResizeHandle } from '../../components/common/ResizeHandle';
import { MailFolder, EmailMessage, ComposeMode } from '../../types/mail';
import { mailService } from '../../services/mail/mailService';
import { notificationService } from '../../services/mail/notificationService';
import './MailPage.css';

const AUTO_SYNC_INTERVAL = 60000; // 60 seconds
const DEFAULT_FOLDER_PANE_WIDTH = 220;
const DEFAULT_MESSAGE_LIST_WIDTH = 360;
const MIN_PANE_WIDTH = 160;
const MAX_FOLDER_PANE_WIDTH = 400;
const MAX_MESSAGE_LIST_WIDTH = 600;

const MailPage: React.FC = () => {
  const { isFolderPaneVisible, toggleFolderPane } = useAppContext();
  const { showToast } = useToast();

  // Data state
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);

  // Loading state
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);

  // Compose state
  const [composeMode, setComposeMode] = useState<ComposeMode | null>(null);

  // Move-to-folder dialog state
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [bulkMoveIds, setBulkMoveIds] = useState<string[] | null>(null);

  // Sort state
  const [sortBy, setSortBy] = useState('date_desc');

  // Resizable pane widths
  const [folderPaneWidth, setFolderPaneWidth] = useState(DEFAULT_FOLDER_PANE_WIDTH);
  const [messageListWidth, setMessageListWidth] = useState(DEFAULT_MESSAGE_LIST_WIDTH);

  // Get sender email from localStorage (set during sign-in/sync)
  const senderEmail = localStorage.getItem('jubilee_sync_email') || '';
  const senderName = senderEmail.split('@')[0];

  // Track if initial load is done to avoid duplicate fetches
  const initialLoadDone = useRef(false);
  const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());

  // Helper to find all folders (including nested) in a flat list
  const flattenFolders = useCallback((folderList: MailFolder[]): MailFolder[] => {
    const result: MailFolder[] = [];
    const recurse = (items: MailFolder[]) => {
      for (const f of items) {
        result.push(f);
        if (f.childFolders?.length) recurse(f.childFolders);
      }
    };
    recurse(folderList);
    return result;
  }, []);

  // Fetch folders on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadFolders = async () => {
      try {
        const fetched = await mailService.getFolders();
        setFolders(fetched);
        const inbox = fetched.find(f => f.folderType === 'inbox');
        if (inbox) {
          setSelectedFolderId(inbox.id);
        } else if (fetched.length > 0) {
          setSelectedFolderId(fetched[0].id);
        }
      } catch {
        showToast('Failed to load mail folders', 'error');
      }
    };
    loadFolders();
    // Request notification permission on mount
    notificationService.requestPermission();
  }, [showToast]);

  // Fetch messages when selected folder or page changes
  useEffect(() => {
    if (!selectedFolderId) return;
    if (searchQuery) return; // Don't fetch folder messages while searching

    const loadMessages = async () => {
      setLoadingMessages(true);
      setSelectedMessageId(null);
      setSelectedMessage(null);
      try {
        const result = await mailService.getMessages(selectedFolderId, currentPage, pageSize);
        setMessages(result.messages);
        setTotalCount(result.totalCount);
        // Seed known IDs on initial load
        for (const m of result.messages) {
          knownMessageIdsRef.current.add(m.id);
        }
      } catch {
        setMessages([]);
        showToast('Failed to load messages', 'error');
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [selectedFolderId, searchQuery, currentPage, showToast]);

  // Auto-sync scheduler with desktop notifications for new mail
  useEffect(() => {
    autoSyncRef.current = setInterval(async () => {
      try {
        const fetched = await mailService.getFolders();
        setFolders(fetched);
        if (selectedFolderId && !searchQuery) {
          const result = await mailService.getMessages(selectedFolderId, currentPage, pageSize);
          // Detect new unread messages
          const newUnread = result.messages.filter(
            (m) => !m.isRead && !knownMessageIdsRef.current.has(m.id)
          );
          // Update known IDs
          for (const m of result.messages) {
            knownMessageIdsRef.current.add(m.id);
          }
          if (newUnread.length > 0) {
            const first = newUnread[0];
            notificationService.showNewMailNotification(
              newUnread.length,
              first.from.name || first.from.address,
              first.subject
            );
          }
          setMessages(result.messages);
          setTotalCount(result.totalCount);
        }
      } catch {
        // Silent background sync failure
      }
    }, AUTO_SYNC_INTERVAL);

    return () => {
      if (autoSyncRef.current) clearInterval(autoSyncRef.current);
    };
  }, [selectedFolderId, searchQuery, currentPage]);

  // Sync all accounts via IMAP, then refresh folders and messages
  const syncAll = useCallback(async () => {
    try {
      showToast('Syncing mail...', 'info');
      const accounts = await mailService.getAccounts();
      if (accounts.length === 0) {
        showToast('No email accounts connected', 'warning');
        return;
      }
      for (const account of accounts) {
        await mailService.syncAccount(account.id);
      }
      // Refresh UI after sync
      const fetched = await mailService.getFolders();
      setFolders(fetched);
      if (selectedFolderId) {
        const result = await mailService.getMessages(selectedFolderId, currentPage, pageSize);
        setMessages(result.messages);
        setTotalCount(result.totalCount);
      }
      showToast('Mail synced successfully', 'success');
    } catch {
      showToast('Sync failed', 'error');
    }
  }, [selectedFolderId, currentPage, showToast]);

  // Refresh folder counts from API
  const refreshFolders = useCallback(async () => {
    try {
      const fetched = await mailService.getFolders();
      setFolders(fetched);
    } catch {
      showToast('Failed to refresh folders', 'error');
    }
  }, [showToast]);

  // Refresh messages for current folder
  const refreshMessages = useCallback(async () => {
    if (!selectedFolderId) return;
    setLoadingMessages(true);
    try {
      const result = await mailService.getMessages(selectedFolderId, currentPage, pageSize);
      setMessages(result.messages);
      setTotalCount(result.totalCount);
    } catch {
      showToast('Failed to refresh messages', 'error');
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedFolderId, currentPage, showToast]);

  // Handle message selection - fetch full message and mark as read
  const handleMessageSelect = useCallback(async (messageId: string) => {
    setSelectedMessageId(messageId);

    const listMsg = messages.find(m => m.id === messageId);
    if (listMsg) {
      setSelectedMessage(listMsg);
    }

    try {
      const fullMessage = await mailService.getMessage(messageId);
      if (fullMessage) {
        setSelectedMessage(fullMessage);

        if (!fullMessage.isRead) {
          await mailService.markAsRead(messageId, true);
          setMessages(prev =>
            prev.map(m => m.id === messageId ? { ...m, isRead: true } : m)
          );
          // Refresh folder counts to update unread badges
          refreshFolders();
        }
      }
    } catch {
      showToast('Failed to load message details', 'error');
    }
  }, [messages, refreshFolders, showToast]);

  // Handle folder selection
  const handleFolderSelect = useCallback((folderId: string) => {
    setSearchQuery('');
    setIsSearching(false);
    setCurrentPage(1);
    setSelectedFolderId(folderId);
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Delete message handler (smart: move-to-trash or hard delete)
  const handleDelete = useCallback(async () => {
    if (!selectedMessage || !selectedFolderId) return;
    const allFolders = flattenFolders(folders);
    const currentFolder = allFolders.find(f => f.id === selectedFolderId);
    const isTrash = currentFolder?.folderType === 'trash';

    try {
      if (isTrash) {
        await mailService.deleteMessage(selectedMessage.id);
      } else {
        const trashFolder = allFolders.find(f => f.folderType === 'trash');
        if (trashFolder) {
          await mailService.moveMessage(selectedMessage.id, trashFolder.id);
        } else {
          await mailService.deleteMessage(selectedMessage.id);
        }
      }
      // Remove from list and clear selection
      setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
      setSelectedMessageId(null);
      setSelectedMessage(null);
      setTotalCount(prev => Math.max(0, prev - 1));
      refreshFolders();
      showToast(isTrash ? 'Message permanently deleted' : 'Message moved to Trash', 'success');
    } catch {
      showToast('Failed to delete message', 'error');
    }
  }, [selectedMessage, selectedFolderId, folders, flattenFolders, refreshFolders, showToast]);

  // Archive message handler
  const handleArchive = useCallback(async () => {
    if (!selectedMessage) return;
    const allFolders = flattenFolders(folders);
    const archiveFolder = allFolders.find(f => f.folderType === 'archive')
      || allFolders.find(f => f.displayName === 'All Mail');
    if (!archiveFolder) {
      showToast('No archive folder found', 'warning');
      return;
    }

    try {
      await mailService.moveMessage(selectedMessage.id, archiveFolder.id);
      setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
      setSelectedMessageId(null);
      setSelectedMessage(null);
      setTotalCount(prev => Math.max(0, prev - 1));
      refreshFolders();
      showToast('Message archived', 'success');
    } catch {
      showToast('Failed to archive message', 'error');
    }
  }, [selectedMessage, folders, flattenFolders, refreshFolders, showToast]);

  // Toggle flag handler
  const handleToggleFlag = useCallback(async () => {
    if (!selectedMessage) return;
    const newFlagged = !selectedMessage.isFlagged;
    try {
      await mailService.toggleFlag(selectedMessage.id, newFlagged);
      setMessages(prev =>
        prev.map(m => m.id === selectedMessage.id ? { ...m, isFlagged: newFlagged } : m)
      );
      setSelectedMessage(prev => prev ? { ...prev, isFlagged: newFlagged } : null);
    } catch {
      showToast('Failed to update flag', 'error');
    }
  }, [selectedMessage, showToast]);

  // Toggle read handler
  const handleToggleRead = useCallback(async () => {
    if (!selectedMessage) return;
    const newRead = !selectedMessage.isRead;
    try {
      await mailService.markAsRead(selectedMessage.id, newRead);
      setMessages(prev =>
        prev.map(m => m.id === selectedMessage.id ? { ...m, isRead: newRead } : m)
      );
      setSelectedMessage(prev => prev ? { ...prev, isRead: newRead } : null);
      refreshFolders();
    } catch {
      showToast('Failed to update read status', 'error');
    }
  }, [selectedMessage, refreshFolders, showToast]);

  // Open compose handler
  const handleOpenCompose = useCallback((mode: ComposeMode) => {
    setComposeMode(mode);
  }, []);

  // Close compose and return to reading pane
  const handleCloseCompose = useCallback(() => {
    setComposeMode(null);
  }, []);

  // Handle send success — close compose, refresh messages
  const handleSentSuccess = useCallback(() => {
    setComposeMode(null);
    refreshMessages();
    refreshFolders();
    showToast('Message sent successfully', 'success');
  }, [refreshMessages, refreshFolders, showToast]);

  // Move-to-folder: open dialog
  const handleOpenMoveDialog = useCallback(() => {
    if (!selectedMessage) return;
    setShowMoveDialog(true);
  }, [selectedMessage]);

  // Move-to-folder: execute move (supports single and bulk)
  const handleMoveToFolder = useCallback(async (targetFolderId: string) => {
    setShowMoveDialog(false);

    // Bulk move
    if (bulkMoveIds && bulkMoveIds.length > 0) {
      const ids = [...bulkMoveIds];
      setBulkMoveIds(null);
      try {
        for (const id of ids) {
          await mailService.moveMessage(id, targetFolderId);
        }
        setMessages(prev => prev.filter(m => !ids.includes(m.id)));
        setTotalCount(prev => Math.max(0, prev - ids.length));
        if (selectedMessage && ids.includes(selectedMessage.id)) {
          setSelectedMessageId(null);
          setSelectedMessage(null);
        }
        refreshFolders();
        showToast(`${ids.length} message(s) moved successfully`, 'success');
      } catch {
        showToast('Failed to move messages', 'error');
      }
      return;
    }

    // Single message move
    if (!selectedMessage) return;
    try {
      await mailService.moveMessage(selectedMessage.id, targetFolderId);
      setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
      setSelectedMessageId(null);
      setSelectedMessage(null);
      setTotalCount(prev => Math.max(0, prev - 1));
      refreshFolders();
      showToast('Message moved successfully', 'success');
    } catch {
      showToast('Failed to move message', 'error');
    }
  }, [selectedMessage, bulkMoveIds, refreshFolders, showToast]);

  // Search messages handler
  const handleSearchMessages = useCallback(async (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    if (!query.trim()) {
      setIsSearching(false);
      // Refetch current folder messages
      if (selectedFolderId) {
        setLoadingMessages(true);
        try {
          const result = await mailService.getMessages(selectedFolderId, 1, pageSize);
          setMessages(result.messages);
          setTotalCount(result.totalCount);
        } catch {
          setMessages([]);
          showToast('Failed to load messages', 'error');
        } finally {
          setLoadingMessages(false);
        }
      }
      return;
    }

    setIsSearching(true);
    setLoadingMessages(true);
    setSelectedMessageId(null);
    setSelectedMessage(null);
    try {
      const folderId = isGlobalSearch ? undefined : (selectedFolderId || undefined);
      const result = await mailService.searchMessages(query, folderId);
      setMessages(result.messages);
      setTotalCount(result.totalCount);
    } catch {
      setMessages([]);
      showToast('Search failed', 'error');
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedFolderId, isGlobalSearch, showToast]);

  const handleClearSearch = useCallback(() => {
    handleSearchMessages('');
  }, [handleSearchMessages]);

  // Toggle global search mode
  const handleToggleGlobalSearch = useCallback(() => {
    setIsGlobalSearch(prev => !prev);
  }, []);

  // Flag toggle handler for MessageList (per-message, not requiring selection)
  const handleToggleFlagForMessage = useCallback(async (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    const newFlagged = !msg.isFlagged;
    try {
      await mailService.toggleFlag(messageId, newFlagged);
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, isFlagged: newFlagged } : m)
      );
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(prev => prev ? { ...prev, isFlagged: newFlagged } : null);
      }
    } catch {
      showToast('Failed to update flag', 'error');
    }
  }, [messages, selectedMessage, showToast]);

  // Error handler for ReadingPane
  const handleReadingPaneError = useCallback((message: string) => {
    showToast(message, 'error');
  }, [showToast]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async (ids: string[]) => {
    const allFolders = flattenFolders(folders);
    const currentFolder = allFolders.find(f => f.id === selectedFolderId);
    const isTrash = currentFolder?.folderType === 'trash';
    const trashFolder = allFolders.find(f => f.folderType === 'trash');

    try {
      for (const id of ids) {
        if (isTrash) {
          await mailService.deleteMessage(id);
        } else if (trashFolder) {
          await mailService.moveMessage(id, trashFolder.id);
        } else {
          await mailService.deleteMessage(id);
        }
      }
      setMessages(prev => prev.filter(m => !ids.includes(m.id)));
      setTotalCount(prev => Math.max(0, prev - ids.length));
      if (selectedMessage && ids.includes(selectedMessage.id)) {
        setSelectedMessageId(null);
        setSelectedMessage(null);
      }
      refreshFolders();
      showToast(`${ids.length} message(s) ${isTrash ? 'permanently deleted' : 'moved to Trash'}`, 'success');
    } catch {
      showToast('Failed to delete messages', 'error');
    }
  }, [selectedFolderId, selectedMessage, folders, flattenFolders, refreshFolders, showToast]);

  // Bulk mark read/unread handler
  const handleBulkMarkRead = useCallback(async (ids: string[], isRead: boolean) => {
    try {
      for (const id of ids) {
        await mailService.markAsRead(id, isRead);
      }
      setMessages(prev =>
        prev.map(m => ids.includes(m.id) ? { ...m, isRead } : m)
      );
      if (selectedMessage && ids.includes(selectedMessage.id)) {
        setSelectedMessage(prev => prev ? { ...prev, isRead } : null);
      }
      refreshFolders();
      showToast(`${ids.length} message(s) marked as ${isRead ? 'read' : 'unread'}`, 'success');
    } catch {
      showToast('Failed to update messages', 'error');
    }
  }, [selectedMessage, refreshFolders, showToast]);

  // Bulk move handler (opens dialog)
  const handleBulkMove = useCallback((ids: string[]) => {
    setBulkMoveIds(ids);
    setShowMoveDialog(true);
  }, []);

  // Drag-and-drop: move messages to a folder
  const handleDropMessages = useCallback(async (messageIds: string[], targetFolderId: string) => {
    try {
      for (const id of messageIds) {
        await mailService.moveMessage(id, targetFolderId);
      }
      setMessages(prev => prev.filter(m => !messageIds.includes(m.id)));
      setTotalCount(prev => Math.max(0, prev - messageIds.length));
      if (selectedMessage && messageIds.includes(selectedMessage.id)) {
        setSelectedMessageId(null);
        setSelectedMessage(null);
      }
      refreshFolders();
      showToast(`${messageIds.length} message(s) moved successfully`, 'success');
    } catch {
      showToast('Failed to move messages', 'error');
    }
  }, [selectedMessage, refreshFolders, showToast]);

  // Context menu action handler
  const handleContextAction = useCallback(async (action: string, messageId: string) => {
    switch (action) {
      case 'reply':
        handleMessageSelect(messageId);
        setTimeout(() => handleOpenCompose('reply'), 100);
        break;
      case 'replyAll':
        handleMessageSelect(messageId);
        setTimeout(() => handleOpenCompose('replyAll'), 100);
        break;
      case 'forward':
        handleMessageSelect(messageId);
        setTimeout(() => handleOpenCompose('forward'), 100);
        break;
      case 'markRead':
        try {
          await mailService.markAsRead(messageId, true);
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isRead: true } : m));
          if (selectedMessage?.id === messageId) setSelectedMessage(prev => prev ? { ...prev, isRead: true } : null);
          refreshFolders();
        } catch { showToast('Failed to mark as read', 'error'); }
        break;
      case 'markUnread':
        try {
          await mailService.markAsRead(messageId, false);
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isRead: false } : m));
          if (selectedMessage?.id === messageId) setSelectedMessage(prev => prev ? { ...prev, isRead: false } : null);
          refreshFolders();
        } catch { showToast('Failed to mark as unread', 'error'); }
        break;
      case 'flag': {
        const msg = messages.find(m => m.id === messageId);
        if (msg) {
          const newFlagged = !msg.isFlagged;
          try {
            await mailService.toggleFlag(messageId, newFlagged);
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isFlagged: newFlagged } : m));
            if (selectedMessage?.id === messageId) setSelectedMessage(prev => prev ? { ...prev, isFlagged: newFlagged } : null);
          } catch { showToast('Failed to toggle flag', 'error'); }
        }
        break;
      }
      case 'move':
        handleMessageSelect(messageId);
        setTimeout(() => { setShowMoveDialog(true); setBulkMoveIds(null); }, 100);
        break;
      case 'archive':
        handleMessageSelect(messageId);
        setTimeout(() => handleArchive(), 100);
        break;
      case 'delete':
        handleMessageSelect(messageId);
        setTimeout(() => handleDelete(), 100);
        break;
    }
  }, [messages, selectedMessage, handleMessageSelect, handleOpenCompose, handleArchive, handleDelete, refreshFolders, showToast]);

  // Sort handler - client-side sort of current messages
  const handleSortChange = useCallback((newSortBy: string) => {
    setSortBy(newSortBy);
  }, []);

  // Apply client-side sorting to messages
  // Apply client-side sorting to messages (default: newest first)
  const sortedMessages = React.useMemo(() => {
    const sorted = [...messages];
    const getTime = (dateStr: string) => dateStr ? new Date(dateStr).getTime() : 0;
    switch (sortBy) {
      case 'date_asc':
        sorted.sort((a, b) => getTime(a.receivedAt) - getTime(b.receivedAt));
        break;
      case 'date_desc':
        sorted.sort((a, b) => getTime(b.receivedAt) - getTime(a.receivedAt));
        break;
      case 'sender':
        sorted.sort((a, b) => (a.from.name || a.from.address).localeCompare(b.from.name || b.from.address));
        break;
      case 'subject':
        sorted.sort((a, b) => a.subject.localeCompare(b.subject));
        break;
      case 'unread':
        sorted.sort((a, b) => (a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1));
        break;
    }
    return sorted;
  }, [messages, sortBy]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      // Skip if compose is open (compose has its own shortcuts)
      if (composeMode) return;

      // Delete/Backspace → delete selected message
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMessage) {
        e.preventDefault();
        handleDelete();
        return;
      }

      // Ctrl+N → new email
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleOpenCompose('new');
        return;
      }

      // Ctrl+R → reply (without Shift)
      if (e.ctrlKey && !e.shiftKey && e.key === 'r' && selectedMessage) {
        e.preventDefault();
        handleOpenCompose('reply');
        return;
      }

      // Ctrl+Shift+R → reply all
      if (e.ctrlKey && e.shiftKey && e.key === 'R' && selectedMessage) {
        e.preventDefault();
        handleOpenCompose('replyAll');
        return;
      }

      // Ctrl+F → forward
      if (e.ctrlKey && e.key === 'f' && selectedMessage) {
        e.preventDefault();
        handleOpenCompose('forward');
        return;
      }

      // Arrow Up/Down → navigate messages
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = messages.findIndex(m => m.id === selectedMessageId);
        const nextIndex = e.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex >= 0 && nextIndex < messages.length) {
          handleMessageSelect(messages[nextIndex].id);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedMessage, selectedMessageId, messages, composeMode, handleDelete, handleOpenCompose, handleMessageSelect]);

  // Resize handlers
  const handleFolderPaneResize = useCallback((delta: number) => {
    setFolderPaneWidth(prev => Math.min(MAX_FOLDER_PANE_WIDTH, Math.max(MIN_PANE_WIDTH, prev + delta)));
  }, []);

  const handleMessageListResize = useCallback((delta: number) => {
    setMessageListWidth(prev => Math.min(MAX_MESSAGE_LIST_WIDTH, Math.max(MIN_PANE_WIDTH, prev + delta)));
  }, []);

  // Build MailContext value
  const mailContextValue: MailContextValue = {
    selectedMessage,
    selectedFolderId,
    folders,
    messages,
    deleteMessage: handleDelete,
    archiveMessage: handleArchive,
    toggleFlag: handleToggleFlag,
    toggleRead: handleToggleRead,
    openCompose: handleOpenCompose,
    moveMessage: handleOpenMoveDialog,
    searchMessages: handleSearchMessages,
    clearSearch: handleClearSearch,
    isGlobalSearch,
    toggleGlobalSearch: handleToggleGlobalSearch,
    toggleFolderPane,
    syncAll,
    refreshMessages,
    refreshFolders,
  };

  return (
    <MailProvider value={mailContextValue}>
      <div className="mail-page">
        <div className="ribbon">
          <MailRibbon />
        </div>
        <div className="mail-page__content">
          {isFolderPaneVisible && (
            <>
              <div style={{ width: folderPaneWidth, flexShrink: 0 }}>
                <FolderPane
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  onFolderSelect={handleFolderSelect}
                  onFoldersChanged={refreshFolders}
                  onDropMessages={handleDropMessages}
                />
              </div>
              <ResizeHandle onResize={handleFolderPaneResize} />
            </>
          )}
          <div style={{ width: messageListWidth, flexShrink: 0 }}>
            <MessageList
              messages={sortedMessages}
              selectedMessageId={selectedMessageId}
              onMessageSelect={handleMessageSelect}
              onToggleFlag={handleToggleFlagForMessage}
              onSearch={handleSearchMessages}
              loading={loadingMessages}
              folderName={isSearching ? `${isGlobalSearch ? 'All Folders' : 'Search'}: "${searchQuery}"` : folders.find(f => f.id === selectedFolderId)?.displayName}
              currentPage={currentPage}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onBulkDelete={handleBulkDelete}
              onBulkMarkRead={handleBulkMarkRead}
              onBulkMove={handleBulkMove}
              onContextAction={handleContextAction}
              sortBy={sortBy}
              onSortChange={handleSortChange}
            />
          </div>
          <ResizeHandle onResize={handleMessageListResize} />
          {composeMode ? (
            <ComposeMail
              mode={composeMode}
              originalMessage={selectedMessage}
              senderEmail={senderEmail}
              senderName={senderName}
              onClose={handleCloseCompose}
              onSent={handleSentSuccess}
            />
          ) : (
            <ReadingPane message={selectedMessage} onError={handleReadingPaneError} />
          )}
        </div>
      </div>
      {showMoveDialog && (
        <MoveToFolderDialog
          folders={folders}
          currentFolderId={selectedFolderId}
          onMove={handleMoveToFolder}
          onClose={() => setShowMoveDialog(false)}
        />
      )}
    </MailProvider>
  );
};

export default MailPage;
