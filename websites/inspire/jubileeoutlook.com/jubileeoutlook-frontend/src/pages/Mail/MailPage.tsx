import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { MailProvider, MailContextValue } from '../../context/MailContext';
import FolderPane from '../../components/mail/FolderPane';
import MessageList from '../../components/mail/MessageList';
import ReadingPane from '../../components/mail/ReadingPane';
import { MailFolder, EmailMessage, ComposeMode } from '../../types/mail';
import { mailService } from '../../services/mail/mailService';
import './MailPage.css';

const MailPage: React.FC = () => {
  const { isFolderPaneVisible } = useAppContext();

  // Data state
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);

  // Loading state
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);

  // Compose state (for Phase 2)
  const [composeMode, setComposeMode] = useState<ComposeMode | null>(null);

  // Track if initial load is done to avoid duplicate fetches
  const initialLoadDone = useRef(false);

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
      setLoadingFolders(true);
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
        // Folders will remain empty
      } finally {
        setLoadingFolders(false);
      }
    };
    loadFolders();
  }, []);

  // Fetch messages when selected folder changes
  useEffect(() => {
    if (!selectedFolderId) return;
    if (searchQuery) return; // Don't fetch folder messages while searching

    const loadMessages = async () => {
      setLoadingMessages(true);
      setSelectedMessageId(null);
      setSelectedMessage(null);
      try {
        const result = await mailService.getMessages(selectedFolderId);
        setMessages(result.messages);
      } catch {
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [selectedFolderId, searchQuery]);

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
        }
      }
    } catch {
      // Keep the list message as fallback
    }
  }, [messages]);

  // Handle folder selection
  const handleFolderSelect = useCallback((folderId: string) => {
    setSearchQuery('');
    setIsSearching(false);
    setSelectedFolderId(folderId);
  }, []);

  // Refresh folder counts from API
  const refreshFolders = useCallback(async () => {
    try {
      const fetched = await mailService.getFolders();
      setFolders(fetched);
    } catch {
      // silently fail
    }
  }, []);

  // Refresh messages for current folder
  const refreshMessages = useCallback(async () => {
    if (!selectedFolderId) return;
    setLoadingMessages(true);
    try {
      const result = await mailService.getMessages(selectedFolderId);
      setMessages(result.messages);
    } catch {
      // silently fail
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedFolderId]);

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
      refreshFolders();
    } catch {
      // silently fail
    }
  }, [selectedMessage, selectedFolderId, folders, flattenFolders, refreshFolders]);

  // Archive message handler
  const handleArchive = useCallback(async () => {
    if (!selectedMessage) return;
    const allFolders = flattenFolders(folders);
    const archiveFolder = allFolders.find(f => f.folderType === 'archive')
      || allFolders.find(f => f.displayName === 'All Mail');
    if (!archiveFolder) return;

    try {
      await mailService.moveMessage(selectedMessage.id, archiveFolder.id);
      setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
      setSelectedMessageId(null);
      setSelectedMessage(null);
      refreshFolders();
    } catch {
      // silently fail
    }
  }, [selectedMessage, folders, flattenFolders, refreshFolders]);

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
      // silently fail
    }
  }, [selectedMessage]);

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
      // silently fail
    }
  }, [selectedMessage, refreshFolders]);

  // Open compose handler (for Phase 2)
  const handleOpenCompose = useCallback((mode: ComposeMode) => {
    setComposeMode(mode);
  }, []);

  // Search messages handler
  const handleSearchMessages = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setIsSearching(false);
      // Refetch current folder messages
      if (selectedFolderId) {
        setLoadingMessages(true);
        try {
          const result = await mailService.getMessages(selectedFolderId);
          setMessages(result.messages);
        } catch {
          setMessages([]);
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
      const result = await mailService.searchMessages(query, selectedFolderId || undefined);
      setMessages(result.messages);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedFolderId]);

  const handleClearSearch = useCallback(() => {
    handleSearchMessages('');
  }, [handleSearchMessages]);

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
      // silently fail
    }
  }, [messages, selectedMessage]);

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
    searchMessages: handleSearchMessages,
    clearSearch: handleClearSearch,
    refreshMessages,
    refreshFolders,
  };

  return (
    <MailProvider value={mailContextValue}>
      <div className="mail-page">
        {isFolderPaneVisible && (
          <FolderPane
            folders={folders}
            selectedFolderId={selectedFolderId}
            onFolderSelect={handleFolderSelect}
          />
        )}
        <MessageList
          messages={messages}
          selectedMessageId={selectedMessageId}
          onMessageSelect={handleMessageSelect}
          onToggleFlag={handleToggleFlagForMessage}
          onSearch={handleSearchMessages}
          loading={loadingMessages}
          folderName={isSearching ? `Search: "${searchQuery}"` : folders.find(f => f.id === selectedFolderId)?.displayName}
        />
        <ReadingPane message={selectedMessage} />
      </div>
    </MailProvider>
  );
};

export default MailPage;
