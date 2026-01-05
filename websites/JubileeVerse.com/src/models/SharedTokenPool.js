/**
 * SharedTokenPool Model
 * Manages shared token allocation for multi-user plans
 *
 * Key concepts:
 * - Primary subscriber owns the pool
 * - All plan members share the token balance
 * - Token purchases add to shared pool
 * - Usage tracked per-user for analytics
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Convert database row to pool object
 */
function rowToPool(row) {
  if (!row) return null;
  return {
    id: row.id,
    primaryUserId: row.primary_user_id,
    planType: row.plan_type,
    monthlyAllocation: row.monthly_allocation,
    currentBalance: row.current_balance,
    tokensUsedThisPeriod: row.tokens_used_this_period,
    additionalTokensPurchased: row.additional_tokens_purchased,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Joined fields
    primaryEmail: row.primary_email,
    primaryDisplayName: row.primary_display_name,
    maxUsers: row.max_users,
    activeMemberCount: row.active_member_count
  };
}

/**
 * Create a new token pool for a primary subscriber
 */
async function create(poolData) {
  const id = uuidv4();

  // Get allocation for plan type
  const limitsResult = await database.query(
    'SELECT monthly_token_limit FROM plan_type_limits WHERE plan_type = $1',
    [poolData.planType || 'standard']
  );
  const allocation = limitsResult.rows[0]?.monthly_token_limit || 50000;

  const result = await database.query(`
    INSERT INTO shared_token_pools (
      id, primary_user_id, plan_type, monthly_allocation, current_balance,
      period_start, period_end, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
    RETURNING *
  `, [
    id,
    poolData.primaryUserId,
    poolData.planType || 'standard',
    poolData.monthlyAllocation || allocation,
    poolData.currentBalance || allocation,
    poolData.periodStart || new Date(),
    poolData.periodEnd || new Date(new Date().setMonth(new Date().getMonth() + 1))
  ]);

  return rowToPool(result.rows[0]);
}

/**
 * Find pool by ID
 */
async function findById(poolId) {
  const result = await database.query(`
    SELECT stp.*, u.email as primary_email, u.display_name as primary_display_name,
           ptl.max_users,
           (SELECT COUNT(*) FROM plan_memberships pm WHERE pm.pool_id = stp.id AND pm.status = 'active') as active_member_count
    FROM shared_token_pools stp
    JOIN users u ON stp.primary_user_id = u.id
    LEFT JOIN plan_type_limits ptl ON stp.plan_type = ptl.plan_type
    WHERE stp.id = $1
  `, [poolId]);

  return rowToPool(result.rows[0]);
}

/**
 * Find pool by primary user ID
 */
async function findByPrimaryUser(userId) {
  const result = await database.query(`
    SELECT stp.*, u.email as primary_email, u.display_name as primary_display_name,
           ptl.max_users,
           (SELECT COUNT(*) FROM plan_memberships pm WHERE pm.pool_id = stp.id AND pm.status = 'active') as active_member_count
    FROM shared_token_pools stp
    JOIN users u ON stp.primary_user_id = u.id
    LEFT JOIN plan_type_limits ptl ON stp.plan_type = ptl.plan_type
    WHERE stp.primary_user_id = $1 AND stp.is_active = TRUE
  `, [userId]);

  return rowToPool(result.rows[0]);
}

/**
 * Find pool for any user (primary or associated)
 */
async function findByUserId(userId) {
  const result = await database.query(`
    SELECT stp.*, u.email as primary_email, u.display_name as primary_display_name,
           ptl.max_users,
           (SELECT COUNT(*) FROM plan_memberships pm WHERE pm.pool_id = stp.id AND pm.status = 'active') as active_member_count
    FROM shared_token_pools stp
    JOIN users u ON stp.primary_user_id = u.id
    LEFT JOIN plan_type_limits ptl ON stp.plan_type = ptl.plan_type
    JOIN plan_memberships pm ON stp.id = pm.pool_id
    WHERE pm.user_id = $1 AND pm.status = 'active' AND stp.is_active = TRUE
    LIMIT 1
  `, [userId]);

  return rowToPool(result.rows[0]);
}

/**
 * Get current token balance
 */
async function getBalance(poolId) {
  const result = await database.query(
    'SELECT current_balance, monthly_allocation, tokens_used_this_period FROM shared_token_pools WHERE id = $1',
    [poolId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    currentBalance: row.current_balance,
    monthlyAllocation: row.monthly_allocation,
    tokensUsed: row.tokens_used_this_period,
    percentUsed: Math.round((row.tokens_used_this_period / row.monthly_allocation) * 100)
  };
}

/**
 * Deduct tokens from pool (uses database function for atomicity)
 */
async function deductTokens(poolId, userId, tokens, usageType = 'chat', conversationId = null, messageId = null) {
  const result = await database.query(
    'SELECT deduct_pool_tokens($1, $2, $3, $4, $5, $6) as success',
    [poolId, userId, tokens, usageType, conversationId, messageId]
  );

  return result.rows[0]?.success === true;
}

/**
 * Check if pool has sufficient tokens
 */
async function hasSufficientTokens(poolId, tokensNeeded) {
  const result = await database.query(
    'SELECT current_balance >= $2 as has_tokens FROM shared_token_pools WHERE id = $1',
    [poolId, tokensNeeded]
  );

  return result.rows[0]?.has_tokens === true;
}

/**
 * Add purchased tokens (uses database function)
 */
async function addPurchasedTokens(poolId, purchaserId, tokens, amountCents, paymentMethodId = null, stripeIntentId = null) {
  const result = await database.query(
    'SELECT add_purchased_tokens($1, $2, $3, $4, $5, $6) as purchase_id',
    [poolId, purchaserId, tokens, amountCents, paymentMethodId, stripeIntentId]
  );

  return result.rows[0]?.purchase_id;
}

/**
 * Reset pool for new billing period
 */
async function resetPeriod(poolId) {
  await database.query('SELECT reset_pool_period($1)', [poolId]);
  return findById(poolId);
}

/**
 * Update plan type and allocation
 */
async function updatePlanType(poolId, newPlanType) {
  // Get new allocation
  const limitsResult = await database.query(
    'SELECT monthly_token_limit FROM plan_type_limits WHERE plan_type = $1',
    [newPlanType]
  );
  const newAllocation = limitsResult.rows[0]?.monthly_token_limit || 50000;

  const result = await database.query(`
    UPDATE shared_token_pools
    SET plan_type = $2,
        monthly_allocation = $3,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [poolId, newPlanType, newAllocation]);

  return rowToPool(result.rows[0]);
}

/**
 * Deactivate a pool
 */
async function deactivate(poolId) {
  const result = await database.query(`
    UPDATE shared_token_pools
    SET is_active = FALSE, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [poolId]);

  return rowToPool(result.rows[0]);
}

/**
 * Get token usage history for pool
 */
async function getUsageHistory(poolId, options = {}) {
  const { limit = 100, offset = 0, userId = null, startDate = null, endDate = null } = options;

  let query = `
    SELECT tul.*, u.email as user_email, u.display_name as user_display_name
    FROM token_usage_log tul
    JOIN users u ON tul.user_id = u.id
    WHERE tul.pool_id = $1
  `;
  const params = [poolId];
  let paramIndex = 2;

  if (userId) {
    query += ` AND tul.user_id = $${paramIndex++}`;
    params.push(userId);
  }

  if (startDate) {
    query += ` AND tul.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND tul.created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  query += ` ORDER BY tul.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  const result = await database.query(query, params);

  return result.rows.map(row => ({
    id: row.id,
    poolId: row.pool_id,
    userId: row.user_id,
    tokensUsed: row.tokens_used,
    usageType: row.usage_type,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    createdAt: row.created_at,
    userEmail: row.user_email,
    userDisplayName: row.user_display_name
  }));
}

/**
 * Get usage summary by user
 */
async function getUsageByUser(poolId, periodStart = null) {
  const start = periodStart || new Date(new Date().setDate(1)); // First of current month

  const result = await database.query(`
    SELECT
      tul.user_id,
      u.email,
      u.display_name,
      SUM(tul.tokens_used) as total_tokens,
      COUNT(*) as request_count,
      MAX(tul.created_at) as last_usage
    FROM token_usage_log tul
    JOIN users u ON tul.user_id = u.id
    WHERE tul.pool_id = $1 AND tul.created_at >= $2
    GROUP BY tul.user_id, u.email, u.display_name
    ORDER BY total_tokens DESC
  `, [poolId, start]);

  return result.rows.map(row => ({
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    totalTokens: parseInt(row.total_tokens),
    requestCount: parseInt(row.request_count),
    lastUsage: row.last_usage
  }));
}

/**
 * Get purchase history
 */
async function getPurchaseHistory(poolId, options = {}) {
  const { limit = 50, offset = 0 } = options;

  const result = await database.query(`
    SELECT tp.*, u.email as purchaser_email, u.display_name as purchaser_name
    FROM token_purchases tp
    JOIN users u ON tp.purchased_by = u.id
    WHERE tp.pool_id = $1
    ORDER BY tp.created_at DESC
    LIMIT $2 OFFSET $3
  `, [poolId, limit, offset]);

  return result.rows.map(row => ({
    id: row.id,
    poolId: row.pool_id,
    purchasedBy: row.purchased_by,
    tokensPurchased: row.tokens_purchased,
    amountPaidCents: row.amount_paid_cents,
    currency: row.currency,
    paymentMethodId: row.payment_method_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    createdAt: row.created_at,
    purchaserEmail: row.purchaser_email,
    purchaserName: row.purchaser_name
  }));
}

/**
 * Get pool summary with all relevant info
 */
async function getPoolSummary(poolId) {
  const pool = await findById(poolId);
  if (!pool) return null;

  const balance = await getBalance(poolId);
  const usageByUser = await getUsageByUser(poolId);

  const memberResult = await database.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') as active_members,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_members,
      COUNT(*) FILTER (WHERE role = 'primary') as primary_count,
      COUNT(*) FILTER (WHERE role = 'associated') as associated_count
    FROM plan_memberships
    WHERE pool_id = $1
  `, [poolId]);

  const limits = await database.query(
    'SELECT * FROM plan_type_limits WHERE plan_type = $1',
    [pool.planType]
  );

  return {
    pool,
    balance,
    limits: limits.rows[0],
    members: memberResult.rows[0],
    usageByUser
  };
}

/**
 * Check if user can purchase tokens for pool
 */
async function canUserPurchaseTokens(poolId, userId) {
  // Only primary owner can purchase
  const result = await database.query(`
    SELECT stp.primary_user_id = $2 as is_primary,
           ptl.can_purchase_additional_tokens as can_purchase
    FROM shared_token_pools stp
    JOIN plan_type_limits ptl ON stp.plan_type = ptl.plan_type
    WHERE stp.id = $1
  `, [poolId, userId]);

  if (result.rows.length === 0) return false;

  const row = result.rows[0];
  return row.is_primary && row.can_purchase;
}

module.exports = {
  create,
  findById,
  findByPrimaryUser,
  findByUserId,
  getBalance,
  deductTokens,
  hasSufficientTokens,
  addPurchasedTokens,
  resetPeriod,
  updatePlanType,
  deactivate,
  getUsageHistory,
  getUsageByUser,
  getPurchaseHistory,
  getPoolSummary,
  canUserPurchaseTokens
};
