const STORAGE_KEY = 'jubilee_email_rules';

export type RuleConditionField = 'from' | 'to' | 'subject' | 'hasAttachment';
export type RuleConditionOp = 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'is';
export type RuleActionType = 'moveToFolder' | 'markAsRead' | 'flag' | 'delete';

export interface RuleCondition {
  field: RuleConditionField;
  operator: RuleConditionOp;
  value: string;
}

export interface RuleAction {
  type: RuleActionType;
  folderId?: string;
}

export interface EmailRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];
  matchAll: boolean; // true = AND, false = OR
  actions: RuleAction[];
  createdAt: string;
}

function getAll(): EmailRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(rules: EmailRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export const rulesService = {
  getAll,

  get(id: string): EmailRule | undefined {
    return getAll().find((r) => r.id === id);
  },

  create(rule: Omit<EmailRule, 'id' | 'createdAt'>): EmailRule {
    const newRule: EmailRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const rules = getAll();
    rules.push(newRule);
    saveAll(rules);
    return newRule;
  },

  update(id: string, updates: Partial<Omit<EmailRule, 'id' | 'createdAt'>>): void {
    const rules = getAll().map((r) =>
      r.id === id ? { ...r, ...updates } : r
    );
    saveAll(rules);
  },

  remove(id: string): void {
    saveAll(getAll().filter((r) => r.id !== id));
  },

  toggleEnabled(id: string): void {
    const rules = getAll().map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    saveAll(rules);
  },

  getEnabled(): EmailRule[] {
    return getAll().filter((r) => r.enabled);
  },
};
