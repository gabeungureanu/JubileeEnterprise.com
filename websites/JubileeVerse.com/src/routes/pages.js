/**
 * Page routes - serves HTML views
 * Delegates to PageController for request handling
 */

const express = require('express');
const router = express.Router();
const { PageController, ChatController, LogController } = require('../controllers');
const { requireAuth, redirectIfAuth, apiRateLimiter, requireAdmin } = require('../middleware');

// Public pages
router.get('/', PageController.search);
router.get('/home', PageController.home);
router.get('/search', PageController.search);
router.get('/about', PageController.about);
router.get('/features', PageController.features);
router.get('/plans', PageController.plans);
router.get('/test-auth', PageController.testAuth);
router.get('/audiotest', PageController.audiotest);
router.get('/audiotest02', PageController.audiotest02);
router.get('/audiotest03', PageController.audiotest03);
router.get('/audiotest04', PageController.audiotest04);

// Auth pages (redirect if already logged in)
router.get('/login', redirectIfAuth, PageController.login);
router.get('/register', redirectIfAuth, PageController.register);
router.get('/forgot-password', redirectIfAuth, PageController.forgotPassword);

// Protected pages
router.get('/dashboard', requireAuth, PageController.dashboard);
router.get('/profile', requireAuth, PageController.profile);
router.get('/settings', requireAuth, PageController.settings);
router.get('/conversations', requireAuth, PageController.conversations);
router.get('/payment', requireAuth, PageController.payment);
router.get('/payment-update', requireAuth, PageController.paymentUpdate);
router.get('/community', requireAuth, PageController.community);

// Admin pages (protected, admin only)
router.get('/admin', requireAdmin, PageController.admin);
router.get('/admin/hospitality', requireAdmin, PageController.adminHospitality);
router.get('/admin/hospitality-cockpit', requireAdmin, PageController.adminHospitalityCockpit);
router.get('/admin/hospitality/rules', requireAdmin, PageController.adminHospitalityRules);
router.get('/admin/tasks', requireAdmin, PageController.adminTasks);
router.get('/admin/personas', requireAdmin, PageController.adminPersonas);
router.get('/admin/collections', requireAdmin, PageController.adminCollections);
router.get('/admin/launch', requireAdmin, PageController.adminLaunch);
router.get('/admin/launch.html', requireAdmin, PageController.adminLaunch);

// Hospitality page (public - for visitor engagement)
router.get('/hospitality', PageController.hospitality);

// Spaces (public - emotionally safe persona engagement entry point)
router.get('/spaces', PageController.spaces);

// Legacy chat endpoints (used by chat.html)
router.post('/Home/ChatWithJubilee', apiRateLimiter, ChatController.chatWithJubilee);
router.post('/Home/DeleteChatConversation', ChatController.deleteChatConversation);
router.get('/Home/GetChatConversations', ChatController.getChatConversations);
router.get('/Home/GetCommunityUsers', ChatController.getCommunityUsers);

// Logs page (for troubleshooting)
router.get('/logs', LogController.logsPage);

module.exports = router;
