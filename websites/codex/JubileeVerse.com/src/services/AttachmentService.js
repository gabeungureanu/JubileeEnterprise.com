/**
 * Attachment Service
 * Handles file attachments with 30-day retention policy
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const database = require('../database');

/**
 * Default retention period in days
 */
const DEFAULT_RETENTION_DAYS = 30;

/**
 * Allowed file types
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

/**
 * Max file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Get upload directory path
 */
function getUploadDir() {
  return config.uploads?.path || path.join(process.cwd(), 'uploads', 'attachments');
}

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir() {
  const uploadDir = getUploadDir();
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      logger.error('Failed to create upload directory', { error: error.message });
      throw error;
    }
  }
}

/**
 * Validate file before upload
 */
function validateFile(file) {
  if (!file) {
    throw new Error('No file provided');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error(`File type ${file.mimetype} is not allowed`);
  }

  return true;
}

/**
 * Save attachment to disk and database
 */
async function saveAttachment(messageId, file, options = {}) {
  const { userId, retentionDays = DEFAULT_RETENTION_DAYS } = options;

  try {
    validateFile(file);
    await ensureUploadDir();

    const id = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${id}${ext}`;
    const uploadDir = getUploadDir();
    const filePath = path.join(uploadDir, filename);

    // Save file to disk
    await fs.writeFile(filePath, file.buffer);

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);

    // Save to database
    const result = await database.query(
      `INSERT INTO message_attachments (id, message_id, file_type, file_name, file_url, file_size, mime_type, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        id,
        messageId,
        file.mimetype.split('/')[0], // 'image', 'application', etc.
        file.originalname,
        `/uploads/attachments/${filename}`,
        file.size,
        file.mimetype,
        expiresAt
      ]
    );

    logger.info('Attachment saved', {
      attachmentId: id,
      messageId,
      filename,
      size: file.size,
      expiresAt
    });

    return {
      id: result.rows[0].id,
      fileName: result.rows[0].file_name,
      fileUrl: result.rows[0].file_url,
      fileSize: result.rows[0].file_size,
      mimeType: result.rows[0].mime_type,
      expiresAt: result.rows[0].expires_at,
      createdAt: result.rows[0].created_at
    };
  } catch (error) {
    logger.error('Failed to save attachment', { error: error.message, messageId });
    throw error;
  }
}

/**
 * Get attachment by ID
 */
async function getAttachment(attachmentId) {
  try {
    const result = await database.query(
      `SELECT * FROM message_attachments WHERE id = $1`,
      [attachmentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const attachment = result.rows[0];

    // Check if expired
    if (attachment.expires_at && new Date(attachment.expires_at) < new Date()) {
      return { expired: true, id: attachmentId };
    }

    return {
      id: attachment.id,
      messageId: attachment.message_id,
      fileName: attachment.file_name,
      fileUrl: attachment.file_url,
      fileSize: attachment.file_size,
      mimeType: attachment.mime_type,
      expiresAt: attachment.expires_at,
      createdAt: attachment.created_at
    };
  } catch (error) {
    logger.error('Failed to get attachment', { error: error.message, attachmentId });
    throw error;
  }
}

/**
 * Get attachments for a message
 */
async function getMessageAttachments(messageId) {
  try {
    const result = await database.query(
      `SELECT * FROM message_attachments
       WHERE message_id = $1
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at ASC`,
      [messageId]
    );

    return result.rows.map(row => ({
      id: row.id,
      fileName: row.file_name,
      fileUrl: row.file_url,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    }));
  } catch (error) {
    logger.error('Failed to get message attachments', { error: error.message, messageId });
    throw error;
  }
}

/**
 * Delete attachment from disk and database
 */
async function deleteAttachment(attachmentId) {
  try {
    // Get attachment info
    const result = await database.query(
      `SELECT * FROM message_attachments WHERE id = $1`,
      [attachmentId]
    );

    if (result.rows.length === 0) {
      return { success: false, reason: 'Attachment not found' };
    }

    const attachment = result.rows[0];
    const filename = path.basename(attachment.file_url);
    const filePath = path.join(getUploadDir(), filename);

    // Delete from disk
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Failed to delete file from disk', { error: error.message, filePath });
      }
    }

    // Delete from database
    await database.query(`DELETE FROM message_attachments WHERE id = $1`, [attachmentId]);

    logger.info('Attachment deleted', { attachmentId, filename });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete attachment', { error: error.message, attachmentId });
    throw error;
  }
}

/**
 * Clean up expired attachments (retention policy enforcement)
 * Should be run periodically via cron job
 */
async function cleanupExpiredAttachments() {
  logger.info('Starting expired attachments cleanup');

  try {
    // Find all expired attachments
    const result = await database.query(
      `SELECT * FROM message_attachments
       WHERE expires_at IS NOT NULL AND expires_at < NOW()`
    );

    const expiredAttachments = result.rows;
    let deletedCount = 0;
    let errorCount = 0;

    for (const attachment of expiredAttachments) {
      try {
        const filename = path.basename(attachment.file_url);
        const filePath = path.join(getUploadDir(), filename);

        // Delete from disk
        try {
          await fs.unlink(filePath);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            logger.warn('Failed to delete expired file', { error: error.message, filePath });
          }
        }

        // Delete from database
        await database.query(`DELETE FROM message_attachments WHERE id = $1`, [attachment.id]);
        deletedCount++;
      } catch (error) {
        logger.error('Error cleaning up attachment', { error: error.message, attachmentId: attachment.id });
        errorCount++;
      }
    }

    logger.info('Expired attachments cleanup completed', {
      totalExpired: expiredAttachments.length,
      deleted: deletedCount,
      errors: errorCount
    });

    return {
      totalExpired: expiredAttachments.length,
      deleted: deletedCount,
      errors: errorCount
    };
  } catch (error) {
    logger.error('Failed to cleanup expired attachments', { error: error.message });
    throw error;
  }
}

/**
 * Get storage statistics
 */
async function getStorageStats() {
  try {
    const result = await database.query(`
      SELECT
        COUNT(*) as total_attachments,
        SUM(file_size) as total_size,
        COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_count,
        SUM(CASE WHEN expires_at < NOW() THEN file_size ELSE 0 END) as expired_size
      FROM message_attachments
    `);

    const stats = result.rows[0];

    return {
      totalAttachments: parseInt(stats.total_attachments, 10),
      totalSize: parseInt(stats.total_size || 0, 10),
      totalSizeMB: Math.round((parseInt(stats.total_size || 0, 10) / 1024 / 1024) * 100) / 100,
      expiredCount: parseInt(stats.expired_count, 10),
      expiredSize: parseInt(stats.expired_size || 0, 10),
      expiredSizeMB: Math.round((parseInt(stats.expired_size || 0, 10) / 1024 / 1024) * 100) / 100
    };
  } catch (error) {
    logger.error('Failed to get storage stats', { error: error.message });
    throw error;
  }
}

/**
 * Extend retention for an attachment
 */
async function extendRetention(attachmentId, additionalDays) {
  try {
    const result = await database.query(
      `UPDATE message_attachments
       SET expires_at = COALESCE(expires_at, NOW()) + INTERVAL '${additionalDays} days'
       WHERE id = $1
       RETURNING *`,
      [attachmentId]
    );

    if (result.rows.length === 0) {
      return { success: false, reason: 'Attachment not found' };
    }

    logger.info('Attachment retention extended', {
      attachmentId,
      newExpiresAt: result.rows[0].expires_at
    });

    return {
      success: true,
      expiresAt: result.rows[0].expires_at
    };
  } catch (error) {
    logger.error('Failed to extend retention', { error: error.message, attachmentId });
    throw error;
  }
}

module.exports = {
  saveAttachment,
  getAttachment,
  getMessageAttachments,
  deleteAttachment,
  cleanupExpiredAttachments,
  getStorageStats,
  extendRetention,
  validateFile,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  DEFAULT_RETENTION_DAYS
};
