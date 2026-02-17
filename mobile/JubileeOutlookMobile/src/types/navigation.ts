/**
 * Navigation type definitions for React Navigation.
 */
import type { CalendarEvent } from './calendar';
import type { Contact } from './contacts';
import type { EmailMessage } from './mail';

// Root stack (auth vs main)
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// Auth stack
export type AuthStackParamList = {
  SignIn: undefined;
};

// Main bottom tabs
export type MainTabParamList = {
  MailTab: undefined;
  CalendarTab: undefined;
  PeopleTab: undefined;
  SettingsTab: undefined;
};

// Mail stack
export type MailStackParamList = {
  MailInbox: undefined;
  MessageDetail: { messageId: string; message?: EmailMessage };
  Compose: {
    mode: 'new' | 'reply' | 'replyAll' | 'forward';
    originalMessage?: EmailMessage;
    draftId?: string;
  };
  FolderMessages: { folderId: string; folderName: string };
  Search: undefined;
};

// Calendar stack
export type CalendarStackParamList = {
  CalendarMain: undefined;
  EventDetail: { eventId: string; event?: CalendarEvent };
  NewEvent: { date?: string; event?: CalendarEvent };
};

// People stack
export type PeopleStackParamList = {
  PeopleMain: undefined;
  ContactDetail: { contactId: string; contact?: Contact };
  ContactEdit: { contactId?: string; contact?: Contact };
  ContactGroup: { groupId: string; groupName: string };
};

// Settings stack
export type SettingsStackParamList = {
  SettingsMain: undefined;
  AccountSettings: undefined;
  SignatureSettings: undefined;
  RulesSettings: undefined;
  TemplateSettings: undefined;
  SyncSettings: undefined;
  GeneralSettings: undefined;
};
