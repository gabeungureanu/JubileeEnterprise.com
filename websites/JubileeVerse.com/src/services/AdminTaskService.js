/**
 * AdminTask Service
 * Business logic for admin task tracking
 */

const { AdminTask } = require('../models');
const logger = require('../utils/logger');

/**
 * Get all tasks with filters
 */
async function getAllTasks(filters = {}) {
  try {
    const tasks = await AdminTask.findAll(filters);
    return tasks;
  } catch (error) {
    logger.error('Failed to get tasks', { error: error.message, filters });
    throw error;
  }
}

/**
 * Get a single task by ID
 */
async function getTaskById(taskId) {
  try {
    const task = await AdminTask.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    return task;
  } catch (error) {
    logger.error('Failed to get task', { error: error.message, taskId });
    throw error;
  }
}

/**
 * Get a task by its task number
 */
async function getTaskByNumber(taskNumber) {
  try {
    const task = await AdminTask.findByTaskNumber(taskNumber);
    if (!task) {
      throw new Error('Task not found');
    }
    return task;
  } catch (error) {
    logger.error('Failed to get task by number', { error: error.message, taskNumber });
    throw error;
  }
}

/**
 * Create a new task
 */
async function createTask(taskData, createdById) {
  try {
    // Validate required fields
    if (!taskData.title || taskData.title.trim() === '') {
      throw new Error('Task title is required');
    }

    // Validate task type
    if (taskData.taskType && !AdminTask.TASK_TYPES.includes(taskData.taskType)) {
      throw new Error(`Invalid task type: ${taskData.taskType}`);
    }

    // Validate priority
    if (taskData.priority && !AdminTask.TASK_PRIORITIES.includes(taskData.priority)) {
      throw new Error(`Invalid priority: ${taskData.priority}`);
    }

    const task = await AdminTask.create({
      ...taskData,
      createdById
    });

    logger.info('Task created', {
      taskId: task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      createdById
    });

    return task;
  } catch (error) {
    logger.error('Failed to create task', { error: error.message, taskData });
    throw error;
  }
}

/**
 * Update a task
 */
async function updateTask(taskId, updates, updatedById) {
  try {
    // Validate task type if provided
    if (updates.taskType && !AdminTask.TASK_TYPES.includes(updates.taskType)) {
      throw new Error(`Invalid task type: ${updates.taskType}`);
    }

    // Validate priority if provided
    if (updates.priority && !AdminTask.TASK_PRIORITIES.includes(updates.priority)) {
      throw new Error(`Invalid priority: ${updates.priority}`);
    }

    const task = await AdminTask.update(taskId, updates);

    logger.info('Task updated', {
      taskId,
      updates: Object.keys(updates),
      updatedById
    });

    return task;
  } catch (error) {
    logger.error('Failed to update task', { error: error.message, taskId, updates });
    throw error;
  }
}

/**
 * Update task status with workflow validation
 */
async function updateTaskStatus(taskId, newStatus, changedById, comment = null) {
  try {
    const task = await AdminTask.updateStatus(taskId, newStatus, changedById, comment);

    logger.info('Task status updated', {
      taskId,
      taskNumber: task.taskNumber,
      newStatus,
      changedById,
      hasComment: !!comment
    });

    return task;
  } catch (error) {
    logger.error('Failed to update task status', {
      error: error.message,
      taskId,
      newStatus,
      changedById
    });
    throw error;
  }
}

/**
 * Get task history
 */
async function getTaskHistory(taskId) {
  try {
    const history = await AdminTask.getHistory(taskId);
    return history;
  } catch (error) {
    logger.error('Failed to get task history', { error: error.message, taskId });
    throw error;
  }
}

/**
 * Delete a task
 */
async function deleteTask(taskId, deletedById) {
  try {
    const task = await AdminTask.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const deleted = await AdminTask.deleteTask(taskId);

    logger.info('Task deleted', {
      taskId,
      taskNumber: task.taskNumber,
      title: task.title,
      deletedById
    });

    return deleted;
  } catch (error) {
    logger.error('Failed to delete task', { error: error.message, taskId });
    throw error;
  }
}

/**
 * Get task statistics
 */
async function getStats() {
  try {
    const stats = await AdminTask.getStats();
    return stats;
  } catch (error) {
    logger.error('Failed to get task stats', { error: error.message });
    throw error;
  }
}

/**
 * Get distinct components
 */
async function getComponents() {
  try {
    const components = await AdminTask.getComponents();
    return components;
  } catch (error) {
    logger.error('Failed to get components', { error: error.message });
    throw error;
  }
}

/**
 * Get users who can be assigned tasks
 */
async function getAssignableUsers() {
  try {
    const users = await AdminTask.getAssignableUsers();
    return users;
  } catch (error) {
    logger.error('Failed to get assignable users', { error: error.message });
    throw error;
  }
}

/**
 * Get valid status transitions for a given status
 */
function getValidTransitions(currentStatus) {
  return AdminTask.VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Format task number with prefix (e.g., JV-001)
 */
function formatTaskNumber(taskNumber) {
  return `JV-${String(taskNumber).padStart(3, '0')}`;
}

/**
 * Get Development Velocity metrics
 * Returns Human-Equivalent Hours (HEH) for rolling 7-day window
 */
async function getVelocity() {
  try {
    const velocity = await AdminTask.calculateVelocity();
    return velocity;
  } catch (error) {
    logger.error('Failed to calculate velocity', { error: error.message });
    throw error;
  }
}

module.exports = {
  // CRUD operations
  getAllTasks,
  getTaskById,
  getTaskByNumber,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,

  // History
  getTaskHistory,

  // Statistics and metadata
  getStats,
  getComponents,
  getAssignableUsers,

  // Velocity calculation
  getVelocity,

  // Utilities
  getValidTransitions,
  formatTaskNumber,

  // Constants (re-exported for convenience)
  TASK_TYPES: AdminTask.TASK_TYPES,
  TASK_STATUSES: AdminTask.TASK_STATUSES,
  TASK_PRIORITIES: AdminTask.TASK_PRIORITIES,
  VALID_TRANSITIONS: AdminTask.VALID_TRANSITIONS,
  EFFORT_MULTIPLIERS: AdminTask.EFFORT_MULTIPLIERS,
  DEFAULT_EFFORT_HOURS: AdminTask.DEFAULT_EFFORT_HOURS
};
