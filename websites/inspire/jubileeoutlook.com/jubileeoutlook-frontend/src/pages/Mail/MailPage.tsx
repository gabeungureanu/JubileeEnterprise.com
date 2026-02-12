import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import FolderPane from '../../components/mail/FolderPane';
import MessageList from '../../components/mail/MessageList';
import ReadingPane from '../../components/mail/ReadingPane';
import { MailFolder, EmailMessage } from '../../types/mail';
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

  // Track if initial load is done to avoid duplicate fetches
  const initialLoadDone = useRef(false);

  // Fetch folders on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadFolders = async () => {
      setLoadingFolders(true);
      try {
        const fetched = await mailService.getFolders();
        setFolders(fetched);
        // Auto-select Inbox (or first folder)
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
  }, [selectedFolderId]);

  // Handle message selection - fetch full message and mark as read
  const handleMessageSelect = useCallback(async (messageId: string) => {
    setSelectedMessageId(messageId);

    // Find message in list for immediate display
    const listMsg = messages.find(m => m.id === messageId);
    if (listMsg) {
      setSelectedMessage(listMsg);
    }

    try {
      // Fetch full message body
      const fullMessage = await mailService.getMessage(messageId);
      if (fullMessage) {
        setSelectedMessage(fullMessage);

        // Auto-mark as read
        if (!fullMessage.isRead) {
          await mailService.markAsRead(messageId, true);
          // Update the message in the list
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
    setSelectedFolderId(folderId);
  }, []);

  return (
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
        loading={loadingMessages}
        folderName={folders.find(f => f.id === selectedFolderId)?.displayName}
      />
      <ReadingPane message={selectedMessage} />
    </div>
  );
};

export default MailPage;
