/**
 * Authentication routes
 * Delegates to AuthController for request handling
 */

const express = require('express');
const router = express.Router();
const { AuthController } = require('../controllers');
const { requireAuth, redirectIfAuth } = require('../middleware');

// Authentication endpoints
router.post('/login', redirectIfAuth, AuthController.login);
router.post('/register', redirectIfAuth, AuthController.register);
router.post('/logout', requireAuth, AuthController.logout);

// User session
router.get('/me', AuthController.getCurrentUser);

// Email verification
router.get('/verify/:token', AuthController.verifyEmail);

// Password management
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.post('/change-password', requireAuth, AuthController.changePassword);

// Profile management
router.put('/profile', requireAuth, AuthController.updateProfile);
router.post('/deactivate', requireAuth, AuthController.deactivateAccount);

module.exports = router;
