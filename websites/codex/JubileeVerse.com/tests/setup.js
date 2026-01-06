/**
 * Jest Test Setup
 * Global configuration and utilities for all tests
 */

// Load environment variables for testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests

// Extend Jest matchers
expect.extend({
  /**
   * Check if value is a valid UUID
   */
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass
    };
  },

  /**
   * Check if value is a valid ISO date string
   */
  toBeValidISODate(received) {
    const date = new Date(received);
    const pass = !isNaN(date.getTime()) && received === date.toISOString();
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid ISO date`,
      pass
    };
  },

  /**
   * Check if response has success structure
   */
  toBeSuccessResponse(received) {
    const pass = received && received.success === true;
    return {
      message: () => `expected response ${pass ? 'not ' : ''}to be a success response`,
      pass
    };
  },

  /**
   * Check if response has error structure
   */
  toBeErrorResponse(received) {
    const pass = received && (received.success === false || received.error);
    return {
      message: () => `expected response ${pass ? 'not ' : ''}to be an error response`,
      pass
    };
  }
});

// Global test utilities
global.testUtils = {
  /**
   * Wait for a specified time
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate random email for testing
   */
  randomEmail: () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,

  /**
   * Generate random string
   */
  randomString: (length = 10) => Math.random().toString(36).slice(2, 2 + length),

  /**
   * Create mock request object
   */
  mockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    session: {},
    headers: {},
    ...overrides
  }),

  /**
   * Create mock response object
   */
  mockResponse: () => {
    const res = {
      statusCode: 200,
      _data: null,
      _headers: {}
    };
    res.status = jest.fn((code) => {
      res.statusCode = code;
      return res;
    });
    res.json = jest.fn((data) => {
      res._data = data;
      return res;
    });
    res.send = jest.fn((data) => {
      res._data = data;
      return res;
    });
    res.sendFile = jest.fn((path) => {
      res._data = { file: path };
      return res;
    });
    res.redirect = jest.fn((url) => {
      res._data = { redirect: url };
      return res;
    });
    res.set = jest.fn((key, value) => {
      res._headers[key] = value;
      return res;
    });
    res.setHeader = jest.fn((key, value) => {
      res._headers[key] = value;
      return res;
    });
    return res;
  },

  /**
   * Create mock next function
   */
  mockNext: () => jest.fn()
};

// Suppress console during tests (optional - comment out for debugging)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn()
// };

// Clean up after all tests
afterAll(async () => {
  // Allow time for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});
