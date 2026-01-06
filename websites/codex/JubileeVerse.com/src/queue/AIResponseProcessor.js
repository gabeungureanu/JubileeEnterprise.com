/**
 * AI Response Processor
 * Handles AI response generation jobs from the queue
 */

const QueueManager = require('./QueueManager');
const { PersonaService, ConversationService } = require('../services');
const WebSocketService = require('./WebSocketService');
const logger = require('../utils/logger');

// Job types
const JOB_TYPES = {
  GENERATE_RESPONSE: 'generate-response',
  STREAM_RESPONSE: 'stream-response'
};

/**
 * Process AI response generation job
 */
async function processAIResponseJob(job) {
  const { conversationId, personaId, messages, userLanguage, userId, requestId } = job.data;

  logger.info('Processing AI response job', {
    jobId: job.id,
    conversationId,
    personaId,
    requestId
  });

  try {
    // Notify client that processing has started
    WebSocketService.sendToUser(userId, {
      type: 'ai-response-started',
      requestId,
      conversationId
    });

    // Generate the response (pass userId for token tracking)
    const response = await PersonaService.generatePersonaResponse({
      personaId,
      messages,
      userLanguage,
      userId
    });

    // Save the assistant message
    // Note: Persona response tracking is handled centrally in AIService.generateResponse
    const assistantMessage = await ConversationService.addMessage(conversationId, {
      type: 'assistant',
      content: response.response,
      metadata: {
        personaId: response.persona.id,
        contextUsed: response.contextUsed,
        jobId: job.id
      }
    });

    const subjectUpdate = await ConversationService.maybeUpdateConversationSubject(conversationId, {
      newAssistantCount: 1
    });

    // Notify client of completion
    WebSocketService.sendToUser(userId, {
      type: 'ai-response-complete',
      requestId,
      conversationId,
      message: assistantMessage,
      persona: response.persona,
      conversationTitle: subjectUpdate ? subjectUpdate.title : null,
      subjectLocked: subjectUpdate ? subjectUpdate.subjectLocked : undefined
    });

    logger.info('AI response job completed', {
      jobId: job.id,
      messageId: assistantMessage.id
    });

    return {
      success: true,
      messageId: assistantMessage.id,
      conversationId
    };
  } catch (error) {
    logger.error('AI response job failed', {
      jobId: job.id,
      error: error.message
    });

    // Notify client of failure
    WebSocketService.sendToUser(userId, {
      type: 'ai-response-error',
      requestId,
      conversationId,
      error: 'Failed to generate response. Please try again.'
    });

    throw error;
  }
}

/**
 * Initialize the AI response worker
 */
function initializeWorker(options = {}) {
  const workerOptions = {
    concurrency: options.concurrency || 10,
    limiter: {
      max: options.rateLimit || 50,
      duration: 1000
    }
  };

  const worker = QueueManager.createWorker(
    QueueManager.QUEUE_NAMES.AI_RESPONSE,
    async (job) => {
      switch (job.name) {
        case JOB_TYPES.GENERATE_RESPONSE:
          return processAIResponseJob(job);
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    },
    workerOptions
  );

  logger.info('AI Response Worker initialized', workerOptions);

  return worker;
}

/**
 * Queue an AI response generation job
 */
async function queueAIResponse(data, options = {}) {
  const { v4: uuidv4 } = require('uuid');

  const requestId = options.requestId || uuidv4();
  const priority = options.priority || QueueManager.PRIORITY.NORMAL;

  const jobData = {
    ...data,
    requestId,
    queuedAt: Date.now()
  };

  const job = await QueueManager.addJob(
    QueueManager.QUEUE_NAMES.AI_RESPONSE,
    JOB_TYPES.GENERATE_RESPONSE,
    jobData,
    {
      priority,
      jobId: requestId
    }
  );

  logger.debug('AI response job queued', {
    jobId: job.id,
    requestId,
    priority
  });

  return {
    jobId: job.id,
    requestId,
    status: 'queued'
  };
}

/**
 * Get job status
 */
async function getJobStatus(requestId) {
  const queue = QueueManager.getQueue(QueueManager.QUEUE_NAMES.AI_RESPONSE);

  if (queue._isMock) {
    return { status: 'unknown', requestId };
  }

  const job = await queue.getJob(requestId);

  if (!job) {
    return { status: 'not_found', requestId };
  }

  const state = await job.getState();

  return {
    requestId,
    status: state,
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn
  };
}

/**
 * Cancel a pending job
 */
async function cancelJob(requestId) {
  const queue = QueueManager.getQueue(QueueManager.QUEUE_NAMES.AI_RESPONSE);

  if (queue._isMock) {
    return { success: false, reason: 'mock mode' };
  }

  const job = await queue.getJob(requestId);

  if (!job) {
    return { success: false, reason: 'not_found' };
  }

  const state = await job.getState();

  if (state === 'active') {
    return { success: false, reason: 'already_processing' };
  }

  await job.remove();

  return { success: true, requestId };
}

module.exports = {
  JOB_TYPES,
  initializeWorker,
  queueAIResponse,
  getJobStatus,
  cancelJob
};
