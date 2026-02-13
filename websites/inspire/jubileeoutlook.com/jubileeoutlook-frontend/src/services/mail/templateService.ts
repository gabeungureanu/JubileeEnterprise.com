const STORAGE_KEY = 'jubilee_email_templates';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  createdAt: string;
  updatedAt: string;
}

function getAll(): EmailTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(templates: EmailTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export const templateService = {
  getAll,

  get(id: string): EmailTemplate | undefined {
    return getAll().find((t) => t.id === id);
  },

  create(name: string, subject: string, bodyHtml: string): EmailTemplate {
    const template: EmailTemplate = {
      id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      subject,
      bodyHtml,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const templates = getAll();
    templates.push(template);
    saveAll(templates);
    return template;
  },

  update(id: string, name: string, subject: string, bodyHtml: string): void {
    const templates = getAll().map((t) =>
      t.id === id ? { ...t, name, subject, bodyHtml, updatedAt: new Date().toISOString() } : t
    );
    saveAll(templates);
  },

  remove(id: string): void {
    saveAll(getAll().filter((t) => t.id !== id));
  },
};
