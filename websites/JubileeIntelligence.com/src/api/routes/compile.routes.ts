import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Compiler } from '../../layers/compiler/Compiler';
import { validateBody } from '../middleware/validation';

const CompileOptionsSchema = z.object({
  dryRun: z.boolean().default(false),
  verbose: z.boolean().default(false),
  batchSize: z.number().int().min(1).max(100).default(10)
});

const CompileEntriesSchema = z.object({
  overlayIds: z.array(z.string().uuid()).min(1),
  dryRun: z.boolean().default(false),
  verbose: z.boolean().default(false)
});

export function createCompileRoutes(compiler: Compiler): Router {
  const router = Router();

  // Full compile (sync all changes to Qdrant)
  router.post('/submit',
    validateBody(CompileOptionsSchema),
    async (req: Request, res: Response) => {
      try {
        const result = await compiler.compile(req.body);
        res.json(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
      }
    }
  );

  // Compile specific entries
  router.post('/entries',
    validateBody(CompileEntriesSchema),
    async (req: Request, res: Response) => {
      try {
        const { overlayIds, ...options } = req.body;
        const result = await compiler.compileEntries(overlayIds, options);
        res.json(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
      }
    }
  );

  // Get compilation status
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const status = await compiler.getStatus();
      res.json(status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  // Dry run compile (preview changes without executing)
  router.post('/preview', async (_req: Request, res: Response) => {
    try {
      const result = await compiler.compile({ dryRun: true, verbose: false });
      res.json({
        wouldProcess: result.processed,
        wouldCreate: result.newEntries,
        wouldUpdateMetadata: result.updatedMetadata,
        wouldReEmbed: result.reEmbedded,
        wouldSoftDelete: result.softDeleted,
        unchanged: result.unchanged,
        errors: result.errors
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  return router;
}
