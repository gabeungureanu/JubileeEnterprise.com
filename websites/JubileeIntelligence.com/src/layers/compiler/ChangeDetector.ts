import { ContentEntryWithMeta } from '../authoring/models/ContentEntry';

export type ChangeType = 'none' | 'metadata_only' | 'content_changed' | 'new' | 'deleted';

export interface ChangeResult {
  overlay_id: string;
  changeType: ChangeType;
  requiresReEmbed: boolean;
  entry: ContentEntryWithMeta | null;
}

export interface PreviousState {
  overlay_id: string;
  content_hash: string;
  metadata_hash: string;
}

export class ChangeDetector {
  private previousHashes: Map<string, { content_hash: string; metadata_hash: string }>;

  constructor() {
    this.previousHashes = new Map();
  }

  /**
   * Load previous state from Qdrant metadata or local cache
   */
  loadPreviousState(entries: PreviousState[]): void {
    this.previousHashes.clear();
    for (const entry of entries) {
      this.previousHashes.set(entry.overlay_id, {
        content_hash: entry.content_hash,
        metadata_hash: entry.metadata_hash
      });
    }
  }

  /**
   * Detect changes for a batch of entries
   */
  detectChanges(currentEntries: ContentEntryWithMeta[]): ChangeResult[] {
    const results: ChangeResult[] = [];
    const currentIds = new Set<string>();

    for (const entry of currentEntries) {
      currentIds.add(entry.overlay_id);
      const previous = this.previousHashes.get(entry.overlay_id);

      if (!previous) {
        results.push({
          overlay_id: entry.overlay_id,
          changeType: 'new',
          requiresReEmbed: true,
          entry
        });
      } else if (previous.content_hash !== entry.content_hash) {
        results.push({
          overlay_id: entry.overlay_id,
          changeType: 'content_changed',
          requiresReEmbed: true,
          entry
        });
      } else if (previous.metadata_hash !== entry.metadata_hash) {
        results.push({
          overlay_id: entry.overlay_id,
          changeType: 'metadata_only',
          requiresReEmbed: false,
          entry
        });
      } else {
        results.push({
          overlay_id: entry.overlay_id,
          changeType: 'none',
          requiresReEmbed: false,
          entry
        });
      }
    }

    // Detect deletions (in previous but not in current)
    for (const [id] of this.previousHashes) {
      if (!currentIds.has(id)) {
        results.push({
          overlay_id: id,
          changeType: 'deleted',
          requiresReEmbed: false,
          entry: null
        });
      }
    }

    return results;
  }

  /**
   * Get summary statistics for a set of changes
   */
  getChangeSummary(changes: ChangeResult[]): {
    total: number;
    new: number;
    contentChanged: number;
    metadataOnly: number;
    unchanged: number;
    deleted: number;
    requiresReEmbed: number;
  } {
    return {
      total: changes.length,
      new: changes.filter(c => c.changeType === 'new').length,
      contentChanged: changes.filter(c => c.changeType === 'content_changed').length,
      metadataOnly: changes.filter(c => c.changeType === 'metadata_only').length,
      unchanged: changes.filter(c => c.changeType === 'none').length,
      deleted: changes.filter(c => c.changeType === 'deleted').length,
      requiresReEmbed: changes.filter(c => c.requiresReEmbed).length
    };
  }

  /**
   * Check if a specific entry has changed
   */
  hasChanged(entry: ContentEntryWithMeta): boolean {
    const previous = this.previousHashes.get(entry.overlay_id);
    if (!previous) return true;
    return previous.content_hash !== entry.content_hash ||
           previous.metadata_hash !== entry.metadata_hash;
  }

  /**
   * Clear the previous state cache
   */
  clear(): void {
    this.previousHashes.clear();
  }
}
