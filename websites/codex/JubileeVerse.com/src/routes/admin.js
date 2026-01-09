/**
 * Admin routes
 * Administrative endpoints for monitoring and managing the system
 */

const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const { requireAuth, requireAdmin } = require('../middleware');

// Kubernetes probes (public - for orchestration)
router.get('/live', AdminController.getLiveness);   // Liveness probe
router.get('/ready', AdminController.getReadiness); // Readiness probe

// Health check (public - for load balancers and monitoring)
router.get('/health', AdminController.getHealth);

// Dashboard analytics (admin only)
router.get('/analytics/dashboard', requireAuth, requireAdmin, AdminController.getDashboardAnalytics);
router.get('/analytics/personas', requireAuth, requireAdmin, AdminController.getPersonaStats);

// Queue management (admin only)
router.get('/queues', requireAuth, requireAdmin, AdminController.getQueueStats);
router.get('/queues/:name', requireAuth, requireAdmin, AdminController.getQueueDetails);
router.post('/queues/:name/pause', requireAuth, requireAdmin, AdminController.pauseQueue);
router.post('/queues/:name/resume', requireAuth, requireAdmin, AdminController.resumeQueue);
router.post('/queues/:name/clean', requireAuth, requireAdmin, AdminController.cleanQueue);

// WebSocket stats (admin only)
router.get('/websocket', requireAuth, requireAdmin, AdminController.getWebSocketStats);

// Cache management (admin only)
router.get('/cache', requireAuth, requireAdmin, AdminController.getCacheStats);
router.delete('/cache', requireAuth, requireAdmin, AdminController.clearCache);

// Broadcast (admin only)
router.post('/broadcast', requireAuth, requireAdmin, AdminController.broadcastMessage);

// Attachment management (admin only)
router.get('/attachments/stats', requireAuth, requireAdmin, AdminController.getAttachmentStats);
router.post('/attachments/cleanup', requireAuth, requireAdmin, AdminController.triggerAttachmentCleanup);

// Translation system health check (admin only)
router.get('/translation/test', requireAuth, requireAdmin, AdminController.testTranslation);

// AI provider status check (admin only)
router.get('/ai/status', requireAuth, requireAdmin, AdminController.getAIStatus);

// Plan features management (admin only)
router.get('/plan-features', requireAuth, requireAdmin, AdminController.getPlanFeatures);
router.get('/plan-features/all', requireAuth, requireAdmin, AdminController.getAllPlanFeatures);
router.put('/plan-features/:id', requireAuth, requireAdmin, AdminController.updatePlanFeature);
router.put('/plan-features/:id/publish', requireAuth, requireAdmin, AdminController.togglePlanFeaturePublish);

// Task tracking system (admin only)
router.get('/tasks', requireAuth, requireAdmin, AdminController.getTasks);
router.get('/tasks/stats', requireAuth, requireAdmin, AdminController.getTaskStats);
router.get('/tasks/velocity', requireAuth, requireAdmin, AdminController.getTaskVelocity);
router.get('/tasks/components', requireAuth, requireAdmin, AdminController.getTaskComponents);
router.get('/tasks/assignees', requireAuth, requireAdmin, AdminController.getTaskAssignees);
router.get('/tasks/:id', requireAuth, requireAdmin, AdminController.getTask);
router.get('/tasks/:id/history', requireAuth, requireAdmin, AdminController.getTaskHistory);
router.post('/tasks', requireAuth, requireAdmin, AdminController.createTask);
router.put('/tasks/:id', requireAuth, requireAdmin, AdminController.updateTask);
router.put('/tasks/:id/status', requireAuth, requireAdmin, AdminController.updateTaskStatus);
router.delete('/tasks/:id', requireAuth, requireAdmin, AdminController.deleteTask);

// QA Tests system (admin only)
router.get('/qa-tests', requireAuth, requireAdmin, AdminController.getQATests);
router.get('/qa-tests/:id', requireAuth, requireAdmin, AdminController.getQATest);
router.post('/qa-tests', requireAuth, requireAdmin, AdminController.createQATest);
router.put('/qa-tests/:id', requireAuth, requireAdmin, AdminController.updateQATest);
router.delete('/qa-tests/:id', requireAuth, requireAdmin, AdminController.deleteQATest);
router.post('/qa-tests/run-all', requireAuth, requireAdmin, AdminController.runAllQATests);
router.post('/qa-tests/:id/run', requireAuth, requireAdmin, AdminController.runQATest);
router.get('/tasks/:id/qa-summary', requireAuth, requireAdmin, AdminController.getTaskQASummary);
router.post('/tasks/:id/qa-tests/run', requireAuth, requireAdmin, AdminController.runTaskQATests);

// Work History system (admin only)
router.get('/tasks/durations', requireAuth, requireAdmin, AdminController.getAllTaskDurations);
router.get('/tasks/:id/work-history', requireAuth, requireAdmin, AdminController.getTaskWorkHistory);
router.post('/tasks/:id/work-history', requireAuth, requireAdmin, AdminController.addTaskWorkHistory);
router.get('/tasks/:id/duration', requireAuth, requireAdmin, AdminController.getTaskDuration);

// Dashboard metrics (admin only)
router.get('/dashboard/metrics', requireAuth, requireAdmin, AdminController.getDashboardMetrics);
router.get('/dashboard/gas-gauge', requireAuth, requireAdmin, AdminController.getGasGauge);
router.post('/dashboard/session/start', requireAuth, requireAdmin, AdminController.startWorkSession);
router.post('/dashboard/session/end', requireAuth, requireAdmin, AdminController.endWorkSession);
router.post('/dashboard/log-hours', requireAuth, requireAdmin, AdminController.logWorkHours);

// Background process health (admin only)
router.get('/health/background-processes', requireAuth, requireAdmin, AdminController.getBackgroundProcessHealth);

// Hospitality Rules management (admin only)
router.get('/hospitality/rules', requireAuth, requireAdmin, AdminController.getHospitalityRules);
router.get('/hospitality/rules/:id', requireAuth, requireAdmin, AdminController.getHospitalityRule);
router.post('/hospitality/rules', requireAuth, requireAdmin, AdminController.createHospitalityRule);
router.put('/hospitality/rules/:id', requireAuth, requireAdmin, AdminController.updateHospitalityRule);
router.delete('/hospitality/rules/:id', requireAuth, requireAdmin, AdminController.deleteHospitalityRule);
router.get('/hospitality/rules/:id/events', requireAuth, requireAdmin, AdminController.getHospitalityRuleEvents);
router.get('/hospitality/metrics', requireAuth, requireAdmin, AdminController.getHospitalityMetrics);

// Persona management (admin only)
router.get('/personas', requireAuth, requireAdmin, AdminController.getAdminPersonas);
router.get('/personas/:id', requireAuth, requireAdmin, AdminController.getAdminPersona);
router.get('/personas/:id/stages', requireAuth, requireAdmin, AdminController.getPersonaStages);
router.put('/personas/:id/stages/:stageId', requireAuth, requireAdmin, AdminController.updatePersonaStage);

// Collections management (admin only)
router.get('/collections', requireAuth, requireAdmin, AdminController.getCollections);
router.get('/collections/items/:itemId', requireAuth, requireAdmin, AdminController.getCategoryItem);
router.get('/collections/:idOrSlug', requireAuth, requireAdmin, AdminController.getCollection);
router.get('/collections/:idOrSlug/categories', requireAuth, requireAdmin, AdminController.getCollectionCategories);
router.get('/collections/:collectionIdOrSlug/categories/:categoryIdOrSlug/items', requireAuth, requireAdmin, AdminController.getCategoryItems);

// Capacity metrics (admin only)
router.get('/capacity/overview', requireAuth, requireAdmin, AdminController.getCollectionsCapacityOverview);
router.get('/collections/:idOrSlug/capacity', requireAuth, requireAdmin, AdminController.getCollectionCapacity);

// Bible verses (admin only)
router.get('/bible/verses/:bookId/:chapter', requireAuth, requireAdmin, AdminController.getBibleVerses);
router.get('/bible/books/:bookId/chapters', requireAuth, requireAdmin, AdminController.getBibleChapters);

// Benchmark evaluation (admin only)
router.post('/benchmark/evaluate', requireAuth, requireAdmin, AdminController.evaluateBenchmark);
router.get('/benchmark/results/:bookId/:chapter/:verse', requireAuth, requireAdmin, AdminController.getBenchmarkResults);
router.get('/benchmark/criteria', requireAuth, requireAdmin, AdminController.getBenchmarkCriteria);
router.post('/benchmark/execute-recommendations', requireAuth, requireAdmin, AdminController.executeRecommendations);

module.exports = router;
