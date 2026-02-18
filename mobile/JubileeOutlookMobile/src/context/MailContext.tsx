/**
 * MailContext — mirrors web frontend src/context/MailContext.tsx exactly.
 * Full mail state management: folders, messages, search, compose, sync,
 * snooze checking, and auto-refresh on a 60-second interval.
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type { MailFolder, EmailMessage } from '../types';
import { mailService } from '../services/mail/mailService';
import { snoozeService } from '../services/mail/snoozeService';
import { tokenStore } from '../services/apiClient';
import { API } from '../constants';

// ---------- Local Types ----------

export type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward';

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------- State & Context Types ----------

interface MailState {
  folders: MailFolder[];
  messages: EmailMessage[];
  selectedFolderId: string | null;
  selectedMessage: EmailMessage | null;
  isLoading: boolean;
  isSyncing: boolean;
  searchQuery: string;
  isSearchMode: boolean;
  page: number;
  pagination: Pagination;
  composeMode: ComposeMode | null;
}

interface MailContextValue extends MailState {
  selectFolder: (folderId: string) => void;
  selectMessage: (message: EmailMessage | null) => void;
  refreshFolders: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  syncAll: () => Promise<void>;
  deleteMessage: (messageId?: string) => Promise<void>;
  archiveMessage: (messageId?: string) => Promise<void>;
  toggleFlag: (messageId?: string) => Promise<void>;
  toggleRead: (messageId?: string) => Promise<void>;
  moveMessage: (messageId: string, targetFolderId: string) => Promise<void>;
  searchMessages: (query: string) => Promise<void>;
  clearSearch: () => void;
  openCompose: (mode: ComposeMode) => void;
  closeCompose: () => void;
}

const initialPagination: Pagination = {
  page: 1,
  pageSize: API.DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 0,
};

const MailContext = createContext<MailContextValue | undefined>(undefined);

// ---------- Provider ----------

export const MailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<MailState>({
    folders: [],
    messages: [],
    selectedFolderId: null,
    selectedMessage: null,
    isLoading: false,
    isSyncing: false,
    searchQuery: '',
    isSearchMode: false,
    page: 1,
    pagination: initialPagination,
    composeMode: null,
  });

  // Keep a ref so interval callbacks always read latest state
  const stateRef = useRef(state);
  stateRef.current = state;

  // ---------- Helpers ----------

  const getUserId = (): string | null => tokenStore.getUserId();

  // ---------- Folder Actions ----------

  const refreshFolders = useCallback(async () => {
    try {
      const folders = await mailService.getFolders();
      setState((prev) => ({ ...prev, folders }));
    } catch (err) {
      console.warn('[MailContext] refreshFolders failed:', err);
    }
  }, []);

  // ---------- Message Actions ----------

  const refreshMessages = useCallback(async () => {
    const current = stateRef.current;
    if (!current.selectedFolderId) return;

    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const { messages, totalCount } = await mailService.getMessages(
        current.selectedFolderId,
        current.page,
        API.DEFAULT_PAGE_SIZE,
      );
      const totalPages = Math.ceil(totalCount / API.DEFAULT_PAGE_SIZE);
      setState((prev) => ({
        ...prev,
        messages,
        pagination: { page: current.page, pageSize: API.DEFAULT_PAGE_SIZE, total: totalCount, totalPages },
        isLoading: false,
      }));
    } catch (err) {
      console.warn('[MailContext] refreshMessages failed:', err);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // ---------- Folder Selection ----------

  const selectFolder = useCallback(
    (folderId: string) => {
      setState((prev) => ({
        ...prev,
        selectedFolderId: folderId,
        selectedMessage: null,
        messages: [],
        page: 1,
        pagination: initialPagination,
        searchQuery: '',
        isSearchMode: false,
      }));
    },
    [],
  );

  // When selectedFolderId changes, fetch messages
  useEffect(() => {
    if (state.selectedFolderId && !state.isSearchMode) {
      refreshMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedFolderId, state.page]);

  // ---------- Message Selection ----------

  const selectMessage = useCallback((message: EmailMessage | null) => {
    setState((prev) => ({ ...prev, selectedMessage: message }));

    // Auto-mark as read when selecting an unread message
    if (message && !message.isRead) {
      mailService.markAsRead(message.id, true).catch(() => {});
    }
  }, []);

  // ---------- Sync ----------

  const syncAll = useCallback(async () => {
    setState((prev) => ({ ...prev, isSyncing: true }));
    try {
      const accounts = await mailService.getAccounts();
      for (const account of accounts) {
        await mailService.syncAccount(account.id);
      }
      // Refresh folders and messages after sync
      await refreshFolders();
      await refreshMessages();
    } catch (err) {
      console.warn('[MailContext] syncAll failed:', err);
    } finally {
      setState((prev) => ({ ...prev, isSyncing: false }));
    }
  }, [refreshFolders, refreshMessages]);

  // ---------- Message Operations ----------

  const deleteMessage = useCallback(
    async (messageId?: string) => {
      const id = messageId || stateRef.current.selectedMessage?.id;
      if (!id) return;

      try {
        await mailService.deleteMessage(id);
        setState((prev) => ({
          ...prev,
          messages: prev.messages.filter((m) => m.id !== id),
          selectedMessage: prev.selectedMessage?.id === id ? null : prev.selectedMessage,
        }));
        await refreshFolders();
      } catch (err) {
        console.warn('[MailContext] deleteMessage failed:', err);
      }
    },
    [refreshFolders],
  );

  const archiveMessage = useCallback(
    async (messageId?: string) => {
      const id = messageId || stateRef.current.selectedMessage?.id;
      if (!id) return;

      try {
        // Find the archive folder
        const archiveFolder = stateRef.current.folders.find(
          (f) => f.folderType === 'archive',
        );
        if (archiveFolder) {
          await mailService.moveMessage(id, archiveFolder.id);
          setState((prev) => ({
            ...prev,
            messages: prev.messages.filter((m) => m.id !== id),
            selectedMessage: prev.selectedMessage?.id === id ? null : prev.selectedMessage,
          }));
          await refreshFolders();
        }
      } catch (err) {
        console.warn('[MailContext] archiveMessage failed:', err);
      }
    },
    [refreshFolders],
  );

  const toggleFlag = useCallback(
    async (messageId?: string) => {
      const id = messageId || stateRef.current.selectedMessage?.id;
      if (!id) return;

      const msg = stateRef.current.messages.find((m) => m.id === id);
      if (!msg) return;

      try {
        const newFlagged = !msg.isFlagged;
        await mailService.toggleFlag(id, newFlagged);
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === id ? { ...m, isFlagged: newFlagged } : m,
          ),
          selectedMessage:
            prev.selectedMessage?.id === id
              ? { ...prev.selectedMessage, isFlagged: newFlagged }
              : prev.selectedMessage,
        }));
      } catch (err) {
        console.warn('[MailContext] toggleFlag failed:', err);
      }
    },
    [],
  );

  const toggleRead = useCallback(
    async (messageId?: string) => {
      const id = messageId || stateRef.current.selectedMessage?.id;
      if (!id) return;

      const msg = stateRef.current.messages.find((m) => m.id === id);
      if (!msg) return;

      try {
        const newRead = !msg.isRead;
        await mailService.markAsRead(id, newRead);
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === id ? { ...m, isRead: newRead } : m,
          ),
          selectedMessage:
            prev.selectedMessage?.id === id
              ? { ...prev.selectedMessage, isRead: newRead }
              : prev.selectedMessage,
        }));
        await refreshFolders();
      } catch (err) {
        console.warn('[MailContext] toggleRead failed:', err);
      }
    },
    [refreshFolders],
  );

  const moveMessage = useCallback(
    async (messageId: string, targetFolderId: string) => {
      try {
        await mailService.moveMessage(messageId, targetFolderId);
        setState((prev) => ({
          ...prev,
          messages: prev.messages.filter((m) => m.id !== messageId),
          selectedMessage:
            prev.selectedMessage?.id === messageId ? null : prev.selectedMessage,
        }));
        await refreshFolders();
      } catch (err) {
        console.warn('[MailContext] moveMessage failed:', err);
      }
    },
    [refreshFolders],
  );

  // ---------- Search ----------

  const searchMessages = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      setState((prev) => ({
        ...prev,
        searchQuery: query,
        isSearchMode: true,
        isLoading: true,
      }));

      try {
        const { messages, totalCount } = await mailService.searchMessages(
          query,
          stateRef.current.selectedFolderId || undefined,
          1,
          API.DEFAULT_PAGE_SIZE,
        );
        const totalPages = Math.ceil(totalCount / API.DEFAULT_PAGE_SIZE);
        setState((prev) => ({
          ...prev,
          messages,
          pagination: { page: 1, pageSize: API.DEFAULT_PAGE_SIZE, total: totalCount, totalPages },
          page: 1,
          isLoading: false,
        }));
      } catch (err) {
        console.warn('[MailContext] searchMessages failed:', err);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [],
  );

  const clearSearch = useCallback(() => {
    setState((prev) => ({
      ...prev,
      searchQuery: '',
      isSearchMode: false,
      page: 1,
    }));
    // Trigger a message refresh by resetting page
    refreshMessages();
  }, [refreshMessages]);

  // ---------- Compose ----------

  const openCompose = useCallback((mode: ComposeMode) => {
    setState((prev) => ({ ...prev, composeMode: mode }));
  }, []);

  const closeCompose = useCallback(() => {
    setState((prev) => ({ ...prev, composeMode: null }));
  }, []);

  // ---------- Auto-Sync (60s interval) ----------

  useEffect(() => {
    const intervalId = setInterval(() => {
      const userId = getUserId();
      if (userId) {
        refreshFolders();
        refreshMessages();
      }
    }, API.SYNC_INTERVAL);

    return () => clearInterval(intervalId);
  }, [refreshFolders, refreshMessages]);

  // ---------- Snooze Check (60s interval) ----------

  useEffect(() => {
    const checkSnoozed = async () => {
      try {
        const expired = await snoozeService.clearExpired();
        if (expired.length > 0) {
          // Refresh to show unsnoozed messages
          await refreshFolders();
          await refreshMessages();
        }
      } catch (err) {
        console.warn('[MailContext] snooze check failed:', err);
      }
    };

    // Run immediately on mount
    checkSnoozed();

    const intervalId = setInterval(checkSnoozed, API.SNOOZE_CHECK_INTERVAL);
    return () => clearInterval(intervalId);
  }, [refreshFolders, refreshMessages]);

  // ---------- Render ----------

  const value: MailContextValue = {
    ...state,
    selectFolder,
    selectMessage,
    refreshFolders,
    refreshMessages,
    syncAll,
    deleteMessage,
    archiveMessage,
    toggleFlag,
    toggleRead,
    moveMessage,
    searchMessages,
    clearSearch,
    openCompose,
    closeCompose,
  };

  return <MailContext.Provider value={value}>{children}</MailContext.Provider>;
};

// ---------- Hooks ----------

export const useMailContext = (): MailContextValue => {
  const context = useContext(MailContext);
  if (!context) {
    throw new Error('useMailContext must be used within a MailProvider');
  }
  return context;
};

/**
 * Safe version that returns null when used outside the provider.
 * Useful for components that may optionally consume mail state (e.g. navigation bars).
 */
export const useMailContextSafe = (): MailContextValue | null => {
  return useContext(MailContext) ?? null;
};
