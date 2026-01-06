/**
 * Personas API Integration Tests
 * Tests persona endpoints end-to-end
 */

const request = require('supertest');
const createApp = require('../../src/app');
const { createMockPersona } = require('../mocks');

// Mock database
jest.mock('../../src/database', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  shutdown: jest.fn().mockResolvedValue(true),
  getPostgres: jest.fn(),
  getQdrant: jest.fn()
}));

// Mock Persona model
jest.mock('../../src/models/Persona', () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  findByCategory: jest.fn(),
  findFeatured: jest.fn(),
  search: jest.fn(),
  searchKnowledge: jest.fn()
}));

const Persona = require('../../src/models/Persona');

describe('Personas API Integration', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/personas', () => {
    it('should return all active personas', async () => {
      const mockPersonas = [
        createMockPersona({ name: 'Dr. Samuel' }),
        createMockPersona({ name: 'Sister Grace' })
      ];
      Persona.findAll.mockResolvedValue(mockPersonas);

      const response = await request(app)
        .get('/api/personas')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.personas).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should filter by category', async () => {
      const mockPersonas = [createMockPersona({ category: 'scholar' })];
      Persona.findAll.mockResolvedValue(mockPersonas);

      const response = await request(app)
        .get('/api/personas?category=scholar')
        .expect(200);

      expect(Persona.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'scholar' })
      );
    });

    it('should filter by language', async () => {
      Persona.findAll.mockResolvedValue([]);

      await request(app)
        .get('/api/personas?language=he')
        .expect(200);

      expect(Persona.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'he' })
      );
    });
  });

  describe('GET /api/personas/featured', () => {
    it('should return featured personas', async () => {
      const mockPersonas = Array(6).fill(null).map(() =>
        createMockPersona({ isFeatured: true })
      );
      Persona.findFeatured.mockResolvedValue(mockPersonas);

      const response = await request(app)
        .get('/api/personas/featured')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.personas).toHaveLength(6);
    });

    it('should respect limit parameter', async () => {
      Persona.findFeatured.mockResolvedValue([createMockPersona()]);

      await request(app)
        .get('/api/personas/featured?limit=3')
        .expect(200);

      expect(Persona.findFeatured).toHaveBeenCalledWith(3);
    });
  });

  describe('GET /api/personas/categories', () => {
    it('should return all persona categories', async () => {
      const response = await request(app)
        .get('/api/personas/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.categories)).toBe(true);
      expect(response.body.categories.length).toBeGreaterThan(0);

      // Each category should have id, name, description
      response.body.categories.forEach(category => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('description');
      });
    });
  });

  describe('GET /api/personas/search', () => {
    it('should search personas by query', async () => {
      const mockPersonas = [createMockPersona({ name: 'Dr. Samuel' })];
      Persona.search.mockResolvedValue(mockPersonas);

      const response = await request(app)
        .get('/api/personas/search?q=Samuel')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.query).toBe('Samuel');
      expect(response.body.personas).toHaveLength(1);
    });

    it('should reject search without query', async () => {
      const response = await request(app)
        .get('/api/personas/search')
        .expect(400);

      expect(response.body.success).toBeFalsy();
    });

    it('should filter search by category', async () => {
      Persona.search.mockResolvedValue([]);

      await request(app)
        .get('/api/personas/search?q=prayer&category=prayer')
        .expect(200);

      expect(Persona.search).toHaveBeenCalledWith('prayer', expect.objectContaining({
        category: 'prayer'
      }));
    });
  });

  describe('GET /api/personas/:id', () => {
    it('should return persona by ID', async () => {
      const mockPersona = createMockPersona();
      Persona.findById.mockResolvedValue(mockPersona);

      const response = await request(app)
        .get(`/api/personas/${mockPersona.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.persona.id).toBe(mockPersona.id);
    });

    it('should return 500 for non-existent persona', async () => {
      Persona.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/personas/non-existent-id')
        .expect(500);

      expect(response.body.success).toBeFalsy();
    });
  });

  describe('Persona list page routes', () => {
    it('should serve personas HTML page', async () => {
      const response = await request(app)
        .get('/personas')
        .expect('Content-Type', /html/)
        .expect(200);

      expect(response.text).toContain('<!DOCTYPE html>');
    });

    it('should serve persona list API', async () => {
      Persona.findAll.mockResolvedValue([createMockPersona()]);

      const response = await request(app)
        .get('/personas/list')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
