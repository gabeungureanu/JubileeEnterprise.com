import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { OverlayRepository } from './layers/authoring/repositories/OverlayRepository';
import { EmbeddingGenerator } from './layers/compiler/EmbeddingGenerator';
import { QdrantWriter } from './layers/execution/QdrantWriter';
import { QdrantReader } from './layers/execution/QdrantReader';
import { Compiler } from './layers/compiler/Compiler';
import { createOverlayRoutes } from './api/routes/overlay.routes';
import { createCompileRoutes } from './api/routes/compile.routes';
import { createSearchRoutes } from './api/routes/search.routes';
import {
  getQdrantConfig,
  getVersion,
  getOverlayDbPath,
  getEmbeddingConfig
} from './config/qdrant';

async function main() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Configuration
  const qdrantConfig = getQdrantConfig();
  const embeddingConfig = getEmbeddingConfig();
  const dbPath = getOverlayDbPath();
  const version = getVersion();
  const openaiApiKey = process.env.OPENAI_API_KEY;

  console.log(`\n📦 Jubilee Intelligence v${version}`);
  console.log('━'.repeat(50));

  if (!openaiApiKey) {
    console.warn('⚠️  Warning: OPENAI_API_KEY not set. Embedding generation will fail.');
  }

  // Initialize components
  console.log('Initializing overlay repository...');
  const repo = new OverlayRepository(dbPath);

  console.log('Initializing embedding generator...');
  const embedder = new EmbeddingGenerator(openaiApiKey || '', embeddingConfig.model);

  // Initialize writers and readers for both collections
  console.log('Initializing Qdrant connections...');

  const personasWriter = new QdrantWriter(
    qdrantConfig.url,
    qdrantConfig.apiKey,
    qdrantConfig.collections.personas
  );

  const systemWriter = new QdrantWriter(
    qdrantConfig.url,
    qdrantConfig.apiKey,
    qdrantConfig.collections.system
  );

  const personasReader = new QdrantReader(
    qdrantConfig.url,
    qdrantConfig.apiKey,
    qdrantConfig.collections.personas
  );

  const systemReader = new QdrantReader(
    qdrantConfig.url,
    qdrantConfig.apiKey,
    qdrantConfig.collections.system
  );

  // Initialize Qdrant collections
  try {
    console.log('Checking Qdrant connection...');
    await personasWriter.initializeCollection(qdrantConfig.vectorSize);
    console.log(`  ✓ Collection '${qdrantConfig.collections.personas}' ready`);

    await systemWriter.initializeCollection(qdrantConfig.vectorSize);
    console.log(`  ✓ Collection '${qdrantConfig.collections.system}' ready`);
  } catch (err) {
    console.error('❌ Failed to connect to Qdrant:', err);
    console.warn('   Qdrant operations will fail until connection is established');
  }

  // Initialize compiler (using personas collection as primary)
  const compiler = new Compiler(repo, embedder, personasWriter);

  // Routes
  app.use('/api/overlay', createOverlayRoutes(repo));
  app.use('/api/compile', createCompileRoutes(compiler));
  app.use('/api/search', createSearchRoutes(personasReader, embedder));

  // Health check
  app.get('/health', async (_req, res) => {
    const health: Record<string, unknown> = {
      status: 'ok',
      version: getVersion(),
      timestamp: new Date().toISOString()
    };

    try {
      const personasInfo = await personasWriter.getCollectionInfo();
      const systemInfo = await systemWriter.getCollectionInfo();
      health.qdrant = {
        connected: true,
        collections: {
          personas: {
            name: qdrantConfig.collections.personas,
            pointCount: personasInfo.pointCount
          },
          system: {
            name: qdrantConfig.collections.system,
            pointCount: systemInfo.pointCount
          }
        }
      };
    } catch {
      health.qdrant = { connected: false };
    }

    try {
      const overlayCount = repo.getAll().length;
      health.overlay = {
        connected: true,
        entryCount: overlayCount
      };
    } catch {
      health.overlay = { connected: false };
    }

    res.json(health);
  });

  // Version endpoint
  app.get('/api/version', (_req, res) => {
    res.json({
      version: getVersion(),
      collections: qdrantConfig.collections
    });
  });

  // API documentation endpoint
  app.get('/api', (_req, res) => {
    res.json({
      name: 'Jubilee Intelligence',
      version: getVersion(),
      collections: qdrantConfig.collections,
      endpoints: {
        overlay: {
          'POST /api/overlay/entries': 'Create a new content entry',
          'GET /api/overlay/entries/:id': 'Get entry by ID',
          'GET /api/overlay/entries': 'Get entries by scope (query: domain, domainKey, subKey)',
          'PATCH /api/overlay/entries/:id/metadata': 'Update metadata only',
          'PATCH /api/overlay/entries/:id/content': 'Update content (triggers re-embed)',
          'PATCH /api/overlay/entries/:id/status': 'Update status',
          'DELETE /api/overlay/entries/:id': 'Soft delete entry',
          'POST /api/overlay/entries/:id/supersede': 'Replace with new entry',
          'DELETE /api/overlay/entries/:id/hard': 'Hard delete (admin only)',
          'GET /api/overlay/entries/:id/audit': 'Get audit log for entry',
          'GET /api/overlay/resolved/:domain/:domainKey/:individual': 'Get resolved entries with inheritance'
        },
        compile: {
          'POST /api/compile/submit': 'Compile and sync all changes to Qdrant',
          'POST /api/compile/entries': 'Compile specific entries',
          'GET /api/compile/status': 'Get compilation status',
          'POST /api/compile/preview': 'Preview changes without executing'
        },
        search: {
          'POST /api/search/search': 'Semantic search',
          'GET /api/search/persona/:persona': 'Get entries by persona',
          'GET /api/search/domain/:domain': 'Get entries by domain',
          'POST /api/search/recommend': 'Get similar entries',
          'GET /api/search/point/:id': 'Get point by ID',
          'GET /api/search/count': 'Count entries'
        },
        system: {
          'GET /health': 'Health check',
          'GET /api/version': 'Get current version'
        }
      }
    });
  });

  // Error handling middleware
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log('━'.repeat(50));
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`   Health:  http://localhost:${PORT}/health`);
    console.log(`   API:     http://localhost:${PORT}/api`);
    console.log(`   Qdrant:  ${qdrantConfig.url}`);
    console.log(`   Collections:`);
    console.log(`     - Personas: ${qdrantConfig.collections.personas}`);
    console.log(`     - System:   ${qdrantConfig.collections.system}`);
    console.log('━'.repeat(50) + '\n');
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
