/**
 * Chat routes
 * Delegates to ChatController and PageController for request handling
 */

const express = require('express');
const router = express.Router();
const { ChatController, PageController } = require('../controllers');
const { requireAuth, apiRateLimiter } = require('../middleware');

// Page routes
router.get('/', requireAuth, PageController.chat);
router.get('/:conversationId', requireAuth, PageController.chat);

// Conversation management
router.post('/conversations', requireAuth, ChatController.createConversation);
router.get('/conversations/list', requireAuth, ChatController.getConversations);
router.get('/conversations/:id', requireAuth, ChatController.getConversation);
router.put('/conversations/:id', requireAuth, ChatController.updateConversation);
router.delete('/conversations/:id', requireAuth, ChatController.deleteConversation);
router.post('/conversations/:id/archive', requireAuth, ChatController.archiveConversation);

// Mailbox-based conversation retrieval
router.get('/mailbox/:type', requireAuth, ChatController.getConversationsByMailbox);

// Messages
router.get('/conversations/:id/messages', requireAuth, ChatController.getMessages);
router.post('/conversations/:id/messages', requireAuth, apiRateLimiter, ChatController.sendMessage);

// Async message handling (queue-based for high traffic)
router.post('/conversations/:id/messages/async', requireAuth, apiRateLimiter, ChatController.sendMessageAsync);

// Request status and cancellation
router.get('/request/:requestId/status', requireAuth, ChatController.getRequestStatus);
router.delete('/request/:requestId', requireAuth, ChatController.cancelRequest);

// Search and stats
router.get('/search', requireAuth, ChatController.searchConversations);
router.get('/stats', requireAuth, ChatController.getStats);

module.exports = router;
