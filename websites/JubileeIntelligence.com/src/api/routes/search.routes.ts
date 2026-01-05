import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { QdrantReader } from '../../layers/execution/QdrantReader';
import { EmbeddingGenerator } from '../../layers/compiler/EmbeddingGenerator';
import { validateBody } from '../middleware/validation';

const SearchSchema = z.object({
  query: z.string().min(1),
  filters: z.object({
    domain: z.string().optional(),
    persona: z.string().optional(),
    abilities: z.array(z.string()).optional(),
    models: z.array(z.string()).optional(),
    guardrailLevel: z.enum(['low', 'medium', 'high']).optional(),
    languages: z.array(z.string()).optional()
  }).optional(),
  limit: z.number().int().min(1).max(100).default(10)
});

const RecommendSchema = z.object({
  positiveIds: z.array(z.string().uuid()).min(1),
  negativeIds: z.array(z.string().uuid()).default([]),
  limit: z.number().int().min(1).max(100).default(10)
});

export function createSearchRoutes(reader: QdrantReader, embedder: EmbeddingGenerator): Router {
  const router = Router();

  // Semantic search
  router.post('/search',
    validateBody(SearchSchema),
    async (req: Request, res: Response) => {
      try {
        const { query, filters = {}, limit } = req.body;

        // Generate embedding for query
        const vector = await embedder.generateEmbedding(query);

        // Search Qdrant
        const results = await reader.search(vector, filters, limit);

        res.json({
          query,
          count: results.length,
          results: results.map(r => ({
            id: r.id,
            score: r.score,
            title: r.payload.title,
            domain: r.payload.domain,
            path: r.payload.path,
            version: r.payload.version,
            guardrail_level: r.payload.guardrail_level
          }))
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
      }
    }
  );

  // Get entries by persona (with inheritance)
  router.get('/persona/:persona', async (req: Request, res: Response) => {
    try {
      const { persona } = req.params;
      const domainKey = (req.query.domainKey as string) || 'Inspire';

      const results = await reader.getByPersona(persona, domainKey);

      res.json({
        persona,
        domainKey,
        count: results.length,
        results: results.map(r => ({
          id: r.id,
          title: r.payload.title,
          domain: r.payload.domain,
          path: r.payload.path,
          scope_sub_key: r.payload.scope_sub_key
        }))
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  // Get entries by domain
  router.get('/domain/:domain', async (req: Request, res: Response) => {
    try {
      const { domain } = req.params;
      const results = await reader.getByDomain(domain);

      res.json({
        domain,
        count: results.length,
        results: results.map(r => ({
          id: r.id,
          title: r.payload.title,
          path: r.payload.path,
          version: r.payload.version
        }))
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  // Recommend similar entries
  router.post('/recommend',
    validateBody(RecommendSchema),
    async (req: Request, res: Response) => {
      try {
        const { positiveIds, negativeIds, limit } = req.body;
        const results = await reader.recommend(positiveIds, negativeIds, limit);

        res.json({
          count: results.length,
          results: results.map(r => ({
            id: r.id,
            score: r.score,
            title: r.payload.title,
            domain: r.payload.domain,
            path: r.payload.path
          }))
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
      }
    }
  );

  // Get point by ID
  router.get('/point/:id', async (req: Request, res: Response) => {
    try {
      const result = await reader.getById(req.params.id);

      if (!result) {
        res.status(404).json({ error: 'Point not found' });
        return;
      }

      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  // Count entries
  router.get('/count', async (req: Request, res: Response) => {
    try {
      const filter = req.query.domain ? {
        must: [{ key: 'domain', match: { value: req.query.domain as string } }]
      } : undefined;

      const count = await reader.count(filter);
      res.json({ count });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  return router;
}
