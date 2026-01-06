/**
 * Auth Service
 * Handles authentication, authorization, and user session management
 */

const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');
const { User } = require('../models');
const CommunityService = require('./CommunityService');
const { AppError } = require('../middleware/errorHandler');

/**
 * Hash password using pbkdf2
 */
async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(32).toString('hex');
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verify password against hash
 */
async function verifyPassword(password, hash) {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(key === derivedKey.toString('hex'));
    });
  });
}

/**
 * Register a new user
 */
async function register(userData) {
  const { email, password, displayName, preferredLanguage = 'en' } = userData;

  logger.debug('Registering new user', { email });

  try {
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await User.create({
      email,
      passwordHash,
      displayName,
      preferredLanguage,
      role: 'user',
      isActive: true,
      emailVerified: false
    });

    logger.info('User registered', { userId: user.id, email });

    await CommunityService.ensureDefaultCommunitiesForUser(user);

    // Generate verification token
    const verificationToken = generateToken();
    await User.setVerificationToken(user.id, verificationToken);

    return {
      user: sanitizeUser(user),
      verificationToken
    };
  } catch (error) {
    logger.error('Registration failed', { email, error: error.message });
    throw error;
  }
}

/**
 * Authenticate user
 */
async function login(email, password) {
  logger.debug('User login attempt', { email });

  try {
    const user = await User.findByEmail(email);

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403);
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      await User.incrementFailedAttempts(user.id);
      throw new AppError('Invalid email or password', 401);
    }

    // Reset failed attempts on successful login
    await User.resetFailedAttempts(user.id);
    await User.updateLastLogin(user.id);

    logger.info('User logged in', { userId: user.id, email });

    const safeUser = sanitizeUser(user);
    await CommunityService.ensureDefaultCommunitiesForUser(safeUser);

    return safeUser;
  } catch (error) {
    logger.error('Login failed', { email, error: error.message });
    throw error;
  }
}

/**
 * Verify email address
 */
async function verifyEmail(token) {
  logger.debug('Verifying email', { token: token.substring(0, 8) + '...' });

  try {
    const user = await User.findByVerificationToken(token);

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    await User.update(user.id, {
      emailVerified: true,
      verificationToken: null
    });

    logger.info('Email verified', { userId: user.id });

    return sanitizeUser(user);
  } catch (error) {
    logger.error('Email verification failed', { error: error.message });
    throw error;
  }
}

/**
 * Request password reset
 */
async function requestPasswordReset(email) {
  logger.debug('Password reset requested', { email });

  try {
    const user = await User.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists
      logger.debug('Password reset requested for non-existent email', { email });
      return { message: 'If the email exists, a reset link will be sent' };
    }

    const resetToken = generateToken();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await User.setResetToken(user.id, resetToken, resetExpires);

    logger.info('Password reset token generated', { userId: user.id });

    return {
      resetToken,
      message: 'If the email exists, a reset link will be sent'
    };
  } catch (error) {
    logger.error('Password reset request failed', { email, error: error.message });
    throw error;
  }
}

/**
 * Reset password using token
 */
async function resetPassword(token, newPassword) {
  logger.debug('Resetting password');

  try {
    const user = await User.findByResetToken(token);

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    if (new Date() > user.resetTokenExpires) {
      throw new Error('Reset token has expired');
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    const passwordHash = await hashPassword(newPassword);

    await User.update(user.id, {
      passwordHash,
      resetToken: null,
      resetTokenExpires: null
    });

    logger.info('Password reset successful', { userId: user.id });

    return sanitizeUser(user);
  } catch (error) {
    logger.error('Password reset failed', { error: error.message });
    throw error;
  }
}

/**
 * Change password for authenticated user
 */
async function changePassword(userId, currentPassword, newPassword) {
  logger.debug('Changing password', { userId });

  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);

    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    const passwordHash = await hashPassword(newPassword);

    await User.update(userId, { passwordHash });

    logger.info('Password changed', { userId });

    return { success: true };
  } catch (error) {
    logger.error('Password change failed', { userId, error: error.message });
    throw error;
  }
}

/**
 * Update user profile
 */
async function updateProfile(userId, updates) {
  const allowedUpdates = ['displayName', 'preferredLanguage', 'avatar', 'bio'];

  logger.debug('Updating profile', { userId, updates: Object.keys(updates) });

  try {
    // Filter to only allowed fields
    const filteredUpdates = {};
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }

    const user = await User.update(userId, filteredUpdates);

    logger.info('Profile updated', { userId });

    return sanitizeUser(user);
  } catch (error) {
    logger.error('Profile update failed', { userId, error: error.message });
    throw error;
  }
}

/**
 * Get user by ID (includes subscription plan and default persona)
 */
async function getUserById(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    const safeUser = sanitizeUser(user);

    // Get subscription plan
    const subscription = await User.getSubscription(userId);
    if (subscription) {
      safeUser.subscriptionPlan = subscription.planSlug || 'free';
      safeUser.planName = subscription.planName || 'Free';
      safeUser.planTier = subscription.planTier || 0;
    } else {
      safeUser.subscriptionPlan = 'free';
      safeUser.planName = 'Free';
      safeUser.planTier = 0;
    }

    // Get default persona if set
    const defaultPersona = await User.getDefaultPersona(userId);
    if (defaultPersona) {
      safeUser.defaultPersona = defaultPersona;
    }

    return safeUser;
  } catch (error) {
    logger.error('Failed to get user', { userId, error: error.message });
    throw error;
  }
}

/**
 * Deactivate user account
 */
async function deactivateAccount(userId) {
  logger.debug('Deactivating account', { userId });

  try {
    await User.update(userId, { isActive: false });
    logger.info('Account deactivated', { userId });
    return { success: true };
  } catch (error) {
    logger.error('Account deactivation failed', { userId, error: error.message });
    throw error;
  }
}

/**
 * Check if user has required role
 */
function hasRole(user, requiredRole) {
  const roleHierarchy = ['user', 'contributor', 'reviewer', 'moderator', 'admin'];
  const userRoleIndex = roleHierarchy.indexOf(user.role);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
  return userRoleIndex >= requiredRoleIndex;
}

/**
 * Validate password strength
 */
function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
}

/**
 * Generate secure random token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Remove sensitive fields from user object
 */
function sanitizeUser(user) {
  const { passwordHash, verificationToken, resetToken, resetTokenExpires, ...safeUser } = user;
  return safeUser;
}

module.exports = {
  register,
  login,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
  updateProfile,
  getUserById,
  deactivateAccount,
  hasRole,
  validatePassword,
  hashPassword,
  verifyPassword
};
