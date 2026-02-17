/**
 * Mail types — mirrors web frontend src/types/mail/index.ts
 */

export interface EmailAccount {
  id: string;
  userId: string;
  emailAddress: string;
  displayName?: string;
  providerType: 'google' | 'microsoft' | 'yahoo' | 'apple' | 'generic';
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: string;
  syncEnabled: boolean;
  createdAt: string;
}

export interface MailFolder {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  folderType: 'inbox' | 'sent' | 'drafts' | 'trash' | 'junk' | 'archive' | 'custom';
  unreadCount: number;
  totalCount: number;
  displayOrder: number;
  isSystem: boolean;
  icon?: string;
  parentFolderId?: string;
  subfolders?: MailFolder[];
}

export interface EmailRecipient {
  email: string;
  name?: string;
  type: 'to' | 'cc' | 'bcc';
}

export interface EmailAttachment {
  id: string;
  messageId: string;
  fileName: string;
  filePath?: string;
  fileSize: number;
  mimeType: string;
  isInline: boolean;
}

export interface EmailMessage {
  id: string;
  folderId: string;
  userId: string;
  conversationId?: string;
  subject: string;
  bodyPreview?: string;
  bodyText?: string;
  bodyHtml?: string;
  senderEmail: string;
  senderName?: string;
  isRead: boolean;
  isFlagged: boolean;
  isDraft: boolean;
  isSent: boolean;
  importance: 'low' | 'normal' | 'high';
  hasAttachments: boolean;
  receivedAt?: string;
  sentAt?: string;
  internetMessageId?: string;
  recipients: EmailRecipient[];
  attachments?: EmailAttachment[];
  createdAt: string;
}

export interface SendMessagePayload {
  userId: string;
  sender_email: string;
  subject: string;
  body_html: string;
  body_text?: string;
  recipients: EmailRecipient[];
  importance?: 'low' | 'normal' | 'high';
  attachments?: {
    filename: string;
    content: string; // base64
    contentType: string;
  }[];
}

export interface DraftPayload {
  userId: string;
  sender_email: string;
  id?: string;
  subject: string;
  body_html: string;
  body_text?: string;
  recipients: EmailRecipient[];
}

export interface ProviderDetection {
  type: string;
  displayName: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  isAppPassword: boolean;
  helpText?: string;
}

export interface EmailSignature {
  id: string;
  name: string;
  html: string;
  isDefault: boolean;
  createdAt: string;
}

export interface EmailRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: string;
}

export interface RuleCondition {
  field: 'from' | 'to' | 'subject' | 'body';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith';
  value: string;
}

export interface RuleAction {
  type: 'move' | 'flag' | 'markRead' | 'delete' | 'forward';
  value?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  createdAt: string;
}

export interface SnoozedMessage {
  messageId: string;
  folderId: string;
  snoozeUntil: string;
  subject: string;
  senderName?: string;
}
