/**
 * Template Service — client-side storage (mirrors web localStorage pattern).
 */
import { StorageKeys } from '../../constants';
import { storage } from '../../utils/storage';
import type { EmailTemplate } from '../../types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const templateService = {
  async getAll(): Promise<EmailTemplate[]> {
    return (await storage.getJSON<EmailTemplate[]>(StorageKeys.TEMPLATES)) || [];
  },

  async get(id: string): Promise<EmailTemplate | null> {
    const templates = await this.getAll();
    return templates.find((t) => t.id === id) || null;
  },

  async create(name: string, subject: string, bodyHtml: string): Promise<EmailTemplate> {
    const templates = await this.getAll();
    const template: EmailTemplate = {
      id: generateId(),
      name,
      subject,
      bodyHtml,
      createdAt: new Date().toISOString(),
    };
    templates.push(template);
    await storage.setJSON(StorageKeys.TEMPLATES, templates);
    return template;
  },

  async update(id: string, name: string, subject: string, bodyHtml: string): Promise<EmailTemplate | null> {
    const templates = await this.getAll();
    const idx = templates.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    templates[idx] = { ...templates[idx], name, subject, bodyHtml };
    await storage.setJSON(StorageKeys.TEMPLATES, templates);
    return templates[idx];
  },

  async remove(id: string): Promise<void> {
    const templates = (await this.getAll()).filter((t) => t.id !== id);
    await storage.setJSON(StorageKeys.TEMPLATES, templates);
  },
};
