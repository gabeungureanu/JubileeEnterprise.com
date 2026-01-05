import { ContentEntryWithMeta } from '../authoring/models/ContentEntry';
import { OverlayRepository } from '../authoring/repositories/OverlayRepository';
import { InheritanceResolver } from '../authoring/services/InheritanceResolver';
import { ChangeDetector } from './ChangeDetector';
import { EmbeddingGenerator } from './EmbeddingGenerator';
import { QdrantWriter, QdrantOperation } from '../execution/QdrantWriter';
import { bumpVersion, getVersion } from '../../config/qdrant';

export interface CompilationResult {
  processed: number;
  newEntries: number;
  updatedMetadata: number;
  reEmbedded: number;
  softDeleted: number;
  unchanged: number;
  errors: string[];
  duration: number;
  version: string;
  previousVersion: string;
}

export interface CompilationOptions {
  dryRun?: boolean;           // If true, don't actually write to Qdrant
  batchSize?: number;         // Number of embeddings to generate at once
  verbose?: boolean;          // Log detailed progress
}

export class Compiler {
  private repo: OverlayRepository;
  private resolver: InheritanceResolver;
  private changeDetector: ChangeDetector;
  private embedder: EmbeddingGenerator;
  private writer: QdrantWriter;

  constructor(
    repo: OverlayRepository,
    embedder: EmbeddingGenerator,
    writer: QdrantWriter
  ) {
    this.repo = repo;
    this.resolver = new InheritanceResolver(repo);
    this.changeDetector = new ChangeDetector();
    this.embedder = embedder;
    this.writer = writer;
  }

  /**
   * Main compilation pipeline — STATELESS and IDEMPOTENT
   */
  async compile(options: CompilationOptions = {}): Promise<CompilationResult> {
    const startTime = Date.now();
    const { dryRun = false, batchSize = 10, verbose = false } = options;
    const previousVersion = getVersion();

    const result: CompilationResult = {
      processed: 0,
      newEntries: 0,
      updatedMetadata: 0,
      reEmbedded: 0,
      softDeleted: 0,
      unchanged: 0,
      errors: [],
      duration: 0,
      version: previousVersion,
      previousVersion
    };

    try {
      // Step 1: Load current overlay state
      if (verbose) console.log('Loading overlay entries...');
      const allEntries = this.repo.getAllActive();
      if (verbose) console.log(`Found ${allEntries.length} active entries`);

      // Step 2: Load previous Qdrant state for change detection
      if (verbose) console.log('Loading previous Qdrant state...');
      const previousState = await this.writer.getAllMetadata();
      if (verbose) console.log(`Found ${previousState.length} entries in Qdrant`);
      this.changeDetector.loadPreviousState(previousState);

      // Step 3: Detect changes
      if (verbose) console.log('Detecting changes...');
      const changes = this.changeDetector.detectChanges(allEntries);
      const summary = this.changeDetector.getChangeSummary(changes);
      if (verbose) {
        console.log(`Changes: ${summary.new} new, ${summary.contentChanged} content changed, ` +
                   `${summary.metadataOnly} metadata only, ${summary.deleted} deleted, ` +
                   `${summary.unchanged} unchanged`);
      }

      // Step 4: Process changes that require embedding
      const toEmbed = changes.filter(c => c.requiresReEmbed && c.entry);
      if (verbose) console.log(`Generating embeddings for ${toEmbed.length} entries...`);

      // Generate embeddings in batches
      const embeddingMap = new Map<string, number[]>();
      for (let i = 0; i < toEmbed.length; i += batchSize) {
        const batch = toEmbed.slice(i, i + batchSize);
        const texts = batch.map(c => c.entry!.content);

        try {
          const embeddings = await this.embedder.generateBatch(texts);
          batch.forEach((change, idx) => {
            embeddingMap.set(change.overlay_id, embeddings[idx]);
          });
          if (verbose) console.log(`Generated embeddings for batch ${Math.floor(i / batchSize) + 1}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          result.errors.push(`Embedding batch failed: ${errorMessage}`);
        }
      }

      // Step 5: Build operations
      const operations: QdrantOperation[] = [];

      for (const change of changes) {
        result.processed++;

        try {
          switch (change.changeType) {
            case 'new':
              const newVector = embeddingMap.get(change.overlay_id);
              if (newVector && change.entry) {
                operations.push({
                  type: 'upsert',
                  id: change.overlay_id,
                  vector: newVector,
                  payload: this.buildPayload(change.entry)
                });
                result.newEntries++;
              }
              break;

            case 'content_changed':
              const updatedVector = embeddingMap.get(change.overlay_id);
              if (updatedVector && change.entry) {
                operations.push({
                  type: 'upsert',
                  id: change.overlay_id,
                  vector: updatedVector,
                  payload: this.buildPayload(change.entry)
                });
                result.reEmbedded++;
              }
              break;

            case 'metadata_only':
              if (change.entry) {
                operations.push({
                  type: 'update_payload',
                  id: change.overlay_id,
                  payload: this.buildPayload(change.entry)
                });
                result.updatedMetadata++;
              }
              break;

            case 'deleted':
              operations.push({
                type: 'soft_delete',
                id: change.overlay_id
              });
              result.softDeleted++;
              break;

            case 'none':
              result.unchanged++;
              break;
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          result.errors.push(`Error processing ${change.overlay_id}: ${errorMessage}`);
        }
      }

      // Step 6: Execute operations in Qdrant (unless dry run)
      if (!dryRun && operations.length > 0) {
        if (verbose) console.log(`Executing ${operations.length} operations in Qdrant...`);
        await this.writer.executeBatch(operations);
        if (verbose) console.log('Operations completed');

        // Step 7: Bump version after successful write to Qdrant
        const newVersion = bumpVersion();
        result.version = newVersion;
        if (verbose) console.log(`Version bumped: ${previousVersion} -> ${newVersion}`);
      } else if (dryRun) {
        if (verbose) console.log(`Dry run: would execute ${operations.length} operations`);
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      result.errors.push(`Compilation failed: ${errorMessage}`);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Compile only specific entries by ID
   */
  async compileEntries(overlayIds: string[], options: CompilationOptions = {}): Promise<CompilationResult> {
    const startTime = Date.now();
    const { dryRun = false, verbose = false } = options;
    const previousVersion = getVersion();

    const result: CompilationResult = {
      processed: 0,
      newEntries: 0,
      updatedMetadata: 0,
      reEmbedded: 0,
      softDeleted: 0,
      unchanged: 0,
      errors: [],
      duration: 0,
      version: previousVersion,
      previousVersion
    };

    try {
      const operations: QdrantOperation[] = [];

      for (const id of overlayIds) {
        const entry = this.repo.getById(id);
        if (!entry) {
          result.errors.push(`Entry ${id} not found`);
          continue;
        }

        result.processed++;

        try {
          // Always regenerate embedding for specific compile
          const vector = await this.embedder.generateEmbedding(entry.content);
          operations.push({
            type: 'upsert',
            id: entry.overlay_id,
            vector,
            payload: this.buildPayload(entry)
          });
          result.reEmbedded++;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          result.errors.push(`Error processing ${id}: ${errorMessage}`);
        }
      }

      if (!dryRun && operations.length > 0) {
        await this.writer.executeBatch(operations);

        // Bump version after successful write
        const newVersion = bumpVersion();
        result.version = newVersion;
        if (verbose) console.log(`Version bumped: ${previousVersion} -> ${newVersion}`);
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      result.errors.push(`Compilation failed: ${errorMessage}`);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Build Qdrant payload from overlay entry
   */
  private buildPayload(entry: ContentEntryWithMeta): Record<string, unknown> {
    return {
      overlay_id: entry.overlay_id,
      title: entry.title,
      domain: entry.domain,
      path: entry.full_path,
      scope_level: entry.scope.level,
      scope_domain_key: entry.scope.domain_key,
      scope_sub_key: entry.scope.sub_key,
      status: entry.status,
      version: `${entry.version.major}.${entry.version.minor}`,
      language: entry.associations.languages[0] || 'English',
      guardrail_level: entry.guardrails.level,
      supersedes: entry.lifecycle.supersedes,
      is_placeholder: false,
      content_hash: entry.content_hash,
      metadata_hash: entry.metadata_hash,
      // Include associations for filtering
      personas: entry.associations.personas,
      abilities: entry.associations.abilities,
      ministries: entry.associations.ministries,
      models: entry.associations.models,
      languages: entry.associations.languages,
      // Timestamps
      created_at: entry.lifecycle.created_at,
      updated_at: entry.lifecycle.updated_at
    };
  }

  /**
   * Get status of last compilation
   */
  async getStatus(): Promise<{
    version: string;
    overlayCount: number;
    qdrantCount: number;
    pendingChanges: number;
  }> {
    const allEntries = this.repo.getAllActive();
    const previousState = await this.writer.getAllMetadata();
    this.changeDetector.loadPreviousState(previousState);
    const changes = this.changeDetector.detectChanges(allEntries);
    const pendingChanges = changes.filter(c => c.changeType !== 'none').length;

    return {
      version: getVersion(),
      overlayCount: allEntries.length,
      qdrantCount: previousState.length,
      pendingChanges
    };
  }
}
