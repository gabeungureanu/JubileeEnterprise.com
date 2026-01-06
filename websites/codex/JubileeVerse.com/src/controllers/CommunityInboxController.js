/**
 * Community Inbox Controller
 * Handles HTTP requests for community inbox operations
 */

const { CommunityInboxService } = require('../services');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * Get conversations for a community
 * GET /api/communities/:communityId/inbox
 */
const getConversations = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { communityId } = req.params;
  const { limit, offset, status } = req.query;

  const conversations = await CommunityInboxService.getConversations(
    req.session.userId,
    communityId,
    {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      status: status || 'active'
    }
  );

  res.json({
    success: true,
    conversations,
    pagination: {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    }
  });
});

/**
 * Create a new conversation in a community
 * POST /api/communities/:communityId/inbox
 */
const createConversation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { communityId } = req.params;
  const { title, personaId } = req.body;

  const conversation = await CommunityInboxService.createConversation({
    communityId,
    userId: req.session.userId,
    title,
    personaId
  });

  res.status(201).json({
    success: true,
    conversation
  });
});

/**
 * Get a single conversation
 * GET /api/communities/:communityId/inbox/:conversationId
 */
const getConversation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { conversationId } = req.params;

  // Verify ownership
  const belongs = await CommunityInboxService.belongsToUser(conversationId, req.session.userId);
  if (!belongs) {
    throw new AppError('Conversation not found', 404);
  }

  const conversation = await CommunityInboxService.getConversation(conversationId);

  res.json({
    success: true,
    conversation
  });
});

/**
 * Update a conversation
 * PUT /api/communities/:communityId/inbox/:conversationId
 */
const updateConversation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { conversationId } = req.params;
  const { title, status } = req.body;

  // Verify ownership
  const belongs = await CommunityInboxService.belongsToUser(conversationId, req.session.userId);
  if (!belongs) {
    throw new AppError('Conversation not found', 404);
  }

  const conversation = await CommunityInboxService.updateConversation(conversationId, { title, status });

  res.json({
    success: true,
    conversation
  });
});

/**
 * Delete a conversation
 * DELETE /api/communities/:communityId/inbox/:conversationId
 */
const deleteConversation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { conversationId } = req.params;

  // Verify ownership
  const belongs = await CommunityInboxService.belongsToUser(conversationId, req.session.userId);
  if (!belongs) {
    throw new AppError('Conversation not found', 404);
  }

  await CommunityInboxService.deleteConversation(conversationId, req.session.userId);

  res.json({
    success: true,
    message: 'Conversation deleted'
  });
});

/**
 * Get messages for a conversation
 * GET /api/communities/:communityId/inbox/:conversationId/messages
 */
const getMessages = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { conversationId } = req.params;
  const { limit, offset, order } = req.query;

  // Verify ownership
  const belongs = await CommunityInboxService.belongsToUser(conversationId, req.session.userId);
  if (!belongs) {
    throw new AppError('Conversation not found', 404);
  }

  const messages = await CommunityInboxService.getMessages(conversationId, {
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
    order: order || 'asc'
  });

  res.json({
    success: true,
    messages,
    pagination: {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    }
  });
});

/**
 * Post a message to a conversation
 * POST /api/communities/:communityId/inbox/:conversationId/messages
 */
const postMessage = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { conversationId } = req.params;
  const { content, generateResponse } = req.body;

  if (!content || !content.trim()) {
    throw new AppError('Message content is required', 400);
  }

  // Verify ownership
  const belongs = await CommunityInboxService.belongsToUser(conversationId, req.session.userId);
  if (!belongs) {
    throw new AppError('Conversation not found', 404);
  }

  const result = await CommunityInboxService.postMessage({
    conversationId,
    userId: req.session.userId,
    content: content.trim(),
    generateResponse: generateResponse !== false
  });

  res.json({
    success: true,
    userMessage: result.userMessage,
    aiMessage: result.aiMessage
  });
});

module.exports = {
  getConversations,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  getMessages,
  postMessage
};
