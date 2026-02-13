import React, { createContext, useContext } from 'react';
import { EmailMessage, MailFolder, ComposeMode } from '../types/mail';

export interface MailContextValue {
  // State
  selectedMessage: EmailMessage | null;
  selectedFolderId: string | null;
  folders: MailFolder[];
  messages: EmailMessage[];

  // Message actions
  deleteMessage: () => Promise<void>;
  archiveMessage: () => Promise<void>;
  toggleFlag: () => Promise<void>;
  toggleRead: () => Promise<void>;

  // Compose actions
  openCompose: (mode: ComposeMode) => void;

  // Move
  moveMessage: () => void;

  // Search
  searchMessages: (query: string) => Promise<void>;
  clearSearch: () => void;
  isGlobalSearch: boolean;
  toggleGlobalSearch: () => void;

  // View
  toggleFolderPane: () => void;

  // Refresh
  refreshMessages: () => Promise<void>;
  refreshFolders: () => Promise<void>;
}

const MailContext = createContext<MailContextValue | undefined>(undefined);

export const MailProvider: React.FC<{ value: MailContextValue; children: React.ReactNode }> = ({ value, children }) => {
  return <MailContext.Provider value={value}>{children}</MailContext.Provider>;
};

export const useMailContext = (): MailContextValue => {
  const context = useContext(MailContext);
  if (!context) {
    throw new Error('useMailContext must be used within a MailProvider');
  }
  return context;
};

// Safe version that returns null when outside provider (for Ribbon)
export const useMailContextSafe = (): MailContextValue | null => {
  return useContext(MailContext) ?? null;
};
