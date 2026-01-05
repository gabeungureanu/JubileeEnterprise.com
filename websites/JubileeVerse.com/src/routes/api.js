/**
 * API routes
 * General JSON endpoints for frontend consumption
 */

const express = require('express');
const router = express.Router();
const { AuthController, ChatController, PersonaController, TranslationController, LogController } = require('../controllers');
const { requireAuth, apiRateLimiter } = require('../middleware');

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '8.0.0'
  });
});

// Auth API routes (prefixed with /api)
router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);
router.post('/auth/logout', requireAuth, AuthController.logout);
router.get('/auth/me', AuthController.getCurrentUser);
router.post('/auth/forgot-password', AuthController.forgotPassword);
router.post('/auth/reset-password', AuthController.resetPassword);
router.post('/auth/change-password', requireAuth, AuthController.changePassword);
router.put('/auth/profile', requireAuth, AuthController.updateProfile);

// Chat API routes
router.post('/chat/conversations', requireAuth, ChatController.createConversation);
router.get('/chat/conversations', requireAuth, ChatController.getConversations);
router.get('/chat/conversations/:id', requireAuth, ChatController.getConversation);
router.put('/chat/conversations/:id', requireAuth, ChatController.updateConversation);
router.delete('/chat/conversations/:id', requireAuth, ChatController.deleteConversation);
router.get('/chat/mailbox/:type', requireAuth, ChatController.getConversationsByMailbox);
router.get('/chat/conversations/:id/messages', requireAuth, ChatController.getMessages);
router.post('/chat/conversations/:id/messages', requireAuth, apiRateLimiter, ChatController.sendMessage);
router.get('/chat/search', requireAuth, ChatController.searchConversations);
router.get('/chat/stats', requireAuth, ChatController.getStats);

// Persona API routes
router.get('/personas', PersonaController.getAllPersonas);
router.get('/personas/featured', PersonaController.getFeaturedPersonas);
router.get('/personas/categories', PersonaController.getCategories);
router.get('/personas/search', PersonaController.searchPersonas);
router.get('/personas/:id', PersonaController.getPersonaById);

// Translation API routes
router.get('/translation/languages', TranslationController.getLanguages);
router.get('/translation/books', TranslationController.getBooks);
router.get('/translation/progress/:language', TranslationController.getProgress);
router.get('/translation/progress/:language/:bookId', TranslationController.getBookProgress);
router.post('/translation/submit', requireAuth, TranslationController.submitTranslation);
router.get('/translation/stats', TranslationController.getDashboardStats);

/**
 * GET /api/user/preferences
 * Get user preferences
 */
router.get('/user/preferences', requireAuth, async (req, res) => {
  try {
    // TODO: Move to a UserPreferencesController/Service when needed
    const preferences = {
      theme: 'light',
      preferredLanguage: req.session.user?.preferredLanguage || 'en',
      fontSize: 'medium',
      notifications: {
        email: true,
        push: false
      },
      defaultPersonaId: null
    };

    res.json({ success: true, preferences });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
  }
});

/**
 * PUT /api/user/preferences
 * Update user preferences
 */
router.put('/user/preferences', requireAuth, async (req, res) => {
  try {
    const updates = req.body;
    // TODO: Move to a UserPreferencesController/Service when needed
    res.json({ success: true, preferences: updates });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

/**
 * PUT /api/user/default-persona
 * Set the user's default AI persona
 * This persona will be used as the baseline for new conversations
 */
const { User } = require('../models');
const { PersonaService } = require('../services');
const logger = require('../utils/logger');

router.put('/user/default-persona', requireAuth, async (req, res) => {
  try {
    const { personaSlug, personaId } = req.body;
    const userId = req.session.userId;

    if (!personaSlug && !personaId) {
      return res.status(400).json({
        success: false,
        error: 'Either personaSlug or personaId is required'
      });
    }

    // Find persona by slug or ID
    let persona;
    if (personaId) {
      persona = await PersonaService.getPersonaById(personaId);
    } else if (personaSlug) {
      persona = await PersonaService.getPersonaBySlug(personaSlug);
    }

    if (!persona) {
      return res.status(404).json({
        success: false,
        error: 'Persona not found'
      });
    }

    // Update user's default persona
    await User.setDefaultPersona(userId, persona.id);

    logger.info('User default persona updated', {
      userId,
      personaId: persona.id,
      personaSlug: persona.slug,
      personaName: persona.name
    });

    res.json({
      success: true,
      defaultPersona: {
        id: persona.id,
        slug: persona.slug,
        name: persona.name,
        avatarUrl: persona.avatarUrl
      }
    });
  } catch (error) {
    logger.error('Failed to update default persona', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update default persona' });
  }
});

/**
 * GET /api/user/default-persona
 * Get the user's default AI persona
 */
router.get('/user/default-persona', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const persona = await User.getDefaultPersona(userId);

    res.json({
      success: true,
      defaultPersona: persona // null if not set
    });
  } catch (error) {
    logger.error('Failed to get default persona', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get default persona' });
  }
});

/**
 * POST /api/feedback
 * Submit user feedback
 */
router.post('/feedback', requireAuth, apiRateLimiter, async (req, res) => {
  try {
    const { type, message, context } = req.body;

    if (!type || !message) {
      return res.status(400).json({
        success: false,
        error: 'Feedback type and message are required'
      });
    }

    // TODO: Move to FeedbackController/Service when needed
    const feedback = {
      id: 'feedback-' + Date.now(),
      userId: req.session.userId,
      type,
      message,
      context,
      createdAt: new Date().toISOString()
    };

    res.json({ success: true, feedback });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to submit feedback' });
  }
});

// Log API routes (for troubleshooting)
router.get('/logs', LogController.getLogs);
router.post('/logs/clear', LogController.clearLogs);

// ============ COMMUNITY API ROUTES ============
const { CommunityController } = require('../controllers');

// Community CRUD
router.get('/communities', requireAuth, CommunityController.getCommunities);
router.get('/communities/:id', requireAuth, CommunityController.getCommunity);
router.post('/communities', requireAuth, CommunityController.createCommunity);
router.put('/communities/:id', requireAuth, CommunityController.updateCommunity);
router.delete('/communities/:id', requireAuth, CommunityController.deleteCommunity);

// Community members
router.get('/communities/:id/members', requireAuth, CommunityController.getCommunityMembers);
router.delete('/communities/:id/members/:userId', requireAuth, CommunityController.removeCommunityMember);

// Community teams
router.get('/communities/:id/teams', requireAuth, CommunityController.getTeams);
router.post('/communities/:id/teams', requireAuth, CommunityController.createTeam);
router.get('/teams/:teamId', requireAuth, CommunityController.getTeam);
router.put('/teams/:teamId', requireAuth, CommunityController.updateTeam);
router.delete('/teams/:teamId', requireAuth, CommunityController.deleteTeam);

// Team members
router.get('/teams/:teamId/members', requireAuth, CommunityController.getTeamMembers);
router.post('/teams/:teamId/members', requireAuth, CommunityController.addTeamMember);
router.delete('/teams/:teamId/members/:userId', requireAuth, CommunityController.removeTeamMember);

// Community invitations
router.post('/communities/:id/invitations', requireAuth, CommunityController.createInvitation);
router.get('/communities/:id/invitations', requireAuth, CommunityController.getCommunityInvitations);
router.get('/invitations/my', requireAuth, CommunityController.getMyInvitations);
router.get('/invitations/token/:token', CommunityController.getInvitationByToken);
router.post('/invitations/:id/accept', requireAuth, CommunityController.acceptInvitation);
router.post('/invitations/:id/decline', requireAuth, CommunityController.declineInvitation);
router.delete('/invitations/:id', requireAuth, CommunityController.cancelInvitation);

// ============ PLAN FEATURES API (public, with translation) ============
const PlanTranslationService = require('../services/PlanTranslationService');

/**
 * GET /api/plan-features
 * Get plan features with optional translation
 * Query params:
 *   - lang: language code (default: 'en')
 *   - published: 'true' or 'false' (default: 'true')
 */
router.get('/plan-features', async (req, res) => {
  try {
    const languageCode = req.query.lang || req.session?.user?.preferredLanguage || 'en';
    const publishedOnly = req.query.published !== 'false';

    const categories = await PlanTranslationService.getTranslatedFeatures(languageCode, publishedOnly);
    const staticContent = await PlanTranslationService.getStaticTranslations(languageCode);
    const versions = await PlanTranslationService.getVersions();

    res.json({
      success: true,
      languageCode,
      versions,
      staticContent,
      categories
    });
  } catch (error) {
    logger.error('Failed to get plan features', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get plan features' });
  }
});

/**
 * GET /api/plan-features/static
 * Get static page translations only
 */
router.get('/plan-features/static', async (req, res) => {
  try {
    const languageCode = req.query.lang || req.session?.user?.preferredLanguage || 'en';
    const staticContent = await PlanTranslationService.getStaticTranslations(languageCode);

    res.json({
      success: true,
      languageCode,
      staticContent
    });
  } catch (error) {
    logger.error('Failed to get static translations', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get static translations' });
  }
});

/**
 * POST /api/plan-features/translate
 * Trigger translation for a language (requires auth)
 */
router.post('/plan-features/translate', requireAuth, async (req, res) => {
  try {
    const { languageCode, force } = req.body;

    if (!languageCode || languageCode === 'en') {
      return res.status(400).json({ success: false, error: 'Valid non-English language code required' });
    }

    if (force) {
      await PlanTranslationService.forceRetranslation(languageCode);
    } else {
      await PlanTranslationService.translateAllContent(languageCode);
    }

    res.json({ success: true, message: `Translation completed for ${languageCode}` });
  } catch (error) {
    logger.error('Translation failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Translation failed' });
  }
});

// ============ USER ANALYTICS API ROUTES ============
const ConversationAnalysisController = require('../controllers/ConversationAnalysisController');

// Analyze a conversation message
router.post('/conversation/analyze', requireAuth, ConversationAnalysisController.analyzeConversation);

// Get user analytics summary
router.get('/user/analytics', requireAuth, ConversationAnalysisController.getUserAnalytics);

// Get specific month's analytics
router.get('/user/analytics/:yearMonth', requireAuth, ConversationAnalysisController.getMonthlyAnalytics);

// Get analytics history
router.get('/user/analytics-history', requireAuth, ConversationAnalysisController.getAnalyticsHistory);

// Get/Update analytics consent
router.get('/user/analytics-consent', requireAuth, ConversationAnalysisController.getAnalyticsConsent);
router.put('/user/analytics-consent', requireAuth, ConversationAnalysisController.updateAnalyticsConsent);

// Delete user analytics data (GDPR)
router.delete('/user/analytics', requireAuth, ConversationAnalysisController.deleteUserAnalytics);

// ============ CONVERSATION PRIVACY CONTROLS ============
// Mark/unmark conversations as private (excluded from ALL analytics)
router.get('/conversation/:conversationId/privacy', requireAuth, ConversationAnalysisController.getConversationPrivacy);
router.put('/conversation/:conversationId/privacy', requireAuth, ConversationAnalysisController.setConversationPrivacy);

// Get all private conversations for user
router.get('/user/private-conversations', requireAuth, ConversationAnalysisController.getPrivateConversations);

// ============ SELF-DECLARED DEMOGRAPHICS (NEVER inferred) ============
// User self-reported demographic information
router.get('/user/demographics', requireAuth, ConversationAnalysisController.getDeclaredDemographics);
router.put('/user/demographics', requireAuth, ConversationAnalysisController.updateDeclaredDemographics);
router.delete('/user/demographics/:field', requireAuth, ConversationAnalysisController.clearDemographicField);

// ============ COMBINED PRIVACY SETTINGS ============
// Get all privacy-related settings in one call
router.get('/user/privacy-settings', requireAuth, ConversationAnalysisController.getPrivacySettings);

// ============ SAFEGUARD & SAFETY ADMINISTRATION ============
// Admin endpoints for safety review, alerting, and persona performance
const SafeguardController = require('../controllers/SafeguardController');

// Dashboard and summary
router.get('/admin/safeguard/dashboard', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getDashboard);

// Alert management
router.get('/admin/safeguard/alerts', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getAlerts);
router.get('/admin/safeguard/alerts/urgent', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getUrgentAlerts);
router.get('/admin/safeguard/alerts/:alertId', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getAlertDetails);
router.post('/admin/safeguard/alerts/:alertId/request-detail', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.requestAlertDetailAccess);
router.post('/admin/safeguard/alerts/:alertId/acknowledge', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.acknowledgeAlert);
router.post('/admin/safeguard/alerts/:alertId/resolve', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.resolveAlert);
router.post('/admin/safeguard/alerts/:alertId/escalate', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.escalateAlert);
router.post('/admin/safeguard/alerts/:alertId/dismiss', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.dismissAlert);
router.get('/admin/safeguard/alerts/:alertId/access-log', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getAlertAccessLog);

// Safety flags
router.get('/admin/safeguard/flags', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getSafetyFlags);
router.get('/admin/safeguard/flags/user/:userId', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getUserSafetyFlags);
router.get('/admin/safeguard/flags/persona/:personaId', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getPersonaSafetyFlags);

// Persona performance and metrics
router.get('/admin/safeguard/personas/flagged', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getFlaggedPersonas);
router.get('/admin/safeguard/personas/boundary-testing', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getPersonasByBoundaryTesting);
router.get('/admin/safeguard/personas/:personaId/metrics', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getPersonaMetrics);
router.get('/admin/safeguard/personas/:personaId/recommendations', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getPersonaRecommendations);
router.get('/admin/safeguard/personas/:personaId/boundary-tests', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getPersonaBoundaryTests);

// Statistics
router.get('/admin/safeguard/stats/alerts', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getAlertStatistics);
router.get('/admin/safeguard/stats/categories', requireAuth, SafeguardController.requireSafeguardAccess, SafeguardController.getCategoryBreakdown);

// ============ MULTI-USER PLAN MANAGEMENT ============
// Shared token pools, associated users, and plan invitations
const PlanManagementController = require('../controllers/PlanManagementController');

// Plan info and balance
router.get('/plan', requireAuth, PlanManagementController.getPlan);
router.get('/plan/balance', requireAuth, PlanManagementController.getBalance);
router.get('/plan/capacity', requireAuth, PlanManagementController.getCapacity);

// Member management (primary/admin only)
router.get('/plan/members', requireAuth, PlanManagementController.getMembers);
router.delete('/plan/members/:userId', requireAuth, PlanManagementController.removeMember);

// Invitation management
router.post('/plan/invite', requireAuth, PlanManagementController.inviteUser);
router.get('/plan/invitations', requireAuth, PlanManagementController.getInvitations);
router.delete('/plan/invitations/:invitationId', requireAuth, PlanManagementController.revokeInvitation);

// Invitation acceptance (by invitee)
router.get('/plan/invitation/:token', PlanManagementController.getInvitationByToken);
router.post('/plan/invitation/:token/accept', requireAuth, PlanManagementController.acceptInvitation);
router.post('/plan/invitation/:token/decline', PlanManagementController.declineInvitation);
router.get('/plan/my-invitations', requireAuth, PlanManagementController.getMyPendingInvitations);

// Token usage and purchases
router.get('/plan/usage', requireAuth, PlanManagementController.getUsageHistory);
router.get('/plan/purchases', requireAuth, PlanManagementController.getPurchaseHistory);
router.post('/plan/purchase-tokens', requireAuth, PlanManagementController.purchaseTokens);

// ============ TEST ENDPOINTS (for automated testing) ============
const DiscussionBoardService = require('../services/DiscussionBoardService');

/**
 * POST /api/test/translate-to-english
 * Test endpoint for translateToEnglish function
 */
router.post('/test/translate-to-english', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    const translated = await DiscussionBoardService.translateToEnglish(content);
    res.json({
      success: true,
      original: content,
      translated: translated
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/test/ai-system-prompt
 * Test endpoint to verify AI system prompt includes English-only instruction
 */
router.get('/test/ai-system-prompt', async (req, res) => {
  try {
    // Return a sample of what the system prompt includes
    const englishInstruction = 'IMPORTANT: You MUST always respond in English, regardless of what language the user writes in. The system will translate your English response to the user\'s preferred language automatically. Never respond in any language other than English.';

    res.json({
      success: true,
      systemPrompt: englishInstruction,
      note: 'This instruction is appended to all AI persona prompts for discussion boards'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
