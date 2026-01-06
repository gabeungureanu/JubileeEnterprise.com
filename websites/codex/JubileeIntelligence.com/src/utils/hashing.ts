import crypto from 'crypto';
import { ContentEntry } from '../layers/authoring/models/ContentEntry';

/**
 * Compute SHA-256 hash of content string.
 * Used to detect content changes that require re-embedding.
 */
export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Compute SHA-256 hash of metadata fields.
 * Used to detect metadata-only changes that don't require re-embedding.
 */
export function computeMetadataHash(entry: Partial<ContentEntry>): string {
  const relevantFields = {
    title: entry.title,
    domain: entry.domain,
    scope: entry.scope,
    associations: entry.associations,
    guardrails: entry.guardrails
  };
  return crypto.createHash('sha256')
    .update(JSON.stringify(relevantFields))
    .digest('hex');
}

/**
 * Generate a short hash for display purposes.
 */
export function shortHash(hash: string, length: number = 8): string {
  return hash.substring(0, length);
}
