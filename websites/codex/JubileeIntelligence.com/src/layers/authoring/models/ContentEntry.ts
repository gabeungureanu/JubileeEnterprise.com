import { z } from 'zod';
import { ROOT_DOMAINS, SCOPE_LEVELS, ENTRY_STATUSES, GUARDRAIL_LEVELS } from '../../../config/domains';

// Zod schema for validation
export const ContentEntrySchema = z.object({
  // Identity
  overlay_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  status: z.enum(ENTRY_STATUSES),

  // Canonical content (human-written)
  content: z.string().min(1),

  // Domain classification
  domain: z.enum(ROOT_DOMAINS),

  // Scope (inheritance control)
  scope: z.object({
    level: z.enum(SCOPE_LEVELS),
    domain_key: z.string(),        // e.g., "Inspire"
    sub_key: z.string()            // e.g., "Jubilee" or "_shared"
  }),

  // Associations (cross-references)
  associations: z.object({
    personas: z.array(z.string()).default([]),
    abilities: z.array(z.string()).default([]),
    ministries: z.array(z.string()).default([]),
    models: z.array(z.string()).default([]),
    languages: z.array(z.string()).default(['English'])
  }),

  // Guardrails
  guardrails: z.object({
    level: z.enum(GUARDRAIL_LEVELS)
  }),

  // Versioning
  version: z.object({
    major: z.number().int().min(0),
    minor: z.number().int().min(0)
  }),

  // Lifecycle tracking
  lifecycle: z.object({
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    supersedes: z.string().uuid().nullable()
  }),

  // Human notes (never sent to Qdrant)
  authoring_notes: z.string().default('')
});

export type ContentEntry = z.infer<typeof ContentEntrySchema>;

// Computed fields for internal use
export interface ContentEntryWithMeta extends ContentEntry {
  content_hash: string;
  metadata_hash: string;
  full_path: string;  // e.g., "Personas/Inspire/Jubilee"
}

// Input type for creating entries (without auto-generated fields)
export type CreateContentEntryInput = Omit<ContentEntry, 'overlay_id' | 'lifecycle'>;

// Input type for updating metadata
export type UpdateMetadataInput = Partial<Pick<ContentEntry, 'title' | 'associations' | 'guardrails' | 'authoring_notes'>>;
