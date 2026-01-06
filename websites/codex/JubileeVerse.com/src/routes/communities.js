/**
 * Community routes
 */

const express = require('express');
const router = express.Router();
const CommunityController = require('../controllers/CommunityController');
const CommunityInboxController = require('../controllers/CommunityInboxController');
const { requireAuth, apiRateLimiter } = require('../middleware');

// Community management
router.get('/', requireAuth, CommunityController.getCommunities);
router.get('/:id/members', requireAuth, CommunityController.getCommunityMembers);
router.post('/:id/invite', requireAuth, apiRateLimiter, CommunityController.inviteMember);

// Community inbox routes
router.get('/:communityId/inbox', requireAuth, CommunityInboxController.getConversations);
router.post('/:communityId/inbox', requireAuth, apiRateLimiter, CommunityInboxController.createConversation);
router.get('/:communityId/inbox/:conversationId', requireAuth, CommunityInboxController.getConversation);
router.put('/:communityId/inbox/:conversationId', requireAuth, CommunityInboxController.updateConversation);
router.delete('/:communityId/inbox/:conversationId', requireAuth, CommunityInboxController.deleteConversation);
router.get('/:communityId/inbox/:conversationId/messages', requireAuth, CommunityInboxController.getMessages);
router.post('/:communityId/inbox/:conversationId/messages', requireAuth, apiRateLimiter, CommunityInboxController.postMessage);

module.exports = router;
