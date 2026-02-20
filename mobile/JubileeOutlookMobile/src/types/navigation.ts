/**
 * Navigation type definitions for React Navigation.
 */
import type { NavigatorScreenParams } from '@react-navigation/native';
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
  SyncEmail: undefined;
  SyncPassword: { email: string };
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: { email?: string } | undefined;
};

// Mail stack (defined before MainTabParamList so it can be referenced)
export type MailStackParamList = {
  MailInbox: undefined;
  MessageDetail: { messageId: string; message?: EmailMessage };
  Compose: {
    mode: 'new' | 'reply' | 'replyAll' | 'forward';
    originalMessage?: EmailMessage;
    draftId?: string;
    to?: string;
  };
  FolderMessages: { folderId: string; folderName: string };
  Search: undefined;
};

// Main bottom tabs
export type MainTabParamList = {
  MailTab: NavigatorScreenParams<MailStackParamList> | undefined;
  CalendarTab: undefined;
  PeopleTab: undefined;
  SettingsTab: undefined;
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
