/**
 * WorkDetectionService - Automated Task Creation from Development Activity
 *
 * This service detects development work from various sources and automatically
 * creates or updates tasks in the system. Sources include:
 * - Git commits (post-commit hooks)
 * - File changes (file watchers)
 * - Database migrations
 * - Configuration changes
 *
 * All auto-created tasks are marked for review and use traditional EHH estimation.
 */

const database = require('../database');
const FormulaService = require('./FormulaService');
const logger = require('../utils/logger');
const path = require('path');

/**
 * File path patterns mapped to component types
 */
const PATH_PATTERNS = {
  migrations: {
    pattern: /scripts[\/\\]migrations[\/\\]\d+.*\.sql$/i,
    componentType: 'migration',
    taskType: 'development',
    component: 'Database'
  },
  services: {
    pattern: /src[\/\\]services[\/\\].*\.js$/i,
    componentType: 'service',
    taskType: 'development',
    component: 'Backend'
  },
  models: {
    pattern: /src[\/\\]models[\/\\].*\.js$/i,
    componentType: 'service',
    taskType: 'development',
    component: 'Models'
  },
  controllers: {
    pattern: /src[\/\\]controllers[\/\\].*\.js$/i,
    componentType: 'endpoint',
    taskType: 'development',
    component: 'API'
  },
  routes: {
    pattern: /src[\/\\]routes[\/\\].*\.js$/i,
    componentType: 'endpoint',
    taskType: 'development',
    component: 'API'
  },
  views: {
    pattern: /views[\/\\].*\.(ejs|html)$/i,
    componentType: 'page',
    taskType: 'development',
    component: 'Frontend'
  },
  publicJs: {
    pattern: /public[\/\\]js[\/\\].*\.js$/i,
    componentType: 'component',
    taskType: 'development',
    component: 'Frontend'
  },
  publicCss: {
    pattern: /public[\/\\]css[\/\\].*\.css$/i,
    componentType: 'component',
    taskType: 'development',
    component: 'Styling'
  },
  tests: {
    pattern: /(tests?|__tests__|spec)[\/\\].*\.(js|ts)$/i,
    componentType: 'feature',
    taskType: 'development',
    component: 'Testing'
  },
  config: {
    pattern: /\.(env|json|yaml|yml)$/i,
    componentType: 'operational',
    taskType: 'operational',
    component: 'Configuration'
  },
  docs: {
    pattern: /\.(md|txt|rst)$/i,
    componentType: 'documentation',
    taskType: 'enhancement',
    component: 'Documentation'
  }
};

/**
 * Parse a git commit message for task references
 * Looks for patterns like: JIT000123, JV-123, #123
 *
 * @param {string} message - Git commit message
 * @returns {Object} {taskCode, isNewTask, title, description}
 */
function parseCommitMessage(message) {
  // Look for existing task code references
  const taskCodeMatch = message.match(/\b(JIT\d{6}|JV-\d+|#\d+)\b/i);

  if (taskCodeMatch) {
    return {
      taskCode: taskCodeMatch[1].toUpperCase(),
      isNewTask: false,
      title: null,
      description: message
    };
  }

  // Extract title from commit message (first line)
  const lines = message.trim().split('\n');
  const title = lines[0].substring(0, 200);
  const description = lines.slice(1).join('\n').trim();

  return {
    taskCode: null,
    isNewTask: true,
    title,
    description: description || title
  };
}

/**
 * Categorize a file path to determine work type
 *
 * @param {string} filePath - Path to the file
 * @returns {Object} {componentType, taskType, component} or null if unknown
 */
function categorizeFilePath(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const [key, config] of Object.entries(PATH_PATTERNS)) {
    if (config.pattern.test(normalizedPath)) {
      return {
        category: key,
        componentType: config.componentType,
        taskType: config.taskType,
        component: config.component
      };
    }
  }

  // Default for unknown file types
  return {
    category: 'other',
    componentType: 'feature',
    taskType: 'development',
    component: 'General'
  };
}

/**
 * Detect work from a git commit
 *
 * @param {Object} commitData - Commit information
 * @param {string} commitData.hash - Commit hash
 * @param {string} commitData.message - Commit message
 * @param {string} commitData.author - Author name/email
 * @param {Array<string>} commitData.files - List of changed files
 * @returns {Object} Detected work information
 */
async function detectGitCommit(commitData) {
  const { hash, message, author, files = [] } = commitData;

  logger.info('[WorkDetection] Processing git commit', { hash, fileCount: files.length });

  // Parse commit message for task references
  const parsed = parseCommitMessage(message);

  // Categorize changed files
  const fileCategories = files.map(f => ({
    file: f,
    ...categorizeFilePath(f)
  }));

  // Determine primary component type (most common)
  const typeCounts = {};
  fileCategories.forEach(fc => {
    typeCounts[fc.componentType] = (typeCounts[fc.componentType] || 0) + 1;
  });

  const primaryType = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'feature';

  // Estimate complexity based on file count
  let complexity = 'simple';
  if (files.length > 5) complexity = 'moderate';
  if (files.length > 15) complexity = 'complex';

  // Get EHH estimate
  const deliverables = {
    components: [{
      type: primaryType,
      complexity,
      count: 1,
      description: `${files.length} files changed in commit ${hash.substring(0, 7)}`
    }]
  };

  const estimation = FormulaService.estimateEHH(deliverables);

  return {
    source: 'git_commit',
    sourceId: hash,
    parsed,
    files: fileCategories,
    primaryType,
    complexity,
    estimation,
    metadata: {
      author,
      commitHash: hash,
      filesChanged: files.length
    }
  };
}

/**
 * Detect work from file changes
 *
 * @param {string} filePath - Path to the changed file
 * @param {string} changeType - Type of change: 'add', 'change', 'unlink'
 * @returns {Object} Detected work information
 */
async function detectFileChange(filePath, changeType) {
  logger.debug('[WorkDetection] Processing file change', { filePath, changeType });

  const category = categorizeFilePath(filePath);
  const fileName = path.basename(filePath);

  // Determine complexity based on file type
  let complexity = 'simple';
  if (category.componentType === 'service' || category.componentType === 'page') {
    complexity = 'moderate';
  }

  const deliverables = {
    components: [{
      type: category.componentType,
      complexity,
      count: 1,
      description: `${changeType} ${fileName}`
    }]
  };

  const estimation = FormulaService.estimateEHH(deliverables);

  return {
    source: 'file_change',
    sourceId: filePath,
    changeType,
    category,
    fileName,
    estimation,
    metadata: {
      filePath,
      changeType,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Detect migration from migration runner
 *
 * @param {number} migrationNumber - Migration number
 * @param {string} migrationName - Migration file name
 * @param {Object} options - Additional options
 * @returns {Object} Detected work information
 */
async function detectMigration(migrationNumber, migrationName, options = {}) {
  logger.info('[WorkDetection] Processing migration', { migrationNumber, migrationName });

  // Determine complexity based on naming conventions
  let complexity = 'moderate';
  if (/simple|fix|update/i.test(migrationName)) {
    complexity = 'simple';
  } else if (/complex|redesign|consolidate|comprehensive/i.test(migrationName)) {
    complexity = 'complex';
  }

  const deliverables = {
    components: [{
      type: 'migration',
      complexity,
      count: 1,
      description: migrationName
    }]
  };

  const estimation = FormulaService.estimateEHH(deliverables);

  return {
    source: 'migration',
    sourceId: `${migrationNumber}`,
    migrationNumber,
    migrationName,
    complexity,
    estimation,
    metadata: {
      ...options,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Correlate detected work to existing tasks
 *
 * @param {Object} detectedWork - Work detection result
 * @returns {Object|null} Matching task or null
 */
async function correlateToExistingTask(detectedWork) {
  try {
    // If we have a task code from the commit message, use that
    if (detectedWork.parsed?.taskCode) {
      const result = await database.query(`
        SELECT id, task_code, title, status
        FROM admin_tasks
        WHERE task_code = $1 OR task_code LIKE $2
        LIMIT 1
      `, [detectedWork.parsed.taskCode, `%${detectedWork.parsed.taskCode}%`]);

      if (result.rows.length > 0) {
        return result.rows[0];
      }
    }

    // Try to match by similar title (for migrations)
    if (detectedWork.source === 'migration') {
      const result = await database.query(`
        SELECT id, task_code, title, status
        FROM admin_tasks
        WHERE title ILIKE $1
        LIMIT 1
      `, [`%Migration ${detectedWork.migrationNumber}%`]);

      if (result.rows.length > 0) {
        return result.rows[0];
      }
    }

    return null;
  } catch (error) {
    logger.error('[WorkDetection] Failed to correlate to existing task', { error: error.message });
    return null;
  }
}

/**
 * Auto-create a task from detected work
 *
 * @param {Object} detectedWork - Work detection result
 * @param {Object} options - Additional options
 * @returns {Object} Created task information
 */
async function autoCreateTask(detectedWork, options = {}) {
  const { forceCreate = false, createdBy = null } = options;

  try {
    // Check for existing task first
    const existingTask = await correlateToExistingTask(detectedWork);

    if (existingTask && !forceCreate) {
      logger.info('[WorkDetection] Found existing task', {
        taskCode: existingTask.task_code,
        source: detectedWork.source
      });

      return {
        action: 'matched',
        task: existingTask,
        detectedWork
      };
    }

    // Generate task details
    let title, description, taskType, component;

    switch (detectedWork.source) {
      case 'git_commit':
        title = detectedWork.parsed.title || `Work from commit ${detectedWork.sourceId.substring(0, 7)}`;
        description = detectedWork.parsed.description || '';
        taskType = detectedWork.files[0]?.taskType || 'development';
        component = detectedWork.files[0]?.component || 'General';
        break;

      case 'migration':
        title = `Migration ${detectedWork.migrationNumber}: ${detectedWork.migrationName.replace(/_/g, ' ')}`;
        description = `Database migration ${detectedWork.migrationNumber}\nComplexity: ${detectedWork.complexity}`;
        taskType = 'development';
        component = 'Database';
        break;

      case 'file_change':
        title = `${detectedWork.changeType === 'add' ? 'Create' : 'Update'} ${detectedWork.fileName}`;
        description = `File ${detectedWork.changeType}: ${detectedWork.category.filePath}`;
        taskType = detectedWork.category.taskType;
        component = detectedWork.category.component;
        break;

      default:
        title = `Auto-detected work: ${detectedWork.source}`;
        description = JSON.stringify(detectedWork.metadata, null, 2);
        taskType = 'development';
        component = 'General';
    }

    // Get next task number
    const nextNum = await database.query("SELECT nextval('task_code_seq')");
    const taskNumber = parseInt(nextNum.rows[0].nextval);
    const taskCode = 'JIT' + String(taskNumber).padStart(6, '0');

    // Get EHH estimate
    const ehh = detectedWork.estimation?.ehh_median || 8;
    const ehhLow = detectedWork.estimation?.ehh_low || 4;
    const ehhHigh = detectedWork.estimation?.ehh_high || 16;

    // Insert the task
    const result = await database.query(`
      INSERT INTO admin_tasks (
        task_number, task_code, title, description, task_type,
        status, effort_hours, component,
        ehh_estimation_method, ehh_low, ehh_high,
        primary_component_type,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        'pending', $6, $7,
        'auto_detected', $8, $9,
        $10,
        NOW()
      )
      RETURNING id, task_code, title
    `, [
      taskNumber, taskCode, title, description, taskType,
      ehh, component,
      ehhLow, ehhHigh,
      detectedWork.primaryType || 'feature'
    ]);

    const createdTask = result.rows[0];

    logger.info('[WorkDetection] Auto-created task', {
      taskCode: createdTask.task_code,
      title: createdTask.title,
      source: detectedWork.source
    });

    return {
      action: 'created',
      task: createdTask,
      detectedWork
    };

  } catch (error) {
    logger.error('[WorkDetection] Failed to auto-create task', {
      source: detectedWork.source,
      error: error.message
    });

    return {
      action: 'error',
      error: error.message,
      detectedWork
    };
  }
}

/**
 * Buffer for batching related changes
 */
const changeBuffer = {
  commits: [],
  files: [],
  timer: null,
  BUFFER_DELAY_MS: 5000  // 5 seconds
};

/**
 * Add work to buffer for batch processing
 *
 * @param {string} type - Type of work ('commit', 'file', 'migration')
 * @param {Object} data - Work data
 */
function bufferWork(type, data) {
  if (type === 'commit') {
    changeBuffer.commits.push(data);
  } else if (type === 'file') {
    changeBuffer.files.push(data);
  }

  // Reset timer
  if (changeBuffer.timer) {
    clearTimeout(changeBuffer.timer);
  }

  // Process buffer after delay
  changeBuffer.timer = setTimeout(processBuffer, changeBuffer.BUFFER_DELAY_MS);
}

/**
 * Process buffered changes
 */
async function processBuffer() {
  const commits = [...changeBuffer.commits];
  const files = [...changeBuffer.files];

  // Clear buffer
  changeBuffer.commits = [];
  changeBuffer.files = [];
  changeBuffer.timer = null;

  if (commits.length === 0 && files.length === 0) {
    return;
  }

  logger.info('[WorkDetection] Processing buffered changes', {
    commits: commits.length,
    files: files.length
  });

  try {
    // Process commits
    for (const commit of commits) {
      const detected = await detectGitCommit(commit);
      await autoCreateTask(detected);
    }

    // Group file changes by directory and process
    // (to avoid creating separate tasks for each file)
    const filesByDir = {};
    for (const file of files) {
      const dir = path.dirname(file.path);
      if (!filesByDir[dir]) {
        filesByDir[dir] = [];
      }
      filesByDir[dir].push(file);
    }

    // Create one task per directory with multiple files
    for (const [dir, dirFiles] of Object.entries(filesByDir)) {
      if (dirFiles.length === 1) {
        const detected = await detectFileChange(dirFiles[0].path, dirFiles[0].changeType);
        await autoCreateTask(detected);
      } else {
        // Batch multiple files in same directory
        logger.info('[WorkDetection] Batching file changes', {
          directory: dir,
          fileCount: dirFiles.length
        });
        // Could create a combined task here if needed
      }
    }

  } catch (error) {
    logger.error('[WorkDetection] Failed to process buffer', { error: error.message });
  }
}

/**
 * Get work detection statistics
 *
 * @returns {Object} Statistics about auto-detected work
 */
async function getDetectionStats() {
  try {
    const result = await database.query(`
      SELECT
        ehh_estimation_method,
        COUNT(*) as count,
        SUM(effort_hours) as total_ehh,
        AVG(effort_hours) as avg_ehh
      FROM admin_tasks
      WHERE ehh_estimation_method IS NOT NULL
      GROUP BY ehh_estimation_method
      ORDER BY count DESC
    `);

    return {
      byMethod: result.rows,
      bufferStatus: {
        pendingCommits: changeBuffer.commits.length,
        pendingFiles: changeBuffer.files.length
      }
    };

  } catch (error) {
    logger.error('[WorkDetection] Failed to get stats', { error: error.message });
    return { error: error.message };
  }
}

module.exports = {
  // Detection functions
  detectGitCommit,
  detectFileChange,
  detectMigration,

  // Correlation and creation
  correlateToExistingTask,
  autoCreateTask,

  // Helpers
  parseCommitMessage,
  categorizeFilePath,

  // Buffering
  bufferWork,
  processBuffer,

  // Stats
  getDetectionStats,

  // Constants
  PATH_PATTERNS
};
