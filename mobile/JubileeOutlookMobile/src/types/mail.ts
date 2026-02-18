/**
 * Mail types — mirrors web frontend src/types/mail/index.ts
 */

// --- API DTO shapes (snake_case from InspireContinuum) ---

export interface MailFolderDto {
  id: string;
  name: string;
  folder_type: string;
  unread_count: number;
  total_count: number;
  icon: string;
  parent_folder_id: string | null;
  is_account_root: boolean;
  wwbw_email_address: string;
  is_expanded: boolean;
  subfolders: MailFolderDto[];
}

export interface EmailMessageDto {
  id: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  body_html: string;
  body_text: string;
  body_preview: string;
  recipients: RecipientDto[];
  received_at: string;
  sent_at: string;
  is_read: boolean;
  is_flagged: boolean;
  has_attachments: boolean;
  attachments: AttachmentDto[];
  folder_id: string;
  importance: string;
  conversation_id: string;
}

export interface RecipientDto {
  email: string;
  name: string;
  type: 'to' | 'cc' | 'bcc';
}

export interface AttachmentDto {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  isInline: boolean;
}

export interface ApiFoldersResponse {
  success: boolean;
  error?: string;
  folders: MailFolderDto[];
}

export interface ApiMessagesResponse {
  success: boolean;
  error?: string;
  messages: EmailMessageDto[];
  total_count: number;
  page: number;
  page_size: number;
}

export type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward';

export type FolderType = 'inbox' | 'sent' | 'drafts' | 'trash' | 'archive' | 'spam' | 'outbox' | 'custom';

// --- DTO Mappers ---

export function mapFolderDto(dto: MailFolderDto): MailFolder {
  const typeMap: Record<string, FolderType> = {
    inbox: 'inbox', sent: 'sent', drafts: 'drafts', trash: 'trash',
    archive: 'archive', spam: 'spam', junk: 'spam', outbox: 'outbox',
  };
  return {
    id: dto.id,
    displayName: dto.name,
    parentFolderId: dto.parent_folder_id,
    unreadItemCount: dto.unread_count,
    totalItemCount: dto.total_count,
    folderType: typeMap[dto.folder_type?.toLowerCase()] || 'custom',
    childFolders: (dto.subfolders || []).map(mapFolderDto),
    accountEmail: dto.wwbw_email_address || '',
  };
}

export function mapMessageDto(dto: EmailMessageDto): EmailMessage {
  const toRecipients = (dto.recipients || []).filter((r) => r.type === 'to');
  const ccRecipients = (dto.recipients || []).filter((r) => r.type === 'cc');
  const bccRecipients = (dto.recipients || []).filter((r) => r.type === 'bcc');
  return {
    id: dto.id,
    subject: dto.subject,
    from: { name: dto.sender_name, address: dto.sender_email },
    to: toRecipients.map((r) => ({ name: r.name, address: r.email })),
    cc: ccRecipients.map((r) => ({ name: r.name, address: r.email })),
    bcc: bccRecipients.map((r) => ({ name: r.name, address: r.email })),
    bodyHtml: dto.body_html,
    bodyText: dto.body_text,
    bodyPreview: dto.body_preview,
    isRead: dto.is_read,
    isFlagged: dto.is_flagged,
    hasAttachments: dto.has_attachments,
    attachments: dto.attachments || [],
    folderId: dto.folder_id,
    importance: dto.importance,
    receivedAt: dto.received_at,
    sentAt: dto.sent_at,
    conversationId: dto.conversation_id,
  };
}

// --- Frontend display types (mapped from DTOs) ---

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
  displayName: string;
  parentFolderId: string | null;
  unreadItemCount: number;
  totalItemCount: number;
  folderType: FolderType;
  childFolders: MailFolder[];
  /** Email address of the account this folder belongs to. */
  accountEmail: string;
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
  subject: string;
  from: { name: string; address: string };
  to: { name: string; address: string }[];
  cc: { name: string; address: string }[];
  bcc: { name: string; address: string }[];
  bodyHtml: string;
  bodyText: string;
  bodyPreview: string;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  attachments: AttachmentDto[];
  folderId: string;
  importance: string;
  receivedAt: string;
  sentAt: string;
  conversationId: string;
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
