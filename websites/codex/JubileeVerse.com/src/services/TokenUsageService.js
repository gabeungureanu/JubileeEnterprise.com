/**
 * Token Usage Service
 * Tracks AI token usage for analytics and billing
 */

const database = require('../database');
const logger = require('../utils/logger');

/**
 * Record token usage for an AI API call
 * @param {object} options - Usage details
 * @param {string} options.userId - User ID (optional, for user-level tracking)
 * @param {string} options.provider - AI provider (openai, claude, gemini, copilot, grok)
 * @param {string} options.model - Model name used
 * @param {number} options.promptTokens - Number of input/prompt tokens
 * @param {number} options.completionTokens - Number of output/completion tokens
 * @param {string} options.requestType - Type of request (chat, embedding, translation, etc.)
 */
async function recordUsage(options) {
  const {
    userId = null,
    provider,
    model,
    promptTokens = 0,
    completionTokens = 0,
    requestType = 'chat'
  } = options;

  const totalTokens = promptTokens + completionTokens;

  try {
    const pool = database.getPostgres();

    // Skip if mock database
    if (pool.mock) {
      logger.debug('Token usage tracking skipped (mock database)', { provider, totalTokens });
      return;
    }

    // Insert usage record (request_type stored in model field for now)
    await pool.query(`
      INSERT INTO ai_token_usage (
        user_id, provider, model, prompt_tokens, completion_tokens, total_tokens
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, provider, model, promptTokens, completionTokens, totalTokens]);

    logger.debug('Token usage recorded', {
      provider,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      requestType,
      userId: userId ? userId.substring(0, 8) + '...' : 'anonymous'
    });
  } catch (error) {
    // Don't throw - token tracking failure shouldn't break the main flow
    logger.error('Failed to record token usage', {
      error: error.message,
      provider,
      totalTokens
    });
  }
}

/**
 * Get token usage statistics for a user
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {Promise<object>} Usage statistics
 */
async function getUserUsage(userId, options = {}) {
  const { startDate, endDate } = options;

  try {
    const pool = database.getPostgres();

    if (pool.mock) {
      return { totalTokens: 0, totalCost: 0, byProvider: {} };
    }

    let query = `
      SELECT
        provider,
        SUM(total_tokens) as total_tokens,
        SUM(prompt_tokens) as prompt_tokens,
        SUM(completion_tokens) as completion_tokens,
        COUNT(*) as request_count
      FROM ai_token_usage
      WHERE user_id = $1
    `;
    const params = [userId];

    if (startDate) {
      query += ` AND created_at >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ' GROUP BY provider';

    const result = await pool.query(query, params);

    const byProvider = {};
    let totalTokens = 0;

    for (const row of result.rows) {
      byProvider[row.provider] = {
        totalTokens: parseInt(row.total_tokens) || 0,
        promptTokens: parseInt(row.prompt_tokens) || 0,
        completionTokens: parseInt(row.completion_tokens) || 0,
        requestCount: parseInt(row.request_count) || 0
      };
      totalTokens += parseInt(row.total_tokens) || 0;
    }

    return { totalTokens, byProvider };
  } catch (error) {
    logger.error('Failed to get user usage', { error: error.message, userId });
    return { totalTokens: 0, byProvider: {} };
  }
}

/**
 * Get aggregated token usage for admin analytics
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {Promise<object>} Aggregated usage by provider
 */
async function getMonthlyUsage(year, month) {
  try {
    const pool = database.getPostgres();

    if (pool.mock) {
      return {
        openai: { tokens: 0, costCents: 0 },
        claude: { tokens: 0, costCents: 0 },
        gemini: { tokens: 0, costCents: 0 },
        copilot: { tokens: 0, costCents: 0 },
        grok: { tokens: 0, costCents: 0 }
      };
    }

    // Get usage aggregated by provider for the month
    const result = await pool.query(`
      SELECT
        provider,
        SUM(total_tokens) as total_tokens,
        SUM(prompt_tokens) as prompt_tokens,
        SUM(completion_tokens) as completion_tokens
      FROM ai_token_usage
      WHERE EXTRACT(YEAR FROM created_at) = $1
        AND EXTRACT(MONTH FROM created_at) = $2
      GROUP BY provider
    `, [year, month]);

    // Get pricing from database (per 1k tokens in cents)
    const pricingResult = await pool.query(`
      SELECT provider, model, prompt_cost_per_1k_cents, completion_cost_per_1k_cents
      FROM ai_provider_pricing
      WHERE is_active = true
    `);

    // Build pricing map (use first matching provider as default)
    const pricing = {};
    for (const row of pricingResult.rows) {
      const provider = row.provider.toLowerCase();
      if (!pricing[provider]) {
        pricing[provider] = {
          promptCostPer1kCents: parseFloat(row.prompt_cost_per_1k_cents) || 0,
          completionCostPer1kCents: parseFloat(row.completion_cost_per_1k_cents) || 0
        };
      }
    }

    // Default pricing if not in database (per 1k tokens in cents)
    const defaultPricing = {
      openai: { promptCostPer1kCents: 0.015, completionCostPer1kCents: 0.06 },    // gpt-4o-mini
      claude: { promptCostPer1kCents: 1.5, completionCostPer1kCents: 7.5 },       // claude-3-opus
      gemini: { promptCostPer1kCents: 0.0075, completionCostPer1kCents: 0.03 },   // gemini-1.5-flash
      copilot: { promptCostPer1kCents: 0.015, completionCostPer1kCents: 0.06 },   // estimated
      grok: { promptCostPer1kCents: 0.5, completionCostPer1kCents: 1.5 }          // grok-2
    };

    const usage = {
      openai: { tokens: 0, costCents: 0 },
      claude: { tokens: 0, costCents: 0 },
      gemini: { tokens: 0, costCents: 0 },
      copilot: { tokens: 0, costCents: 0 },
      grok: { tokens: 0, costCents: 0 }
    };

    for (const row of result.rows) {
      const provider = row.provider.toLowerCase();
      if (usage[provider] !== undefined) {
        const tokens = parseInt(row.total_tokens) || 0;
        const promptTokens = parseInt(row.prompt_tokens) || 0;
        const completionTokens = parseInt(row.completion_tokens) || 0;

        const providerPricing = pricing[provider] || defaultPricing[provider] || { promptCostPer1kCents: 0, completionCostPer1kCents: 0 };

        // Calculate cost in cents (pricing is per 1k tokens in cents)
        // Use 4 decimal places to capture small costs accurately
        const promptCost = (promptTokens / 1000) * providerPricing.promptCostPer1kCents;
        const completionCost = (completionTokens / 1000) * providerPricing.completionCostPer1kCents;
        const totalCost = promptCost + completionCost;

        usage[provider] = {
          tokens,
          // Store cost with 4 decimal precision (e.g., 0.0121 cents)
          costCents: Math.round(totalCost * 10000) / 10000
        };
      }
    }

    return usage;
  } catch (error) {
    logger.error('Failed to get monthly usage', { error: error.message, year, month });
    return {
      openai: { tokens: 0, costCents: 0 },
      claude: { tokens: 0, costCents: 0 },
      gemini: { tokens: 0, costCents: 0 },
      copilot: { tokens: 0, costCents: 0 },
      grok: { tokens: 0, costCents: 0 }
    };
  }
}

/**
 * Update the admin_monthly_analytics table with current token usage
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 */
async function updateMonthlyAnalytics(year, month) {
  try {
    const pool = database.getPostgres();

    if (pool.mock) {
      return;
    }

    const usage = await getMonthlyUsage(year, month);

    // Update or insert the analytics record
    await pool.query(`
      INSERT INTO admin_monthly_analytics (
        analytics_year, analytics_month,
        openai_tokens_used, openai_cost_cents,
        claude_tokens_used, claude_cost_cents,
        gemini_tokens_used, gemini_cost_cents,
        copilot_tokens_used, copilot_cost_cents,
        grok_tokens_used, grok_cost_cents
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (analytics_year, analytics_month)
      DO UPDATE SET
        openai_tokens_used = EXCLUDED.openai_tokens_used,
        openai_cost_cents = EXCLUDED.openai_cost_cents,
        claude_tokens_used = EXCLUDED.claude_tokens_used,
        claude_cost_cents = EXCLUDED.claude_cost_cents,
        gemini_tokens_used = EXCLUDED.gemini_tokens_used,
        gemini_cost_cents = EXCLUDED.gemini_cost_cents,
        copilot_tokens_used = EXCLUDED.copilot_tokens_used,
        copilot_cost_cents = EXCLUDED.copilot_cost_cents,
        grok_tokens_used = EXCLUDED.grok_tokens_used,
        grok_cost_cents = EXCLUDED.grok_cost_cents,
        updated_at = NOW()
    `, [
      year, month,
      usage.openai.tokens, usage.openai.costCents,
      usage.claude.tokens, usage.claude.costCents,
      usage.gemini.tokens, usage.gemini.costCents,
      usage.copilot.tokens, usage.copilot.costCents,
      usage.grok.tokens, usage.grok.costCents
    ]);

    logger.debug('Monthly analytics updated', { year, month, usage });
  } catch (error) {
    logger.error('Failed to update monthly analytics', { error: error.message, year, month });
  }
}

module.exports = {
  recordUsage,
  getUserUsage,
  getMonthlyUsage,
  updateMonthlyAnalytics
};
