const STORAGE_KEY = 'jubilee_snoozed_messages';

export interface SnoozedMessage {
  messageId: string;
  folderId: string;
  snoozeUntil: string; // ISO date string
  subject: string;
  senderName: string;
}

function getAll(): SnoozedMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(items: SnoozedMessage[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const snoozeService = {
  getAll,

  snooze(item: SnoozedMessage): void {
    const items = getAll().filter((s) => s.messageId !== item.messageId);
    items.push(item);
    saveAll(items);
  },

  unsnooze(messageId: string): void {
    const items = getAll().filter((s) => s.messageId !== messageId);
    saveAll(items);
  },

  isSnoozed(messageId: string): boolean {
    return getAll().some((s) => s.messageId === messageId);
  },

  getExpired(): SnoozedMessage[] {
    const now = new Date().getTime();
    return getAll().filter((s) => new Date(s.snoozeUntil).getTime() <= now);
  },

  clearExpired(): SnoozedMessage[] {
    const now = new Date().getTime();
    const all = getAll();
    const expired = all.filter((s) => new Date(s.snoozeUntil).getTime() <= now);
    const remaining = all.filter((s) => new Date(s.snoozeUntil).getTime() > now);
    saveAll(remaining);
    return expired;
  },

  getSnoozedCount(): number {
    return getAll().length;
  },
};
