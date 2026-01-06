/**
 * Jobs Index
 * Exports all scheduled job modules
 */

const AttachmentCleanupJob = require('./AttachmentCleanupJob');
const MonthlyAnalyticsAggregationJob = require('./MonthlyAnalyticsAggregationJob');

module.exports = {
  AttachmentCleanupJob,
  MonthlyAnalyticsAggregationJob
};
