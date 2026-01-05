/**
 * Enhanced Structured Logging for JubileeVerse
 * Provides JSON-formatted logs with trace context support
 * Also writes to logs.yaml file (cleared on server restart)
 */

const config = require('../config');
const fs = require('fs');
const path = require('path');

// YAML log file path
const YAML_LOG_FILE = path.join(__dirname, '../../logs/server.yaml');

// Ensure logs directory exists and clear the file on startup
(function initYamlLog() {
  const logsDir = path.dirname(YAML_LOG_FILE);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  // Clear the file on server restart
  fs.writeFileSync(YAML_LOG_FILE, `# JubileeVerse Server Logs\n# Started: ${new Date().toISOString()}\n# This file is cleared on each server restart\n\nlogs:\n`, 'utf8');
})();

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LOG_LEVEL_NAMES = ['error', 'warn', 'info', 'debug'];

// In-memory log storage for troubleshooting
const MAX_LOG_ENTRIES = 1000;
const logStore = [];

// Determine current log level from environment
const currentLevel = (() => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && LOG_LEVEL_NAMES.includes(envLevel)) {
    return LOG_LEVELS[envLevel.toUpperCase()];
  }
  return config.server.isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
})();

// Whether to output JSON format (recommended for production)
const useJsonFormat = process.env.LOG_FORMAT === 'json' || !config.server.isDev;

// Base metadata to include in all logs
const baseMetadata = {
  service: 'jubileeverse',
  version: process.env.npm_package_version || '8.0.0',
  env: config.server.env,
  hostname: process.env.HOSTNAME || require('os').hostname()
};

/**
 * Sanitize sensitive data from log output
 */
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveKeys = [
    'password', 'secret', 'token', 'apiKey', 'api_key',
    'authorization', 'cookie', 'session', 'credit_card',
    'ssn', 'private_key'
  ];

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(s => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Format error object for logging
 */
function formatError(error) {
  if (!error) return {};

  return {
    error: {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: config.server.isDev ? error.stack : undefined
    }
  };
}

/**
 * Format log entry as JSON
 */
function formatJson(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...baseMetadata,
    ...sanitize(meta)
  };

  // Handle error objects specially
  if (meta.error instanceof Error) {
    Object.assign(entry, formatError(meta.error));
  }

  return JSON.stringify(entry);
}

/**
 * Format log entry as human-readable string (for development)
 */
function formatPretty(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);

  // Color codes for different levels (only for TTY)
  const colors = {
    error: '\x1b[31m', // red
    warn: '\x1b[33m',  // yellow
    info: '\x1b[36m',  // cyan
    debug: '\x1b[90m'  // gray
  };
  const reset = '\x1b[0m';

  const useColor = process.stdout.isTTY;
  const color = useColor ? (colors[level] || '') : '';
  const resetCode = useColor ? reset : '';

  let output = `${color}[${timestamp}] [${levelStr}]${resetCode} ${message}`;

  // Add metadata if present
  const sanitizedMeta = sanitize(meta);
  const metaKeys = Object.keys(sanitizedMeta);
  if (metaKeys.length > 0) {
    // Format error stack nicely
    if (meta.error instanceof Error && config.server.isDev) {
      output += `\n${color}Stack:${resetCode} ${meta.error.stack}`;
      delete sanitizedMeta.error;
    }

    const remainingKeys = Object.keys(sanitizedMeta);
    if (remainingKeys.length > 0) {
      output += ` ${color}${JSON.stringify(sanitizedMeta)}${resetCode}`;
    }
  }

  return output;
}

/**
 * Write log entry to YAML file
 */
function writeToYaml(level, message, meta = {}) {
  try {
    const sanitizedMeta = sanitize(meta);

    // Format as YAML entry
    let yamlEntry = `  - timestamp: "${new Date().toISOString()}"\n`;
    yamlEntry += `    level: "${level}"\n`;
    yamlEntry += `    message: "${message.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n`;

    // Add metadata if present
    const metaKeys = Object.keys(sanitizedMeta);
    if (metaKeys.length > 0) {
      yamlEntry += `    meta:\n`;
      for (const key of metaKeys) {
        const value = sanitizedMeta[key];
        if (typeof value === 'object' && value !== null) {
          yamlEntry += `      ${key}: ${JSON.stringify(value)}\n`;
        } else {
          const strValue = String(value).replace(/"/g, '\\"').replace(/\n/g, '\\n');
          yamlEntry += `      ${key}: "${strValue}"\n`;
        }
      }
    }
    yamlEntry += '\n';

    fs.appendFileSync(YAML_LOG_FILE, yamlEntry, 'utf8');
  } catch (err) {
    // Don't log errors about logging to avoid infinite loops
    console.error('Failed to write to YAML log:', err.message);
  }
}

/**
 * Add log entry to in-memory store
 */
function addToStore(level, message, meta = {}) {
  const entry = {
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    level,
    message,
    meta: sanitize(meta)
  };

  logStore.push(entry);

  // Keep only the last MAX_LOG_ENTRIES
  while (logStore.length > MAX_LOG_ENTRIES) {
    logStore.shift();
  }

  // Also write to YAML file
  writeToYaml(level, message, meta);
}

/**
 * Get logs from store
 */
function getLogs(options = {}) {
  const { limit = 100, level = null, search = null } = options;

  let filtered = [...logStore];

  if (level && level !== 'all') {
    filtered = filtered.filter(log => log.level === level);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(log => {
      const searchIn = (log.message + ' ' + JSON.stringify(log.meta || {})).toLowerCase();
      return searchIn.includes(searchLower);
    });
  }

  // Return most recent first
  return filtered.slice(-limit).reverse();
}

/**
 * Clear all logs from store
 */
function clearLogs() {
  logStore.length = 0;
}

/**
 * Main log function
 */
function log(level, levelNum, message, meta = {}) {
  // Always store logs regardless of level (for troubleshooting)
  addToStore(level, message, meta);

  if (currentLevel < levelNum) return;

  const formatter = useJsonFormat ? formatJson : formatPretty;
  const output = formatter(level, message, meta);

  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

/**
 * Create a child logger with additional context
 */
function child(defaultMeta = {}) {
  return {
    error: (message, meta = {}) => log('error', LOG_LEVELS.ERROR, message, { ...defaultMeta, ...meta }),
    warn: (message, meta = {}) => log('warn', LOG_LEVELS.WARN, message, { ...defaultMeta, ...meta }),
    info: (message, meta = {}) => log('info', LOG_LEVELS.INFO, message, { ...defaultMeta, ...meta }),
    debug: (message, meta = {}) => log('debug', LOG_LEVELS.DEBUG, message, { ...defaultMeta, ...meta }),
    child: (additionalMeta) => child({ ...defaultMeta, ...additionalMeta })
  };
}

/**
 * Create a request-scoped logger
 */
function forRequest(req) {
  const requestMeta = {
    traceId: req.trace?.traceId,
    requestId: req.trace?.requestId,
    method: req.method,
    path: req.path
  };

  return child(requestMeta);
}

const logger = {
  error: (message, meta = {}) => log('error', LOG_LEVELS.ERROR, message, meta),
  warn: (message, meta = {}) => log('warn', LOG_LEVELS.WARN, message, meta),
  info: (message, meta = {}) => log('info', LOG_LEVELS.INFO, message, meta),
  debug: (message, meta = {}) => log('debug', LOG_LEVELS.DEBUG, message, meta),

  // Create child logger with default metadata
  child,

  // Create request-scoped logger
  forRequest,

  // Utility functions
  sanitize,
  formatError,

  // Log store functions (for troubleshooting UI)
  getLogs,
  clearLogs,

  // YAML log file path
  YAML_LOG_FILE,

  // Configuration
  LOG_LEVELS,
  currentLevel
};

module.exports = logger;
