const SIGNATURES_KEY = 'jubilee_email_signatures';
const ACTIVE_SIGNATURE_KEY = 'jubilee_active_signature_id';

export interface EmailSignature {
  id: string;
  name: string;
  html: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

function generateId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const signatureService = {
  getAll(): EmailSignature[] {
    try {
      const raw = localStorage.getItem(SIGNATURES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  save(signatures: EmailSignature[]): void {
    localStorage.setItem(SIGNATURES_KEY, JSON.stringify(signatures));
  },

  create(name: string, html: string): EmailSignature {
    const signatures = this.getAll();
    const isDefault = signatures.length === 0;
    const sig: EmailSignature = {
      id: generateId(),
      name,
      html,
      isDefault,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    signatures.push(sig);
    this.save(signatures);
    if (isDefault) this.setActive(sig.id);
    return sig;
  },

  update(id: string, name: string, html: string): EmailSignature | null {
    const signatures = this.getAll();
    const idx = signatures.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    signatures[idx] = { ...signatures[idx], name, html, updatedAt: new Date().toISOString() };
    this.save(signatures);
    return signatures[idx];
  },

  remove(id: string): void {
    let signatures = this.getAll();
    const wasDefault = signatures.find((s) => s.id === id)?.isDefault;
    signatures = signatures.filter((s) => s.id !== id);
    if (wasDefault && signatures.length > 0) {
      signatures[0].isDefault = true;
      this.setActive(signatures[0].id);
    }
    this.save(signatures);
    if (this.getActiveId() === id) {
      localStorage.removeItem(ACTIVE_SIGNATURE_KEY);
    }
  },

  setDefault(id: string): void {
    const signatures = this.getAll();
    signatures.forEach((s) => (s.isDefault = s.id === id));
    this.save(signatures);
    this.setActive(id);
  },

  getDefault(): EmailSignature | null {
    return this.getAll().find((s) => s.isDefault) || null;
  },

  getActiveId(): string | null {
    return localStorage.getItem(ACTIVE_SIGNATURE_KEY);
  },

  setActive(id: string | null): void {
    if (id) {
      localStorage.setItem(ACTIVE_SIGNATURE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_SIGNATURE_KEY);
    }
  },

  getActive(): EmailSignature | null {
    const activeId = this.getActiveId();
    if (activeId) {
      const sig = this.getAll().find((s) => s.id === activeId);
      if (sig) return sig;
    }
    return this.getDefault();
  },
};
