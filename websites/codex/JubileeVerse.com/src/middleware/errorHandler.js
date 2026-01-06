/**
 * Error Handling Middleware
 */

const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * 404 Not Found Handler
 */
function notFoundHandler(req, res, next) {
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    res.status(404).json({ error: 'Not found' });
  } else {
    res.status(404).sendFile(path.join(__dirname, '../../views/pages/404.html'));
  }
}

/**
 * Global Error Handler
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Determine if we should show the error message
  // Show message for operational errors (4xx) or in development
  const showMessage = config.server.isDev || err.isOperational || statusCode < 500;
  const errorMessage = showMessage ? err.message : 'Internal server error';

  // Send response
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    res.status(statusCode).json({
      error: errorMessage,
      ...(config.server.isDev && { stack: err.stack })
    });
  } else {
    const errorPage = statusCode === 404 ? '404.html' : '500.html';
    res.status(statusCode).sendFile(path.join(__dirname, '../../views/pages', errorPage));
  }
}

/**
 * Async handler wrapper to catch async errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create custom application error
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  notFoundHandler,
  errorHandler,
  asyncHandler,
  AppError
};
