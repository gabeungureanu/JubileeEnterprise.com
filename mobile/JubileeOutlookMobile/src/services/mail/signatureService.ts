/**
 * Signature Service — client-side storage (mirrors web localStorage pattern).
 */
import { StorageKeys } from '../../constants';
import { storage } from '../../utils/storage';
import type { EmailSignature } from '../../types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const signatureService = {
  async getAll(): Promise<EmailSignature[]> {
    return (await storage.getJSON<EmailSignature[]>(StorageKeys.SIGNATURES)) || [];
  },

  async create(name: string, html: string): Promise<EmailSignature> {
    const signatures = await this.getAll();
    const sig: EmailSignature = {
      id: generateId(),
      name,
      html,
      isDefault: signatures.length === 0,
      createdAt: new Date().toISOString(),
    };
    signatures.push(sig);
    await storage.setJSON(StorageKeys.SIGNATURES, signatures);
    return sig;
  },

  async update(id: string, name: string, html: string): Promise<EmailSignature | null> {
    const signatures = await this.getAll();
    const idx = signatures.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    signatures[idx] = { ...signatures[idx], name, html };
    await storage.setJSON(StorageKeys.SIGNATURES, signatures);
    return signatures[idx];
  },

  async remove(id: string): Promise<void> {
    const signatures = (await this.getAll()).filter((s) => s.id !== id);
    await storage.setJSON(StorageKeys.SIGNATURES, signatures);
  },

  async setDefault(id: string): Promise<void> {
    const signatures = await this.getAll();
    signatures.forEach((s) => (s.isDefault = s.id === id));
    await storage.setJSON(StorageKeys.SIGNATURES, signatures);
  },

  async getDefault(): Promise<EmailSignature | null> {
    const signatures = await this.getAll();
    return signatures.find((s) => s.isDefault) || null;
  },

  async getActiveId(): Promise<string | null> {
    return storage.get(StorageKeys.ACTIVE_SIGNATURE_ID);
  },

  async setActiveId(id: string | null): Promise<void> {
    if (id) {
      await storage.set(StorageKeys.ACTIVE_SIGNATURE_ID, id);
    } else {
      await storage.remove(StorageKeys.ACTIVE_SIGNATURE_ID);
    }
  },
};
