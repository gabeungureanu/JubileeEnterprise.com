import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

interface ZodIssue {
  path: (string | number)[];
  message: string;
}

/**
 * Express middleware for validating request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues as ZodIssue[];
        res.status(400).json({
          error: 'Validation failed',
          details: issues.map((e: ZodIssue) => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Express middleware for validating query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues as ZodIssue[];
        res.status(400).json({
          error: 'Invalid query parameters',
          details: issues.map((e: ZodIssue) => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Express middleware for validating URL parameters
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues as ZodIssue[];
        res.status(400).json({
          error: 'Invalid URL parameters',
          details: issues.map((e: ZodIssue) => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }
      next(error);
    }
  };
}

// Common validation schemas
export const UuidParamSchema = z.object({
  id: z.string().uuid()
});

export const ScopeQuerySchema = z.object({
  domain: z.string().min(1),
  domainKey: z.string().min(1),
  subKey: z.string().optional()
});
