/**
 * PersonaService Unit Tests
 * TDD tests for persona service
 */

const PersonaService = require('../../../src/services/PersonaService');
const { createMockPersona } = require('../../mocks');
const { personas } = require('../../fixtures');

// Mock dependencies
jest.mock('../../../src/models/Persona', () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  findByCategory: jest.fn(),
  findFeatured: jest.fn(),
  search: jest.fn(),
  searchKnowledge: jest.fn()
}));

jest.mock('../../../src/services/AIService', () => ({
  generateResponse: jest.fn(),
  getDefaultProvider: jest.fn().mockReturnValue('anthropic')
}));

const Persona = require('../../../src/models/Persona');
const AIService = require('../../../src/services/AIService');

describe('PersonaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPersonas', () => {
    it('should return all active personas', async () => {
      const mockPersonas = [createMockPersona(), createMockPersona()];
      Persona.findAll.mockResolvedValue(mockPersonas);

      const result = await PersonaService.getAllPersonas();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(Persona.findAll).toHaveBeenCalledWith({ isActive: true });
    });

    it('should filter by category', async () => {
      const mockPersonas = [createMockPersona({ category: 'scholar' })];
      Persona.findAll.mockResolvedValue(mockPersonas);

      await PersonaService.getAllPersonas({ category: 'scholar' });

      expect(Persona.findAll).toHaveBeenCalledWith({
        category: 'scholar',
        isActive: true
      });
    });

    it('should filter by language', async () => {
      Persona.findAll.mockResolvedValue([]);

      await PersonaService.getAllPersonas({ language: 'he' });

      expect(Persona.findAll).toHaveBeenCalledWith({
        language: 'he',
        isActive: true
      });
    });

    it('should include inactive personas when specified', async () => {
      Persona.findAll.mockResolvedValue([]);

      await PersonaService.getAllPersonas({ activeOnly: false });

      expect(Persona.findAll).toHaveBeenCalledWith({});
    });
  });

  describe('getPersonaById', () => {
    it('should return persona by ID', async () => {
      const mockPersona = createMockPersona();
      Persona.findById.mockResolvedValue(mockPersona);

      const result = await PersonaService.getPersonaById(mockPersona.id);

      expect(result).toEqual(mockPersona);
      expect(Persona.findById).toHaveBeenCalledWith(mockPersona.id);
    });

    it('should throw error for non-existent persona', async () => {
      Persona.findById.mockResolvedValue(null);

      await expect(PersonaService.getPersonaById('non-existent'))
        .rejects.toThrow('Persona not found');
    });
  });

  describe('getPersonaBySlug', () => {
    it('should return persona by slug', async () => {
      const mockPersona = createMockPersona({ slug: 'dr-samuel' });
      Persona.findBySlug.mockResolvedValue(mockPersona);

      const result = await PersonaService.getPersonaBySlug('dr-samuel');

      expect(result.slug).toBe('dr-samuel');
      expect(Persona.findBySlug).toHaveBeenCalledWith('dr-samuel');
    });

    it('should throw error for non-existent slug', async () => {
      Persona.findBySlug.mockResolvedValue(null);

      await expect(PersonaService.getPersonaBySlug('non-existent'))
        .rejects.toThrow('Persona not found');
    });
  });

  describe('getPersonasByCategory', () => {
    it('should return personas in category', async () => {
      const mockPersonas = [
        createMockPersona({ category: 'scholar' }),
        createMockPersona({ category: 'scholar' })
      ];
      Persona.findByCategory.mockResolvedValue(mockPersonas);

      const result = await PersonaService.getPersonasByCategory('scholar');

      expect(result.length).toBe(2);
      expect(Persona.findByCategory).toHaveBeenCalledWith('scholar');
    });
  });

  describe('getFeaturedPersonas', () => {
    it('should return featured personas with limit', async () => {
      const mockPersonas = Array(6).fill(null).map(() => createMockPersona({ isFeatured: true }));
      Persona.findFeatured.mockResolvedValue(mockPersonas);

      const result = await PersonaService.getFeaturedPersonas(6);

      expect(result.length).toBe(6);
      expect(Persona.findFeatured).toHaveBeenCalledWith(6);
    });

    it('should default to 6 personas', async () => {
      Persona.findFeatured.mockResolvedValue([]);

      await PersonaService.getFeaturedPersonas();

      expect(Persona.findFeatured).toHaveBeenCalledWith(6);
    });
  });

  describe('searchPersonas', () => {
    it('should search personas by query', async () => {
      const mockPersonas = [createMockPersona({ name: 'Dr. Samuel' })];
      Persona.search.mockResolvedValue(mockPersonas);

      const result = await PersonaService.searchPersonas('Samuel');

      expect(result.length).toBe(1);
      expect(Persona.search).toHaveBeenCalledWith('Samuel', {
        limit: 10,
        category: null
      });
    });

    it('should search with category filter', async () => {
      Persona.search.mockResolvedValue([]);

      await PersonaService.searchPersonas('prayer', { category: 'prayer' });

      expect(Persona.search).toHaveBeenCalledWith('prayer', {
        limit: 10,
        category: 'prayer'
      });
    });

    it('should respect custom limit', async () => {
      Persona.search.mockResolvedValue([]);

      await PersonaService.searchPersonas('test', { limit: 5 });

      expect(Persona.search).toHaveBeenCalledWith('test', {
        limit: 5,
        category: null
      });
    });
  });

  describe('getPersonaCategories', () => {
    it('should return all persona categories', () => {
      const categories = PersonaService.getPersonaCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]).toHaveProperty('id');
      expect(categories[0]).toHaveProperty('name');
      expect(categories[0]).toHaveProperty('description');
    });

    it('should include scholar category', () => {
      const categories = PersonaService.getPersonaCategories();
      const scholar = categories.find(c => c.id === 'scholar');

      expect(scholar).toBeDefined();
      expect(scholar.name).toBe('Biblical Scholars');
    });

    it('should include all expected categories', () => {
      const categories = PersonaService.getPersonaCategories();
      const categoryIds = categories.map(c => c.id);

      expect(categoryIds).toContain('scholar');
      expect(categoryIds).toContain('counselor');
      expect(categoryIds).toContain('teacher');
      expect(categoryIds).toContain('prayer');
      expect(categoryIds).toContain('worship');
      expect(categoryIds).toContain('translator');
    });
  });

  describe('validatePersona', () => {
    it('should return true for active persona', async () => {
      Persona.findById.mockResolvedValue(createMockPersona({ isActive: true }));

      const result = await PersonaService.validatePersona('valid-id');

      expect(result).toBe(true);
    });

    it('should return false for inactive persona', async () => {
      Persona.findById.mockResolvedValue(createMockPersona({ isActive: false }));

      const result = await PersonaService.validatePersona('inactive-id');

      expect(result).toBe(false);
    });

    it('should return false for non-existent persona', async () => {
      Persona.findById.mockResolvedValue(null);

      const result = await PersonaService.validatePersona('non-existent');

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      Persona.findById.mockRejectedValue(new Error('Database error'));

      const result = await PersonaService.validatePersona('error-id');

      expect(result).toBe(false);
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build prompt with persona details', () => {
      const persona = createMockPersona();

      const prompt = PersonaService.buildSystemPrompt(persona);

      expect(prompt).toContain(persona.name);
      expect(prompt).toContain(persona.title);
      expect(prompt).toContain(persona.description);
      expect(prompt).toContain('IDENTITY');
      expect(prompt).toContain('PERSONALITY');
      expect(prompt).toContain('EXPERTISE');
    });

    it('should include language preference when not English', () => {
      const persona = createMockPersona();

      const prompt = PersonaService.buildSystemPrompt(persona, { userLanguage: 'es' });

      expect(prompt).toContain('LANGUAGE');
      expect(prompt).toContain('Spanish');
    });

    it('should not include language section for English', () => {
      const persona = createMockPersona();

      const prompt = PersonaService.buildSystemPrompt(persona, { userLanguage: 'en' });

      expect(prompt).not.toContain('LANGUAGE:');
    });

    it('should include conversation context when provided', () => {
      const persona = createMockPersona();

      const prompt = PersonaService.buildSystemPrompt(persona, {
        conversationContext: 'Previous discussion about Psalms'
      });

      expect(prompt).toContain('CONVERSATION CONTEXT');
      expect(prompt).toContain('Previous discussion about Psalms');
    });
  });

  describe('generatePersonaResponse', () => {
    it('should generate response with persona context', async () => {
      const mockPersona = createMockPersona();
      Persona.findById.mockResolvedValue(mockPersona);
      Persona.searchKnowledge.mockResolvedValue([]);
      AIService.generateResponse.mockResolvedValue('AI generated response');

      const result = await PersonaService.generatePersonaResponse({
        personaId: mockPersona.id,
        messages: [{ type: 'user', content: 'Hello' }]
      });

      expect(result.response).toBe('AI generated response');
      expect(result.persona).toBeDefined();
      expect(result.persona.id).toBe(mockPersona.id);
      expect(AIService.generateResponse).toHaveBeenCalled();
    });

    it('should include knowledge context in AI call', async () => {
      const mockPersona = createMockPersona();
      const mockKnowledge = [
        { content: 'Knowledge chunk 1', metadata: { source: 'Bible' }, score: 0.9 },
        { content: 'Knowledge chunk 2', metadata: { source: 'Commentary' }, score: 0.8 }
      ];

      Persona.findById.mockResolvedValue(mockPersona);
      Persona.searchKnowledge.mockResolvedValue(mockKnowledge);
      AIService.generateResponse.mockResolvedValue('Response with context');

      const result = await PersonaService.generatePersonaResponse({
        personaId: mockPersona.id,
        messages: [{ type: 'user', content: 'Tell me about Jubilee' }]
      });

      expect(result.contextUsed).toBe(2);
      expect(AIService.generateResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.arrayContaining([
            expect.stringContaining('Knowledge chunk 1')
          ])
        })
      );
    });

    it('should handle missing persona', async () => {
      Persona.findById.mockResolvedValue(null);

      await expect(PersonaService.generatePersonaResponse({
        personaId: 'non-existent',
        messages: []
      })).rejects.toThrow('Persona not found');
    });

    it('should use persona language preference', async () => {
      const mockPersona = createMockPersona();
      Persona.findById.mockResolvedValue(mockPersona);
      Persona.searchKnowledge.mockResolvedValue([]);
      AIService.generateResponse.mockResolvedValue('Respuesta en español');

      await PersonaService.generatePersonaResponse({
        personaId: mockPersona.id,
        messages: [{ type: 'user', content: 'Hola' }],
        userLanguage: 'es'
      });

      expect(AIService.generateResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('Spanish')
        })
      );
    });
  });
});
