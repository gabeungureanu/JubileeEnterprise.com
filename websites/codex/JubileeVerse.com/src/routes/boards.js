/**
 * Discussion Board routes
 * Handles community discussion board endpoints
 */

const express = require('express');
const router = express.Router();
const DiscussionBoardController = require('../controllers/DiscussionBoardController');
const { requireAuth, apiRateLimiter } = require('../middleware');

// Board listing
router.get('/', DiscussionBoardController.getBoards);
router.get('/my-boards', requireAuth, DiscussionBoardController.getMyBoards);

// Client-side translation endpoint (for client-side translation layer)
router.post('/translate', requireAuth, apiRateLimiter, DiscussionBoardController.translateText);

// Single conversation operations (by conversation ID) - MUST be before /:slug routes
router.get('/conversations/:conversationId', DiscussionBoardController.getConversation);
router.delete('/conversations/:conversationId', requireAuth, DiscussionBoardController.deleteConversation);
router.get('/conversations/:conversationId/messages', DiscussionBoardController.getMessages);
router.post('/conversations/:conversationId/messages', requireAuth, apiRateLimiter, DiscussionBoardController.postMessage);
router.post('/conversations/:conversationId/ai-response', requireAuth, apiRateLimiter, DiscussionBoardController.requestAiResponse);

// Message operations - MUST be before /:slug routes
router.post('/messages/:messageId/like', requireAuth, DiscussionBoardController.likeMessage);
router.delete('/messages/:messageId/like', requireAuth, DiscussionBoardController.unlikeMessage);

// Single board operations (/:slug is a catch-all, so must come after specific routes)
router.get('/:slug', DiscussionBoardController.getBoard);
router.post('/:slug/join', requireAuth, DiscussionBoardController.joinBoard);
router.post('/:slug/leave', requireAuth, DiscussionBoardController.leaveBoard);
router.get('/:slug/search', DiscussionBoardController.searchBoard);

// Board conversations
router.get('/:slug/conversations', DiscussionBoardController.getBoardConversations);
router.post('/:slug/conversations', requireAuth, apiRateLimiter, DiscussionBoardController.createConversation);

module.exports = router;
