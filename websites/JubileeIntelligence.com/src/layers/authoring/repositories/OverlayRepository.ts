import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  ContentEntry,
  ContentEntrySchema,
  ContentEntryWithMeta,
  CreateContentEntryInput,
  UpdateMetadataInput
} from '../models/ContentEntry';
import { computeContentHash, computeMetadataHash } from '../../../utils/hashing';

interface DatabaseRow {
  overlay_id: string;
  title: string;
  status: string;
  content: string;
  domain: string;
  scope_level: string;
  scope_domain_key: string;
  scope_sub_key: string;
  associations_json: string;
  guardrail_level: string;
  version_major: number;
  version_minor: number;
  created_at: string;
  updated_at: string;
  supersedes: string | null;
  authoring_notes: string;
  content_hash: string;
  metadata_hash: string;
}

export class OverlayRepository {
  private db: Database.Database;

  constructor(dbPath: string = './data/overlay.db') {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content_entries (
        overlay_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        content TEXT NOT NULL,
        domain TEXT NOT NULL,
        scope_level TEXT NOT NULL,
        scope_domain_key TEXT NOT NULL,
        scope_sub_key TEXT NOT NULL,
        associations_json TEXT NOT NULL DEFAULT '{}',
        guardrail_level TEXT NOT NULL DEFAULT 'medium',
        version_major INTEGER NOT NULL DEFAULT 1,
        version_minor INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        supersedes TEXT,
        authoring_notes TEXT DEFAULT '',
        content_hash TEXT NOT NULL,
        metadata_hash TEXT NOT NULL,
        FOREIGN KEY (supersedes) REFERENCES content_entries(overlay_id)
      );

      CREATE INDEX IF NOT EXISTS idx_domain ON content_entries(domain);
      CREATE INDEX IF NOT EXISTS idx_status ON content_entries(status);
      CREATE INDEX IF NOT EXISTS idx_scope ON content_entries(scope_domain_key, scope_sub_key);
      CREATE INDEX IF NOT EXISTS idx_supersedes ON content_entries(supersedes);

      -- Audit log for all changes
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        overlay_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_at TEXT NOT NULL,
        changed_by TEXT DEFAULT 'system'
      );
    `);
  }

  // CREATE
  create(entry: CreateContentEntryInput): ContentEntryWithMeta {
    const overlay_id = uuidv4();
    const now = new Date().toISOString();

    const fullEntry: ContentEntry = {
      ...entry,
      overlay_id,
      lifecycle: {
        created_at: now,
        updated_at: now,
        supersedes: null
      }
    };

    // Validate
    ContentEntrySchema.parse(fullEntry);

    const content_hash = computeContentHash(fullEntry.content);
    const metadata_hash = computeMetadataHash(fullEntry);

    const stmt = this.db.prepare(`
      INSERT INTO content_entries (
        overlay_id, title, status, content, domain,
        scope_level, scope_domain_key, scope_sub_key,
        associations_json, guardrail_level,
        version_major, version_minor,
        created_at, updated_at, supersedes, authoring_notes,
        content_hash, metadata_hash
      ) VALUES (
        @overlay_id, @title, @status, @content, @domain,
        @scope_level, @scope_domain_key, @scope_sub_key,
        @associations_json, @guardrail_level,
        @version_major, @version_minor,
        @created_at, @updated_at, @supersedes, @authoring_notes,
        @content_hash, @metadata_hash
      )
    `);

    stmt.run({
      overlay_id,
      title: fullEntry.title,
      status: fullEntry.status,
      content: fullEntry.content,
      domain: fullEntry.domain,
      scope_level: fullEntry.scope.level,
      scope_domain_key: fullEntry.scope.domain_key,
      scope_sub_key: fullEntry.scope.sub_key,
      associations_json: JSON.stringify(fullEntry.associations),
      guardrail_level: fullEntry.guardrails.level,
      version_major: fullEntry.version.major,
      version_minor: fullEntry.version.minor,
      created_at: fullEntry.lifecycle.created_at,
      updated_at: fullEntry.lifecycle.updated_at,
      supersedes: fullEntry.lifecycle.supersedes,
      authoring_notes: fullEntry.authoring_notes,
      content_hash,
      metadata_hash
    });

    this.logAudit(overlay_id, 'CREATE', null, JSON.stringify(fullEntry));

    return {
      ...fullEntry,
      content_hash,
      metadata_hash,
      full_path: `${fullEntry.domain}/${fullEntry.scope.domain_key}/${fullEntry.scope.sub_key}`
    };
  }

  // READ
  getById(overlay_id: string): ContentEntryWithMeta | null {
    const row = this.db.prepare('SELECT * FROM content_entries WHERE overlay_id = ?').get(overlay_id) as DatabaseRow | undefined;
    return row ? this.rowToEntry(row) : null;
  }

  getByScope(domain: string, domainKey: string, subKey?: string): ContentEntryWithMeta[] {
    let query = 'SELECT * FROM content_entries WHERE domain = ? AND scope_domain_key = ?';
    const params: string[] = [domain, domainKey];

    if (subKey) {
      query += ' AND scope_sub_key = ?';
      params.push(subKey);
    }

    query += ' AND status != ?';
    params.push('deprecated');

    const rows = this.db.prepare(query).all(...params) as DatabaseRow[];
    return rows.map(row => this.rowToEntry(row));
  }

  getAllActive(): ContentEntryWithMeta[] {
    const rows = this.db.prepare(
      'SELECT * FROM content_entries WHERE status = ?'
    ).all('active') as DatabaseRow[];
    return rows.map(row => this.rowToEntry(row));
  }

  getAll(): ContentEntryWithMeta[] {
    const rows = this.db.prepare('SELECT * FROM content_entries').all() as DatabaseRow[];
    return rows.map(row => this.rowToEntry(row));
  }

  // UPDATE (metadata only — no re-embedding required)
  updateMetadata(overlay_id: string, updates: UpdateMetadataInput): ContentEntryWithMeta {
    const existing = this.getById(overlay_id);
    if (!existing) throw new Error(`Entry ${overlay_id} not found`);

    const now = new Date().toISOString();
    const newMinor = existing.version.minor + 1;

    // Merge existing with updates for hash calculation
    const merged = {
      ...existing,
      title: updates.title ?? existing.title,
      associations: updates.associations ?? existing.associations,
      guardrails: updates.guardrails ?? existing.guardrails,
      authoring_notes: updates.authoring_notes ?? existing.authoring_notes
    };

    const newMetadataHash = computeMetadataHash(merged);

    const stmt = this.db.prepare(`
      UPDATE content_entries SET
        title = COALESCE(@title, title),
        associations_json = COALESCE(@associations_json, associations_json),
        guardrail_level = COALESCE(@guardrail_level, guardrail_level),
        authoring_notes = COALESCE(@authoring_notes, authoring_notes),
        version_minor = @version_minor,
        updated_at = @updated_at,
        metadata_hash = @metadata_hash
      WHERE overlay_id = @overlay_id
    `);

    stmt.run({
      overlay_id,
      title: updates.title ?? null,
      associations_json: updates.associations ? JSON.stringify(updates.associations) : null,
      guardrail_level: updates.guardrails?.level ?? null,
      authoring_notes: updates.authoring_notes ?? null,
      version_minor: newMinor,
      updated_at: now,
      metadata_hash: newMetadataHash
    });

    this.logAudit(overlay_id, 'UPDATE_METADATA', JSON.stringify(existing), JSON.stringify(updates));

    return this.getById(overlay_id)!;
  }

  // UPDATE (content change — requires re-embedding)
  updateContent(overlay_id: string, newContent: string): ContentEntryWithMeta {
    const existing = this.getById(overlay_id);
    if (!existing) throw new Error(`Entry ${overlay_id} not found`);

    const now = new Date().toISOString();
    const newMajor = existing.version.major + 1;
    const newContentHash = computeContentHash(newContent);

    const stmt = this.db.prepare(`
      UPDATE content_entries SET
        content = @content,
        version_major = @version_major,
        version_minor = 0,
        updated_at = @updated_at,
        content_hash = @content_hash
      WHERE overlay_id = @overlay_id
    `);

    stmt.run({
      overlay_id,
      content: newContent,
      version_major: newMajor,
      updated_at: now,
      content_hash: newContentHash
    });

    this.logAudit(overlay_id, 'UPDATE_CONTENT', existing.content, newContent);

    return this.getById(overlay_id)!;
  }

  // Update status (e.g., draft -> active)
  updateStatus(overlay_id: string, newStatus: 'active' | 'deprecated' | 'draft'): ContentEntryWithMeta {
    const existing = this.getById(overlay_id);
    if (!existing) throw new Error(`Entry ${overlay_id} not found`);

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE content_entries SET
        status = @status,
        updated_at = @updated_at
      WHERE overlay_id = @overlay_id
    `).run({ overlay_id, status: newStatus, updated_at: now });

    this.logAudit(overlay_id, 'UPDATE_STATUS', existing.status, newStatus);

    return this.getById(overlay_id)!;
  }

  // SOFT DELETE (status = deprecated)
  softDelete(overlay_id: string): void {
    const existing = this.getById(overlay_id);
    if (!existing) throw new Error(`Entry ${overlay_id} not found`);

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE content_entries SET
        status = 'deprecated',
        updated_at = @updated_at
      WHERE overlay_id = @overlay_id
    `).run({ overlay_id, updated_at: now });

    this.logAudit(overlay_id, 'SOFT_DELETE', 'active', 'deprecated');
  }

  // SUPERSEDE (create new entry that replaces old one)
  supersede(oldId: string, newEntryData: CreateContentEntryInput): ContentEntryWithMeta {
    const oldEntry = this.getById(oldId);
    if (!oldEntry) throw new Error(`Entry ${oldId} not found`);

    // Soft delete old entry
    this.softDelete(oldId);

    // Create new entry with incremented major version
    const newEntry = this.create({
      ...newEntryData,
      version: { major: oldEntry.version.major + 1, minor: 0 }
    });

    // Update supersedes reference
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE content_entries SET supersedes = @supersedes, updated_at = @updated_at
      WHERE overlay_id = @overlay_id
    `).run({ overlay_id: newEntry.overlay_id, supersedes: oldId, updated_at: now });

    this.logAudit(newEntry.overlay_id, 'SUPERSEDE', oldId, newEntry.overlay_id);

    return this.getById(newEntry.overlay_id)!;
  }

  // HARD DELETE (admin only, requires confirmation)
  hardDelete(overlay_id: string, adminConfirmation: string): void {
    if (adminConfirmation !== `DELETE_PERMANENTLY_${overlay_id}`) {
      throw new Error('Invalid admin confirmation. Hard delete denied.');
    }

    const existing = this.getById(overlay_id);
    if (!existing) throw new Error(`Entry ${overlay_id} not found`);

    this.db.prepare('DELETE FROM content_entries WHERE overlay_id = ?').run(overlay_id);
    this.logAudit(overlay_id, 'HARD_DELETE', JSON.stringify(existing), null);
  }

  // Get audit history for an entry
  getAuditLog(overlay_id: string): Array<{
    id: number;
    action: string;
    old_value: string | null;
    new_value: string | null;
    changed_at: string;
    changed_by: string;
  }> {
    return this.db.prepare(`
      SELECT id, action, old_value, new_value, changed_at, changed_by
      FROM audit_log
      WHERE overlay_id = ?
      ORDER BY changed_at DESC
    `).all(overlay_id) as Array<{
      id: number;
      action: string;
      old_value: string | null;
      new_value: string | null;
      changed_at: string;
      changed_by: string;
    }>;
  }

  // AUDIT
  private logAudit(overlay_id: string, action: string, oldValue: string | null, newValue: string | null): void {
    this.db.prepare(`
      INSERT INTO audit_log (overlay_id, action, old_value, new_value, changed_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(overlay_id, action, oldValue, newValue, new Date().toISOString());
  }

  // Helper: convert DB row to typed entry
  private rowToEntry(row: DatabaseRow): ContentEntryWithMeta {
    return {
      overlay_id: row.overlay_id,
      title: row.title,
      status: row.status as 'active' | 'deprecated' | 'draft',
      content: row.content,
      domain: row.domain as ContentEntry['domain'],
      scope: {
        level: row.scope_level as 'group' | 'individual',
        domain_key: row.scope_domain_key,
        sub_key: row.scope_sub_key
      },
      associations: JSON.parse(row.associations_json),
      guardrails: { level: row.guardrail_level as 'low' | 'medium' | 'high' },
      version: { major: row.version_major, minor: row.version_minor },
      lifecycle: {
        created_at: row.created_at,
        updated_at: row.updated_at,
        supersedes: row.supersedes
      },
      authoring_notes: row.authoring_notes,
      content_hash: row.content_hash,
      metadata_hash: row.metadata_hash,
      full_path: `${row.domain}/${row.scope_domain_key}/${row.scope_sub_key}`
    };
  }

  // Close database connection
  close(): void {
    this.db.close();
  }
}
