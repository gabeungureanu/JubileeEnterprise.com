/**
 * Board Message Translation Model
 * Stores per-message translations for discussion boards
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

function rowToTranslation(row) {
  if (!row) return null;
  return {
    id: row.id,
    boardMessageId: row.board_message_id,
    language: row.language,
    translatedContent: row.translated_content,
    provider: row.provider,
    createdAt: row.created_at
  };
}

async function findByMessageAndLanguage(boardMessageId, language) {
  try {
    const result = await database.query(
      `SELECT * FROM board_message_translations WHERE board_message_id = $1 AND language = $2`,
      [boardMessageId, language]
    );
    return rowToTranslation(result.rows[0]);
  } catch (error) {
    logger.error('Failed to find board message translation', { error: error.message, boardMessageId, language });
    throw error;
  }
}

async function findByMessageIdsAndLanguage(boardMessageIds, language) {
  if (!boardMessageIds || boardMessageIds.length === 0) {
    return [];
  }
  try {
    const result = await database.query(
      `SELECT * FROM board_message_translations
       WHERE board_message_id = ANY($1::uuid[]) AND language = $2`,
      [boardMessageIds, language]
    );
    return result.rows.map(rowToTranslation);
  } catch (error) {
    logger.error('Failed to find board message translations', { error: error.message, language });
    throw error;
  }
}

async function upsertTranslation(data) {
  const id = uuidv4();
  try {
    const result = await database.query(
      `INSERT INTO board_message_translations (id, board_message_id, language, translated_content, provider)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (board_message_id, language)
       DO UPDATE SET translated_content = EXCLUDED.translated_content, provider = EXCLUDED.provider
       RETURNING *`,
      [
        id,
        data.boardMessageId,
        data.language,
        data.translatedContent,
        data.provider || 'openai'
      ]
    );
    return rowToTranslation(result.rows[0]);
  } catch (error) {
    logger.error('Failed to upsert board message translation', {
      error: error.message,
      boardMessageId: data.boardMessageId,
      language: data.language
    });
    throw error;
  }
}

module.exports = {
  findByMessageAndLanguage,
  findByMessageIdsAndLanguage,
  upsertTranslation
};
