/**
 * Main router - aggregates all route modules
 */

const express = require('express');
const router = express.Router();

const pageRoutes = require('./pages');
const authRoutes = require('./auth');
const chatRoutes = require('./chat');
const personaRoutes = require('./personas');
const translationRoutes = require('./translation');
const boardRoutes = require('./boards');
const communityRoutes = require('./communities');
const apiRoutes = require('./api');
const adminRoutes = require('./admin');
const billingRoutes = require('./billing');
const hospitalityRoutes = require('./hospitality');

// Page routes (HTML views)
router.use('/', pageRoutes);

// Authentication routes
router.use('/auth', authRoutes);

// Chat routes
router.use('/chat', chatRoutes);

// Persona routes
router.use('/personas', personaRoutes);

// Translation routes
router.use('/translation', translationRoutes);

// Discussion board routes
router.use('/boards', boardRoutes);

// Community routes (API)
router.use('/api/communities', communityRoutes);

// API routes (JSON endpoints)
router.use('/api', apiRoutes);

// Admin routes (monitoring and management)
router.use('/api/admin', adminRoutes);

// Billing routes (payment methods, invoices, subscription status)
router.use('/api/billing', billingRoutes);

// Hospitality routes (engagement tracking, popups, admin)
router.use('/api/hospitality', hospitalityRoutes);

module.exports = router;
