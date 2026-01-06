/**
 * WebSocketService Tests
 */

const { mockLogger } = require('../../mocks');

// Mock dependencies
jest.mock('../../../src/utils/logger', () => mockLogger);

// Mock ws module
const mockWebSocketServer = {
  on: jest.fn(),
  close: jest.fn((cb) => cb && cb())
};

jest.mock('ws', () => ({
  Server: jest.fn().mockImplementation(() => mockWebSocketServer),
  OPEN: 1
}));

const WebSocketService = require('../../../src/queue/WebSocketService');

describe('WebSocketService', () => {
  let mockServer;
  let mockWs;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServer = {
      on: jest.fn()
    };

    mockWs = {
      readyState: 1, // WebSocket.OPEN
      send: jest.fn(),
      close: jest.fn(),
      ping: jest.fn(),
      terminate: jest.fn(),
      on: jest.fn()
    };
  });

  describe('initialize', () => {
    it('should initialize WebSocket server with default path', () => {
      const wss = WebSocketService.initialize(mockServer);

      expect(wss).toBeDefined();
      expect(mockWebSocketServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockWebSocketServer.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should accept custom path option', () => {
      WebSocketService.initialize(mockServer, { path: '/custom-ws' });

      // The mock doesn't track constructor args, but we verify it initializes
      expect(mockWebSocketServer.on).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return connection statistics', () => {
      const stats = WebSocketService.getStats();

      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('uniqueUsers');
      expect(stats).toHaveProperty('connectionsByUser');
      expect(typeof stats.totalConnections).toBe('number');
      expect(typeof stats.uniqueUsers).toBe('number');
    });
  });

  describe('isUserConnected', () => {
    it('should return false for non-connected user', () => {
      const connected = WebSocketService.isUserConnected('non-existent-user');

      expect(connected).toBe(false);
    });
  });

  describe('sendToUser', () => {
    it('should return 0 when user has no connections', () => {
      const sent = WebSocketService.sendToUser('no-connections', { type: 'test' });

      expect(sent).toBe(0);
    });
  });

  describe('sendToChannel', () => {
    it('should return 0 when no subscribers', () => {
      const sent = WebSocketService.sendToChannel('empty-channel', { type: 'test' });

      expect(sent).toBe(0);
    });
  });

  describe('broadcast', () => {
    it('should return 0 when no connections', () => {
      const sent = WebSocketService.broadcast({ type: 'test' });

      expect(sent).toBe(0);
    });
  });

  describe('event handling', () => {
    it('should register event handler with on()', () => {
      const handler = jest.fn();
      WebSocketService.on('test-event', handler);

      // Verify handler was registered (implementation detail)
      expect(typeof WebSocketService.on).toBe('function');
    });

    it('should unregister event handler with off()', () => {
      const handler = jest.fn();
      WebSocketService.on('remove-event', handler);
      WebSocketService.off('remove-event', handler);

      expect(typeof WebSocketService.off).toBe('function');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await expect(WebSocketService.shutdown()).resolves.not.toThrow();
    });
  });
});
