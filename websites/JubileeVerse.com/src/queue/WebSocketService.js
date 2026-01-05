/**
 * WebSocket Service
 * Manages WebSocket connections for real-time communication
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

let wss = null;

// Store connections by user ID
const userConnections = new Map();

// Store all connections with metadata
const connections = new Map();

// Store connections by board conversation ID for real-time sync
const boardConversationConnections = new Map();

// Store connections by board ID for new conversation broadcasts
const boardConnections = new Map();

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
let heartbeatTimer = null;

/**
 * Initialize WebSocket server
 */
function initialize(server, options = {}) {
  wss = new WebSocket.Server({
    server,
    path: options.path || '/ws',
    verifyClient: options.verifyClient || verifyConnection
  });

  wss.on('connection', handleConnection);

  wss.on('error', (error) => {
    logger.error('WebSocket server error', { error: error.message });
  });

  // Start heartbeat
  startHeartbeat();

  logger.info('WebSocket server initialized', { path: options.path || '/ws' });

  return wss;
}

/**
 * Verify WebSocket connection (authentication)
 */
function verifyConnection(info, callback) {
  // In production, verify session/token from cookie or query param
  // For now, accept all connections
  const url = new URL(info.req.url, 'http://localhost');
  const token = url.searchParams.get('token');

  // TODO: Implement proper authentication
  // For development, accept all connections
  callback(true);
}

/**
 * Handle new WebSocket connection
 */
function handleConnection(ws, req) {
  const connectionId = uuidv4();
  const url = new URL(req.url, 'http://localhost');
  const userId = url.searchParams.get('userId') || null;

  // Store connection metadata
  const connectionData = {
    id: connectionId,
    userId,
    ws,
    isAlive: true,
    connectedAt: Date.now(),
    subscriptions: new Set()
  };

  connections.set(connectionId, connectionData);

  // Track user connections
  if (userId) {
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId).add(connectionId);
  }

  logger.info('WebSocket connection established', { connectionId, userId });

  // Send welcome message
  sendToConnection(connectionId, {
    type: 'connected',
    connectionId,
    timestamp: Date.now()
  });

  // Handle messages
  ws.on('message', (data) => {
    handleMessage(connectionId, data);
  });

  // Handle pong for heartbeat
  ws.on('pong', () => {
    connectionData.isAlive = true;
  });

  // Handle close
  ws.on('close', (code, reason) => {
    handleDisconnection(connectionId, code, reason);
  });

  // Handle error
  ws.on('error', (error) => {
    logger.error('WebSocket connection error', {
      connectionId,
      error: error.message
    });
  });
}

/**
 * Handle incoming message
 */
function handleMessage(connectionId, rawData) {
  const connection = connections.get(connectionId);
  if (!connection) return;

  try {
    const message = JSON.parse(rawData.toString());

    logger.debug('WebSocket message received', {
      connectionId,
      type: message.type
    });

    switch (message.type) {
      case 'ping':
        sendToConnection(connectionId, { type: 'pong', timestamp: Date.now() });
        break;

      case 'subscribe':
        handleSubscribe(connectionId, message.channel);
        break;

      case 'unsubscribe':
        handleUnsubscribe(connectionId, message.channel);
        break;

      case 'identify':
        handleIdentify(connectionId, message.userId);
        break;

      case 'subscribe_board':
        handleSubscribeBoard(connectionId, message.conversationId, message.language);
        break;

      case 'unsubscribe_board':
        handleUnsubscribeBoard(connectionId, message.conversationId);
        break;

      case 'set_language':
        handleSetLanguage(connectionId, message.language);
        break;

      default:
        // Emit custom event for application handling
        emitEvent('message', { connectionId, message });
    }
  } catch (error) {
    logger.error('WebSocket message parse error', {
      connectionId,
      error: error.message
    });

    sendToConnection(connectionId, {
      type: 'error',
      error: 'Invalid message format'
    });
  }
}

/**
 * Handle connection identification (associate with user ID)
 */
function handleIdentify(connectionId, userId) {
  const connection = connections.get(connectionId);
  if (!connection || !userId) return;

  // Remove from old user connections if exists
  if (connection.userId && userConnections.has(connection.userId)) {
    userConnections.get(connection.userId).delete(connectionId);
  }

  // Update user ID
  connection.userId = userId;

  // Add to new user connections
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId).add(connectionId);

  logger.debug('WebSocket connection identified', { connectionId, userId });

  sendToConnection(connectionId, {
    type: 'identified',
    userId,
    timestamp: Date.now()
  });
}

/**
 * Handle channel subscription
 */
function handleSubscribe(connectionId, channel) {
  const connection = connections.get(connectionId);
  if (!connection || !channel) return;

  connection.subscriptions.add(channel);

  sendToConnection(connectionId, {
    type: 'subscribed',
    channel,
    timestamp: Date.now()
  });
}

/**
 * Handle channel unsubscription
 */
function handleUnsubscribe(connectionId, channel) {
  const connection = connections.get(connectionId);
  if (!connection || !channel) return;

  connection.subscriptions.delete(channel);

  sendToConnection(connectionId, {
    type: 'unsubscribed',
    channel,
    timestamp: Date.now()
  });
}

/**
 * Handle board conversation subscription
 * @param {string} connectionId - The connection ID
 * @param {string} conversationId - The conversation ID to subscribe to
 * @param {string} language - Optional language code for translation preferences
 */
function handleSubscribeBoard(connectionId, conversationId, language = null) {
  const connection = connections.get(connectionId);
  if (!connection || !conversationId) return;

  // Add to board conversation connections
  if (!boardConversationConnections.has(conversationId)) {
    boardConversationConnections.set(conversationId, new Set());
  }
  boardConversationConnections.get(conversationId).add(connectionId);

  // Track in connection metadata
  if (!connection.boardConversations) {
    connection.boardConversations = new Set();
  }
  connection.boardConversations.add(conversationId);

  // Store language preference for translation broadcasts
  if (language) {
    connection.language = language;
    logger.debug('Connection language set', { connectionId, language });
  }

  logger.debug('Connection subscribed to board conversation', { connectionId, conversationId, language });

  sendToConnection(connectionId, {
    type: 'subscribed_board',
    conversationId,
    timestamp: Date.now()
  });
}

/**
 * Handle board conversation unsubscription
 */
function handleUnsubscribeBoard(connectionId, conversationId) {
  const connection = connections.get(connectionId);
  if (!connection || !conversationId) return;

  // Remove from board conversation connections
  if (boardConversationConnections.has(conversationId)) {
    boardConversationConnections.get(conversationId).delete(connectionId);
    if (boardConversationConnections.get(conversationId).size === 0) {
      boardConversationConnections.delete(conversationId);
    }
  }

  // Remove from connection metadata
  if (connection.boardConversations) {
    connection.boardConversations.delete(conversationId);
  }

  sendToConnection(connectionId, {
    type: 'unsubscribed_board',
    conversationId,
    timestamp: Date.now()
  });
}

/**
 * Handle setting user's preferred language for translations
 */
function handleSetLanguage(connectionId, language) {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.language = language || 'en';
  logger.debug('Connection language updated', { connectionId, language: connection.language });

  sendToConnection(connectionId, {
    type: 'language_set',
    language: connection.language,
    timestamp: Date.now()
  });
}

/**
 * Broadcast message to all clients subscribed to a board conversation
 * @param {string} conversationId - The conversation ID
 * @param {object} message - The message to broadcast
 * @param {object} options - Options: excludeConnectionId, excludeUserId
 */
function broadcastToBoardConversation(conversationId, message, options = {}) {
  const { excludeConnectionId = null, excludeUserId = null } = typeof options === 'string'
    ? { excludeConnectionId: options } // Backwards compatibility
    : (options || {});

  const connectionIds = boardConversationConnections.get(conversationId);
  if (!connectionIds || connectionIds.size === 0) {
    logger.debug('No active connections for board conversation', { conversationId });
    return 0;
  }

  let sent = 0;
  for (const connectionId of connectionIds) {
    // Skip excluded connection
    if (excludeConnectionId && connectionId === excludeConnectionId) {
      continue;
    }

    // Skip connections belonging to excluded user
    if (excludeUserId) {
      const connection = connections.get(connectionId);
      if (connection && connection.userId === excludeUserId) {
        continue;
      }
    }

    if (sendToConnection(connectionId, message)) {
      sent++;
    }
  }

  logger.debug('Broadcasted to board conversation', { conversationId, sentTo: sent });
  return sent;
}

/**
 * Handle disconnection
 */
function handleDisconnection(connectionId, code, reason) {
  const connection = connections.get(connectionId);
  if (!connection) return;

  // Remove from user connections
  if (connection.userId && userConnections.has(connection.userId)) {
    userConnections.get(connection.userId).delete(connectionId);
    if (userConnections.get(connection.userId).size === 0) {
      userConnections.delete(connection.userId);
    }
  }

  // Remove from all board conversation subscriptions
  if (connection.boardConversations) {
    for (const conversationId of connection.boardConversations) {
      if (boardConversationConnections.has(conversationId)) {
        boardConversationConnections.get(conversationId).delete(connectionId);
        if (boardConversationConnections.get(conversationId).size === 0) {
          boardConversationConnections.delete(conversationId);
        }
      }
    }
  }

  connections.delete(connectionId);

  logger.info('WebSocket connection closed', {
    connectionId,
    userId: connection.userId,
    code,
    duration: Date.now() - connection.connectedAt
  });
}

/**
 * Send message to specific connection
 */
function sendToConnection(connectionId, message) {
  const connection = connections.get(connectionId);
  if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  try {
    connection.ws.send(JSON.stringify(message));
    return true;
  } catch (error) {
    logger.error('WebSocket send error', {
      connectionId,
      error: error.message
    });
    return false;
  }
}

/**
 * Send message to all connections of a user
 */
function sendToUser(userId, message) {
  const connectionIds = userConnections.get(userId);
  if (!connectionIds || connectionIds.size === 0) {
    logger.debug('No active connections for user', { userId });
    return 0;
  }

  let sent = 0;
  for (const connectionId of connectionIds) {
    if (sendToConnection(connectionId, message)) {
      sent++;
    }
  }

  return sent;
}

/**
 * Send message to all subscribers of a channel
 */
function sendToChannel(channel, message) {
  let sent = 0;

  for (const [connectionId, connection] of connections) {
    if (connection.subscriptions.has(channel)) {
      if (sendToConnection(connectionId, message)) {
        sent++;
      }
    }
  }

  return sent;
}

/**
 * Broadcast message to all connections
 */
function broadcast(message, excludeConnectionId = null) {
  let sent = 0;

  for (const connectionId of connections.keys()) {
    if (connectionId !== excludeConnectionId) {
      if (sendToConnection(connectionId, message)) {
        sent++;
      }
    }
  }

  return sent;
}

/**
 * Broadcast message to all connections with user exclusion support
 */
function broadcastToAll(message, options = {}) {
  const { excludeUserId = null } = options;
  let sent = 0;

  for (const [connectionId, connection] of connections) {
    // Skip connections belonging to excluded user
    if (excludeUserId && connection.userId === excludeUserId) {
      continue;
    }

    if (sendToConnection(connectionId, message)) {
      sent++;
    }
  }

  logger.debug('Broadcasted to all connections', { sentTo: sent, excludeUserId });
  return sent;
}

/**
 * Start heartbeat to detect dead connections
 */
function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    for (const [connectionId, connection] of connections) {
      if (!connection.isAlive) {
        // Connection didn't respond to last ping, terminate
        connection.ws.terminate();
        handleDisconnection(connectionId, 1006, 'Heartbeat timeout');
        continue;
      }

      connection.isAlive = false;
      connection.ws.ping();
    }
  }, HEARTBEAT_INTERVAL);
}

/**
 * Get connection statistics
 */
function getStats() {
  return {
    totalConnections: connections.size,
    uniqueUsers: userConnections.size,
    connectionsByUser: Object.fromEntries(
      Array.from(userConnections.entries()).map(([userId, conns]) => [userId, conns.size])
    )
  };
}

/**
 * Check if user is connected
 */
function isUserConnected(userId) {
  const connectionIds = userConnections.get(userId);
  return connectionIds && connectionIds.size > 0;
}

/**
 * Event emitter for custom message handling
 */
const eventHandlers = new Map();

function on(event, handler) {
  if (!eventHandlers.has(event)) {
    eventHandlers.set(event, new Set());
  }
  eventHandlers.get(event).add(handler);
}

function off(event, handler) {
  if (eventHandlers.has(event)) {
    eventHandlers.get(event).delete(handler);
  }
}

function emitEvent(event, data) {
  if (eventHandlers.has(event)) {
    for (const handler of eventHandlers.get(event)) {
      try {
        handler(data);
      } catch (error) {
        logger.error('WebSocket event handler error', {
          event,
          error: error.message
        });
      }
    }
  }
}

/**
 * Shutdown WebSocket server
 */
async function shutdown() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  // Close all connections
  for (const [connectionId, connection] of connections) {
    try {
      connection.ws.close(1001, 'Server shutting down');
    } catch (error) {
      // Ignore errors during shutdown
    }
  }

  connections.clear();
  userConnections.clear();

  if (wss) {
    await new Promise((resolve) => {
      wss.close(resolve);
    });
    wss = null;
  }

  logger.info('WebSocket server shut down');
}

module.exports = {
  initialize,
  sendToConnection,
  sendToUser,
  sendToChannel,
  broadcast,
  broadcastToAll,
  broadcastToBoardConversation,
  getStats,
  isUserConnected,
  on,
  off,
  shutdown,
  // Expose internal maps for translation service to check active languages
  get connections() { return connections; },
  get boardConversationConnections() { return boardConversationConnections; }
};
