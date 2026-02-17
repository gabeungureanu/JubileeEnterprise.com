/**
 * Snooze Service — client-side storage (mirrors web localStorage pattern).
 */
import { StorageKeys } from '../../constants';
import { storage } from '../../utils/storage';
import type { SnoozedMessage } from '../../types';

export const snoozeService = {
  async getAll(): Promise<SnoozedMessage[]> {
    return (await storage.getJSON<SnoozedMessage[]>(StorageKeys.SNOOZED_MESSAGES)) || [];
  },

  async snooze(item: SnoozedMessage): Promise<void> {
    const snoozed = await this.getAll();
    const existing = snoozed.findIndex((s) => s.messageId === item.messageId);
    if (existing >= 0) snoozed[existing] = item;
    else snoozed.push(item);
    await storage.setJSON(StorageKeys.SNOOZED_MESSAGES, snoozed);
  },

  async unsnooze(messageId: string): Promise<void> {
    const snoozed = (await this.getAll()).filter((s) => s.messageId !== messageId);
    await storage.setJSON(StorageKeys.SNOOZED_MESSAGES, snoozed);
  },

  async isSnoozed(messageId: string): Promise<boolean> {
    const snoozed = await this.getAll();
    return snoozed.some((s) => s.messageId === messageId);
  },

  async getExpired(): Promise<SnoozedMessage[]> {
    const now = new Date().getTime();
    const snoozed = await this.getAll();
    return snoozed.filter((s) => new Date(s.snoozeUntil).getTime() <= now);
  },

  async clearExpired(): Promise<SnoozedMessage[]> {
    const now = new Date().getTime();
    const snoozed = await this.getAll();
    const expired = snoozed.filter((s) => new Date(s.snoozeUntil).getTime() <= now);
    const remaining = snoozed.filter((s) => new Date(s.snoozeUntil).getTime() > now);
    await storage.setJSON(StorageKeys.SNOOZED_MESSAGES, remaining);
    return expired;
  },
};
