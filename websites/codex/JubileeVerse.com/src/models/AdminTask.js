/**
 * AdminTask Model
 * Handles all admin task tracking database operations
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');
const FormulaService = require('../services/FormulaService');

// Valid task types
const TASK_TYPES = ['development', 'bug', 'enhancement', 'operational'];

// Valid task statuses (in workflow order)
const TASK_STATUSES = ['submitted', 'in_review', 'in_progress', 'fixing', 'completed'];

// Valid task priorities
const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'];

// Valid status transitions
const VALID_TRANSITIONS = {
  submitted: ['in_review', 'completed'],
  in_review: ['in_progress', 'submitted', 'completed'],
  in_progress: ['fixing', 'in_review', 'completed'],
  fixing: ['completed', 'in_progress'],
  completed: ['in_progress']
};

/**
 * Convert database row to task object (snake_case to camelCase)
 */
function rowToTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    taskNumber: row.task_number,
    taskCode: row.task_code,
    title: row.title,
    description: row.description,
    taskType: row.task_type,
    priority: row.priority,
    status: row.status,
    workflowStatus: row.workflow_status,
    currentOwner: row.current_owner,
    component: row.component,
    createdById: row.created_by,
    assignedToId: row.assigned_to,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    startedAt: row.started_at,
    fixingAt: row.fixing_at,
    completedAt: row.completed_at,
    notes: row.notes,
    resolution: row.resolution,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Effort estimation
    effort_hours: row.effort_hours ? parseFloat(row.effort_hours) : null,
    // Completed Work (Human+AI) - actual time with AI assistance
    completed_work: row.completed_work ? parseFloat(row.completed_work) : null,
    // Hierarchy fields
    parentTaskId: row.parent_task_id,
    isParent: row.is_parent || false,
    childCount: row.child_count || 0,
    displayOrder: row.display_order || 0,
    // Joined fields from users table
    createdByName: row.created_by_name,
    assignedToName: row.assigned_to_name,
    // Hierarchy joined fields
    parentTaskNumber: row.parent_task_number,
    parentTitle: row.parent_title,
    hierarchyLevel: row.hierarchy_level || 0,
    // Children array (populated separately)
    children: row.children || []
  };
}

/**
 * Convert database row to history entry
 */
function rowToHistory(row) {
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.task_id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    changedById: row.changed_by,
    changedByName: row.changed_by_name,
    comment: row.comment,
    changedAt: row.changed_at
  };
}

/**
 * Get all tasks with optional filters
 */
async function findAll(filters = {}) {
  let query = `
    SELECT t.*,
           creator.display_name as created_by_name,
           assignee.display_name as assigned_to_name,
           parent.task_number as parent_task_number,
           parent.title as parent_title
    FROM admin_tasks t
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    LEFT JOIN admin_tasks parent ON t.parent_task_id = parent.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (filters.status) {
    query += ` AND t.status = $${paramIndex++}`;
    params.push(filters.status);
  }

  if (filters.workflowStatus) {
    query += ` AND t.workflow_status = $${paramIndex++}`;
    params.push(filters.workflowStatus);
  }

  if (filters.taskType) {
    query += ` AND t.task_type = $${paramIndex++}`;
    params.push(filters.taskType);
  }

  if (filters.priority) {
    query += ` AND t.priority = $${paramIndex++}`;
    params.push(filters.priority);
  }

  if (filters.component) {
    query += ` AND t.component = $${paramIndex++}`;
    params.push(filters.component);
  }

  if (filters.assignedTo) {
    query += ` AND t.assigned_to = $${paramIndex++}`;
    params.push(filters.assignedTo);
  }

  if (filters.currentOwner) {
    query += ` AND t.current_owner = $${paramIndex++}`;
    params.push(filters.currentOwner);
  }

  // Filter for parent tasks only (no parent_task_id)
  if (filters.parentsOnly) {
    query += ` AND t.parent_task_id IS NULL`;
  }

  // Filter for children of a specific parent
  if (filters.parentTaskId) {
    query += ` AND t.parent_task_id = $${paramIndex++}`;
    params.push(filters.parentTaskId);
  }

  if (filters.search) {
    query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  // Default sort by task_number descending (newest first)
  const sortField = filters.sortBy || 'task_number';
  const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY t.${sortField} ${sortOrder}`;

  // Pagination
  if (filters.limit) {
    query += ` LIMIT $${paramIndex++}`;
    params.push(filters.limit);
  }

  if (filters.offset) {
    query += ` OFFSET $${paramIndex++}`;
    params.push(filters.offset);
  }

  const result = await database.query(query, params);
  return result.rows.map(rowToTask);
}

/**
 * Get tasks in hierarchical structure (parents with children nested)
 */
async function findAllHierarchical(filters = {}) {
  // First get all parent tasks (tasks without parent_task_id)
  const parentFilters = { ...filters, parentsOnly: true };
  const parents = await findAll(parentFilters);

  // For each parent that has children, fetch them
  for (const parent of parents) {
    if (parent.isParent && parent.childCount > 0) {
      const children = await findAll({
        parentTaskId: parent.id,
        sortBy: 'display_order',
        sortOrder: 'asc'
      });
      parent.children = children;
    }
  }

  return parents;
}

/**
 * Get children of a specific task
 */
async function findChildren(parentTaskId) {
  return findAll({
    parentTaskId,
    sortBy: 'display_order',
    sortOrder: 'asc'
  });
}

/**
 * Update parent task title to reflect combined scope
 */
async function updateParentTitle(parentTaskId, newTitle) {
  const result = await database.query(
    'UPDATE admin_tasks SET title = $2 WHERE id = $1 RETURNING *',
    [parentTaskId, newTitle]
  );
  return rowToTask(result.rows[0]);
}

/**
 * Check if a task can accept new children (not completed)
 */
async function canAcceptChildren(taskId) {
  const result = await database.query(
    'SELECT workflow_status FROM admin_tasks WHERE id = $1',
    [taskId]
  );
  if (result.rows.length === 0) return false;
  return result.rows[0].workflow_status !== 'completed';
}

/**
 * Find an appropriate open parent task for a new child task
 * Returns the most recent open parent task that matches the component
 */
async function findOpenParentTask(component = null) {
  let query = `
    SELECT * FROM admin_tasks
    WHERE is_parent = TRUE
      AND workflow_status != 'completed'
  `;
  const params = [];

  if (component) {
    query += ` AND component = $1`;
    params.push(component);
  }

  query += ` ORDER BY created_at DESC LIMIT 1`;

  const result = await database.query(query, params);
  return rowToTask(result.rows[0]);
}

/**
 * Get task by ID
 */
async function findById(taskId) {
  const result = await database.query(`
    SELECT t.*,
           creator.display_name as created_by_name,
           assignee.display_name as assigned_to_name
    FROM admin_tasks t
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    WHERE t.id = $1
  `, [taskId]);
  return rowToTask(result.rows[0]);
}

/**
 * Get task by task number (e.g., JV-001)
 */
async function findByTaskNumber(taskNumber) {
  const result = await database.query(`
    SELECT t.*,
           creator.display_name as created_by_name,
           assignee.display_name as assigned_to_name
    FROM admin_tasks t
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    WHERE t.task_number = $1
  `, [taskNumber]);
  return rowToTask(result.rows[0]);
}

/**
 * Create a new task
 */
async function create(taskData) {
  const id = uuidv4();

  // Calculate EHH (Est. Human Hours) based on task type and priority
  const taskType = taskData.taskType || 'development';
  const priority = taskData.priority || 'medium';

  // Use provided effort_hours or calculate default based on task type and priority
  let effortHours = taskData.effort_hours;
  if (!effortHours || effortHours <= 0) {
    // Get default effort hours from lookup table
    const typeDefaults = DEFAULT_EFFORT_HOURS[taskType] || DEFAULT_EFFORT_HOURS.development;
    effortHours = typeDefaults[priority] || typeDefaults.medium || 3.0;
  }

  const result = await database.query(`
    INSERT INTO admin_tasks (
      id, title, description, task_type, priority, status,
      component, created_by, assigned_to, notes, parent_task_id, display_order, effort_hours
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `, [
    id,
    taskData.title,
    taskData.description || null,
    taskType,
    priority,
    'submitted', // Always start as submitted
    taskData.component || null,
    taskData.createdById || null,
    taskData.assignedToId || null,
    taskData.notes || null,
    taskData.parentTaskId || null,
    taskData.displayOrder || 0,
    effortHours
  ]);

  return rowToTask(result.rows[0]);
}

/**
 * Update a task
 */
async function update(taskId, updates) {
  const fieldMap = {
    title: 'title',
    description: 'description',
    taskType: 'task_type',
    priority: 'priority',
    component: 'component',
    assignedToId: 'assigned_to',
    notes: 'notes',
    resolution: 'resolution',
    effort_hours: 'effort_hours',
    completed_work: 'completed_work'
  };

  const dbUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    if (fieldMap[key]) {
      dbUpdates[fieldMap[key]] = value;
    }
  }

  const fields = Object.keys(dbUpdates);
  const values = Object.values(dbUpdates);

  if (fields.length === 0) return findById(taskId);

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

  const result = await database.query(
    `UPDATE admin_tasks SET ${setClause} WHERE id = $1 RETURNING *`,
    [taskId, ...values]
  );

  return rowToTask(result.rows[0]);
}

/**
 * Update task status with validation
 */
async function updateStatus(taskId, newStatus, changedById, comment = null) {
  // Validate status
  if (!TASK_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  // Get current task
  const currentTask = await findById(taskId);
  if (!currentTask) {
    throw new Error('Task not found');
  }

  // Check if transition is valid
  const currentStatus = currentTask.status;
  if (currentStatus !== newStatus) {
    const validTransitions = VALID_TRANSITIONS[currentStatus] || [];
    if (!validTransitions.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  // When completing a task, freeze the EHH/CW+ metrics using FormulaService
  // This creates an immutable audit record
  let completedWorkValue = null;
  let shouldFreezeMetrics = false;

  if (newStatus === 'completed') {
    // Get EHH value (use existing or estimate)
    const ehh = currentTask.effort_hours || 8.0;

    // Calculate CW+ if not already set
    // CW+ is estimated as a small fraction of EHH since AI greatly accelerates work
    // Default: 2.5% of EHH (e.g., 8 EHH → 0.2 CW+)
    // Minimum 0.10 hours (6 minutes)
    if (!currentTask.completed_work) {
      completedWorkValue = Math.max(0.10, Math.round(ehh * 0.025 * 100) / 100);
    } else {
      completedWorkValue = currentTask.completed_work;
    }

    // Only freeze if not already frozen
    if (!currentTask.metrics_frozen_at) {
      shouldFreezeMetrics = true;
    }
  }

  // Update status (and completed_work if applicable)
  let result;
  if (completedWorkValue !== null) {
    result = await database.query(
      'UPDATE admin_tasks SET status = $1, completed_work = $2, completed_at = NOW() WHERE id = $3 RETURNING *',
      [newStatus, completedWorkValue, taskId]
    );
  } else {
    result = await database.query(
      'UPDATE admin_tasks SET status = $1 WHERE id = $2 RETURNING *',
      [newStatus, taskId]
    );
  }

  // Freeze metrics with FormulaService for completed tasks
  if (shouldFreezeMetrics && result.rows.length > 0) {
    const task = result.rows[0];
    const ehh = parseFloat(task.effort_hours) || 8.0;
    const cwPlus = parseFloat(task.completed_work) || completedWorkValue;

    await FormulaService.freezeTaskMetrics(taskId, ehh, cwPlus, {
      calculatedBy: changedById,
      reason: 'task_completion'
    });
  }

  // Record history
  await database.query(`
    INSERT INTO admin_task_history (task_id, previous_status, new_status, changed_by, comment)
    VALUES ($1, $2, $3, $4, $5)
  `, [taskId, currentStatus, newStatus, changedById, comment]);

  return rowToTask(result.rows[0]);
}

/**
 * Get task history
 */
async function getHistory(taskId) {
  const result = await database.query(`
    SELECT h.*, u.display_name as changed_by_name
    FROM admin_task_history h
    LEFT JOIN users u ON h.changed_by = u.id
    WHERE h.task_id = $1
    ORDER BY h.changed_at DESC
  `, [taskId]);
  return result.rows.map(rowToHistory);
}

/**
 * Delete a task (soft delete not implemented - just removes)
 */
async function deleteTask(taskId) {
  const result = await database.query(
    'DELETE FROM admin_tasks WHERE id = $1 RETURNING id',
    [taskId]
  );
  return result.rows.length > 0;
}

/**
 * Get task statistics
 */
async function getStats() {
  const result = await database.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
      COUNT(*) FILTER (WHERE status = 'in_review') as in_review,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
      COUNT(*) FILTER (WHERE status = 'fixing') as fixing,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE priority = 'critical') as critical,
      COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
      COUNT(*) FILTER (WHERE task_type = 'bug') as bugs,
      COUNT(*) FILTER (WHERE task_type = 'development') as development,
      COUNT(*) FILTER (WHERE task_type = 'enhancement') as enhancements,
      COUNT(*) FILTER (WHERE task_type = 'operational') as operational
    FROM admin_tasks
  `);

  const row = result.rows[0];
  return {
    total: parseInt(row.total, 10),
    byStatus: {
      submitted: parseInt(row.submitted, 10),
      inReview: parseInt(row.in_review, 10),
      inProgress: parseInt(row.in_progress, 10),
      fixing: parseInt(row.fixing, 10),
      completed: parseInt(row.completed, 10)
    },
    byPriority: {
      critical: parseInt(row.critical, 10),
      highPriority: parseInt(row.high_priority, 10)
    },
    byType: {
      bugs: parseInt(row.bugs, 10),
      development: parseInt(row.development, 10),
      enhancements: parseInt(row.enhancements, 10),
      operational: parseInt(row.operational, 10)
    }
  };
}

/**
 * Get distinct components used in tasks
 */
async function getComponents() {
  const result = await database.query(`
    SELECT DISTINCT component FROM admin_tasks
    WHERE component IS NOT NULL
    ORDER BY component
  `);
  return result.rows.map(r => r.component);
}

/**
 * Get users who can be assigned tasks (admin role)
 */
async function getAssignableUsers() {
  const result = await database.query(`
    SELECT id, display_name, email
    FROM users
    WHERE role = 'admin' AND is_active = true
    ORDER BY display_name
  `);
  return result.rows.map(r => ({
    id: r.id,
    displayName: r.display_name,
    email: r.email
  }));
}

/**
 * Effort multipliers by status for partial EHH contribution
 * Completed tasks contribute 100%, others contribute partial based on progress
 */
const EFFORT_MULTIPLIERS = {
  submitted: 0.0,      // No progress yet
  in_review: 0.15,     // Initial review contributes some effort
  in_progress: 0.50,   // Active work - 50% contribution
  fixing: 0.80,        // Near completion - 80% contribution
  completed: 1.0       // Full contribution
};

/**
 * Default effort hours by task type and priority
 * Used when effort_hours is not explicitly set
 */
const DEFAULT_EFFORT_HOURS = {
  // [taskType][priority]
  development: { low: 1.5, medium: 3.0, high: 5.0, critical: 8.0 },
  bug: { low: 1.0, medium: 2.0, high: 4.0, critical: 6.0 },
  enhancement: { low: 1.0, medium: 2.0, high: 3.0, critical: 5.0 },
  operational: { low: 0.5, medium: 1.0, high: 2.0, critical: 3.0 }
};

/**
 * Calculate Development Velocity - Human-Equivalent Hours (EHH) over rolling 7-day window
 *
 * The velocity represents progress delivered, not time spent.
 * Baseline: 40 EHH/week = one normal human work week
 *
 * Calculation:
 * - Completed tasks within window: full effort_hours
 * - Tasks that changed status within window: partial effort based on state transition
 * - In-progress tasks: partial contribution based on EFFORT_MULTIPLIERS
 */
async function calculateVelocity() {
  // First, ensure effort_hours column exists (idempotent)
  try {
    await database.query(`
      ALTER TABLE admin_tasks ADD COLUMN IF NOT EXISTS effort_hours DECIMAL(5,2) DEFAULT 2.0
    `);
  } catch (e) {
    // Column may already exist or we lack permissions - continue anyway
  }

  const result = await database.query(`
    WITH velocity_window AS (
      SELECT NOW() - INTERVAL '7 days' AS window_start,
             NOW() AS window_end
    ),
    -- Tasks completed within the 7-day window (full contribution)
    completed_in_window AS (
      SELECT
        t.id,
        t.task_type,
        t.priority,
        t.status,
        COALESCE(t.effort_hours, 2.0) as effort_hours,
        1.0 as multiplier,
        'completed' as contribution_type
      FROM admin_tasks t, velocity_window w
      WHERE t.status = 'completed'
        AND t.completed_at >= w.window_start
        AND t.completed_at <= w.window_end
    ),
    -- Tasks currently in progress (partial contribution based on status)
    in_progress_tasks AS (
      SELECT
        t.id,
        t.task_type,
        t.priority,
        t.status,
        COALESCE(t.effort_hours, 2.0) as effort_hours,
        CASE t.status
          WHEN 'submitted' THEN 0.0
          WHEN 'in_review' THEN 0.15
          WHEN 'in_progress' THEN 0.50
          WHEN 'fixing' THEN 0.80
          ELSE 0.0
        END as multiplier,
        'in_progress' as contribution_type
      FROM admin_tasks t
      WHERE t.status NOT IN ('completed', 'submitted')
    ),
    -- Combine all contributions
    all_contributions AS (
      SELECT * FROM completed_in_window
      UNION ALL
      SELECT * FROM in_progress_tasks
    ),
    -- Calculate totals
    velocity_totals AS (
      SELECT
        SUM(effort_hours * multiplier) as total_ehh,
        SUM(CASE WHEN contribution_type = 'completed' THEN effort_hours ELSE 0 END) as completed_ehh,
        SUM(CASE WHEN contribution_type = 'in_progress' THEN effort_hours * multiplier ELSE 0 END) as in_progress_ehh,
        COUNT(CASE WHEN contribution_type = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN contribution_type = 'in_progress' THEN 1 END) as in_progress_count
      FROM all_contributions
    ),
    -- Get 7-day trend (compare to previous 7 days)
    previous_window AS (
      SELECT
        SUM(COALESCE(t.effort_hours, 2.0)) as previous_ehh
      FROM admin_tasks t
      WHERE t.status = 'completed'
        AND t.completed_at >= NOW() - INTERVAL '14 days'
        AND t.completed_at < NOW() - INTERVAL '7 days'
    )
    SELECT
      COALESCE(v.total_ehh, 0) as total_ehh,
      COALESCE(v.completed_ehh, 0) as completed_ehh,
      COALESCE(v.in_progress_ehh, 0) as in_progress_ehh,
      COALESCE(v.completed_count, 0) as completed_count,
      COALESCE(v.in_progress_count, 0) as in_progress_count,
      COALESCE(p.previous_ehh, 0) as previous_ehh
    FROM velocity_totals v, previous_window p
  `);

  const row = result.rows[0];
  const totalEHH = parseFloat(row.total_ehh) || 0;
  const completedEHH = parseFloat(row.completed_ehh) || 0;
  const inProgressEHH = parseFloat(row.in_progress_ehh) || 0;
  const completedCount = parseInt(row.completed_count, 10) || 0;
  const inProgressCount = parseInt(row.in_progress_count, 10) || 0;
  const previousEHH = parseFloat(row.previous_ehh) || 0;

  // Calculate trend percentage
  let trendPercent = 0;
  if (previousEHH > 0) {
    trendPercent = ((completedEHH - previousEHH) / previousEHH) * 100;
  } else if (completedEHH > 0) {
    trendPercent = 100; // Infinite growth from 0
  }

  // Baseline: 40 EHH = 1 normal human work week
  const baseline = 40;
  const velocityRatio = totalEHH / baseline;

  return {
    // Primary metric: total EHH in the rolling 7-day window
    totalEHH: Math.round(totalEHH * 10) / 10,

    // Breakdown
    completedEHH: Math.round(completedEHH * 10) / 10,
    inProgressEHH: Math.round(inProgressEHH * 10) / 10,

    // Task counts
    completedCount,
    inProgressCount,

    // Trend (compared to previous 7 days)
    previousEHH: Math.round(previousEHH * 10) / 10,
    trendPercent: Math.round(trendPercent),
    trendDirection: trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'stable',

    // Baseline comparison
    baseline,
    velocityRatio: Math.round(velocityRatio * 100) / 100,

    // WPH (Work Per Hour) - Human-equivalent work delivered per clock hour
    // 7 days * 8 hours = 56 clock hours in the window
    // WPH = totalEHH / 56 * 100 (percentage scale for gauge)
    // But for display, we use totalEHH directly as it represents the velocity magnitude
    wph: Math.round(totalEHH),  // Total EHH delivered in the 7-day window
    multiplier: Math.round(velocityRatio * 100) / 100,  // How many times faster than baseline

    // Interpretation zones
    zone: velocityRatio >= 2.0 ? 'peak' :
          velocityRatio >= 1.0 ? 'accelerating' :
          velocityRatio >= 0.5 ? 'normal' : 'warming_up',

    // Timestamp
    calculatedAt: new Date().toISOString()
  };
}

module.exports = {
  // Constants
  TASK_TYPES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  VALID_TRANSITIONS,

  // CRUD operations
  findAll,
  findById,
  findByTaskNumber,
  create,
  update,
  updateStatus,
  deleteTask,

  // Hierarchy operations
  findAllHierarchical,
  findChildren,
  updateParentTitle,
  canAcceptChildren,
  findOpenParentTask,

  // History
  getHistory,

  // Statistics and metadata
  getStats,
  getComponents,
  getAssignableUsers,

  // Velocity calculation
  calculateVelocity,
  EFFORT_MULTIPLIERS,
  DEFAULT_EFFORT_HOURS
};
