export type EntryStatus = 'draft' | 'review' | 'approved' | 'active' | 'deprecated';
export type GuardrailLevel = 'low' | 'medium' | 'high';
export type ScopeLevel = 'group' | 'individual';

export interface ContentEntry {
  overlay_id: string;
  title: string;
  status: EntryStatus;
  content: string;
  domain: string;
  scope: {
    level: ScopeLevel;
    domain_key: string;
    sub_key: string;
  };
  associations: {
    personas: string[];
    abilities: string[];
    ministries: string[];
    models: string[];
    languages: string[];
  };
  guardrails: {
    level: GuardrailLevel;
  };
  version: {
    major: number;
    minor: number;
  };
  lifecycle: {
    created_at: string;
    updated_at: string;
    supersedes: string | null;
  };
  authoring_notes: string;
  content_hash: string;
  metadata_hash: string;
  full_path: string;
}

export interface EntryFormData {
  title: string;
  content: string;
  domain: string;
  scope: {
    level: ScopeLevel;
    domain_key: string;
    sub_key: string;
  };
  associations: {
    personas: string[];
    abilities: string[];
    ministries: string[];
    models: string[];
    languages: string[];
  };
  guardrails: {
    level: GuardrailLevel;
  };
  authoring_notes: string;
}
