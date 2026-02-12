import { Category } from '../common';

export interface EmailMessage {
  id: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  body: string;
  bodyPreview: string;
  isRead: boolean;
  isFlagged: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  importance: 'low' | 'normal' | 'high';
  receivedDateTime: string;
  sentDateTime: string;
  conversationId: string;
  folderId: string;
  categories: Category[];
  attachments: Attachment[];
}

export interface EmailAddress {
  name: string;
  address: string;
}

export interface Attachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
}

export interface MailFolder {
  id: string;
  displayName: string;
  parentFolderId: string | null;
  unreadItemCount: number;
  totalItemCount: number;
  folderType: FolderType;
  childFolders: MailFolder[];
}

export type FolderType = 'inbox' | 'sent' | 'drafts' | 'trash' | 'archive' | 'spam' | 'outbox' | 'custom';

export interface ConversationGroup {
  conversationId: string;
  subject: string;
  messages: EmailMessage[];
  lastMessageDate: string;
  unreadCount: number;
  participants: EmailAddress[];
}

export interface ComposeMailData {
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  body: string;
  attachments: File[];
  importance: 'low' | 'normal' | 'high';
  isReply: boolean;
  isForward: boolean;
  originalMessageId?: string;
  signatureId?: string;
}

export interface EmailSignature {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
}
