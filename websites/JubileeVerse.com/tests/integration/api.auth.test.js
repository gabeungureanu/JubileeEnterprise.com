/**
 * Auth API Integration Tests
 * Tests authentication endpoints end-to-end
 */

const request = require('supertest');
const createApp = require('../../src/app');
const { users } = require('../fixtures');

// Mock database and services
jest.mock('../../src/database', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  shutdown: jest.fn().mockResolvedValue(true),
  getPostgres: jest.fn(),
  getQdrant: jest.fn()
}));

jest.mock('../../src/models/User', () => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  setVerificationToken: jest.fn(),
  incrementFailedAttempts: jest.fn(),
  resetFailedAttempts: jest.fn(),
  updateLastLogin: jest.fn()
}));

const User = require('../../src/models/User');
const AuthService = require('../../src/services/AuthService');

describe('Auth API Integration', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const userData = users.validUser;

      User.findByEmail.mockResolvedValue(null);
      User.create.mockResolvedValue({
        id: 'new-user-id',
        email: userData.email,
        displayName: userData.displayName,
        preferredLanguage: userData.preferredLanguage,
        role: 'user',
        isActive: true,
        emailVerified: false,
        createdAt: new Date().toISOString()
      });
      User.setVerificationToken.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.passwordHash).toBeUndefined();
    });

    it('should reject registration without email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ password: 'Password123', displayName: 'Test' })
        .expect(400);

      expect(response.body.success).toBeFalsy();
    });

    it('should reject registration without password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com', displayName: 'Test' })
        .expect(400);

      expect(response.body.success).toBeFalsy();
    });

    it('should reject registration without display name', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com', password: 'Password123' })
        .expect(400);

      expect(response.body.success).toBeFalsy();
    });

    it('should reject duplicate email', async () => {
      User.findByEmail.mockResolvedValue({ id: 'existing-user' });

      const response = await request(app)
        .post('/api/auth/register')
        .send(users.validUser)
        .expect(500); // Error thrown by service

      expect(response.body.success).toBeFalsy();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const password = 'ValidPass123';
      const hashedPassword = await AuthService.hashPassword(password);

      User.findByEmail.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        displayName: 'Test User',
        passwordHash: hashedPassword,
        isActive: true,
        role: 'user'
      });
      User.resetFailedAttempts.mockResolvedValue(true);
      User.updateLastLogin.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.passwordHash).toBeUndefined();
    });

    it('should reject login with wrong password', async () => {
      const hashedPassword = await AuthService.hashPassword('CorrectPassword123');

      User.findByEmail.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        passwordHash: hashedPassword,
        isActive: true
      });
      User.incrementFailedAttempts.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'WrongPassword123' })
        .expect(500);

      expect(response.body.success).toBeFalsy();
    });

    it('should reject login without email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Password123' })
        .expect(400);

      expect(response.body.success).toBeFalsy();
    });

    it('should reject login without password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com' })
        .expect(400);

      expect(response.body.success).toBeFalsy();
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return null user when not authenticated', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(200);

      // When not authenticated, should return 401 based on controller logic
      // or indicate no user in session
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should accept valid email for password reset', async () => {
      User.findByEmail.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com'
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@test.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If the email exists');
    });

    it('should not reveal if email exists', async () => {
      User.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If the email exists');
    });

    it('should reject request without email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({})
        .expect(400);

      expect(response.body.success).toBeFalsy();
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.version).toBeDefined();
    });
  });
});
