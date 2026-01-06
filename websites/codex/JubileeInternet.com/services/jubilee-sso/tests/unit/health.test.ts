import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { health } from '../../src/routes/health.js';

vi.mock('../../src/services/database.js', () => ({
  healthCheck: vi.fn(),
}));

import { healthCheck } from '../../src/services/database.js';

describe('Health Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/', health);
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status when database is up', async () => {
      vi.mocked(healthCheck).mockResolvedValue(true);

      const res = await app.request('/health');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe('healthy');
      expect(body.checks.database).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });

    it('should return degraded status when database is down', async () => {
      vi.mocked(healthCheck).mockResolvedValue(false);

      const res = await app.request('/health');
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.status).toBe('degraded');
      expect(body.checks.database).toBe('error');
    });
  });

  describe('GET /ready', () => {
    it('should return ready when database is available', async () => {
      vi.mocked(healthCheck).mockResolvedValue(true);

      const res = await app.request('/ready');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ready).toBe(true);
    });

    it('should return not ready when database is unavailable', async () => {
      vi.mocked(healthCheck).mockResolvedValue(false);

      const res = await app.request('/ready');
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.ready).toBe(false);
      expect(body.reason).toBe('database not available');
    });
  });

  describe('GET /live', () => {
    it('should always return alive', async () => {
      const res = await app.request('/live');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.alive).toBe(true);
    });
  });
});
