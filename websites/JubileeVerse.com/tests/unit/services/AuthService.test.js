/**
 * AuthService Unit Tests
 * TDD tests for authentication service
 */

const AuthService = require('../../../src/services/AuthService');
const { createMockUser } = require('../../mocks');
const { users, invalidInputs } = require('../../fixtures');

// Mock the User model
jest.mock('../../../src/models/User', () => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  findByVerificationToken: jest.fn(),
  findByResetToken: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  setVerificationToken: jest.fn(),
  setResetToken: jest.fn(),
  incrementFailedAttempts: jest.fn(),
  resetFailedAttempts: jest.fn(),
  updateLastLogin: jest.fn()
}));

const User = require('../../../src/models/User');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePassword', () => {
    it('should reject empty password', () => {
      const result = AuthService.validatePassword('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('8 characters');
    });

    it('should reject password shorter than 8 characters', () => {
      const result = AuthService.validatePassword('Short1');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('8 characters');
    });

    it('should reject password without uppercase letter', () => {
      const result = AuthService.validatePassword('lowercase123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('uppercase');
    });

    it('should reject password without lowercase letter', () => {
      const result = AuthService.validatePassword('UPPERCASE123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('lowercase');
    });

    it('should reject password without number', () => {
      const result = AuthService.validatePassword('NoNumbersHere');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('number');
    });

    it('should accept valid password', () => {
      const result = AuthService.validatePassword('ValidPass123');
      expect(result.valid).toBe(true);
    });

    it('should reject all invalid password fixtures', () => {
      invalidInputs.passwords.forEach(password => {
        const result = AuthService.validatePassword(password);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('hashPassword and verifyPassword', () => {
    it('should hash password and verify correctly', async () => {
      const password = 'TestPassword123';
      const hash = await AuthService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toContain(':'); // salt:hash format

      const isValid = await AuthService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123';
      const hash = await AuthService.hashPassword(password);

      const isValid = await AuthService.verifyPassword('WrongPassword123', hash);
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await AuthService.hashPassword(password);
      const hash2 = await AuthService.hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts
    });
  });

  describe('register', () => {
    it('should register new user successfully', async () => {
      const userData = users.validUser;
      const mockCreatedUser = createMockUser({ email: userData.email });

      User.findByEmail.mockResolvedValue(null);
      User.create.mockResolvedValue(mockCreatedUser);
      User.setVerificationToken.mockResolvedValue(true);

      const result = await AuthService.register(userData);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(userData.email);
      expect(result.verificationToken).toBeDefined();
      expect(User.create).toHaveBeenCalled();
      expect(User.setVerificationToken).toHaveBeenCalled();
    });

    it('should reject registration with existing email', async () => {
      const userData = users.validUser;
      User.findByEmail.mockResolvedValue(createMockUser());

      await expect(AuthService.register(userData))
        .rejects.toThrow('Email already registered');
    });

    it('should reject registration with weak password', async () => {
      const userData = { ...users.validUser, password: 'weak' };
      User.findByEmail.mockResolvedValue(null);

      await expect(AuthService.register(userData))
        .rejects.toThrow();
    });

    it('should not include password hash in returned user', async () => {
      const userData = users.validUser;
      const mockCreatedUser = createMockUser({
        email: userData.email,
        passwordHash: 'should-not-be-returned'
      });

      User.findByEmail.mockResolvedValue(null);
      User.create.mockResolvedValue(mockCreatedUser);
      User.setVerificationToken.mockResolvedValue(true);

      const result = await AuthService.register(userData);

      expect(result.user.passwordHash).toBeUndefined();
    });
  });

  describe('login', () => {
    it('should login user with correct credentials', async () => {
      const mockUser = createMockUser();
      const password = 'ValidPass123';
      mockUser.passwordHash = await AuthService.hashPassword(password);

      User.findByEmail.mockResolvedValue(mockUser);
      User.resetFailedAttempts.mockResolvedValue(true);
      User.updateLastLogin.mockResolvedValue(true);

      const result = await AuthService.login(mockUser.email, password);

      expect(result).toBeDefined();
      expect(result.email).toBe(mockUser.email);
      expect(result.passwordHash).toBeUndefined();
      expect(User.resetFailedAttempts).toHaveBeenCalledWith(mockUser.id);
      expect(User.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should reject login with incorrect password', async () => {
      const mockUser = createMockUser();
      mockUser.passwordHash = await AuthService.hashPassword('CorrectPass123');

      User.findByEmail.mockResolvedValue(mockUser);
      User.incrementFailedAttempts.mockResolvedValue(true);

      await expect(AuthService.login(mockUser.email, 'WrongPass123'))
        .rejects.toThrow('Invalid email or password');

      expect(User.incrementFailedAttempts).toHaveBeenCalledWith(mockUser.id);
    });

    it('should reject login with non-existent email', async () => {
      User.findByEmail.mockResolvedValue(null);

      await expect(AuthService.login('nonexistent@test.com', 'Password123'))
        .rejects.toThrow('Invalid email or password');
    });

    it('should reject login for inactive user', async () => {
      const mockUser = createMockUser({ isActive: false });
      User.findByEmail.mockResolvedValue(mockUser);

      await expect(AuthService.login(mockUser.email, 'Password123'))
        .rejects.toThrow('Account is deactivated');
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const mockUser = createMockUser({ emailVerified: false });
      User.findByVerificationToken.mockResolvedValue(mockUser);
      User.update.mockResolvedValue({ ...mockUser, emailVerified: true });

      const result = await AuthService.verifyEmail('valid-token');

      expect(result.emailVerified).toBe(true);
      expect(User.update).toHaveBeenCalledWith(mockUser.id, {
        emailVerified: true,
        verificationToken: null
      });
    });

    it('should reject invalid verification token', async () => {
      User.findByVerificationToken.mockResolvedValue(null);

      await expect(AuthService.verifyEmail('invalid-token'))
        .rejects.toThrow('Invalid or expired verification token');
    });
  });

  describe('requestPasswordReset', () => {
    it('should generate reset token for existing user', async () => {
      const mockUser = createMockUser();
      User.findByEmail.mockResolvedValue(mockUser);
      User.setResetToken.mockResolvedValue(true);

      const result = await AuthService.requestPasswordReset(mockUser.email);

      expect(result.resetToken).toBeDefined();
      expect(User.setResetToken).toHaveBeenCalled();
    });

    it('should not reveal if email exists', async () => {
      User.findByEmail.mockResolvedValue(null);

      const result = await AuthService.requestPasswordReset('nonexistent@test.com');

      expect(result.message).toContain('If the email exists');
      expect(User.setResetToken).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const mockUser = createMockUser({
        resetTokenExpires: new Date(Date.now() + 3600000) // 1 hour from now
      });
      User.findByResetToken.mockResolvedValue(mockUser);
      User.update.mockResolvedValue(mockUser);

      const result = await AuthService.resetPassword('valid-token', 'NewPassword123');

      expect(result).toBeDefined();
      expect(User.update).toHaveBeenCalled();
    });

    it('should reject expired reset token', async () => {
      const mockUser = createMockUser({
        resetTokenExpires: new Date(Date.now() - 3600000) // 1 hour ago
      });
      User.findByResetToken.mockResolvedValue(mockUser);

      await expect(AuthService.resetPassword('expired-token', 'NewPassword123'))
        .rejects.toThrow('Reset token has expired');
    });

    it('should reject invalid reset token', async () => {
      User.findByResetToken.mockResolvedValue(null);

      await expect(AuthService.resetPassword('invalid-token', 'NewPassword123'))
        .rejects.toThrow('Invalid or expired reset token');
    });

    it('should reject weak new password', async () => {
      const mockUser = createMockUser({
        resetTokenExpires: new Date(Date.now() + 3600000)
      });
      User.findByResetToken.mockResolvedValue(mockUser);

      await expect(AuthService.resetPassword('valid-token', 'weak'))
        .rejects.toThrow();
    });
  });

  describe('changePassword', () => {
    it('should change password with correct current password', async () => {
      const currentPassword = 'CurrentPass123';
      const mockUser = createMockUser();
      mockUser.passwordHash = await AuthService.hashPassword(currentPassword);

      User.findById.mockResolvedValue(mockUser);
      User.update.mockResolvedValue(mockUser);

      const result = await AuthService.changePassword(
        mockUser.id,
        currentPassword,
        'NewPassword123'
      );

      expect(result.success).toBe(true);
      expect(User.update).toHaveBeenCalled();
    });

    it('should reject incorrect current password', async () => {
      const mockUser = createMockUser();
      mockUser.passwordHash = await AuthService.hashPassword('CorrectPass123');

      User.findById.mockResolvedValue(mockUser);

      await expect(AuthService.changePassword(
        mockUser.id,
        'WrongPass123',
        'NewPassword123'
      )).rejects.toThrow('Current password is incorrect');
    });
  });

  describe('hasRole', () => {
    it('should return true for matching role', () => {
      const user = { role: 'admin' };
      expect(AuthService.hasRole(user, 'admin')).toBe(true);
    });

    it('should return true for higher role', () => {
      const user = { role: 'admin' };
      expect(AuthService.hasRole(user, 'user')).toBe(true);
      expect(AuthService.hasRole(user, 'reviewer')).toBe(true);
    });

    it('should return false for insufficient role', () => {
      const user = { role: 'user' };
      expect(AuthService.hasRole(user, 'admin')).toBe(false);
      expect(AuthService.hasRole(user, 'reviewer')).toBe(false);
    });
  });

  describe('getUserById', () => {
    it('should return sanitized user', async () => {
      const mockUser = createMockUser();
      User.findById.mockResolvedValue(mockUser);

      const result = await AuthService.getUserById(mockUser.id);

      expect(result.passwordHash).toBeUndefined();
      expect(result.verificationToken).toBeUndefined();
      expect(result.resetToken).toBeUndefined();
    });

    it('should return null for non-existent user', async () => {
      User.findById.mockResolvedValue(null);

      const result = await AuthService.getUserById('non-existent-id');

      expect(result).toBeNull();
    });
  });
});
