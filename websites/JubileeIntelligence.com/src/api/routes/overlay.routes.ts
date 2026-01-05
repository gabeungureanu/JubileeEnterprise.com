import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OverlayRepository } from '../../layers/authoring/repositories/OverlayRepository';
import { InheritanceResolver } from '../../layers/authoring/services/InheritanceResolver';
import { ROOT_DOMAINS, SCOPE_LEVELS, ENTRY_STATUSES, GUARDRAIL_LEVELS } from '../../config/domains';
import { validateBody, validateParams, UuidParamSchema } from '../middleware/validation';

// Input validation schemas
const CreateEntrySchema = z.object({
  title: z.string().min(1).max(255),
  status: z.enum(ENTRY_STATUSES).default('draft'),
  content: z.string().min(1),
  domain: z.enum(ROOT_DOMAINS),
  scope: z.object({
    level: z.enum(SCOPE_LEVELS),
    domain_key: z.string().min(1),
    sub_key: z.string().min(1)
  }),
  associations: z.object({
    personas: z.array(z.string()).default([]),
    abilities: z.array(z.string()).default([]),
    ministries: z.array(z.string()).default([]),
    models: z.array(z.string()).default([]),
    languages: z.array(z.string()).default(['English'])
  }).default({
    personas: [],
    abilities: [],
    ministries: [],
    models: [],
    languages: ['English']
  }),
  guardrails: z.object({
    level: z.enum(GUARDRAIL_LEVELS)
  }).default({ level: 'medium' }),
  version: z.object({
    major: z.number().int().min(0),
    minor: z.number().int().min(0)
  }).default({ major: 1, minor: 0 }),
  authoring_notes: z.string().default('')
});

const UpdateMetadataSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  associations: z.object({
    personas: z.array(z.string()),
    abilities: z.array(z.string()),
    ministries: z.array(z.string()),
    models: z.array(z.string()),
    languages: z.array(z.string())
  }).optional(),
  guardrails: z.object({
    level: z.enum(GUARDRAIL_LEVELS)
  }).optional(),
  authoring_notes: z.string().optional()
});

const UpdateContentSchema = z.object({
  content: z.string().min(1)
});

const UpdateStatusSchema = z.object({
  status: z.enum(['active', 'deprecated', 'draft'])
});

export function createOverlayRoutes(repo: OverlayRepository): Router {
  const router = Router();
  const resolver = new InheritanceResolver(repo);

  // Create entry
  router.post('/entries',
    validateBody(CreateEntrySchema),
    (req: Request, res: Response) => {
      try {
        const entry = repo.create(req.body);
        res.status(201).json(entry);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(400).json({ error: message });
      }
    }
  );

  // Get entry by ID
  router.get('/entries/:id',
    validateParams(UuidParamSchema),
    (req: Request, res: Response) => {
      const entry = repo.getById(req.params.id);
      if (!entry) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }
      res.json(entry);
    }
  );

  // Get entries by scope
  router.get('/entries', (req: Request, res: Response) => {
    const { domain, domainKey, subKey } = req.query;

    if (!domain || !domainKey) {
      res.status(400).json({ error: 'domain and domainKey query parameters are required' });
      return;
    }

    const entries = repo.getByScope(
      domain as string,
      domainKey as string,
      subKey as string | undefined
    );
    res.json(entries);
  });

  // Get all entries
  router.get('/entries/all', (_req: Request, res: Response) => {
    const entries = repo.getAll();
    res.json(entries);
  });

  // Get all active entries
  router.get('/entries/active', (_req: Request, res: Response) => {
    const entries = repo.getAllActive();
    res.json(entries);
  });

  // Get resolved entries for an individual (with inheritance)
  router.get('/resolved/:domain/:domainKey/:individual', (req: Request, res: Response) => {
    const { domain, domainKey, individual } = req.params;
    const entries = resolver.resolveForIndividual(domain, domainKey, individual);
    res.json(entries);
  });

  // Update metadata only (doesn't require re-embedding)
  router.patch('/entries/:id/metadata',
    validateParams(UuidParamSchema),
    validateBody(UpdateMetadataSchema),
    (req: Request, res: Response) => {
      try {
        const entry = repo.updateMetadata(req.params.id, req.body);
        res.json(entry);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(400).json({ error: message });
      }
    }
  );

  // Update content (triggers re-embed flag)
  router.patch('/entries/:id/content',
    validateParams(UuidParamSchema),
    validateBody(UpdateContentSchema),
    (req: Request, res: Response) => {
      try {
        const entry = repo.updateContent(req.params.id, req.body.content);
        res.json(entry);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(400).json({ error: message });
      }
    }
  );

  // Update status
  router.patch('/entries/:id/status',
    validateParams(UuidParamSchema),
    validateBody(UpdateStatusSchema),
    (req: Request, res: Response) => {
      try {
        const entry = repo.updateStatus(req.params.id, req.body.status);
        res.json(entry);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(400).json({ error: message });
      }
    }
  );

  // Soft delete (sets status to deprecated)
  router.delete('/entries/:id',
    validateParams(UuidParamSchema),
    (req: Request, res: Response) => {
      try {
        repo.softDelete(req.params.id);
        res.status(204).send();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(400).json({ error: message });
      }
    }
  );

  // Supersede (replace with new entry)
  router.post('/entries/:id/supersede',
    validateParams(UuidParamSchema),
    validateBody(CreateEntrySchema),
    (req: Request, res: Response) => {
      try {
        const entry = repo.supersede(req.params.id, req.body);
        res.status(201).json(entry);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(400).json({ error: message });
      }
    }
  );

  // Hard delete (admin only, requires confirmation header)
  router.delete('/entries/:id/hard',
    validateParams(UuidParamSchema),
    (req: Request, res: Response) => {
      try {
        const confirmation = req.headers['x-admin-confirmation'] as string;
        if (!confirmation) {
          res.status(400).json({
            error: 'Missing X-Admin-Confirmation header',
            hint: `Required value: DELETE_PERMANENTLY_${req.params.id}`
          });
          return;
        }
        repo.hardDelete(req.params.id, confirmation);
        res.status(204).send();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(403).json({ error: message });
      }
    }
  );

  // Get audit log for an entry
  router.get('/entries/:id/audit',
    validateParams(UuidParamSchema),
    (req: Request, res: Response) => {
      try {
        const log = repo.getAuditLog(req.params.id);
        res.json(log);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(400).json({ error: message });
      }
    }
  );

  return router;
}
