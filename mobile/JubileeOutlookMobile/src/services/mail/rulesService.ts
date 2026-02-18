/**
 * Rules Service — client-side storage (mirrors web localStorage pattern).
 */
import { StorageKeys } from '../../constants';
import { storage } from '../../utils/storage';
import type { EmailRule } from '../../types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const rulesService = {
  async getAll(): Promise<EmailRule[]> {
    return (await storage.getJSON<EmailRule[]>(StorageKeys.RULES)) || [];
  },

  async get(id: string): Promise<EmailRule | null> {
    const rules = await this.getAll();
    return rules.find((r) => r.id === id) || null;
  },

  async create(rule: Omit<EmailRule, 'id' | 'createdAt'>): Promise<EmailRule> {
    const rules = await this.getAll();
    const newRule: EmailRule = {
      ...rule,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    rules.push(newRule);
    await storage.setJSON(StorageKeys.RULES, rules);
    return newRule;
  },

  async update(id: string, updates: Partial<EmailRule>): Promise<EmailRule | null> {
    const rules = await this.getAll();
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    rules[idx] = { ...rules[idx], ...updates };
    await storage.setJSON(StorageKeys.RULES, rules);
    return rules[idx];
  },

  async remove(id: string): Promise<void> {
    const rules = (await this.getAll()).filter((r) => r.id !== id);
    await storage.setJSON(StorageKeys.RULES, rules);
  },

  async toggleEnabled(id: string): Promise<boolean> {
    const rules = await this.getAll();
    const rule = rules.find((r) => r.id === id);
    if (!rule) return false;
    rule.enabled = !rule.enabled;
    await storage.setJSON(StorageKeys.RULES, rules);
    return rule.enabled;
  },

  async getEnabled(): Promise<EmailRule[]> {
    const rules = await this.getAll();
    return rules.filter((r) => r.enabled);
  },
};
