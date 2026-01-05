/**
 * Auth Controller
 * Handles authentication-related HTTP requests
 */

const { AuthService } = require('../services');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * Register new user
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, displayName, preferredLanguage } = req.body;

  // Validation
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  if (!displayName) {
    throw new AppError('Display name is required', 400);
  }

  const result = await AuthService.register({
    email,
    password,
    displayName,
    preferredLanguage
  });

  // TODO: Send verification email with result.verificationToken

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please check your email to verify your account.',
    user: result.user
  });
});

/**
 * Login user
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password, remember } = req.body;

  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const user = await AuthService.login(email, password);

  // Set session
  req.session.userId = user.id;
  req.session.user = user;

  // If "Remember Me" is checked, extend session to 30 days
  if (remember) {
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  // Ensure session is saved before responding
  req.session.save((err) => {
    if (err) {
      logger.error('Session save error', { error: err.message });
    }
    res.json({
      success: true,
      message: 'Login successful',
      user
    });
  });
});

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Session destruction error', { error: err.message });
    }
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * Get current user
 * GET /api/auth/me
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    // Return success: false for unauthenticated users (don't throw error)
    // This allows the frontend to gracefully handle logged-out state
    return res.json({ success: false, user: null });
  }

  const user = await AuthService.getUserById(req.session.userId);

  if (!user) {
    return res.json({ success: false, user: null });
  }

  res.json({
    success: true,
    user
  });
});

/**
 * Verify email
 * GET /api/auth/verify/:token
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    throw new AppError('Verification token is required', 400);
  }

  const user = await AuthService.verifyEmail(token);

  res.json({
    success: true,
    message: 'Email verified successfully',
    user
  });
});

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  const result = await AuthService.requestPasswordReset(email);

  // TODO: Send reset email with result.resetToken

  res.json({
    success: true,
    message: result.message
  });
});

/**
 * Reset password
 * POST /api/auth/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    throw new AppError('Token and new password are required', 400);
  }

  await AuthService.resetPassword(token, password);

  res.json({
    success: true,
    message: 'Password reset successful. You can now login with your new password.'
  });
});

/**
 * Change password
 * POST /api/auth/change-password
 */
const changePassword = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required', 400);
  }

  await AuthService.changePassword(req.session.userId, currentPassword, newPassword);

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

/**
 * Update profile
 * PUT /api/auth/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { displayName, preferredLanguage, bio, avatar } = req.body;

  const user = await AuthService.updateProfile(req.session.userId, {
    displayName,
    preferredLanguage,
    bio,
    avatar
  });

  // Update session
  req.session.user = user;

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user
  });
});

/**
 * Deactivate account
 * POST /api/auth/deactivate
 */
const deactivateAccount = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  await AuthService.deactivateAccount(req.session.userId);

  req.session.destroy();

  res.json({
    success: true,
    message: 'Account deactivated successfully'
  });
});

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
  deactivateAccount
};
