const express = require('express');
const { query } = require('express-validator');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// Protect all analytics endpoints with JWT authentication
router.use(authMiddleware);

/**
 * Helper to build date range filters for analytics queries
 */
function buildDateRangeFilter(from, to, tableAlias = 'f') {
  const conditions = [];
  const values = [];

  if (from) {
    values.push(from);
    conditions.push(`${tableAlias}.created_at >= $${values.length}`);
  }

  if (to) {
    values.push(to);
    conditions.push(`${tableAlias}.created_at <= $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, values };
}

/**
 * GET /api/analytics/summary
 * Returns overall statistics filtered by optional date range
 */
router.get(
  '/summary',
  [
    query('from').optional().isISO8601().withMessage('from must be a valid ISO 8601 date'),
    query('to').optional().isISO8601().withMessage('to must be a valid ISO 8601 date'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { from, to } = req.query;
      const { whereClause, values } = buildDateRangeFilter(from, to, 'f');

      const summaryQuery = `
        SELECT 
          COUNT(f.id)::int AS total_feedback,
          ROUND(COALESCE(AVG(f.rating), 0), 2)::float AS average_rating,
          COUNT(CASE WHEN ar.sentiment = 'positive' THEN 1 END)::int AS positive_count,
          COUNT(CASE WHEN ar.sentiment = 'neutral' THEN 1 END)::int AS neutral_count,
          COUNT(CASE WHEN ar.sentiment = 'negative' THEN 1 END)::int AS negative_count,
          COUNT(CASE WHEN q.status = 'pending' THEN 1 END)::int AS pending_analysis,
          COUNT(CASE WHEN q.status = 'failed' THEN 1 END)::int AS failed_analysis
        FROM feedback f
        LEFT JOIN analysis_results ar ON f.id = ar.feedback_id
        LEFT JOIN analysis_queue q ON f.id = q.feedback_id
        ${whereClause}
      `;

      const { rows } = await db.query(summaryQuery, values);
      const summary = rows[0];

      return res.json({
        totalFeedback: summary.total_feedback,
        averageRating: summary.average_rating,
        sentimentCounts: {
          positive: summary.positive_count,
          neutral: summary.neutral_count,
          negative: summary.negative_count,
        },
        pendingAnalysis: summary.pending_analysis,
        failedAnalysis: summary.failed_analysis,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/analytics/trend
 * Returns sentiment distribution aggregated over time intervals (day, week, month)
 */
router.get(
  '/trend',
  [
    query('interval')
      .optional()
      .isIn(['day', 'week', 'month'])
      .withMessage('Interval must be day, week, or month'),
    query('from').optional().isISO8601().withMessage('from must be a valid ISO 8601 date'),
    query('to').optional().isISO8601().withMessage('to must be a valid ISO 8601 date'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const interval = req.query.interval || 'day';
      const { from, to } = req.query;

      const allowedIntervals = { day: 'day', week: 'week', month: 'month' };
      const truncatedUnit = allowedIntervals[interval] || 'day';

      const { whereClause, values } = buildDateRangeFilter(from, to, 'f');

      const trendQuery = `
        SELECT 
          date_trunc('${truncatedUnit}', f.created_at) AS date,
          COUNT(f.id)::int AS total,
          COUNT(CASE WHEN ar.sentiment = 'positive' THEN 1 END)::int AS positive,
          COUNT(CASE WHEN ar.sentiment = 'neutral' THEN 1 END)::int AS neutral,
          COUNT(CASE WHEN ar.sentiment = 'negative' THEN 1 END)::int AS negative
        FROM feedback f
        LEFT JOIN analysis_results ar ON f.id = ar.feedback_id
        ${whereClause}
        GROUP BY date
        ORDER BY date ASC
      `;

      const { rows } = await db.query(trendQuery, values);
      return res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/analytics/categories
 * Returns feedback distribution per category split by positive, neutral, and negative sentiment
 */
router.get(
  '/categories',
  [
    query('from').optional().isISO8601().withMessage('from must be a valid ISO 8601 date'),
    query('to').optional().isISO8601().withMessage('to must be a valid ISO 8601 date'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { from, to } = req.query;
      const { whereClause, values } = buildDateRangeFilter(from, to, 'f');

      const categoryQuery = `
        SELECT 
          c.id,
          c.name AS category,
          COUNT(ar.id)::int AS total,
          COUNT(CASE WHEN ar.sentiment = 'positive' THEN 1 END)::int AS positive,
          COUNT(CASE WHEN ar.sentiment = 'neutral' THEN 1 END)::int AS neutral,
          COUNT(CASE WHEN ar.sentiment = 'negative' THEN 1 END)::int AS negative
        FROM categories c
        LEFT JOIN (
          SELECT ar.id, ar.category_id, ar.sentiment
          FROM analysis_results ar
          JOIN feedback f ON ar.feedback_id = f.id
          ${whereClause}
        ) ar ON c.id = ar.category_id
        GROUP BY c.id, c.name
        ORDER BY total DESC, c.name ASC
      `;

      const { rows } = await db.query(categoryQuery, values);
      return res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/analytics/keywords
 * Returns top 50 keywords extracted from feedback comments using PostgreSQL unnest
 */
router.get(
  '/keywords',
  [
    query('from').optional().isISO8601().withMessage('from must be a valid ISO 8601 date'),
    query('to').optional().isISO8601().withMessage('to must be a valid ISO 8601 date'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { from, to } = req.query;
      const { whereClause, values } = buildDateRangeFilter(from, to, 'f');

      const keywordsQuery = `
        SELECT 
          LOWER(TRIM(kw)) AS keyword,
          COUNT(*)::int AS count
        FROM (
          SELECT unnest(ar.keywords) AS kw
          FROM analysis_results ar
          JOIN feedback f ON ar.feedback_id = f.id
          ${whereClause}
        ) unnested_keywords
        WHERE kw IS NOT NULL AND TRIM(kw) <> ''
        GROUP BY LOWER(TRIM(kw))
        ORDER BY count DESC, keyword ASC
        LIMIT 50
      `;

      const { rows } = await db.query(keywordsQuery, values);
      return res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
