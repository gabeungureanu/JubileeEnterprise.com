/**
 * Discussion Board Controller
 * Handles discussion board HTTP requests
 */

const { DiscussionBoardService, CommunityService } = require('../services');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

async function resolveCommunityFromRequest(req) {
  const requested = req.query?.communityId || req.body?.communityId || null;
  if (requested) {
    const community = await CommunityService.resolveCommunityByIdOrSlug(requested);
    if (!community) {
      throw new AppError('Community not found', 404);
    }
    return community;
  }

  return CommunityService.ensureGlobalCommunity();
}

async function requireCommunityMembership(communityId, userId) {
  const membership = await CommunityService.getMembership(communityId, userId);
  if (!membership) {
    throw new AppError('Access denied', 403);
  }
  return membership;
}

/**
 * Get all discussion boards
 * GET /api/boards
 */
const getBoards = asyncHandler(async (req, res) => {
  const { includeInactive, limit, offset } = req.query;

  const boards = await DiscussionBoardService.getAllBoards({
    includeInactive: includeInactive === 'true',
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0
  });

  res.json({
    success: true,
    boards
  });
});

/**
 * Get a single board by slug
 * GET /api/boards/:slug
 */
const getBoard = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const board = await DiscussionBoardService.getBoardBySlug(slug);

  // Check if user is a member
  let membership = null;
  if (req.session.userId) {
    membership = await require('../models').DiscussionBoard.isMember(board.id, req.session.userId);
  }

  res.json({
    success: true,
    board,
    membership
  });
});

/**
 * Join a board
 * POST /api/boards/:slug/join
 */
const joinBoard = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { slug } = req.params;
  const board = await DiscussionBoardService.getBoardBySlug(slug);

  const membership = await DiscussionBoardService.joinBoard(board.id, req.session.userId);

  res.json({
    success: true,
    message: 'Joined board successfully',
    membership
  });
});

/**
 * Leave a board
 * POST /api/boards/:slug/leave
 */
const leaveBoard = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { slug } = req.params;
  const board = await DiscussionBoardService.getBoardBySlug(slug);

  await DiscussionBoardService.leaveBoard(board.id, req.session.userId);

  res.json({
    success: true,
    message: 'Left board successfully'
  });
});

/**
 * Get user's joined boards
 * GET /api/boards/my-boards
 */
const getMyBoards = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const boards = await DiscussionBoardService.getUserBoards(req.session.userId);

  res.json({
    success: true,
    boards
  });
});

/**
 * Get conversations for a board
 * GET /api/boards/:slug/conversations
 */
const getBoardConversations = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { limit, offset, status } = req.query;

  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const board = await DiscussionBoardService.getBoardBySlug(slug);
  const community = await resolveCommunityFromRequest(req);
  await requireCommunityMembership(community.id, req.session.userId);

  const conversations = await DiscussionBoardService.getBoardConversations(board.id, {
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
    status: status || 'active',
    communityId: community.id
  });

  // Note: Auto-seeding removed - users can create conversations manually
  // Empty boards are now allowed after deletion

  res.json({
    success: true,
    board: {
      id: board.id,
      name: board.name,
      slug: board.slug
    },
    community,
    conversations
  });
});

/**
 * Create a new conversation in a board
 * POST /api/boards/:slug/conversations
 */
const createConversation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { slug } = req.params;
  const { title, description, initialMessage } = req.body;

  if (!title || !title.trim()) {
    throw new AppError('Title is required', 400);
  }

  const board = await DiscussionBoardService.getBoardBySlug(slug);
  const community = await resolveCommunityFromRequest(req);
  await requireCommunityMembership(community.id, req.session.userId);

  const conversation = await DiscussionBoardService.createConversation({
    boardId: board.id,
    communityId: community.id,
    userId: req.session.userId,
    title: title.trim(),
    description: description?.trim() || null,
    initialMessage: initialMessage?.trim() || null
  });

  res.status(201).json({
    success: true,
    conversation
  });
});

/**
 * Get a single conversation
 * GET /api/boards/conversations/:conversationId
 */
const getConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  const conversation = await DiscussionBoardService.getConversation(conversationId);
  const communityId = conversation.communityId || (await CommunityService.ensureGlobalCommunity()).id;

  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  await requireCommunityMembership(communityId, req.session.userId);

  res.json({
    success: true,
    conversation
  });
});

/**
 * Get messages for a conversation
 * GET /api/boards/conversations/:conversationId/messages
 */
const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { limit, offset, order, language } = req.query;

  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const conversation = await DiscussionBoardService.getConversation(conversationId);
  const communityId = conversation.communityId || (await CommunityService.ensureGlobalCommunity()).id;
  await requireCommunityMembership(communityId, req.session.userId);

  const messages = await DiscussionBoardService.getConversationMessages(conversationId, {
    limit: parseInt(limit) || 100,
    offset: parseInt(offset) || 0,
    order: order || 'asc',
    targetLanguage: language || null
  });

  res.json({
    success: true,
    messages
  });
});

/**
 * Post a message to a conversation
 * POST /api/boards/conversations/:conversationId/messages
 */
const postMessage = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { conversationId } = req.params;
  const { content, requestAiResponse } = req.body;

  if (!content || !content.trim()) {
    throw new AppError('Message content is required', 400);
  }

  const conversation = await DiscussionBoardService.getConversation(conversationId);
  const communityId = conversation.communityId || (await CommunityService.ensureGlobalCommunity()).id;
  await requireCommunityMembership(communityId, req.session.userId);

  const result = await DiscussionBoardService.postMessage({
    conversationId,
    userId: req.session.userId,
    content: content.trim(),
    requestAiResponse: requestAiResponse === true
  });

  res.status(201).json({
    success: true,
    userMessage: result.userMessage,
    aiMessage: result.aiMessage
  });
});

/**
 * Request AI response for a conversation
 * POST /api/boards/conversations/:conversationId/ai-response
 */
const requestAiResponse = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { conversationId } = req.params;

  const conversation = await DiscussionBoardService.getConversation(conversationId);
  const communityId = conversation.communityId || (await CommunityService.ensureGlobalCommunity()).id;
  await requireCommunityMembership(communityId, req.session.userId);

  const aiMessage = await DiscussionBoardService.generateAiResponse(conversationId);

  res.json({
    success: true,
    message: aiMessage
  });
});

/**
 * Like a message
 * POST /api/boards/messages/:messageId/like
 */
const likeMessage = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { messageId } = req.params;

  await DiscussionBoardService.likeMessage(messageId, req.session.userId);

  res.json({
    success: true,
    message: 'Message liked'
  });
});

/**
 * Unlike a message
 * DELETE /api/boards/messages/:messageId/like
 */
const unlikeMessage = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { messageId } = req.params;

  await DiscussionBoardService.unlikeMessage(messageId, req.session.userId);

  res.json({
    success: true,
    message: 'Message unliked'
  });
});

/**
 * Delete a board conversation and all its messages/translations
 * DELETE /api/boards/conversations/:conversationId
 */
const deleteConversation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { conversationId } = req.params;

  // Get conversation to verify ownership/permissions
  const conversation = await DiscussionBoardService.getConversation(conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }

  const communityId = conversation.communityId || (await CommunityService.ensureGlobalCommunity()).id;
  await requireCommunityMembership(communityId, req.session.userId);

  // Delete the conversation (service will handle messages and translations)
  await DiscussionBoardService.deleteConversation(conversationId);

  res.json({
    success: true,
    message: 'Conversation deleted successfully'
  });
});

/**
 * Search in a board
 * GET /api/boards/:slug/search
 */
const searchBoard = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { q, type, limit } = req.query;

  if (!q) {
    throw new AppError('Search query is required', 400);
  }

  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const board = await DiscussionBoardService.getBoardBySlug(slug);
  const community = await resolveCommunityFromRequest(req);
  await requireCommunityMembership(community.id, req.session.userId);

  let results;
  if (type === 'messages') {
    results = await DiscussionBoardService.searchMessages(board.id, q, { limit: parseInt(limit) || 50, communityId: community.id });
  } else {
    results = await DiscussionBoardService.searchConversations(board.id, q, { limit: parseInt(limit) || 20, communityId: community.id });
  }

  res.json({
    success: true,
    query: q,
    type: type || 'conversations',
    results
  });
});

/**
 * Translate text to target language
 * POST /api/boards/translate
 * Client-side translation layer endpoint
 */
const translateText = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { text, targetLanguage } = req.body;

  if (!text || !targetLanguage) {
    throw new AppError('Text and targetLanguage are required', 400);
  }

  // Skip translation if target is English
  if (targetLanguage === 'en' || targetLanguage === 'en-US' || targetLanguage === 'en-GB') {
    return res.json({
      success: true,
      translatedText: text,
      targetLanguage
    });
  }

  try {
    const translatedText = await DiscussionBoardService.translateTextForClient(text, targetLanguage);

    res.json({
      success: true,
      translatedText: translatedText || text,
      targetLanguage
    });
  } catch (error) {
    logger.error('Translation error:', error);
    // Return original text if translation fails
    res.json({
      success: true,
      translatedText: text,
      targetLanguage,
      error: 'Translation failed, showing original'
    });
  }
});

module.exports = {
  getBoards,
  getBoard,
  joinBoard,
  leaveBoard,
  getMyBoards,
  getBoardConversations,
  createConversation,
  getConversation,
  deleteConversation,
  getMessages,
  postMessage,
  requestAiResponse,
  likeMessage,
  unlikeMessage,
  searchBoard,
  translateText
};
