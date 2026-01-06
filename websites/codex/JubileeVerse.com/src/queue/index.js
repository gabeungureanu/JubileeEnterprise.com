/**
 * Queue Module Index
 * Exports queue management functionality
 */

const QueueManager = require('./QueueManager');
const AIResponseProcessor = require('./AIResponseProcessor');
const WebSocketService = require('./WebSocketService');

/**
 * Initialize all queue workers and WebSocket server
 */
async function initialize(httpServer, options = {}) {
  // Initialize WebSocket service
  if (httpServer) {
    WebSocketService.initialize(httpServer, {
      path: options.wsPath || '/ws'
    });
  }

  // Initialize AI response worker
  AIResponseProcessor.initializeWorker({
    concurrency: options.aiWorkerConcurrency || 10,
    rateLimit: options.aiRateLimit || 50
  });

  return {
    queueManager: QueueManager,
    webSocket: WebSocketService,
    aiProcessor: AIResponseProcessor
  };
}

/**
 * Shutdown all queues and WebSocket
 */
async function shutdown() {
  await WebSocketService.shutdown();
  await QueueManager.shutdown();
}

module.exports = {
  QueueManager,
  AIResponseProcessor,
  WebSocketService,
  initialize,
  shutdown,

  // Re-exports for convenience
  QUEUE_NAMES: QueueManager.QUEUE_NAMES,
  PRIORITY: QueueManager.PRIORITY,
  addJob: QueueManager.addJob,
  queueAIResponse: AIResponseProcessor.queueAIResponse,
  sendToUser: WebSocketService.sendToUser,
  broadcast: WebSocketService.broadcast
};
