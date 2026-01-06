import { ContentEntryWithMeta } from '../models/ContentEntry';
import { OverlayRepository } from '../repositories/OverlayRepository';

export interface InheritedEntry extends ContentEntryWithMeta {
  _inherited: boolean;
}

export class InheritanceResolver {
  constructor(private repo: OverlayRepository) {}

  /**
   * Resolve all entries for a specific individual, merging _shared inheritance.
   * Individual entries override _shared entries with the same title.
   */
  resolveForIndividual(domain: string, domainKey: string, individualKey: string): InheritedEntry[] {
    // Get _shared entries (inherited)
    const sharedEntries = this.repo.getByScope(domain, domainKey, '_shared');

    // Get individual entries (override)
    const individualEntries = this.repo.getByScope(domain, domainKey, individualKey);

    // Build map: title → entry (individual overrides shared)
    const mergedMap = new Map<string, InheritedEntry>();

    for (const entry of sharedEntries) {
      mergedMap.set(entry.title, {
        ...entry,
        _inherited: true
      });
    }

    for (const entry of individualEntries) {
      mergedMap.set(entry.title, {
        ...entry,
        _inherited: false
      });
    }

    return Array.from(mergedMap.values());
  }

  /**
   * Get all resolved entries for an entire domain group (e.g., all Inspire personas).
   */
  resolveForGroup(domain: string, domainKey: string, individuals: string[]): Map<string, InheritedEntry[]> {
    const result = new Map<string, InheritedEntry[]>();

    for (const individual of individuals) {
      if (individual === '_shared') continue;
      result.set(individual, this.resolveForIndividual(domain, domainKey, individual));
    }

    return result;
  }

  /**
   * Check if an individual has overridden a specific shared entry.
   */
  hasOverride(domain: string, domainKey: string, individualKey: string, title: string): boolean {
    const individualEntries = this.repo.getByScope(domain, domainKey, individualKey);
    return individualEntries.some(entry => entry.title === title);
  }

  /**
   * Get all _shared entries for a domain group.
   */
  getSharedEntries(domain: string, domainKey: string): ContentEntryWithMeta[] {
    return this.repo.getByScope(domain, domainKey, '_shared');
  }

  /**
   * Get entries that are unique to a specific individual (not inherited from _shared).
   */
  getUniqueEntries(domain: string, domainKey: string, individualKey: string): ContentEntryWithMeta[] {
    const sharedTitles = new Set(
      this.repo.getByScope(domain, domainKey, '_shared').map(e => e.title)
    );

    const individualEntries = this.repo.getByScope(domain, domainKey, individualKey);
    return individualEntries.filter(entry => !sharedTitles.has(entry.title));
  }
}
