/**
 * ConversationAnalysisController
 * Handles HTTP requests for conversation analytics
 * Part of the User Analytics and Intelligence System
 *
 * Privacy and Demographics Endpoints:
 * - Conversation privacy controls (mark/unmark as private)
 * - Self-declared demographics (user self-reported, NEVER inferred)
 * - Analytics consent management
 */

const logger = require('../utils/logger');
const ConversationAnalysisService = require('../services/ConversationAnalysisService');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * Analyze a conversation message
 * POST /api/conversation/analyze
 *
 * Body: {
 *   messageId: string (required),
 *   conversationId: string (required),
 *   userMessage: string (required),
 *   aiResponse: string (required),
 *   personaId: string (optional),
 *   sessionId: string (optional)
 * }
 */
const analyzeConversation = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const {
    messageId,
    conversationId,
    userMessage,
    aiResponse,
    personaId,
    sessionId
  } = req.body;

  // Validate required fields
  if (!messageId) {
    throw new AppError('messageId is required', 400);
  }

  if (!conversationId) {
    throw new AppError('conversationId is required', 400);
  }

  if (!userMessage) {
    throw new AppError('userMessage is required', 400);
  }

  if (!aiResponse) {
    throw new AppError('aiResponse is required', 400);
  }

  const result = await ConversationAnalysisService.analyzeMessage({
    userId,
    messageId,
    conversationId,
    personaId: personaId || null,
    sessionId: sessionId || req.sessionID || null,
    userMessage,
    aiResponse
  });

  res.json({
    success: true,
    ...result
  });
});

/**
 * Get user's analytics summary
 * GET /api/user/analytics
 */
const getUserAnalytics = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const summary = await ConversationAnalysisService.getUserAnalyticsSummary(userId);

  res.json({
    success: true,
    analytics: summary
  });
});

/**
 * Get specific month's analytics
 * GET /api/user/analytics/:yearMonth
 *
 * Params:
 *   yearMonth: string (YYYY-MM format)
 */
const getMonthlyAnalytics = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const { yearMonth } = req.params;

  // Validate yearMonth format
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new AppError('Invalid yearMonth format. Use YYYY-MM', 400);
  }

  const analytics = await ConversationAnalysisService.getMonthlyAnalytics(userId, yearMonth);

  res.json({
    success: true,
    analytics
  });
});

/**
 * Get analytics history (multiple months)
 * GET /api/user/analytics-history
 *
 * Query:
 *   months: number (optional, default 12)
 */
const getAnalyticsHistory = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const months = parseInt(req.query.months) || 12;

  if (months < 1 || months > 36) {
    throw new AppError('months must be between 1 and 36', 400);
  }

  const history = await ConversationAnalysisService.getAnalyticsHistory(userId, months);

  res.json({
    success: true,
    history
  });
});

/**
 * Update analytics consent preference
 * PUT /api/user/analytics-consent
 *
 * Body: {
 *   consent: boolean (required)
 * }
 */
const updateAnalyticsConsent = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const { consent } = req.body;

  if (typeof consent !== 'boolean') {
    throw new AppError('consent must be a boolean value', 400);
  }

  const result = await ConversationAnalysisService.updateAnalyticsConsent(userId, consent);

  res.json({
    success: true,
    ...result
  });
});

/**
 * Delete all user analytics data (GDPR compliance)
 * DELETE /api/user/analytics
 */
const deleteUserAnalytics = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const result = await ConversationAnalysisService.deleteUserAnalytics(userId);

  logger.info('User analytics deleted via API', { userId });

  res.json({
    success: true,
    message: 'All analytics data has been deleted',
    ...result
  });
});

/**
 * Get analytics consent status
 * GET /api/user/analytics-consent
 */
const getAnalyticsConsent = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    analyticsConsent: user.analyticsConsent || false,
    analyticsConsentAt: user.analyticsConsentAt || null
  });
});

// ============================================
// Conversation Privacy Controls
// ============================================

/**
 * Mark a conversation as private
 * Private conversations are EXCLUDED from all analytics
 * PUT /api/conversation/:conversationId/privacy
 *
 * Body: {
 *   isPrivate: boolean (required)
 * }
 */
const setConversationPrivacy = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const { conversationId } = req.params;
  const { isPrivate } = req.body;

  if (typeof isPrivate !== 'boolean') {
    throw new AppError('isPrivate must be a boolean value', 400);
  }

  // Verify user owns this conversation
  const belongsToUser = await Conversation.belongsToUser(conversationId, userId);
  if (!belongsToUser) {
    throw new AppError('Conversation not found or access denied', 404);
  }

  const conversation = await Conversation.setPrivate(conversationId, isPrivate);

  logger.info('Conversation privacy updated', {
    userId,
    conversationId,
    isPrivate
  });

  res.json({
    success: true,
    conversationId,
    isPrivate: conversation.isPrivate,
    markedPrivateAt: conversation.markedPrivateAt,
    message: isPrivate
      ? 'Conversation marked as private. No analytics will be stored.'
      : 'Conversation privacy removed. Analytics will be processed normally.'
  });
});

/**
 * Get conversation privacy status
 * GET /api/conversation/:conversationId/privacy
 */
const getConversationPrivacy = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const { conversationId } = req.params;

  // Verify user owns this conversation
  const belongsToUser = await Conversation.belongsToUser(conversationId, userId);
  if (!belongsToUser) {
    throw new AppError('Conversation not found or access denied', 404);
  }

  const conversation = await Conversation.findById(conversationId);

  res.json({
    success: true,
    conversationId,
    isPrivate: conversation.isPrivate || false,
    markedPrivateAt: conversation.markedPrivateAt || null
  });
});

/**
 * Get all private conversations for the user
 * GET /api/user/private-conversations
 *
 * Query:
 *   limit: number (optional, default 50)
 *   offset: number (optional, default 0)
 */
const getPrivateConversations = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const conversations = await Conversation.findPrivateByUser(userId, { limit, offset });
  const total = await Conversation.countPrivateByUser(userId);

  res.json({
    success: true,
    conversations,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + conversations.length < total
    }
  });
});

// ============================================
// Self-Declared Demographics (NEVER inferred)
// ============================================

/**
 * Update user's self-declared demographics
 * PUT /api/user/demographics
 *
 * Body: {
 *   sex: string (optional - 'male', 'female', 'other', 'prefer_not_to_say'),
 *   primaryLanguage: string (optional - ISO language code),
 *   secondaryLanguages: string[] (optional - array of ISO language codes),
 *   languageInterests: string[] (optional - languages user wants to learn),
 *   churchBackground: string (optional),
 *   churchAttendance: string (optional - 'never', 'rarely', 'monthly', 'weekly', 'multiple_weekly'),
 *   yearsBeliever: number (optional),
 *   ageRange: string (optional - '13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'),
 *   maritalStatus: string (optional - 'single', 'married', 'divorced', 'widowed', 'separated'),
 *   parentStatus: string (optional - 'no_children', 'expecting', 'parent', 'grandparent'),
 *   denomination: string (optional)
 * }
 */
const updateDeclaredDemographics = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const demographics = req.body;

  // Validate sex field if provided
  if (demographics.sex !== undefined) {
    const validSex = ['male', 'female', 'other', 'prefer_not_to_say'];
    if (!validSex.includes(demographics.sex)) {
      throw new AppError(`sex must be one of: ${validSex.join(', ')}`, 400);
    }
  }

  // Validate church attendance if provided
  if (demographics.churchAttendance !== undefined) {
    const validAttendance = ['never', 'rarely', 'monthly', 'weekly', 'multiple_weekly'];
    if (!validAttendance.includes(demographics.churchAttendance)) {
      throw new AppError(`churchAttendance must be one of: ${validAttendance.join(', ')}`, 400);
    }
  }

  // Validate age range if provided
  if (demographics.ageRange !== undefined) {
    const validAgeRanges = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
    if (!validAgeRanges.includes(demographics.ageRange)) {
      throw new AppError(`ageRange must be one of: ${validAgeRanges.join(', ')}`, 400);
    }
  }

  // Validate marital status if provided
  if (demographics.maritalStatus !== undefined) {
    const validStatus = ['single', 'married', 'divorced', 'widowed', 'separated'];
    if (!validStatus.includes(demographics.maritalStatus)) {
      throw new AppError(`maritalStatus must be one of: ${validStatus.join(', ')}`, 400);
    }
  }

  // Validate parent status if provided
  if (demographics.parentStatus !== undefined) {
    const validParent = ['no_children', 'expecting', 'parent', 'grandparent'];
    if (!validParent.includes(demographics.parentStatus)) {
      throw new AppError(`parentStatus must be one of: ${validParent.join(', ')}`, 400);
    }
  }

  // Validate years believer is a positive number if provided
  if (demographics.yearsBeliever !== undefined) {
    const years = parseInt(demographics.yearsBeliever);
    if (isNaN(years) || years < 0 || years > 150) {
      throw new AppError('yearsBeliever must be a positive number', 400);
    }
    demographics.yearsBeliever = years;
  }

  // Validate arrays
  if (demographics.secondaryLanguages !== undefined && !Array.isArray(demographics.secondaryLanguages)) {
    throw new AppError('secondaryLanguages must be an array', 400);
  }
  if (demographics.languageInterests !== undefined && !Array.isArray(demographics.languageInterests)) {
    throw new AppError('languageInterests must be an array', 400);
  }

  const user = await User.updateDeclaredDemographics(userId, demographics);

  logger.info('User demographics updated', { userId });

  res.json({
    success: true,
    message: 'Demographics updated successfully',
    demographics: {
      sex: user.declaredSex,
      primaryLanguage: user.declaredPrimaryLanguage,
      secondaryLanguages: user.declaredSecondaryLanguages,
      languageInterests: user.declaredLanguageInterests,
      churchBackground: user.declaredChurchBackground,
      churchAttendance: user.declaredChurchAttendance,
      yearsBeliever: user.declaredYearsBeliever,
      ageRange: user.declaredAgeRange,
      maritalStatus: user.declaredMaritalStatus,
      parentStatus: user.declaredParentStatus,
      denomination: user.declaredDenomination,
      updatedAt: user.demographicsUpdatedAt
    }
  });
});

/**
 * Get user's self-declared demographics
 * GET /api/user/demographics
 */
const getDeclaredDemographics = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const demographics = await User.getDeclaredDemographics(userId);

  if (!demographics) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    demographics
  });
});

/**
 * Clear specific demographic fields
 * DELETE /api/user/demographics/:field
 *
 * Params:
 *   field: string (one of the demographic field names)
 */
const clearDemographicField = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const { field } = req.params;

  const validFields = [
    'sex', 'primaryLanguage', 'secondaryLanguages', 'languageInterests',
    'churchBackground', 'churchAttendance', 'yearsBeliever', 'ageRange',
    'maritalStatus', 'parentStatus', 'denomination'
  ];

  if (!validFields.includes(field)) {
    throw new AppError(`Invalid field. Must be one of: ${validFields.join(', ')}`, 400);
  }

  // Set the field to null
  const updates = { [field]: null };
  await User.updateDeclaredDemographics(userId, updates);

  logger.info('User demographic field cleared', { userId, field });

  res.json({
    success: true,
    message: `${field} has been cleared`,
    field
  });
});

/**
 * Get user's complete privacy and analytics settings
 * GET /api/user/privacy-settings
 *
 * Returns combined privacy status including consent, private conversation count, etc.
 */
const getPrivacySettings = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const privateConversationCount = await Conversation.countPrivateByUser(userId);
  const consent = await User.getAnalyticsConsent(userId);

  res.json({
    success: true,
    privacy: {
      analyticsConsent: consent?.consent || false,
      analyticsConsentAt: consent?.consentedAt || null,
      privateConversationCount,
      // Info for user
      note: 'Analytics consent controls whether spiritual insights are stored. Private conversations are always excluded from analytics regardless of consent.'
    }
  });
});

module.exports = {
  // Core analytics
  analyzeConversation,
  getUserAnalytics,
  getMonthlyAnalytics,
  getAnalyticsHistory,
  updateAnalyticsConsent,
  deleteUserAnalytics,
  getAnalyticsConsent,
  // Conversation privacy controls
  setConversationPrivacy,
  getConversationPrivacy,
  getPrivateConversations,
  // Self-declared demographics (NEVER inferred)
  updateDeclaredDemographics,
  getDeclaredDemographics,
  clearDemographicField,
  // Combined privacy settings
  getPrivacySettings
};
