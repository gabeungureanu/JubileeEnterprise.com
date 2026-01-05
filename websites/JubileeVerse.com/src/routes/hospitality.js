/**
 * Hospitality Routes
 * Event tracking and admin management endpoints for the hospitality module.
 */

const express = require('express');
const router = express.Router();
const HospitalityController = require('../controllers/HospitalityController');
const { requireAuth, requireAdmin } = require('../middleware');

// ============================================
// Public/Session-Based Event Tracking
// These endpoints work for both authenticated and anonymous users
// ============================================

// Track engagement event (page view, scroll, interaction, etc.)
router.post('/events', HospitalityController.trackEvent);

// Check for pending hospitality action (popup to show)
router.get('/check', HospitalityController.checkForAction);

// Record that a popup was shown to the user
router.post('/shown', HospitalityController.recordShown);

// Record popup dismissal
router.post('/dismiss', HospitalityController.dismissAction);

// Record popup click
router.post('/clicked', HospitalityController.recordClicked);

// Get current user's hospitality state (for debugging)
router.get('/state', HospitalityController.getUserState);

// ============================================
// Admin Endpoints - Dashboard Views
// All require authentication and admin role
// ============================================

// Visitor hospitality dashboard
router.get('/admin/visitors', requireAuth, requireAdmin, HospitalityController.getVisitorDashboard);

// Subscriber hospitality dashboard
router.get('/admin/subscribers', requireAuth, requireAdmin, HospitalityController.getSubscriberDashboard);

// System health check
router.get('/admin/health', requireAuth, requireAdmin, HospitalityController.getSystemHealth);

// Rule performance statistics
router.get('/admin/performance', requireAuth, requireAdmin, HospitalityController.getRulePerformance);

// Recent hospitality actions
router.get('/admin/actions', requireAuth, requireAdmin, HospitalityController.getRecentActions);

// ============================================
// Admin Endpoints - Rule Management
// CRUD operations for hospitality rules
// ============================================

// List all rules
router.get('/admin/rules', requireAuth, requireAdmin, HospitalityController.getRules);

// Get single rule by ID
router.get('/admin/rules/:id', requireAuth, requireAdmin, HospitalityController.getRuleById);

// Create new rule
router.post('/admin/rules', requireAuth, requireAdmin, HospitalityController.createRule);

// Update existing rule
router.put('/admin/rules/:id', requireAuth, requireAdmin, HospitalityController.updateRule);

// Delete (deactivate) rule
router.delete('/admin/rules/:id', requireAuth, requireAdmin, HospitalityController.deleteRule);

// Toggle rule active status
router.post('/admin/rules/:id/toggle', requireAuth, requireAdmin, HospitalityController.toggleRule);

// ============================================
// Admin Endpoints - Engagement Categories
// Hierarchical category tree for organizing rules
// ============================================

// Get full category tree
router.get('/admin/categories', requireAuth, requireAdmin, HospitalityController.getCategoryTree);

// Get root categories only
router.get('/admin/categories/roots', requireAuth, requireAdmin, HospitalityController.getCategoryRoots);

// Search categories
router.get('/admin/categories/search', requireAuth, requireAdmin, HospitalityController.searchCategories);

// Get category statistics
router.get('/admin/categories/stats', requireAuth, requireAdmin, HospitalityController.getCategoryStats);

// Get children of a category (for lazy loading)
router.get('/admin/categories/:id/children', requireAuth, requireAdmin, HospitalityController.getCategoryChildren);

// Get ancestors of a category (breadcrumb path)
router.get('/admin/categories/:id/ancestors', requireAuth, requireAdmin, HospitalityController.getCategoryAncestors);

// Get rules for a category with auto-generation
router.get('/admin/categories/:id/rules', requireAuth, requireAdmin, HospitalityController.getCategoryRules);

// Get single category by ID
router.get('/admin/categories/:id', requireAuth, requireAdmin, HospitalityController.getCategoryById);

// Create new category
router.post('/admin/categories', requireAuth, requireAdmin, HospitalityController.createCategory);

// Update existing category
router.put('/admin/categories/:id', requireAuth, requireAdmin, HospitalityController.updateCategory);

// Delete category with safe deletion mode
router.delete('/admin/categories/:id', requireAuth, requireAdmin, HospitalityController.deleteCategory);

// Reorder categories within a parent
router.post('/admin/categories/reorder', requireAuth, requireAdmin, HospitalityController.reorderCategories);

// Restore soft-deleted category
router.post('/admin/categories/:id/restore', requireAuth, requireAdmin, HospitalityController.restoreCategory);

// ============================================
// Admin Endpoints - Hospitality Cockpit
// Flight instrument dashboard for situational awareness
// ============================================

// Get current cockpit state (all gauges)
router.get('/admin/cockpit', requireAuth, requireAdmin, HospitalityController.getCockpitState);

// Force refresh of cockpit metrics
router.post('/admin/cockpit/refresh', requireAuth, requireAdmin, HospitalityController.refreshCockpitMetrics);

// Get historical cockpit data
router.get('/admin/cockpit/history', requireAuth, requireAdmin, HospitalityController.getCockpitHistory);

// Get active cockpit alerts
router.get('/admin/cockpit/alerts', requireAuth, requireAdmin, HospitalityController.getCockpitAlerts);

// Acknowledge an alert
router.post('/admin/cockpit/alerts/:id/acknowledge', requireAuth, requireAdmin, HospitalityController.acknowledgeCockpitAlert);

// Resolve an alert
router.post('/admin/cockpit/alerts/:id/resolve', requireAuth, requireAdmin, HospitalityController.resolveCockpitAlert);

// Get cockpit configuration
router.get('/admin/cockpit/config', requireAuth, requireAdmin, HospitalityController.getCockpitConfig);

// Update cockpit configuration
router.put('/admin/cockpit/config/:key', requireAuth, requireAdmin, HospitalityController.updateCockpitConfig);

// ============================================
// Admin Endpoints - AI-Assisted Content
// AI-powered content generation and editing
// ============================================

// Process AI instruction to update rule content
router.post('/admin/ai/process-instruction', requireAuth, requireAdmin, HospitalityController.processAiInstruction);

module.exports = router;
